/**
 * Import SaleReport.xlsx into the database.
 * - Sale Report sheet → invoices + invoice_payments
 * - Item Details sheet → invoice_items
 *
 * Usage: node deploy/import_sales.cjs
 * Output: deploy/import_sales.sql
 */

const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const wb = XLSX.readFile(path.join(__dirname, "../src/assets/SaleReport.xlsx"));

// ── 1. Parse Sale Report (invoice headers)
const saleSheet = XLSX.utils.sheet_to_json(wb.Sheets["Sale Report"], { header: 1, defval: "" });
// Row 2 = headers: Date, Order No, Invoice No, Party Name, GSTIN, Party Phone No., Transaction Type, Total Amount, Payment Type, Received/Paid Amount, Balance Due, Description

const invoiceMap = {}; // invoiceNo → header data
for (let i = 3; i < saleSheet.length; i++) {
  const row = saleSheet[i];
  const invoiceNo = String(row[2] || "").trim();
  if (!invoiceNo) continue;

  const rawDate = String(row[0] || "").trim();
  // Convert DD/MM/YYYY → YYYY-MM-DD
  let invoiceDate = "";
  const dm = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dm) invoiceDate = `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;

  const partyName = String(row[3] || "Cash Sale").trim();
  const gstin = String(row[4] || "").trim();
  const phone = String(row[5] || "").trim();
  const totalAmount = Number(row[7]) || 0;
  const payTypeRaw = String(row[8] || "Cash").trim();
  const received = Number(row[9]) || 0;
  const balance = Number(row[10]) || 0;

  // Map payment types
  // "GANGA INSTAMART" → UPI, "Cash, GANGA INSTAMART" → split
  const mapPayType = (pt) => {
    if (pt === "GANGA INSTAMART") return "UPI";
    if (pt === "Cash") return "Cash";
    if (pt === "Cheque") return "Cheque";
    return "UPI";
  };

  // Parse split payments
  const payments = [];
  if (payTypeRaw.includes(",")) {
    // Split payment — we only have total received, split evenly (best we can do)
    const parts = payTypeRaw.split(",").map((p) => p.trim());
    const perPart = received / parts.length;
    for (const p of parts) {
      payments.push({ type: mapPayType(p), amount: Math.round(perPart * 100) / 100 });
    }
  } else {
    payments.push({ type: mapPayType(payTypeRaw), amount: received });
  }

  const custName = partyName === "Cash Sale" ? "Cash" : partyName;
  const custType = partyName === "Cash Sale" ? "Retail" : "Credit";

  invoiceMap[invoiceNo] = {
    invoiceNo, invoiceDate, custType, custName, gstin, phone,
    totalAmount, received, balance, payments,
  };
}
console.log(`Sale Report: ${Object.keys(invoiceMap).length} invoices`);

// ── 2. Parse Item Details (line items)
const itemSheet = XLSX.utils.sheet_to_json(wb.Sheets["Item Details"], { header: 1, defval: "" });
// Row 2 = headers: Date, Invoice No, Party Name, Item Name, Item Code, HSN/SAC, Category, Batch No., Exp. Date, Challan, Size, Quantity, Unit, UnitPrice, Discount Percent, Discount, Tax Percent, Tax, Transaction Type, Amount

const itemsByInvoice = {}; // invoiceNo → [items]
for (let i = 4; i < itemSheet.length; i++) {
  const row = itemSheet[i];
  const invoiceNo = String(row[1] || "").trim();
  if (!invoiceNo) continue;

  const itemName = String(row[3] || "").trim();
  if (!itemName) continue;

  const itemCode = String(row[4] || "").trim();
  const hsn = String(row[5] || "").trim();
  const batchNo = String(row[7] || "").trim();
  const rawExp = String(row[8] || "").trim();
  let expDate = "";
  const em = rawExp.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (em) expDate = `${em[3]}-${em[2].padStart(2, "0")}-${em[1].padStart(2, "0")}`;

  const qty = Number(row[11]) || 0;
  const unitPrice = Number(row[13]) || 0; // sale price (tax-inclusive)
  const discPct = Number(row[14]) || 0;
  const taxPct = Number(row[16]) || 0;
  const amount = Number(row[19]) || 0;
  const mrp = unitPrice; // best guess — unit price as MRP

  if (!itemsByInvoice[invoiceNo]) itemsByInvoice[invoiceNo] = [];
  itemsByInvoice[invoiceNo].push({
    itemName, itemCode, hsn, batchNo, expDate,
    mrp, qty, price: unitPrice, discount: discPct > 0 ? String(discPct) : "0",
    tax: taxPct, amount,
  });
}
console.log(`Item Details: ${Object.keys(itemsByInvoice).length} invoices with items`);

// ── 3. Generate SQL
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

let sql = `-- MyShop Sales Import from SaleReport.xlsx
-- Generated: ${new Date().toISOString()}
-- Invoices: ${Object.keys(invoiceMap).length}

