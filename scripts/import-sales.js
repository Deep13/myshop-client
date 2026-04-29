#!/usr/bin/env node
/**
 * Import sales data from src/assets/SaleReport_*.xlsx into the LOCAL myshop DB.
 * Two sheets:
 *   - "Sale Report"    → invoices  + invoice_payments
 *   - "Item Details"   → invoice_items
 *
 * Generates db-backup/import_sales.sql; run it against local mysql:
 *   "C:/xampp/mysql/bin/mysql.exe" -u root myshop < db-backup/import_sales.sql
 */

import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ""), "..");
const xlsxPath = path.join(root, "src/assets/SaleReport_01_08_25_to_29_04_26.xlsx");
const outSql   = path.join(root, "db-backup/import_sales.sql");

console.error("Reading", xlsxPath);
const wb = XLSX.readFile(xlsxPath);

const saleRows = XLSX.utils.sheet_to_json(wb.Sheets["Sale Report"], { header: 1, defval: "" });
const itemRows = XLSX.utils.sheet_to_json(wb.Sheets["Item Details"], { header: 1, defval: "" });

/* ── Helpers ──────────────────────────────────────────────────── */
const sqlEsc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/'/g, "''");
const num    = (v) => { const n = parseFloat(String(v ?? "").replace(/[, ]/g, "")); return isFinite(n) ? n : 0; };

// "DD/MM/YYYY" → "YYYY-MM-DD"; also handles Excel serial numbers
function parseDate(v) {
  if (typeof v === "number") {
    // Excel epoch: days since 1899-12-30
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) return null;
  let [, dd, mm, yy] = m;
  if (yy.length === 2) yy = "20" + yy;
  return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

/* ── Locate header rows in each sheet ─────────────────────────── */
function findHeaderRow(rows, wantHeaders) {
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const r = rows[i].map((c) => String(c).trim());
    if (wantHeaders.every((h) => r.includes(h))) return i;
  }
  return -1;
}

const saleHeaderIdx = findHeaderRow(saleRows, ["Date", "Invoice No", "Total Amount"]);
const itemHeaderIdx = findHeaderRow(itemRows, ["Date", "Invoice No./Txn No.", "Item Name"]);
if (saleHeaderIdx < 0 || itemHeaderIdx < 0) {
  console.error("Could not find header rows", { saleHeaderIdx, itemHeaderIdx });
  process.exit(1);
}

const saleHdr = saleRows[saleHeaderIdx].map((c) => String(c).trim());
const itemHdr = itemRows[itemHeaderIdx].map((c) => String(c).trim());

const colIdx = (hdr, name) => hdr.indexOf(name);
const saleCol = (n) => colIdx(saleHdr, n);
const itemCol = (n) => colIdx(itemHdr, n);

const SC = {
  date:   saleCol("Date"),
  invNo:  saleCol("Invoice No"),
  party:  saleCol("Party Name"),
  gstin:  saleCol("GSTIN"),
  phone:  saleCol("Party Phone No."),
  type:   saleCol("Transaction Type"),
  total:  saleCol("Total Amount"),
  payType:saleCol("Payment Type"),
  recvd:  saleCol("Received/Paid Amount"),
  bal:    saleCol("Balance Due"),
  desc:   saleCol("Description"),
  cash:   saleCol("Cash"),
  cheque: saleCol("Cheque"),
  bank:   saleHdr.findIndex((h) => /GANGA|UPI|Bank/i.test(h) && h !== "Cash" && h !== "Cheque"),
};
const IC = {
  date:   itemCol("Date"),
  invNo:  itemCol("Invoice No./Txn No."),
  party:  itemCol("Party Name"),
  name:   itemCol("Item Name"),
  code:   itemCol("Item Code"),
  hsn:    itemCol("HSN/SAC"),
  batch:  itemCol("Batch No."),
  exp:    itemCol("Exp. Date"),
  qty:    itemCol("Quantity"),
  price:  itemCol("UnitPrice"),
  discPct:itemCol("Discount Percent"),
  disc:   itemCol("Discount"),
  taxPct: itemCol("Tax Percent"),
  tax:    itemCol("Tax"),
  type:   itemCol("Transaction Type"),
  amount: itemCol("Amount"),
};

