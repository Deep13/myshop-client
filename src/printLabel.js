/**
 * Print price label for 58mm thermal label printer (P58D style).
 * Generates a label with: Item Name, Sale Price, Barcode (Code 39) of item code.
 * Uses a print popup window — works with Bluetooth thermal printers set as default.
 */

function code39(text) {
  // Code 39 encoding table: each character → pattern of narrow(1) and wide(3) for bars and spaces
  const ENC = {
    "0":"101001101101","1":"110100101011","2":"101100101011","3":"110110010101",
    "4":"101001101011","5":"110100110101","6":"101100110101","7":"101001011011",
    "8":"110100101101","9":"101100101101","A":"110101001011","B":"101101001011",
    "C":"110110100101","D":"101011001011","E":"110101100101","F":"101101100101",
    "G":"101010011011","H":"110101001101","I":"101101001101","J":"101011001101",
    "K":"110101010011","L":"101101010011","M":"110110101001","N":"101011010011",
    "O":"110101101001","P":"101101101001","Q":"101010110011","R":"110101011001",
    "S":"101101011001","T":"101011011001","U":"110010101011","V":"100110101011",
    "W":"110011010101","X":"100101101011","Y":"110010110101","Z":"100110110101",
    "-":"100101011011",".":"110010101101"," ":"100110101101","$":"100100100101",
    "/":"100100101001","+":"100101001001","%":"101001001001","*":"100101101101",
  };

  const upper = text.toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, "");
  const chars = ["*", ...upper.split(""), "*"]; // start/stop = *
  let bits = "";
  chars.forEach((ch, ci) => {
    bits += ENC[ch] || "";
    if (ci < chars.length - 1) bits += "0"; // inter-character gap
  });
  return bits;
}

function barcodeSVG(text) {
  const bits = code39(text);
  const n = bits.length;
  let rects = "";
  let i = 0;
  while (i < n) {
    if (bits[i] === "1") {
      const start = i;
      while (i < n && bits[i] === "1") i++;
      rects += `<rect x="${start}" y="0" width="${i - start}" height="100"/>`;
    } else {
      i++;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} 100" preserveAspectRatio="none" shape-rendering="crispEdges">${rects}</svg>`;
}

export function printLabel({ itemName, salePrice, itemCode, copies = 1 }) {
  const barcodeStr = barcodeSVG(itemCode);

  let labelsHTML = "";
  for (let i = 0; i < copies; i++) {
    labelsHTML += `
      <div class="label">
        <div class="name">${itemName}</div>
        <div class="price">₹${Number(salePrice || 0).toFixed(2)}</div>
        <div class="barcode">${barcodeStr}</div>
      </div>
    `;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  @page { size: 42mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; width: 42mm; }
  .label {
    width: 42mm;
    padding: 2mm 1mm 1mm;
    text-align: center;
    page-break-after: always;
  }
  .label:last-child { page-break-after: auto; }
  .name {
    font-size: 12px;
    font-weight: 600;
    line-height: 1.15;
    margin-bottom: 0.5mm;
    word-wrap: break-word;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .price {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 0mm;
  }
  .barcode { margin-bottom: 0; line-height: 0; }
  .barcode svg { width: 42mm; height: 8mm; image-rendering: pixelated; image-rendering: -webkit-optimize-contrast; }
  .code {
    font-size: 11px;
    font-weight: 400;
    color: #000;
    letter-spacing: 1px;
    margin-top: -8px;
  }
</style></head><body>${labelsHTML}</body></html>`;

  const win = window.open("", "_blank", "width=240,height=360");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.print();
    win.onafterprint = () => win.close();
  };
}