SET NAMES utf8mb4;
SET @old_fk = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

`;

let invoiceCount = 0;
let itemCount = 0;
let paymentCount = 0;

for (const [invNo, inv] of Object.entries(invoiceMap)) {
  const items = itemsByInvoice[invNo];
  if (!items || !items.length) continue; // skip invoices with no line items

  // Calculate totals from items
  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const roundedTotal = Math.round(subtotal);
  const roundDiff = roundedTotal - subtotal;

  sql += `-- Invoice ${invNo}\n`;
  sql += `INSERT INTO invoices (invoice_no, invoice_date, customer_type, customer_name, phone, customer_gstin,
  subtotal, bill_discount, bill_discount_value, final_total,
  round_off_enabled, rounded_final_total, round_off_diff, received, balance)
VALUES ('${esc(invNo)}', '${esc(inv.invoiceDate)}', '${esc(inv.custType)}', '${esc(inv.custName)}', '${esc(inv.phone)}', '${esc(inv.gstin)}',
  ${subtotal.toFixed(2)}, '', 0, ${subtotal.toFixed(2)},
  1, ${roundedTotal.toFixed(2)}, ${roundDiff.toFixed(2)}, ${inv.received.toFixed(2)}, ${inv.balance.toFixed(2)});\n`;
  sql += `SET @inv_id = LAST_INSERT_ID();\n`;

  // Items
  for (const it of items) {
    const expVal = it.expDate ? `'${esc(it.expDate)}'` : "NULL";
    sql += `INSERT INTO invoice_items (invoice_id, item_name, item_code, hsn, batch_no, exp_date, mrp, qty, price, discount, tax, amount, gst_flag)
VALUES (@inv_id, '${esc(it.itemName)}', '${esc(it.itemCode)}', '${esc(it.hsn)}', '${esc(it.batchNo)}', ${expVal}, ${it.mrp}, ${it.qty}, ${it.price}, '${esc(it.discount)}', ${it.tax}, ${it.amount}, 1);\n`;
    itemCount++;
  }

  // Payments
  for (const p of inv.payments) {
    if (p.amount <= 0) continue;
    sql += `INSERT INTO invoice_payments (invoice_id, pay_type, amount) VALUES (@inv_id, '${esc(p.type)}', ${p.amount.toFixed(2)});\n`;
    paymentCount++;
  }

  sql += "\n";
  invoiceCount++;
}

sql += `SET FOREIGN_KEY_CHECKS = @old_fk;\n`;

const outPath = path.join(__dirname, "import_sales.sql");
fs.writeFileSync(outPath, sql, "utf8");

console.log(`\nGenerated:`);
console.log(`  Invoices: ${invoiceCount}`);
console.log(`  Line items: ${itemCount}`);
console.log(`  Payments: ${paymentCount}`);
console.log(`\nSQL written to: ${outPath}`);
console.log(`\nTo import: mysql -u root myshop < deploy/import_sales.sql`);