/* ── Parse invoices ───────────────────────────────────────────── */
const invoices = [];
const invByNo  = new Map();
let skippedSale = 0;
for (let i = saleHeaderIdx + 1; i < saleRows.length; i++) {
  const r = saleRows[i];
  if (!r) continue;
  const txnType = String(r[SC.type] || "").trim();
  if (!/^Sale\b/i.test(txnType)) { if (txnType) skippedSale++; continue; }
  const invNo = String(r[SC.invNo] ?? "").trim();
  const date  = parseDate(r[SC.date]);
  if (!invNo || !date) { skippedSale++; continue; }
  if (invByNo.has(invNo)) { skippedSale++; continue; } // dedupe
  const total = num(r[SC.total]);
  const recv  = num(r[SC.recvd]);
  const bal   = num(r[SC.bal]);
  const cash  = num(r[SC.cash]);
  const cheq  = num(r[SC.cheque]);
  const bank  = SC.bank >= 0 ? num(r[SC.bank]) : 0;
  const inv = {
    invoice_no: invNo,
    invoice_date: date,
    customer_name: String(r[SC.party] || "Cash Sale").trim() || "Cash Sale",
    customer_type: /cash sale/i.test(String(r[SC.party])) ? "Cash" : "Credit",
    phone: String(r[SC.phone] || "").trim(),
    customer_gstin: String(r[SC.gstin] || "").trim(),
    subtotal: total,                  // best approximation; tax is per-line
    bill_discount: "",
    bill_discount_value: 0,
    final_total: total,
    round_off_enabled: 1,
    rounded_final_total: total,
    round_off_diff: 0,
    received: recv,
    balance: bal,
    cash, cheq, bank,
    items: [],
  };
  invoices.push(inv);
  invByNo.set(invNo, inv);
}

/* ── Parse items, attach to invoices by Invoice No ────────────── */
let attachedItems = 0, orphanItems = 0;
for (let i = itemHeaderIdx + 1; i < itemRows.length; i++) {
  const r = itemRows[i];
  if (!r) continue;
  const name = String(r[IC.name] || "").trim();
  if (!name) continue;
  const txnType = String(r[IC.type] || "").trim();
  if (txnType && !/^Sale\b/i.test(txnType)) continue;
  const invNo = String(r[IC.invNo] ?? "").trim();
  const inv   = invByNo.get(invNo);
  if (!inv) { orphanItems++; continue; }
  const qty   = num(r[IC.qty]);
  const price = num(r[IC.price]);
  const tax   = num(r[IC.taxPct]);
  const disc  = num(r[IC.disc]);
  const amt   = num(r[IC.amount]);
  inv.items.push({
    item_name: name,
    item_code: String(r[IC.code] || "").trim(),
    hsn:       String(r[IC.hsn]  || "").trim(),
    batch_no:  String(r[IC.batch]|| "").trim(),
    exp_date:  parseDate(r[IC.exp]),
    qty, price,
    discount:  String(disc || ""),
    tax,
    amount:    amt,
    gst_flag:  tax > 0 ? 1 : 0,
  });
  attachedItems++;
}

console.error(`Invoices: ${invoices.length}, items attached: ${attachedItems}, orphan items: ${orphanItems}, skipped sale rows: ${skippedSale}`);

/* ── Build SQL ────────────────────────────────────────────────── */
const sql = [];
sql.push("-- Auto-generated by scripts/import-sales.js");
sql.push("-- Bulk import of historical sales into LOCAL myshop DB only.");
sql.push("SET autocommit=0;");
sql.push("SET FOREIGN_KEY_CHECKS=0;");
sql.push("START TRANSACTION;");

const CHUNK = 200;

