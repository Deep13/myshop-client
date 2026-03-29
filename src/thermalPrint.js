/**
 * Thermal Receipt Printer Utility
 * Generates and prints receipts formatted for 58mm / 80mm thermal printers.
 * Shop details are stored in localStorage under "shopSettings".
 */

const DEFAULT_SHOP = {
  name: "GANGA INSTAMART",
  address: "547, WEST CHOWBAGA, KOLKATA 700105",
  state: "19-West Bengal",
  phone: "7204909749",
  gstin: "19APQPD7206N2ZC",
  footer: "Thanks for doing business with us!",
  paperWidth: "80mm",
  autoPrint: false,
  caName: "",
  caEmail: "",
  caPhone: "",
};

export function getShopSettings() {
  try {
    const s = JSON.parse(localStorage.getItem("shopSettings") || "null");
    return { ...DEFAULT_SHOP, ...s };
  } catch {
    return { ...DEFAULT_SHOP };
  }
}

export function saveShopSettings(settings) {
  localStorage.setItem("shopSettings", JSON.stringify(settings));
}

/**
 * Print a thermal receipt — sends directly to printer (no preview).
 * @param {object} data
 *   - invoiceNo, invoiceDate, invoiceTime
 *   - customerName, customerType
 *   - items: [{ name, mrp, qty, price, amount, tax }]
 *   - totalQty, subTotal, taxAmount, total, received, balance, savings
 *   - discount (optional bill-level discount)
 */
