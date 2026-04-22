/**
 * Print price label for 50mm × 23mm thermal label.
 * Content: Item Name, Sale Price, Barcode, Item Code.
 * Auto-detects barcode format:
 *   - 12 or 13 digits → EAN-13 (check digit computed if 12)
 *   - 7 or 8 digits   → EAN-8  (check digit computed if 7)
 *   - otherwise       → Code 128 (B/C auto)
 */

/* ── EAN-13 ── */
function ean13(digits) {
  const d = String(digits).replace(/\D/g, "");
  let input;
  if (d.length === 13) input = d;
  else if (d.length === 12) {
    let s = 0;
    for (let i = 0; i < 12; i++) s += parseInt(d[i], 10) * (i % 2 === 0 ? 1 : 3);
    input = d + String((10 - (s % 10)) % 10);
  } else return null;

  const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
  const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
  const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
  const P = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

  const first = parseInt(input[0], 10);
  let bits = "101";
  for (let i = 0; i < 6; i++) {
    const v = parseInt(input[i + 1], 10);
    bits += P[first][i] === "L" ? L[v] : G[v];
  }
  bits += "01010";
  for (let i = 0; i < 6; i++) bits += R[parseInt(input[i + 7], 10)];
  bits += "101";
  return { bits, text: input, type: "ean13" };
}

/* ── EAN-8 ── */
function ean8(digits) {
  const d = String(digits).replace(/\D/g, "");
  let input;
  if (d.length === 8) input = d;
  else if (d.length === 7) {
    let s = 0;
    for (let i = 0; i < 7; i++) s += parseInt(d[i], 10) * (i % 2 === 0 ? 3 : 1);
    input = d + String((10 - (s % 10)) % 10);
  } else return null;

  const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
  const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];

  let bits = "101";
  for (let i = 0; i < 4; i++) bits += L[parseInt(input[i], 10)];
  bits += "01010";
  for (let i = 0; i < 4; i++) bits += R[parseInt(input[i + 4], 10)];
  bits += "101";
  return { bits, text: input, type: "ean8" };
}

/* ── Code 128 (auto B/C) ── */
function code128(text) {
  const P = [
    "11011001100",
    "11001101100",
    "11001100110",
    "10010011000",
    "10010001100",
    "10001001100",
    "10011001000",
    "10011000100",
    "10001100100",
    "11001001000",
    "11001000100",
    "11000100100",
    "10110011100",
    "10011011100",
    "10011001110",
    "10111001100",
    "10011101100",
    "10011100110",
    "11001110010",
    "11001011100",
    "11001001110",
    "11011100100",
    "11001110100",
    "11101101110",
    "11101001100",
    "11100101100",
    "11100100110",
    "11101100100",
    "11100110100",
    "11100110010",
    "11011011000",
    "11011000110",
    "11000110110",
    "10100011000",
    "10001011000",
    "10001000110",
    "10110001000",
    "10001101000",
    "10001100010",
    "11010001000",
    "11000101000",
    "11000100010",
    "10110111000",
    "10110001110",
    "10001101110",
    "10111011000",
    "10111000110",
    "10001110110",
    "11101110110",
    "11010001110",
    "11000101110",
    "11011101000",
    "11011100010",
    "11011101110",
    "11101011000",
    "11101000110",
    "11100010110",
    "11101101000",
    "11101100010",
    "11100011010",
    "11101111010",
    "11001000010",
    "11110001010",
    "10100110000",
    "10100001100",
    "10010110000",
    "10010000110",
    "10000101100",
    "10000100110",
    "10110010000",
    "10110000100",
    "10011010000",
    "10011000010",
    "10000110100",
    "10000110010",
    "11000010010",
    "11001010000",
    "11110111010",
    "11000010100",
    "10001111010",
    "10100111100",
    "10010111100",
    "10010011110",
    "10111100100",
    "10011110100",
    "10011110010",
    "11110100100",
    "11110010100",
    "11110010010",
    "11011011110",
    "11011110110",
    "11110110110",
    "10101111000",
    "10100011110",
    "10001011110",
    "10111101000",
    "10111100010",
    "11110101000",
    "11110100010",
    "10111011110",
    "10111101110",
    "11101011110",
    "11110101110",
    "11010000100",
    "11010010000",
    "11010011100",
    "1100011101011",
  ];
  const START_B = 104,
    START_C = 105,
    STOP = 106,
    CODE_B = 100,
    CODE_C = 99;

  const codes = [];
  let inC = false;
  let i = 0;

  const leadDigits = (text.match(/^\d+/) || [""])[0].length;
  if (leadDigits >= 4 && leadDigits % 2 === 0) {
    codes.push(START_C);
    inC = true;
  } else if (leadDigits >= 4) {
    // odd run at start — emit one in B first, then switch to C
    codes.push(START_B);
    codes.push(text.charCodeAt(0) - 32);
    i = 1;
    codes.push(CODE_C);
    inC = true;
  } else {
    codes.push(START_B);
  }

  while (i < text.length) {
    if (inC) {
      if (i + 1 < text.length && /\d/.test(text[i]) && /\d/.test(text[i + 1])) {
        codes.push(parseInt(text.slice(i, i + 2), 10));
        i += 2;
      } else {
        codes.push(CODE_B);
        inC = false;
      }
    } else {
      const rest = text.slice(i);
      const digRun = (rest.match(/^\d+/) || [""])[0];
      if (digRun.length >= 6 && digRun.length % 2 === 0) {
        codes.push(CODE_C);
        inC = true;
      } else {
        const c = text.charCodeAt(i);
        codes.push(c >= 32 && c < 128 ? c - 32 : 0);
        i++;
      }
    }
  }

  let sum = codes[0];
  for (let j = 1; j < codes.length; j++) sum += codes[j] * j;
  codes.push(sum % 103);
  codes.push(STOP);

  return { bits: codes.map((c) => P[c]).join(""), text, type: "code128" };
}