// Insert invoices in chunks. Use placeholder created_by=1.
for (let i = 0; i < invoices.length; i += CHUNK) {
  const slice = invoices.slice(i, i + CHUNK);
  const values = slice.map((v) => `(`
    + `'${sqlEsc(v.invoice_no)}',`
    + `'${v.invoice_date}',`
    + `'${sqlEsc(v.customer_type)}',`
    + `'${sqlEsc(v.customer_name)}',`
    + `'${sqlEsc(v.phone)}',`
    + `'${sqlEsc(v.customer_gstin)}',`
    + `${v.subtotal.toFixed(2)},`
    + `'${sqlEsc(v.bill_discount)}',`
    + `${v.bill_discount_value.toFixed(2)},`
    + `${v.final_total.toFixed(2)},`
    + `${v.round_off_enabled},`
    + `${v.rounded_final_total.toFixed(2)},`
    + `${v.round_off_diff.toFixed(2)},`
    + `${v.received.toFixed(2)},`
    + `${v.balance.toFixed(2)},`
    + `1`
    + `)`).join(",\n");
  sql.push(`INSERT INTO invoices (invoice_no, invoice_date, customer_type, customer_name, phone, customer_gstin, subtotal, bill_discount, bill_discount_value, final_total, round_off_enabled, rounded_final_total, round_off_diff, received, balance, created_by) VALUES\n${values};`);
}

// Now build items + payments using the inserted invoice ids.
// MariaDB supports CTE/JOIN approach; simpler: re-look up id by invoice_no per chunk via subquery.
// We'll insert items and payments grouped per invoice for clarity.
sql.push("-- Items + Payments (joined by invoice_no)");

// To avoid tens of thousands of subqueries, build a temporary mapping.
sql.push("CREATE TEMPORARY TABLE _inv_map (invoice_no VARCHAR(50) PRIMARY KEY, id BIGINT);");
sql.push("INSERT INTO _inv_map (invoice_no, id) SELECT invoice_no, id FROM invoices;");

// Items
const allItems = [];
for (const inv of invoices) {
  for (const it of inv.items) allItems.push({ ...it, invoice_no: inv.invoice_no });
}

for (let i = 0; i < allItems.length; i += CHUNK) {
  const slice = allItems.slice(i, i + CHUNK);
  const values = slice.map((it) => `(`
    + `(SELECT id FROM _inv_map WHERE invoice_no='${sqlEsc(it.invoice_no)}'),`
    + `'${sqlEsc(it.item_name)}',`
    + `'${sqlEsc(it.item_code)}',`
    + `'${sqlEsc(it.hsn)}',`
    + `'${sqlEsc(it.batch_no)}',`
    + `${it.exp_date ? `'${it.exp_date}'` : "NULL"},`
    + `0,` // mrp not in sheet
    + `${it.qty.toFixed(2)},`
    + `${it.price.toFixed(2)},`
    + `'${sqlEsc(it.discount)}',`
    + `${it.tax.toFixed(2)},`
    + `${it.amount.toFixed(2)},`
    + `${it.gst_flag}`
    + `)`).join(",\n");
  sql.push(`INSERT INTO invoice_items (invoice_id, item_name, item_code, hsn, batch_no, exp_date, mrp, qty, price, discount, tax, amount, gst_flag) VALUES\n${values};`);
}

// Payments — emit one row per non-zero channel
const payments = [];
for (const inv of invoices) {
  if (inv.cash > 0)  payments.push({ invoice_no: inv.invoice_no, type: "Cash",  amt: inv.cash });
  if (inv.cheq > 0)  payments.push({ invoice_no: inv.invoice_no, type: "Cheque",amt: inv.cheq });
  if (inv.bank > 0)  payments.push({ invoice_no: inv.invoice_no, type: "UPI",   amt: inv.bank });
  // Fallback: if none of the above but received > 0
  if (inv.cash === 0 && inv.cheq === 0 && inv.bank === 0 && inv.received > 0) {
    payments.push({ invoice_no: inv.invoice_no, type: "Other", amt: inv.received });
  }
}

for (let i = 0; i < payments.length; i += CHUNK) {
  const slice = payments.slice(i, i + CHUNK);
  const values = slice.map((p) => `(`
    + `(SELECT id FROM _inv_map WHERE invoice_no='${sqlEsc(p.invoice_no)}'),`
    + `'${sqlEsc(p.type)}',`
    + `${p.amt.toFixed(2)}`
    + `)`).join(",\n");
  sql.push(`INSERT INTO invoice_payments (invoice_id, pay_type, amount) VALUES\n${values};`);
}

sql.push("DROP TEMPORARY TABLE _inv_map;");
sql.push("SET FOREIGN_KEY_CHECKS=1;");
sql.push("COMMIT;");

fs.writeFileSync(outSql, sql.join("\n"));
console.error(`Wrote ${outSql} (${invoices.length} invoices, ${allItems.length} items, ${payments.length} payments)`);
