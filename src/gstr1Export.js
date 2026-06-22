// Multi-sheet GSTR-1 export matching the canonical Tally-style format.
// Builds an actual xlsx (via SheetJS) with 14 sheets: GSTR1 Report, b2b/b2cl/
// b2cs/cdnr/cdnur/exp/at/atadj/exemp/hsn(b2b)/hsn(b2c)/itemSummary/docs.

import * as XLSX from "xlsx";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// `lines` from get_gst_reports.php gstr1 = one row per invoice_items row, with:
//   invoice_no, invoice_date (YYYY-MM-DD), customer_name, customer_gstin,
//   invoice_value, item_name, item_code, hsn, qty, rate, tax_pct, amount,
//   gst_flag. (Server-computed taxable/cgst/sgst fields are recomputed here
//   on aggregated buckets so rounding lines up with the reference layout.)
export function buildGSTR1Workbook({ rows, from, to, shop }) {
  const stateNum = (() => {
    const m = /^(\d+)\b/.exec(String(shop?.state || ""));
    return m ? m[1] : "";
  })();
  const stateName = String(shop?.state || "").replace(/^\d+\s*[-–]\s*/, "").trim() || "West Bengal";
  const posLabel  = stateNum ? `${stateNum}-${stateName}` : stateName;

  const fmtDate = (iso) => {
    if (!iso) return "";
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
  };
  const period = (() => {
    const fmtMon = (iso) => {
      const m = /^(\d{4})-(\d{2})/.exec(String(iso || ""));
      if (!m) return "";
      const names = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      return `${names[Number(m[2]) - 1]} ${m[1]}`;
    };
    const a = fmtMon(from), b = fmtMon(to);
    return a && b ? `${a} - ${b}` : a || b || "";
  })();

  // ── 1) Aggregate per (invoice_no, tax_pct, gst_flag) for the main report sheet
  const buckets = new Map(); // key -> { ...row, amount, qty }
  for (const r of rows) {
    const key = `${r.invoice_no}|${Number(r.tax_pct) || 0}|${Number(r.gst_flag) || 0}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        invoice_no:     r.invoice_no,
        invoice_date:   r.invoice_date,
        customer_name:  r.customer_name || "Cash Sale",
        customer_gstin: r.customer_gstin || "",
        invoice_value:  Number(r.invoice_value) || 0,
        tax_pct:        Number(r.tax_pct) || 0,
        gst_flag:       Number(r.gst_flag) || 0,
        amount:         0,
      });
    }
    buckets.get(key).amount += Number(r.total) || 0;
  }
  const mainRows = [...buckets.values()].sort((a, b) => {
    if (a.invoice_date !== b.invoice_date) return a.invoice_date < b.invoice_date ? -1 : 1;
    const an = Number(a.invoice_no), bn = Number(b.invoice_no);
    if (!isNaN(an) && !isNaN(bn) && an !== bn) return an - bn;
    if (a.invoice_no !== b.invoice_no) return a.invoice_no < b.invoice_no ? -1 : 1;
    return a.tax_pct - b.tax_pct;
  });

  // ── 2) Build the "GSTR1 Report" sheet (header info + detail rows + total)
  // Note: Invoice Value is repeated on every rate bucket of an invoice (matching
  // the reference layout), but the Total row sums each invoice's value ONCE.
  const seenInvForTotal = new Set();
  let sumInvVal = 0, sumTaxable = 0, sumTax = 0;
  const detail = mainRows.map((b) => {
    const taxable = b.gst_flag && b.tax_pct > 0
      ? r2(b.amount * 100 / (100 + b.tax_pct))
      : r2(b.amount);
    const tax = r2(b.amount - taxable);
    // For intra-state GST, CGST must equal SGST. Display the same per-line
    // value so totals stay balanced; if tax is an odd half-paise, the 1-paise
    // imbalance is absorbed at the line level.
    const cgst = r2(tax / 2);
    const sgst = cgst;
    if (!seenInvForTotal.has(b.invoice_no)) {
      seenInvForTotal.add(b.invoice_no);
      sumInvVal += b.invoice_value;
    }
    sumTaxable += taxable;
    sumTax     += tax;
    return [
      b.customer_gstin || "",                 // GSTIN/UIN
      b.customer_name,                        // Party Name
      "Sale",                                 // Transaction Type
      b.invoice_no,                           // Invoice No.
      fmtDate(b.invoice_date),                // Invoice Date
      b.invoice_value,                        // Invoice Value (full invoice — repeated per rate bucket; matches reference)
      b.tax_pct,                              // Rate
      0,                                      // Cess Rate
      taxable,                                // Taxable value
      "N",                                    // Reverse Charge
      0,                                      // Integrated Tax
      cgst,                                   // Central Tax
      sgst,                                   // State/UT Tax
      0,                                      // Cess Amount
      stateName,                              // Place of Supply
    ];
  });

  const reportAOA = [
    ["Period", period],
    [],
    ["1. GSTIN", shop?.gstin || ""],
    ["2.a Legal name of the registered person.", shop?.name || ""],
    ["2.b Trade name, if any"],
    ["3.a Aggregate turnover of the preceeding Financial Year"],
    ["3.b Aggregate turnover, April to June 2017"],
    [],
    [
      "GSTIN/UIN", "Party Name", "Transaction Type", "Invoice No.", "Invoice Date",
      "Invoice Value", "Rate", "Cess Rate", "Taxable value", "Reverse Charge",
      "Integrated Tax Amount", "Central Tax Amount", "State/UT Tax Amount", "Cess Amount",
      "Place of Supply(Name of state)",
    ],
    [],
    ...detail,
    [],
    // Derive CGST/SGST totals from aggregate tax so they're exactly equal.
    (() => {
      const half = r2(sumTax / 2);
      return ["Total", "", "", "", "", r2(sumInvVal), "", "", r2(sumTaxable), "", 0, half, half, 0];
    })(),
  ];

  // ── 3) b2cs — by tax rate, taxable supplies only (rate > 0)
  const b2cs = new Map(); // rate -> taxable
  // ── 4) exemp — nil rated total (rate = 0, gst_flag = 1)
  let nilRated = 0;
  // ── 5) hsn(b2c) — group by (hsn, rate)
  const hsnAgg = new Map(); // key=hsn|rate -> {hsn, rate, qty, totalValue, taxable, cgst, sgst}
  // ── 6) itemSummary — group by (hsn, item_name, rate)
  const itemAgg = new Map();
  const invSet = new Set();
  let minNo = null, maxNo = null;

  for (const r of rows) {
    const amount  = Number(r.total)   || 0;
    const qty     = Number(r.qty)     || 0;
    const taxPct  = Number(r.tax_pct) || 0;
    const gstFlag = Number(r.gst_flag) || 0;
    const taxable = gstFlag && taxPct > 0 ? r2(amount * 100 / (100 + taxPct)) : r2(amount);
    const tax     = r2(amount - taxable);

    if (taxPct > 0) {
      b2cs.set(taxPct, r2((b2cs.get(taxPct) || 0) + taxable));
    } else if (gstFlag) {
      nilRated = r2(nilRated + amount);
    }

    // Aggregate TAX (not cgst/sgst). Split into CGST/SGST evenly at the end
    // of each group so the per-group totals stay exactly balanced.
    const hsnKey = `${r.hsn || ""}|${taxPct}`;
    if (!hsnAgg.has(hsnKey)) {
      hsnAgg.set(hsnKey, { hsn: r.hsn || "", rate: taxPct, qty: 0, totalValue: 0, taxable: 0, tax: 0 });
    }
    const ha = hsnAgg.get(hsnKey);
    ha.qty += qty;
    ha.totalValue = r2(ha.totalValue + amount);
    ha.taxable    = r2(ha.taxable    + taxable);
    ha.tax        = r2(ha.tax        + tax);

    const itemKey = `${r.hsn || ""}|${r.item_name || ""}|${taxPct}`;
    if (!itemAgg.has(itemKey)) {
      itemAgg.set(itemKey, { hsn: r.hsn || "", itemName: r.item_name || "", rate: taxPct, qty: 0, totalValue: 0, taxable: 0, tax: 0 });
    }
    const ia = itemAgg.get(itemKey);
    ia.qty += qty;
    ia.totalValue = r2(ia.totalValue + amount);
    ia.taxable    = r2(ia.taxable    + taxable);
    ia.tax        = r2(ia.tax        + tax);

    invSet.add(r.invoice_no);
    const n = Number(r.invoice_no);
    if (!isNaN(n)) {
      if (minNo === null || n < minNo) minNo = n;
      if (maxNo === null || n > maxNo) maxNo = n;
    }
  }

  // ── Build sheets ──
  const wb = XLSX.utils.book_new();
  const addSheet = (name, aoa) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);

  addSheet("GSTR1 Report", reportAOA);

  // b2b,sez,de — empty for retail
  addSheet("b2b,sez,de", [
    ["Summary For B2B, SEZ, DE (4A, 4B, 6B, 6C)"],
    ["No. of Recipients", "", "No. of Invoices", "", "Total Invoice Value", "", "", "", "", "", "", "Total Taxable Value", "Total Cess"],
    [0, "", 0, "", 0, "", "", "", "", "", "", 0, 0],
    ["GSTIN/UIN of Recipient", "Receiver Name", "Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply", "Reverse Charge", "Applicable % of Tax Rate", "Invoice Type", "E-Commerce GSTIN", "Rate", "Taxable Value", "Cess Amount"],
  ]);

  // b2cl — empty for retail under threshold
  addSheet("b2cl", [
    ["Summary For B2CL(5)"],
    ["No. of Invoices", "", "Total Invoice Value", "", "", "", "Total Taxable Value", "Total Cess"],
    [0, "", 0, "", "", "", 0, 0],
    ["Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN"],
  ]);

  // b2cs
  const b2csRates = [...b2cs.keys()].sort((a, b) => a - b);
  const b2csTotal = r2(b2csRates.reduce((s, r) => s + (b2cs.get(r) || 0), 0));
  addSheet("b2cs", [
    ["Summary For B2CS(7)"],
    ["", "", "", "", "Total Taxable Value", "Total Cess"],
    ["", "", "", "", b2csTotal, 0],
    ["Type", "Place Of Supply", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN"],
    ...b2csRates.map((rate) => ["OE", posLabel, "", rate, b2cs.get(rate), 0, ""]),
  ]);

  // cdnr / cdnur / exp / at / atadj — empty
  addSheet("cdnr", [
    ["Summary For CDNR(9B)"],
    ["No. of Recipients", "", "No. of Notes", "", "", "", "", "", "Total Note Value", "", "", "Total Taxable Value", "Total Cess"],
    [0, "", 0, "", "", "", "", "", 0, "", "", 0, 0],
    ["GSTIN/UIN of Recipient", "Receiver Name", "Note Number", "Note Date", "Note Type", "Place Of Supply", "Reverse Charge", "Note Supply Type", "Note Value", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount"],
  ]);
  addSheet("cdnur", [
    ["Summary For CDNUR(9B)"],
    ["", "No. of Notes/Vouchers", "", "", "", "Total Note Value", "", "", "Total Taxable Value", "Total Cess"],
    ["", 0, "", "", "", 0, "", "", 0, 0],
    ["UR Type", "Note Number", "Note Date", "Note Type", "Place Of Supply", "Note Value", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount"],
  ]);
  addSheet("exp", [
    ["Summary For EXP(6)"],
    ["", "No. of Invoices", "", "Total Invoice Value", "", "No. of Shipping Bill", "", "", "Total Taxable Value"],
    [],
    ["Export Type", "Invoice Number", "Invoice date", "Invoice Value", "Port Code", "Shipping Bill Number", "Shipping Bill Date", "Rate", "Taxable Value"],
  ]);
  addSheet("at", [
    ["Summary For Advance Received(11B)"],
    ["", "", "", "Total Advance Received", "Total Cess"],
    [],
    ["Place Of Supply", "Applicable % of Tax Rate", "Rate", "Gross Advance Received", "Cess Amount"],
  ]);
  addSheet("atadj", [
    ["Summary For Advance Adjusted(11B)"],
    ["", "", "", "Total Advance Adjusted", "Total Cess"],
    [],
    ["Place Of Supply", "Applicable % of Tax Rate", "Rate", "Gross Advance Adjusted", "Cess Amount"],
  ]);

  // exemp
  addSheet("exemp", [
    ["Summary For Nil rated, exempted and non GST outward supplies (8)"],
    ["", "Total Nil Rated Supplies", "Total Exempted Supplies", "Total Non-GST Supplies"],
    ["", nilRated, 0, 0],
    ["Description", "Nil Rated Supplies", "Exempted(other than nil rated/non GST supply)", "Non-GST Supplies"],
    ["Inter-State supplies to registered persons", 0, 0, 0],
    ["Intra-State supplies to registered persons", 0, 0, 0],
    ["Inter-State supplies to unregistered persons", 0, 0, 0],
    ["Intra-State supplies to unregistered persons", nilRated, 0, 0],
  ]);

  // hsn(b2b) — empty
  addSheet("hsn(b2b)", [
    ["Summary For HSN(12)"],
    ["No. of HSN", "", "", "", "Total Value", "", "Total Taxable Value", "Total Integrated Tax", "Total Central Tax", "Total State/UT Tax", "Total Cess"],
    [0, "", "", "", 0, "", 0, 0, 0, 0, 0],
    ["HSN", "Description", "UQC", "Total Quantity", "Total Value", "Rate", "Taxable Value", "Integrated Tax Amount", "Central Tax Amount", "State/UT Tax Amount", "Cess Amount"],
  ]);

  // Per group: split tax evenly into CGST and SGST (intra-state, equal halves).
  const splitTaxEven = (x) => {
    const half = r2((x.tax || 0) / 2);
    return { ...x, cgst: half, sgst: half };
  };

  // hsn(b2c) — totals across all rows
  const hsnRows = [...hsnAgg.values()].map(splitTaxEven).sort((a, b) => b.totalValue - a.totalValue);
  const hsnTotalTax = hsnRows.reduce((t, x) => r2(t + (x.tax || 0)), 0);
  const hsnTotalHalf = r2(hsnTotalTax / 2);
  const hsnTotals = hsnRows.reduce((t, x) => ({
    totalValue: r2(t.totalValue + x.totalValue),
    taxable:    r2(t.taxable    + x.taxable),
  }), { totalValue: 0, taxable: 0 });
  addSheet("hsn(b2c)", [
    ["Summary For HSN(12)"],
    ["No. of HSN", "", "", "", "Total Value", "", "Total Taxable Value", "Total Integrated Tax", "Total Central Tax", "Total State/UT Tax", "Total Cess"],
    [hsnRows.length, "", "", "", hsnTotals.totalValue, "", hsnTotals.taxable, 0, hsnTotalHalf, hsnTotalHalf, 0],
    ["HSN", "Description", "UQC", "Total Quantity", "Total Value", "Rate", "Taxable Value", "Integrated Tax Amount", "Central Tax Amount", "State/UT Tax Amount", "Cess Amount"],
    ...hsnRows.map((x) => [x.hsn, "", "OTH-OTHERS", x.qty, x.totalValue, x.rate, x.taxable, 0, x.cgst, x.sgst, 0]),
  ]);

  // itemSummary — same totals as hsn(b2c) but per-item
  const itemRows = [...itemAgg.values()].map(splitTaxEven).sort((a, b) => b.totalValue - a.totalValue);
  addSheet("itemSummary", [
    ["Summary For HSN(12)"],
    ["No. of HSN", "", "", "", "Total Value", "", "Total Taxable Value", "Total Integrated Tax", "Total Central Tax", "Total State/UT Tax", "Total Cess"],
    [hsnRows.length, "", "", "", hsnTotals.totalValue, "", hsnTotals.taxable, 0, hsnTotalHalf, hsnTotalHalf, 0],
    ["HSN", "Description", "UQC", "Total Quantity", "Total Value", "Rate", "Taxable Value", "Integrated Tax Amount", "Central Tax Amount", "State/UT Tax Amount", "Cess Amount"],
    ...itemRows.map((x) => [x.hsn, x.itemName, "OTH-OTHERS", x.qty, x.totalValue, x.rate, x.taxable, 0, x.cgst, x.sgst, 0]),
  ]);

  // docs
  addSheet("docs", [
    ["Summary of documents issued during the tax period (13)"],
    ["", "", "", "Total Number", "Total Cancelled"],
    ["", "", "", invSet.size, 0],
    ["Nature of Document", "Sr. No. From", "Sr. No. To", "Total Number", "Cancelled"],
    ["Invoices for outward supply", minNo ?? "", maxNo ?? "", invSet.size, 0],
  ]);

  return wb;
}

export function downloadGSTR1(opts) {
  const wb = buildGSTR1Workbook(opts);
  const fname = opts.filename || `GSTR1_${opts.from || ""}_to_${opts.to || ""}.xlsx`;
  XLSX.writeFile(wb, fname);
}

export function buildGSTR1Blob(opts) {
  const wb = buildGSTR1Workbook(opts);
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