/* ── Pick encoding ── */
function encodeBarcode(raw) {
  const clean = String(raw || "").trim();
  if (!clean) return code128("");
  // if input is pure digits, prefer EAN-13 / EAN-8 for best scanner compatibility
  if (/^\d+$/.test(clean)) {
    if (clean.length === 12 || clean.length === 13) return ean13(clean);
    if (clean.length === 7 || clean.length === 8) return ean8(clean);
  }
  return code128(clean);
}

/* ── Render barcode as SVG (with quiet zones) ──
   Width is pixel-aligned for P58D (203 DPI / 8 dots/mm):
   3 dots per module = 0.375mm, so bars snap to integer dot boundaries.
*/
function barcodeSVG(enc) {
  const bits = enc.bits;
  const n = bits.length;
  const quiet = 10;
  const total = n + 2 * quiet;
  let rects = "";
  let i = 0;
  while (i < n) {
    if (bits[i] === "1") {
      const s = i;
      while (i < n && bits[i] === "1") i++;
      rects += `<rect x="${quiet + s}" y="0" width="${i - s}" height="100" />`;
    } else {
      i++;
    }
  }
  const widthMm = (total * 0.375).toFixed(3);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} 100" width="${widthMm}mm" height="8mm" preserveAspectRatio="none" shape-rendering="crispEdges">${rects}</svg>`;
}

export function printLabel({ itemName, salePrice, itemCode, copies = 1 }) {
  const enc = encodeBarcode(itemCode);
  const barcodeStr = barcodeSVG(enc);
  const codeText = enc.text || String(itemCode || "");

  let labelsHTML = "";
  for (let i = 0; i < copies; i++) {
    labelsHTML += `
      <div class="label">
        <div class="name">${itemName}</div>
        <div class="price">&#8377;${Number(salePrice || 0).toFixed(2)}</div>
        <div class="barcode">${barcodeStr}</div>
        <div class="code">${codeText}</div>
      </div>
    `;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  @page { size: 50mm 23mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 50mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; }
  .label {
    width: 50mm;
    height: 23mm;
    padding: 0.3mm 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    page-break-after: always;
    overflow: hidden;
  }
  .label:last-child { page-break-after: auto; }
  .name {
    font-size: 7.5pt;
    font-weight: 700;
    line-height: 1.1;
    text-align: center;
    word-wrap: break-word;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    width: 100%;
  }
  .price {
    font-size: 13pt;
    font-weight: 800;
    line-height: 1;
    margin-bottom: 0.8mm;
  }
  .barcode {
    line-height: 0;
    text-align: center;
  }
  .barcode svg { display: block; margin: 0 auto; }
  .code {
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: 0.5px;
    line-height: 1;
    margin-top: 0.3mm;
  }
</style></head><body>${labelsHTML}</body></html>`;

  const win = window.open("", "_blank", "width=320,height=240");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.print();
    win.onafterprint = () => win.close();
  };
}