export function printReceipt(data) {
  const shop = getShopSettings();
  const is58 = shop.paperWidth === "58mm";
  const pw = is58 ? "48mm" : "72mm";

  const time = data.invoiceTime || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  // Calculate taxable subtotal (sale price is tax-inclusive)
  let taxableTotal = 0;
  let totalTax = 0;
  let totalSavings = 0;
  for (const item of data.items) {
    const amt = Number(item.amount || 0);
    const taxPct = Number(item.tax || 0);
    if (taxPct > 0) {
      const taxable = amt * 100 / (100 + taxPct);
      taxableTotal += taxable;
      totalTax += amt - taxable;
    } else {
      taxableTotal += amt;
    }
    const mrp = Number(item.mrp || 0);
    const sp = Number(item.price || 0);
    if (mrp > sp && sp > 0) {
      totalSavings += (mrp - sp) * Number(item.qty || 0);
    }
  }
  taxableTotal = Math.round(taxableTotal * 100) / 100;
  totalTax = Math.round(totalTax * 100) / 100;
  totalSavings = Math.round(totalSavings * 100) / 100;

  // Override with passed values if available
  if (data.savings != null) totalSavings = Number(data.savings);

  // Build items HTML
  let itemsHTML = "";
  let idx = 1;
  for (const item of data.items) {
    itemsHTML += `<tr>
<td class="v-top">${idx}</td>
<td class="v-top" style="padding:2px 6px"><div>${esc(item.name)}</div><div class="sub">MRP: ${n(item.mrp)}</div></td>
<td class="v-top c" style="padding:2px 6px">${item.qty}</td>
<td class="v-top r" style="padding:2px 6px">${n(item.price)}</td>
<td class="v-top r b" style="padding:2px 4px">${n(item.amount)}</td>
</tr>`;
    idx++;
  }

  // Summary rows
  const sRows = [];
  sRows.push(["Sub Total", n(taxableTotal)]);
  if (totalTax > 0) sRows.push(["Total Tax", n(totalTax)]);
  if (data.discount && Number(data.discount) > 0) sRows.push(["Discount", `-${n(data.discount)}`]);
  sRows.push(["Total", n(data.total)]);
  sRows.push(["Received", n(data.received)]);
  sRows.push(["Balance", n(data.balance)]);

  const summaryHTML = sRows.map(([l, v]) =>
    `<tr><td colspan="4" class="r" style="padding:1px 4px 1px 0">${l}</td><td class="r b" style="padding:1px 0">${v}</td></tr>`
  ).join("\n");

  const savedHTML = totalSavings > 0
    ? `<table><tr class="saved-row"><td class="c" colspan="4">You Saved</td><td class="r b">${n(totalSavings)}</td></tr></table>`
    : "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Receipt</title>
<style>
@page{size:${shop.paperWidth} auto;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
body{width:${pw};margin:0 auto;font-family:'Courier New',Courier,monospace;font-size:${is58 ? "11px" : "13px"};color:#000;padding:4px 2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-weight:700}
table{width:100%;border-collapse:collapse}
th{font-weight:900;padding:2px 0}
td{font-weight:700}
.b{font-weight:900}
.c{text-align:center}
.r{text-align:right}
.v-top{vertical-align:top}
.sub{font-size:${is58 ? "9px" : "10px"};font-weight:700}
hr{border:none;border-top:1px dashed #000;margin:4px 0}
.logo{text-align:center;margin-bottom:4px}
.logo svg{width:${is58 ? "44px" : "56px"};height:${is58 ? "44px" : "56px"}}
.sn{font-size:${is58 ? "15px" : "18px"};font-weight:900;text-align:center;letter-spacing:2px;margin-bottom:2px}
.sd{text-align:center;font-size:${is58 ? "10px" : "11px"};line-height:1.5;font-weight:700;margin-bottom:2px}
.it{text-align:center;font-weight:900;font-size:${is58 ? "13px" : "14px"};margin:4px 0;text-decoration:underline}
.mr{display:flex;justify-content:space-between;font-size:${is58 ? "11px" : "12px"};line-height:1.6;font-weight:700}
.tbl th{border-bottom:1px dashed #000;font-size:${is58 ? "11px" : "12px"};padding:3px 4px}
.tbl td{font-size:${is58 ? "11px" : "12px"};padding:2px 4px}
.tr td{border-top:1px dashed #000;font-weight:900;padding-top:4px;font-size:${is58 ? "12px" : "13px"}}
.st td{font-size:${is58 ? "11px" : "12px"};padding:1px 0;font-weight:700}
.saved-row td{font-weight:900;font-size:${is58 ? "12px" : "13px"};padding:4px 0;border-top:1px dashed #000;border-bottom:1px dashed #000}
.ft{text-align:center;font-size:${is58 ? "10px" : "11px"};margin-top:6px;border-top:1px dashed #000;padding-top:4px;font-weight:900}
@media print{body{width:${pw};padding:2px}}
</style></head>
<body>

<div class="logo">
${shop.logo
  ? `<img src="${shop.logo}" style="max-width:${is58 ? "44px" : "60px"};max-height:${is58 ? "44px" : "60px"};object-fit:contain" />`
  : `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
<path d="M8 12 L14 12 L22 44 L52 44" stroke="#000" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
<path d="M22 44 L20 36 L54 36 L58 16 L16 16" stroke="#000" stroke-width="4" stroke-linejoin="round" fill="none"/>
<circle cx="26" cy="52" r="4.5" fill="#000"/><circle cx="48" cy="52" r="4.5" fill="#000"/>
</svg>`}
</div>

<div class="sn">${esc(shop.name)}</div>
<div class="sd">${esc(shop.address)}<br>State: ${esc(shop.state)}<br>Ph.No.: ${esc(shop.phone)}<br>GSTIN: ${esc(shop.gstin)}</div>

<hr>
<div class="it">Tax Invoice</div>

<div class="mr"><span>${esc(data.customerType || "Cash Sale")}</span></div>
<div class="mr"><span></span><span>Date: ${esc(formatDate(data.invoiceDate))}</span></div>
<div class="mr"><span></span><span>Time: ${esc(time)}</span></div>
<div class="mr"><span></span><span>Invoice No.: ${esc(data.invoiceNo)}</span></div>
${data.customerName && data.customerName !== "Cash" ? `<div class="mr"><span>Customer: ${esc(data.customerName)}</span></div>` : ""}
${data.phone ? `<div class="mr"><span>Phone: ${esc(data.phone)}</span></div>` : ""}

<hr>

<table class="tbl">
<thead><tr>
<th style="text-align:left;width:14px;padding:3px 4px">#</th>
<th style="text-align:left;padding:3px 6px">Name</th>
<th class="c" style="padding:3px 6px">Qty</th>
<th class="r" style="padding:3px 6px">Price</th>
<th class="r" style="padding:3px 4px">Amount</th>
</tr></thead>
<tbody>${itemsHTML}</tbody>
</table>

<hr>

<table><tr class="tr">
<td>Total</td>
<td class="c">${data.totalQty}</td>
<td></td>
<td class="r">${n(data.total)}</td>
</tr></table>

<table class="st">${summaryHTML}</table>

${savedHTML}

<div class="ft">Terms &amp; Conditions<br>${esc(shop.footer)}</div>

</body></html>`;

  // Send directly to printer — no preview
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:0;height:0;border:none";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  // Print after render
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    // Cleanup after print
    setTimeout(() => { document.body.removeChild(iframe); }, 1000);
  }, 300);
}

function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function n(v) { return Number(v || 0).toFixed(2); }
function formatDate(d) {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}
