/**
 * Merge three Excel files:
 *   1. StockDetailReport  → Item Code + Item Name (base — ALL items kept)
 *   2. StockSummaryReport → Item Name + Sale Price + Purchase Price
 *   3. Sale Summary By HSN (Item Details sheet) → Item Name + HSN + CGST + SGST → GST%
 *
 * Output: deploy/import_stock.sql + deploy/import_stock_preview.csv
 * Usage: node deploy/import_stock.cjs
 */

const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const assetsDir = path.join(__dirname, "../src/assets");

// ── 1. StockDetailReport: Item Code + Item Name
const wb1 = XLSX.readFile(path.join(assetsDir, "StockDetailReport.xlsx"));
const ws1 = wb1.Sheets[wb1.SheetNames[0]];
const detailRows = XLSX.utils.sheet_to_json(ws1, { header: 1, defval: "" });

const allItems = [];
const seenCodes = new Set();
for (let i = 1; i < detailRows.length; i++) {
  const code = String(detailRows[i][0] || "").trim();
  const name = String(detailRows[i][1] || "").trim();
  if (!name || !code || seenCodes.has(code)) continue;
  seenCodes.add(code);
  allItems.push({ code, name, salePrice: 0, purchasePrice: 0, mrp: 0, hsn: "", tax: 0 });
}
console.log(`1. StockDetailReport: ${allItems.length} unique items (base)`);

// ── 2. StockSummaryReport: Item Name + Sale Price + Purchase Price
const wb2 = XLSX.readFile(path.join(assetsDir, "StockSummaryReport.xlsx"));
const ws2 = wb2.Sheets[wb2.SheetNames[0]];
const summaryRows = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: "" });

const priceMap = {};
for (let i = 4; i < summaryRows.length; i++) {
  const name = String(summaryRows[i][0] || "").trim();
  const salePrice = Number(summaryRows[i][1]) || 0;
  const purchasePrice = Number(summaryRows[i][2]) || 0;
  if (!name) continue;
  const key = name.toLowerCase().replace(/\s+/g, " ");
  priceMap[key] = { salePrice, purchasePrice };
}
console.log(`2. StockSummaryReport: ${Object.keys(priceMap).length} items`);

// ── 3. Sale Summary By HSN → Item Details sheet
const wb3 = XLSX.readFile(path.join(assetsDir, "Sale Summary By HSN.xlsx"));
const ws3 = wb3.Sheets["Item Details"];
const hsnRows = XLSX.utils.sheet_to_json(ws3, { header: 1, defval: "" });

const hsnMap = {};
for (let i = 2; i < hsnRows.length; i++) {
  const hsn = String(hsnRows[i][0] || "").trim();
  const name = String(hsnRows[i][1] || "").trim();
  const taxableValue = Number(hsnRows[i][4]) || 0;
  const cgst = Number(hsnRows[i][6]) || 0;
  const sgst = Number(hsnRows[i][7]) || 0;
  if (!name || !hsn) continue;

  let taxPct = 0;
  if (taxableValue > 0 && (cgst + sgst) > 0) {
    taxPct = ((cgst + sgst) / taxableValue) * 100;
    // Round to nearest standard GST slab: 0, 5, 12, 18, 28
    const slabs = [0, 5, 12, 18, 28];
    taxPct = slabs.reduce((best, slab) => Math.abs(slab - taxPct) < Math.abs(best - taxPct) ? slab : best, 0);
  }

  const key = name.toLowerCase().replace(/\s+/g, " ");
  if (!hsnMap[key]) hsnMap[key] = { hsn, taxPct };
}
console.log(`3. Sale Summary By HSN: ${Object.keys(hsnMap).length} items`);

// ── Merge
let priceMatched = 0, hsnMatched = 0;
for (const item of allItems) {
  const key = item.name.toLowerCase().replace(/\s+/g, " ");
  const price = priceMap[key];
  if (price) {
    item.salePrice = price.salePrice;
    item.purchasePrice = price.purchasePrice;
    item.mrp = price.salePrice;
    priceMatched++;
  }
  const hsn = hsnMap[key];
  if (hsn) {
    item.hsn = hsn.hsn;
    item.tax = hsn.taxPct;
    hsnMatched++;
  }
}

console.log(`\nMerge results:`);
console.log(`  Total items: ${allItems.length}`);
console.log(`  Price matched: ${priceMatched}`);
console.log(`  HSN+GST matched: ${hsnMatched}`);
console.log(`  No price: ${allItems.length - priceMatched}`);
console.log(`  No HSN: ${allItems.length - hsnMatched}`);

// ── Generate SQL
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

let sql = `-- MyShop Stock Import
-- Generated: ${new Date().toISOString()}
-- Source: StockDetailReport + StockSummaryReport + Sale Summary By HSN
-- Total: ${allItems.length} | Price: ${priceMatched} | HSN: ${hsnMatched}

SET NAMES utf8mb4;

-- 1. INSERT ITEMS INTO MASTER
`;

for (const item of allItems) {
  sql += `INSERT IGNORE INTO items (code, name, hsn, mrp, sale_price, purchase_price, tax_pct, is_primary)
VALUES ('${esc(item.code)}', '${esc(item.name)}', '${esc(item.hsn)}', ${item.mrp}, ${item.salePrice}, ${item.purchasePrice}, ${item.tax}, 1);\n`;
}

sql += `\n-- 2. INSERT INVENTORY WITH 0 STOCK\n`;

for (const item of allItems) {
  sql += `INSERT INTO inventory (item_id, batch_no, exp_date, mrp, purchase_price, sale_price, tax_pct, gst_flag, initial_qty, current_qty)
SELECT id, '', NULL, ${item.mrp}, ${item.purchasePrice}, ${item.salePrice}, ${item.tax}, 1, 0, 0
FROM items WHERE code = '${esc(item.code)}' LIMIT 1;\n`;
}

const outPath = path.join(__dirname, "import_stock.sql");
fs.writeFileSync(outPath, sql, "utf8");

// CSV preview
let csv = "Code,Name,HSN,MRP,Sale Price,Purchase Price,Tax %\n";
for (const item of allItems) {
  csv += `"${item.code}","${item.name.replace(/"/g, '""')}","${item.hsn}",${item.mrp},${item.salePrice},${item.purchasePrice},${item.tax}\n`;
}
fs.writeFileSync(path.join(__dirname, "import_stock_preview.csv"), csv, "utf8");

console.log(`\nFiles written:`);
console.log(`  SQL: ${outPath}`);
console.log(`  CSV: ${path.join(__dirname, "import_stock_preview.csv")}`);
console.log(`\nTo import: mysql -u root myshop < deploy/import_stock.sql`);
