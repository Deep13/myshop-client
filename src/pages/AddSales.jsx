import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiCheck, FiPlus, FiShoppingCart, FiX, FiTrash2, FiSearch, FiTag, FiPrinter, FiSettings, FiRefreshCw } from "react-icons/fi";
import { C, GLOBAL_CSS, API, Field, Modal, asNum, todayISO, fmt2, fmtDate } from "../ui.jsx";
import DateInput from "../comps/DateInput.jsx";
import { printReceipt, getShopSettings, saveShopSettings } from "../thermalPrint.js";
import usePageMeta from "../usePageMeta.js";

/* ═══════════════════════════════════════════════════════
   PRICING MODEL
   ─────────────────────────────────────────────────────
   • Sale price is tax-INCLUSIVE (what customer pays)
   • Discount = MRP − Sale Price  (auto-calc, editable)
   • If user edits discount → salePrice = mrp − discount
   • Amount = qty × salePrice  (already tax-inclusive)
   • Tax portion in amount = amount × taxRate / (100 + taxRate)
   • Savings per row = (mrp − salePrice) × qty
═══════════════════════════════════════════════════════ */

const PAY_MODES = ["Cash", "UPI", "Card", "Bank", "Cheque", "Other"];
const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();

const blankRow = () => ({
  invId: 0, itemId: 0, itemName: "", code: "", hsn: "",
  batchNo: "", expDate: "", mrp: "", qty: "", salePrice: "",
  discount: "", tax: "", amount: "",
});

/* Sale price inclusive of tax — amount = qty × salePrice */
function calcRowAmount(row) {
  const qty = asNum(row.qty);
  const sp  = asNum(row.salePrice);
  return qty * sp;
}

/* Tax portion inside the inclusive sale price */
function taxInAmount(amount, taxRate) {
  const r = asNum(taxRate);
  if (r <= 0) return 0;
  return amount * r / (100 + r);
}

/* Discount % off MRP */
function discountPct(mrp, salePrice) {
  const m = asNum(mrp), s = asNum(salePrice);
  if (m <= 0) return 0;
  return Math.max(0, (m - s) / m * 100);
}

function SectionHead({ num, title, icon, actions }) {
  return (
    <div style={{ padding: "12px 18px", borderBottom: "1.5px solid #e5e7eb", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{num}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ color: C.brand }}>{icon}</span>
          <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{title}</span>
        </div>
      </div>
      {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
    </div>
  );
}

export default function AddSales() {
  const [sp] = useSearchParams();
  const invoiceId = sp.get("id");
  const isEdit = Boolean(invoiceId);
  usePageMeta(isEdit ? "Edit Sale" : "New Sale", "Create or edit a sales invoice");

  const [custType, setCustType]   = useState("Retail");
  const [custName, setCustName]   = useState("");
  const [phone, setPhone]         = useState("");
  const [custGstin, setCustGstin] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayISO());

  const [rows, setRows]           = useState([blankRow(), blankRow()]);
  const [activeSug, setActiveSug] = useState(null);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [searchText, setSearchText] = useState({});
  const qtyRefs = useRef({});
  const searchRefs = useRef({});

  const [inventory, setInventory] = useState([]);

  const [billDisc, setBillDisc]   = useState("");
  const [roundOff, setRoundOff]   = useState(true);

  const [multiPay, setMultiPay]   = useState(false);
  const [payMode, setPayMode]     = useState("Cash");
  const [received, setReceived]   = useState("0");
  const [recTouched, setRecTouched] = useState(false);
  const [payments, setPayments]   = useState([{ type: "Cash", amount: "" }]);

  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState("");   // inline message instead of alert
  const [cashGiven, setCashGiven] = useState("");   // cash tendered by customer

  const showToast = (msg, duration = 3000) => { setToast(msg); setTimeout(() => setToast(""), duration); };

  /* ── Shop / Printer settings ── */
  const [showShopSettings, setShowShopSettings] = useState(false);
  const [shopForm, setShopForm] = useState(getShopSettings);

  /* ── Focus the first row's item search input on mount ── */
  useEffect(() => {
    // Defer until after render so the ref is wired up
    const t = setTimeout(() => searchRefs.current[0]?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  /* ── Load inventory with include_zero=1 so all batches show ── */
  const [loadingInv, setLoadingInv] = useState(false);
  const loadInventory = async () => {
    try {
      setLoadingInv(true);
      const r = await fetch(`${API}/get_inventory.php?include_zero=1`);
      const j = await r.json();
      if (j.status === "success") setInventory(j.data || []);
    } catch { }
    finally { setLoadingInv(false); }
  };
  useEffect(() => { loadInventory(); }, []);

  /* ── Load invoice for edit ── */
  useEffect(() => {
    if (!invoiceId) return;
    (async () => {
      try {
        const r = await fetch(`${API}/get_invoice.php?id=${invoiceId}`);
        const j = await r.json();
        if (!r.ok || j.status !== "success") throw new Error(j.message || "Failed to load");
        const h = j.invoice;
        setCustType(h.customer_type || "Retail");
        setCustName(h.customer_name || "");
        setPhone(h.phone || "");
        setCustGstin(h.customer_gstin || "");
        setInvoiceNo(h.invoice_no || "");
        setInvoiceDate(h.invoice_date || todayISO());
        setBillDisc(h.bill_discount || "");
        setRoundOff(h.round_off_enabled == "1" || h.round_off_enabled === 1);
        setRows((j.items || []).map((item) => {
          const mrp  = asNum(item.mrp);
          const sp   = asNum(item.price);
          const disc = fmt2(Math.max(0, mrp - sp));
          return {
            invId: 0, itemId: 0,
            itemName: item.item_name || "",
            code: item.item_code || "",
            hsn: item.hsn || "",
            batchNo: item.batch_no || "",
            expDate: item.exp_date || "",
            mrp: String(item.mrp || ""),
            qty: String(item.qty || ""),
            salePrice: String(item.price || ""),
            discount: disc,
            tax: String(item.tax || ""),
            amount: String(item.amount || ""),
          };
        }));
        if (j.payments?.length) {
          const pList = j.payments.map((p) => ({ type: p.pay_type || "Cash", amount: String(p.amount || "") }));
          setPayments(pList);
          if (pList.length > 1) setMultiPay(true);
          else { setPayMode(pList[0]?.type || "Cash"); setReceived(String(pList[0]?.amount || "")); setRecTouched(true); }
        }
      } catch (e) { showToast(e.message || "Load failed"); }
    })();
  }, [invoiceId]);

  /* ── Fetch next invoice number ── */
  useEffect(() => {
    if (isEdit) return;
    (async () => {
      try {
        const r = await fetch(`${API}/get_next_invoice.php`);
        const j = await r.json();
        if (j.status === "success") setInvoiceNo(j.invoiceNo);
      } catch { }
    })();
  }, [isEdit]);

  /* ── Inventory search ── */
  const getInvSug = (text) => {
    const q = String(text || "").trim().toLowerCase();
    if (!q) return [];
    return inventory
      .filter((inv) =>
        (inv.item_name || "").toLowerCase().includes(q) ||
        (inv.item_code || "").toLowerCase().includes(q)
      )
      .sort((a, b) => {
        if (!a.exp_date && !b.exp_date) return 0;
        if (!a.exp_date) return 1;
        if (!b.exp_date) return -1;
        return a.exp_date.localeCompare(b.exp_date);
      })
      .slice(0, 15);
  };

  /* ── Row update — recalc amount ── */
  const updRow = (i, patch) => setRows((prev) => {
    const n = [...prev];
    const u = { ...n[i], ...patch };
    u.amount = fmt2(calcRowAmount(u));
    n[i] = u;
    return n;
  });

  /* ── When sale price changes → auto-calc discount ── */
  const onSalePriceChange = (i, val) => {
    setRows((prev) => {
      const n = [...prev];
      const u = { ...n[i], salePrice: val };
      const mrp = asNum(u.mrp), sp = asNum(val);
      u.discount = mrp > 0 ? fmt2(Math.max(0, mrp - sp)) : "";
      u.amount   = fmt2(calcRowAmount(u));
      n[i] = u;
      return n;
    });
  };

  /* ── When discount changes → update sale price ── */
  const onDiscountChange = (i, val) => {
    setRows((prev) => {
      const n = [...prev];
      const u = { ...n[i], discount: val };
      const mrp = asNum(u.mrp);
      const disc = asNum(val);
      if (mrp > 0) {
        const newSP = Math.max(0, mrp - disc);
        u.salePrice = fmt2(newSP);
      }
      u.amount = fmt2(calcRowAmount(u));
      n[i] = u;
      return n;
    });
  };

  /* ── When qty changes — cap at stock if invId set ── */
  const onQtyChange = (i, val) => {
    setRows((prev) => {
      const n = [...prev];
      const u = { ...n[i] };
      // Find stock for this inventory record
      const invRec = u.invId ? inventory.find((inv) => inv.id === u.invId) : null;
      let qty = asNum(val);
      // Keep the typed string for display but floor to stock
      u.qty    = String(qty);
      u.amount = fmt2(calcRowAmount({ ...u, qty }));
      n[i] = u;
      return n;
    });
  };

  /* ── Pick a batch ── */
  const pickBatch = (ri, inv) => {
    setActiveSug(null);
    setSearchText((p) => ({ ...p, [ri]: "" }));
    const invId = asNum(inv.id);
    setRows((prev) => {
      // Check if this batch already exists in another filled row
      const existingIdx = prev.findIndex((r, i) => i !== ri && r.invId === invId && String(r.itemName || "").trim());
      if (existingIdx >= 0) {
        // Increment qty of existing row instead of filling a new one
        const n = [...prev];
        const existing = { ...n[existingIdx] };
        const newQty = asNum(existing.qty) + 1;
        existing.qty = String(newQty);
        existing.amount = fmt2(calcRowAmount(existing));
        n[existingIdx] = existing;
        // Clear the current row search
        n[ri] = blankRow();
        return n;
      }
      // No duplicate — fill the current row
      const mrp  = asNum(inv.mrp);
      const sp   = asNum(inv.sale_price);
      const disc = mrp > 0 ? fmt2(Math.max(0, mrp - sp)) : "";
      const fill = {
        invId: invId, itemId: asNum(inv.item_id),
        itemName: inv.item_name, code: inv.item_code,
        hsn: inv.hsn || "", batchNo: inv.batch_no || "",
        expDate: inv.exp_date || "", mrp: String(mrp),
        salePrice: fmt2(sp), discount: disc,
        tax: String(inv.tax_pct || ""), qty: "1",
      };
      fill.amount = fmt2(calcRowAmount(fill));
      const n = [...prev];
      n[ri] = { ...n[ri], ...fill };
      if (ri === n.length - 1) n.push(blankRow());
      return n;
    });
    // Move focus to qty
    setTimeout(() => qtyRefs.current[ri]?.focus(), 0);
  };

  /* ── Auto-pick if search matches exactly one batch ── */
  const handleSearchChange = (idx, val) => {
    setSearchText((p) => ({ ...p, [idx]: val }));
    setActiveSug(idx);
    setHighlightIdx(-1);
    // Check if exactly one batch matches this code
    const q = val.trim().toLowerCase();
    if (!q) return;
    const matches = inventory.filter((inv) =>
      (inv.item_code || "").toLowerCase() === q ||
      (inv.item_name || "").toLowerCase() === q
    );
    if (matches.length === 1) {
      // Auto-select single match
      pickBatch(idx, matches[0]);
    }
  };

  /* close sug on outside click */
  useEffect(() => {
    const c = () => setActiveSug(null);
    document.addEventListener("click", c);
    return () => document.removeEventListener("click", c);
  }, []);

  /* ══════════════════════════════════════════════════════
     TOTALS  —  correct GST calculation
     ────────────────────────────────────────────────────
     Sale price is tax-inclusive, so:
       taxable (excl)  = amount × 100 / (100 + rate)
       tax portion     = amount − taxable
     Bill discount is applied on taxable amount only,
     then tax is recalculated on (taxable − discount).
  ══════════════════════════════════════════════════════ */

  /* Per-row taxable (excl) and tax portions */
  const rowBreakdown = useMemo(() =>
    rows.map((r) => {
      const amount  = asNum(r.amount);
      const rate    = asNum(r.tax);
      const taxable = rate > 0 ? amount * 100 / (100 + rate) : amount;
      const tax     = amount - taxable;
      const savings = Math.max(0, asNum(r.mrp) - asNum(r.salePrice)) * asNum(r.qty);
      return { amount, taxable, tax, savings };
    }),
  [rows]);

  /* Sums before bill discount */
  const rowTotal       = useMemo(() => rowBreakdown.reduce((a, r) => a + r.amount,   0), [rowBreakdown]);
  const preTaxable     = useMemo(() => rowBreakdown.reduce((a, r) => a + r.taxable,  0), [rowBreakdown]);
  const preTax         = useMemo(() => rowBreakdown.reduce((a, r) => a + r.tax,      0), [rowBreakdown]);
  const totalSavings   = useMemo(() => rowBreakdown.reduce((a, r) => a + r.savings,  0), [rowBreakdown]);

  /* Bill discount — applied on taxable (excl-tax) amount */
  const billDiscValue = useMemo(() => {
    const s = String(billDisc || "").trim();
    if (!s) return 0;
    if (s.endsWith("%")) {
      const n = parseFloat(s);
      return isFinite(n) ? Math.min(preTaxable * n / 100, preTaxable) : 0;
    }
    const n = parseFloat(s);
    return isFinite(n) ? Math.min(n, preTaxable) : 0;
  }, [billDisc, preTaxable]);

  /* After bill discount: taxable shrinks, recalculate tax on it */
  const taxableAfterDisc = useMemo(() => preTaxable - billDiscValue, [preTaxable, billDiscValue]);

  /* Effective overall tax rate from pre-discount values — keep same rate */
  const effectiveTaxRate = useMemo(() =>
    preTaxable > 0 ? preTax / preTaxable : 0,
  [preTax, preTaxable]);

  /* Tax on the discounted taxable base */
  const taxAfterDisc = useMemo(() =>
    taxableAfterDisc * effectiveTaxRate,
  [taxableAfterDisc, effectiveTaxRate]);

  /* Net total = discounted taxable + recalculated tax */
  const afterDisc    = useMemo(() => taxableAfterDisc + taxAfterDisc, [taxableAfterDisc, taxAfterDisc]);
  const roundedTotal = useMemo(() => roundOff ? Math.ceil(afterDisc) : afterDisc, [afterDisc, roundOff]);
  const roundDiff    = useMemo(() => roundedTotal - afterDisc, [roundedTotal, afterDisc]);
  const sumPay       = useMemo(() => payments.reduce((a, p) => a + asNum(p.amount), 0), [payments]);
  const totalPaid    = useMemo(() => multiPay ? sumPay : asNum(received), [multiPay, sumPay, received]);
  const balance      = useMemo(() => roundedTotal - totalPaid, [roundedTotal, totalPaid]);
  const changeReturn = useMemo(() => asNum(cashGiven) - roundedTotal, [cashGiven, roundedTotal]);
  useEffect(() => { if (!multiPay && !recTouched) setReceived(roundedTotal.toFixed(2)); }, [roundedTotal, multiPay, recTouched]);

  /* ── Build print data from current form ── */
  const buildPrintData = () => {
    const printItems = rows.filter((r) => String(r.itemName || "").trim() && asNum(r.qty) > 0).map((r) => ({
      name: r.itemName, mrp: asNum(r.mrp), qty: asNum(r.qty),
      price: asNum(r.salePrice), amount: asNum(r.amount), tax: asNum(r.tax),
    }));
    return {
      invoiceNo, invoiceDate,
      customerType: custType === "Retail" ? "Cash Sale" : custType,
      customerName: custName || "Cash", phone,
      items: printItems,
      totalQty: printItems.reduce((s, i) => s + i.qty, 0),
      subTotal: rowTotal, discount: billDiscValue,
      total: roundedTotal, received: totalPaid, balance,
    };
  };

  /* ── Print current invoice (without saving) ── */
  const onPrint = () => {
    const data = buildPrintData();
    if (!data.items.length) return showToast("Add at least one item to print");
    printReceipt(data);
  };

  /* ── Save ── */
  const onSave = async (andPrint = false) => {
    if (!invoiceNo.trim()) return showToast("Invoice number required");
    const cleanRows = rows.map((r) => ({
      invId: asNum(r.invId),               // inventory record PK — used to resolve gst_flag
      itemName: String(r.itemName || "").trim(),
      code: String(r.code || "").trim(),
      hsn: String(r.hsn || "").trim(),
      batchNo: String(r.batchNo || "").trim(),
      expDate: r.expDate || "",
      mrp: asNum(r.mrp),
      qty: asNum(r.qty),
      price: asNum(r.salePrice),        // invoice_items column is "price"
      discount: String(r.discount || "").trim(),
      tax: asNum(r.tax),
      amount: asNum(r.amount),
    })).filter((r) => r.itemName && r.qty > 0);
    if (!cleanRows.length) return showToast("Add at least one item");
    const payList = multiPay
      ? payments.map((p) => ({ type: p.type, amount: asNum(p.amount) })).filter((p) => p.amount > 0)
      : [{ type: payMode, amount: asNum(received) }];
    const totals = {
      grandTotal: fmt2(rowTotal),
      billDiscount: billDisc,
      billDiscountValue: fmt2(billDiscValue),
      finalTotal: fmt2(afterDisc),
      roundOffEnabled: roundOff,
      roundedFinalTotal: fmt2(roundedTotal),
      roundOffDiff: fmt2(roundDiff),
      received: fmt2(totalPaid),
      balance: fmt2(balance),
      taxableAmount: fmt2(taxableAfterDisc),
      taxAmount: fmt2(taxAfterDisc),
    };
    try {
      setSaving(true);
      const url  = isEdit ? `${API}/update_invoice.php` : `${API}/save_invoice.php`;
      const body = {
        invoiceNo, invoiceDate,
        customerType: custType,
        customerName: custName || "Cash",
        phone, customerGstin: custGstin.trim(),
        rows: cleanRows, payments: payList, totals,
        ...(isEdit ? { invoiceId: Number(invoiceId), updatedBy: user?.id || 1 } : { createdBy: user?.id || 1 }),
      };
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Failed");
      const shouldPrint = andPrint || (!isEdit && getShopSettings().autoPrint);
      if (shouldPrint) {
        printReceipt(buildPrintData());
        setTimeout(() => { window.location.href = "/sales"; }, 1500);
      } else {
        window.location.href = "/sales";
      }
    } catch (e) { showToast(e.message || "Failed"); } finally { setSaving(false); }
  };

  // Ctrl+S shortcut
  useEffect(() => {
    const fn = () => { if (!saving) onSave(false); };
    window.addEventListener("shortcut-save", fn);
    return () => window.removeEventListener("shortcut-save", fn);
  }, [saving, onSave]);

  const filledCount = rows.filter((r) => String(r.itemName || "").trim()).length;
  const today = todayISO();

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <div id="g-root" style={{ padding: "18px 24px", background: C.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
          background: "#1e293b", color: "#fff", padding: "10px 24px", borderRadius: 10,
          fontSize: 14, fontWeight: 700, boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          animation: "fadeIn 0.2s",
        }}>{toast}</div>
      )}

      {/* ── COMPACT HEADER BAR ── */}
      <div style={{
        background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 14, padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        {/* Invoice Date */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.brand, borderRadius: 9, padding: "6px 14px", color: "#fff" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.8, textTransform: "uppercase" }}>Bill Date</div>
            <DateInput value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
              style={{ background: "none", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", outline: "none", padding: 0, cursor: "pointer", width: 120 }} />
          </div>
        </div>

        {/* Invoice No */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 100 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>Invoice No</span>
          <input className="g-inp sm" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="Auto" style={{ height: 30, fontSize: 13, fontWeight: 700 }} />
        </div>

        {/* Refresh suggestions (re-fetch inventory only — form state preserved) */}
        <button className="g-btn ghost sm" onClick={loadInventory} disabled={loadingInv}
          title="Refresh item suggestions from latest inventory" style={{ height: 30 }}>
          <FiRefreshCw size={13} style={{ animation: loadingInv ? "spin 1s linear infinite" : "none" }} />
        </button>

        <div style={{ width: 1, height: 32, background: "#e5e7eb" }} />

        {/* Customer Name */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 140 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>Customer Name</span>
          <input className="g-inp sm" value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Cash" style={{ height: 30, fontSize: 13 }} />
        </div>

        {/* Phone */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 120 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>Phone</span>
          <input className="g-inp sm" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" type="tel" style={{ height: 30, fontSize: 13 }} />
        </div>

        {/* GST Number */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 150 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>GST Number</span>
          <input className="g-inp sm" value={custGstin} onChange={(e) => setCustGstin(e.target.value.toUpperCase())} placeholder="Optional" maxLength={15} style={{ height: 30, fontSize: 13, letterSpacing: "0.03em" }} />
        </div>

        <div style={{ flex: "0 0 auto", display: "flex", gap: 8, alignItems: "center", marginLeft: "auto" }}>
          <button className="g-btn success sm" onClick={() => onSave(false)} disabled={saving} style={{ minWidth: 90 }}>
            <FiCheck size={14} />{saving ? "Saving…" : isEdit ? "Update" : "Save"}
          </button>
          <button className="g-btn primary sm" onClick={() => onSave(true)} disabled={saving} title="Save & Print">
            <FiPrinter size={14} />
          </button>
        </div>
      </div>

      {/* ── STEP 2: ITEMS ── */}
      <div className="g-card" style={{ marginBottom: 18 }}>
        <SectionHead num="2" icon={<FiShoppingCart size={15} />}
          title={`Items${filledCount > 0 ? ` — ${filledCount} added` : ""}`}
        />

        <div>
          <table className="g-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 30, paddingLeft: 10 }}>#</th>
                <th style={{ minWidth: 320 }}>Item</th>
                <th style={{ minWidth: 100, textAlign: "right" }}>Expiry</th>
                <th style={{ minWidth: 100, textAlign: "right" }}>MRP</th>
                <th style={{ minWidth: 100, textAlign: "right" }}>Disc</th>
                <th style={{ minWidth: 100, textAlign: "right" }}>Sale ₹</th>
                <th style={{ minWidth: 100, textAlign: "right" }}>Tax%</th>
                <th style={{ minWidth: 100, textAlign: "right" }}>Qty</th>
                <th style={{ minWidth: 100, textAlign: "right", paddingRight: 10 }}>Amount</th>
                <th style={{ width: 32 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const st       = searchText[idx] !== undefined ? searchText[idx] : r.itemName;
                const sug      = getInvSug(st);
                const filled   = r.itemName.trim();
                const isExpired = r.expDate && r.expDate < today;

                // Stock for this row
                const invRec   = r.invId ? inventory.find((inv) => inv.id === r.invId) : null;
                const stockQty = invRec ? asNum(invRec.current_qty) : null;
                const isZeroStock = stockQty !== null && stockQty <= 0;

                // Discount % for display
                const dPct = filled ? discountPct(r.mrp, r.salePrice) : 0;

                return (
                  <tr key={idx} style={{ background: isZeroStock && filled ? "#fff5f5" : undefined }}>
                    <td style={{ paddingLeft: 8 }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", background: filled ? C.greenLight : "#f3f4f6", color: filled ? C.green : C.textSub, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>{idx + 1}</div>
                    </td>

                    {/* ── Item search & display ── */}
                    <td style={{ position: "relative" }}>
                      {filled ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 6px" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.itemName}</div>
                            <div style={{ fontSize: 11, color: C.textSub, display: "flex", gap: 6, flexWrap: "wrap", marginTop: 1 }}>
                              <span>{r.code}</span>
                              {r.batchNo && <span>· {r.batchNo}</span>}
                              {stockQty !== null && (
                                <span style={{ fontWeight: 700, color: isZeroStock ? C.red : C.green }}>
                                  · {isZeroStock ? "Out of stock" : `${stockQty} left`}
                                </span>
                              )}
                            </div>
                            {isExpired && <div style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>⚠ EXPIRED</div>}
                          </div>
                          <button onClick={() => { updRow(idx, blankRow()); setSearchText((p) => ({ ...p, [idx]: "" })); }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, padding: 3, borderRadius: 4, display: "flex", flexShrink: 0 }}>
                            <FiX size={13} />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ position: "relative" }}>
                            <FiSearch size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: C.textLight, pointerEvents: "none" }} />
                            <input ref={(el) => (searchRefs.current[idx] = el)} className="g-td-inp item-search" value={st}
                              onChange={(e) => handleSearchChange(idx, e.target.value)}
                              onFocus={() => { setActiveSug(idx); setHighlightIdx(-1); }}
                              onBlur={() => { if (!r.itemName.trim()) setTimeout(() => setSearchText((p) => ({ ...p, [idx]: "" })), 150); }}
                              onKeyDown={(e) => {
                                if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIdx((h) => Math.min(h + 1, sug.length - 1)); }
                                else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIdx((h) => Math.max(h - 1, 0)); }
                                else if (e.key === "Enter" && highlightIdx >= 0 && sug[highlightIdx]) { e.preventDefault(); pickBatch(idx, sug[highlightIdx]); setHighlightIdx(-1); }
                                else if (e.key === "Escape") { setActiveSug(null); setHighlightIdx(-1); }
                              }}
                              placeholder={idx === 0 ? "Search or scan code…" : ""}
                              autoComplete="off" />
                          </div>

                          {/* Suggestions dropdown */}
                          {activeSug === idx && sug.length > 0 && (
                            <div onMouseDown={(e) => e.stopPropagation()}
                              style={{ position: "absolute", top: "100%", left: 0, width: 650, zIndex: 30, background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.15)", maxHeight: 380, overflow: "hidden" }}>
                              {/* Header row */}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 80px 80px 50px", gap: 0, padding: "8px 16px", background: "#f1f5f9", borderBottom: "1.5px solid #e2e8f0" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>Item</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>Batch</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>Expiry</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", textAlign: "right" }}>MRP</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", textAlign: "center" }}>Qty</span>
                              </div>
                              <div style={{ maxHeight: 340, overflowY: "auto" }}>
                              {(() => { return sug.map((inv, si) => {
                                const isExp  = inv.exp_date && inv.exp_date < today;
                                const qty    = asNum(inv.current_qty);
                                const isZero = qty <= 0;
                                const isHl = si === highlightIdx;
                                return (
                                  <div key={inv.id} onMouseDown={() => pickBatch(idx, inv)}
                                    style={{
                                      display: "grid", gridTemplateColumns: "1fr 90px 80px 80px 50px", gap: 0,
                                      padding: "10px 16px", cursor: "pointer",
                                      borderBottom: "1px solid #f3f4f6",
                                      background: isHl ? "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)" : "#fff",
                                      color: isHl ? "#fff" : C.text,
                                      opacity: 1,
                                      transition: "background 0.1s",
                                    }}
                                    onMouseEnter={(e) => { if (!isHl) e.currentTarget.style.background = "#f0f9ff"; }}
                                    onMouseLeave={(e) => { if (!isHl) e.currentTarget.style.background = "#fff"; }}>
                                    {/* Item name + code */}
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                        color: isHl ? "#fff" : isZero ? C.textLight : C.text }}>
                                        {inv.item_name}
                                      </div>
                                      <div style={{ fontSize: 11, marginTop: 1, color: isHl ? "rgba(255,255,255,0.75)" : C.textSub }}>
                                        {inv.item_code}
                                      </div>
                                    </div>
                                    {/* Batch */}
                                    <div style={{ fontSize: 12, color: isHl ? "rgba(255,255,255,0.9)" : C.textSub, display: "flex", alignItems: "center" }}>
                                      {inv.batch_no || "—"}
                                    </div>
                                    {/* Expiry */}
                                    <div style={{ fontSize: 12, display: "flex", alignItems: "center",
                                      color: isExp ? (isHl ? "#fecaca" : C.red) : (isHl ? "rgba(255,255,255,0.9)" : C.textSub),
                                      fontWeight: isExp ? 700 : 400 }}>
                                      {inv.exp_date ? fmtDate(inv.exp_date) : "—"}
                                    </div>
                                    {/* MRP */}
                                    <div style={{ fontSize: 13, fontWeight: 700, textAlign: "right", display: "flex", alignItems: "center", justifyContent: "flex-end",
                                      color: isHl ? "#fff" : C.text }}>
                                      ₹{inv.mrp}
                                    </div>
                                    {/* Stock */}
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <span style={{
                                        fontWeight: 800, fontSize: 13,
                                        color: isHl ? "#fff" : isZero ? C.red : C.text,
                                      }}>
                                        {isZero ? "0" : qty}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }); })()}
                              </div>
                            </div>
                          )}
                          {activeSug === idx && String(st || "").trim().length > 0 && sug.length === 0 && (
                            <div style={{ position: "absolute", top: "100%", left: 0, width: 300, zIndex: 30, background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 10, boxShadow: "0 8px 20px rgba(0,0,0,0.08)", padding: "14px 16px" }}>
                              <div style={{ fontSize: 13, color: C.textSub }}>No stock found. Add stock via Purchase first.</div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Expiry */}
                    <td style={{ fontSize: 12, color: isExpired ? C.red : C.textSub, fontWeight: isExpired ? 700 : 400, textAlign: "right", paddingRight: 8 }}>
                      {r.expDate ? r.expDate.split("-").reverse().join("/") : "—"}
                    </td>

                    {/* MRP */}
                    <td>
                      <input className="g-td-inp num" value={r.mrp}
                        onChange={(e) => {
                          setRows((prev) => {
                            const n = [...prev];
                            const u = { ...n[i], mrp: e.target.value };
                            const mrpN = asNum(e.target.value), spN = asNum(u.salePrice);
                            u.discount = mrpN > 0 ? fmt2(Math.max(0, mrpN - spN)) : u.discount;
                            u.amount = fmt2(calcRowAmount(u));
                            n[idx] = u;
                            return n;
                          });
                        }}
                        inputMode="decimal" placeholder="0"
                        style={{ color: C.textSub }}
                      />
                    </td>

                    {/* Discount */}
                    <td>
                      <input className="g-td-inp num" value={r.discount}
                        onChange={(e) => onDiscountChange(idx, e.target.value)}
                        inputMode="decimal" placeholder="0"
                      />
                      {dPct > 0 && filled && (
                        <div style={{ fontSize: 9, color: C.green, fontWeight: 700, textAlign: "right", paddingRight: 6 }}>
                          {dPct.toFixed(0)}%
                        </div>
                      )}
                    </td>

                    {/* Sale Price */}
                    <td>
                      <input className="g-td-inp num" value={r.salePrice}
                        onChange={(e) => onSalePriceChange(idx, e.target.value)}
                        inputMode="decimal" placeholder="0"
                        style={{ fontWeight: 600 }}
                      />
                    </td>

                    {/* Tax % */}
                    <td>
                      <input className="g-td-inp num" value={r.tax}
                        onChange={(e) => updRow(idx, { tax: e.target.value })}
                        inputMode="decimal" placeholder="0"
                        style={{ textAlign: "center", color: asNum(r.tax) > 0 ? C.brand : C.textSub }}
                      />
                    </td>

                    {/* Qty */}
                    <td>
                      <input
                        ref={(el) => (qtyRefs.current[idx] = el)}
                        className="g-td-inp num"
                        value={r.qty}
                        onChange={(e) => onQtyChange(idx, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const next = idx + 1; setTimeout(() => searchRefs.current[next]?.focus(), 0); } }}
                        inputMode="numeric" placeholder="0"
                        style={{ textAlign: "center", fontWeight: 600 }}
                      />
                      {filled && stockQty !== null && (
                        <div style={{ fontSize: 9, textAlign: "center", fontWeight: 700,
                          color: isZeroStock ? C.red : C.textLight }}>
                          {isZeroStock ? "0" : stockQty}
                        </div>
                      )}
                    </td>

                    {/* Amount */}
                    <td style={{ textAlign: "right", paddingRight: 10 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: filled ? C.text : "#d1d5db" }}>
                        {filled ? `₹${fmt2(r.amount)}` : "—"}
                      </div>
                    </td>

                    {/* Delete */}
                    <td style={{ paddingRight: 8 }}>
                      <button onClick={() => { if (rows.length > 1) setRows((p) => p.filter((_, i) => i !== idx)); }}
                        disabled={rows.length <= 1}
                        style={{ background: "none", border: "none", cursor: rows.length <= 1 ? "not-allowed" : "pointer", color: "#d1d5db", padding: 6, borderRadius: 6, display: "flex", transition: "color 0.15s" }}
                        onMouseEnter={(e) => { if (rows.length > 1) e.currentTarget.style.color = C.red; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "#d1d5db"; }}>
                        <FiTrash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 18px" }}>
          <button className="g-btn ghost sm" onClick={() => setRows((p) => [...p, blankRow()])}>
            <FiPlus size={13} /> Add Row
          </button>
        </div>
      </div>

      {/* ── STEP 3: PAYMENT + SUMMARY ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 18, alignItems: "start" }}>

        {/* ── Payment ── */}
        <div className="g-card" style={{ marginBottom: 0 }}>
          <SectionHead num="3" icon={<FiShoppingCart size={15} />} title="Payment"
            actions={
              <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: 3, gap: 3 }}>
                {["Single", "Multiple"].map((m) => {
                  const active = (m === "Multiple") === multiPay;
                  return (
                    <button key={m} onClick={() => { setMultiPay(m === "Multiple"); if (m === "Single") { setRecTouched(false); setPayments([{ type: "Cash", amount: "" }]); } }}
                      style={{ padding: "4px 12px", borderRadius: 6, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.15s", background: active ? C.brand : "transparent", color: active ? "#fff" : C.textSub }}>
                      {m}
                    </button>
                  );
                })}
              </div>
            }
          />
          <div style={{ padding: 18 }}>
            {!multiPay ? (
              <div style={{ display: "grid", gridTemplateColumns: "200px 1fr auto", gap: 14, alignItems: "end" }}>
                <Field label="Mode">
                  <select className="g-sel" value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                    {PAY_MODES.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Amount Received (₹)">
                  <input className="g-inp" value={received} onChange={(e) => { setRecTouched(true); setReceived(e.target.value); }} inputMode="decimal" placeholder="0.00" />
                </Field>
                <div style={{ paddingBottom: 2, textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: C.textSub, fontWeight: 700, marginBottom: 4 }}>Balance</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: balance <= 0 ? C.green : C.orange }}>₹{fmt2(balance)}</div>
                </div>
              </div>
            ) : (
              <div>
                {payments.map((p, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "180px 1fr 38px", gap: 12, alignItems: "end", marginBottom: 12 }}>
                    <Field label={i === 0 ? "Mode" : ""}>
                      <select className="g-sel" value={p.type} onChange={(e) => setPayments((prev) => { const n = [...prev]; n[i] = { ...n[i], type: e.target.value }; return n; })}>
                        {PAY_MODES.map((m) => <option key={m}>{m}</option>)}
                      </select>
                    </Field>
                    <Field label={i === 0 ? "Amount (₹)" : ""}>
                      <input className="g-inp" value={p.amount} onChange={(e) => setPayments((prev) => { const n = [...prev]; n[i] = { ...n[i], amount: e.target.value }; return n; })} inputMode="decimal" placeholder="0.00" />
                    </Field>
                    <div style={{ paddingBottom: 2 }}>
                      {payments.length > 1 && <button className="g-btn danger sm" onClick={() => setPayments((p) => p.filter((_, j) => j !== i))}><FiX size={13} /></button>}
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1.5px solid #f3f4f6" }}>
                  <button className="g-btn ghost sm" onClick={() => setPayments((p) => [...p, { type: "Cash", amount: "" }])}><FiPlus size={13} /> Add</button>
                  <div style={{ display: "flex", gap: 24 }}>
                    {[{ l: "Received", v: fmt2(sumPay), c: C.text }, { l: "Balance", v: fmt2(balance), c: balance <= 0 ? C.green : C.orange }].map(({ l, v, c }) => (
                      <div key={l} style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, color: C.textSub, fontWeight: 700 }}>{l}</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: c }}>₹{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {/* Cash given / Change return */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16,
              padding: "14px 16px", background: "#fffbeb", borderRadius: 10, border: "1.5px solid #fde68a",
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, marginBottom: 4, textTransform: "uppercase" }}>Cash Given by Customer</div>
                <input className="g-inp" value={cashGiven} onChange={(e) => setCashGiven(e.target.value)}
                  inputMode="decimal" placeholder="0.00"
                  style={{ fontSize: 20, fontWeight: 800, textAlign: "right" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "flex-end" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, marginBottom: 4, textTransform: "uppercase" }}>Change Return</div>
                <div style={{
                  fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em",
                  color: asNum(cashGiven) > 0 && changeReturn >= 0 ? C.green : asNum(cashGiven) > 0 ? C.red : C.textLight,
                }}>
                  {asNum(cashGiven) > 0 ? `₹${fmt2(changeReturn)}` : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Summary ── */}
        <div className="g-card" style={{ marginBottom: 0 }}>
          <div className="g-card-head"><div className="g-card-title">Summary</div></div>
          <div className="g-card-body">

            {/* ── Row total (tax-inclusive) ── */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, paddingBottom: 10, borderBottom: "1px solid #f3f4f6", marginBottom: 10 }}>
              <span style={{ color: C.textSub }}>Gross Total</span>
              <span style={{ fontWeight: 700 }}>₹{fmt2(rowTotal)}</span>
            </div>

            {/* ── Taxable & Tax breakdown ── */}
            <div style={{ background: "#f8fafc", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: C.textSub }}>Taxable Amount</span>
                <span style={{ fontWeight: 600 }}>₹{fmt2(preTaxable)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: C.brand, fontWeight: 600 }}>
                  <FiTag size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  GST / Tax
                </span>
                <span style={{ fontWeight: 700, color: C.brand }}>₹{fmt2(preTax)}</span>
              </div>
            </div>

            {/* ── Customer savings ── */}
            {totalSavings > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 12, padding: "7px 12px", background: C.greenLight, borderRadius: 7 }}>
                <span style={{ color: C.green, fontWeight: 600 }}>🎉 Customer saves (MRP disc.)</span>
                <span style={{ fontWeight: 800, color: C.green }}>₹{fmt2(totalSavings)}</span>
              </div>
            )}

            {/* ── Bill discount (on taxable) ── */}
            <div style={{ marginBottom: billDiscValue > 0 ? 6 : 12, paddingTop: 0 }}>
              <Field label="Bill Discount (on taxable amount)">
                <input className="g-inp sm" value={billDisc} onChange={(e) => setBillDisc(e.target.value)} placeholder="e.g. 10 or 10%" />
              </Field>
            </div>

            {billDiscValue > 0 && (
              <div style={{ background: "#fff5f5", border: "1.5px solid #fca5a5", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                  <span style={{ color: C.red }}>Discount on taxable</span>
                  <span style={{ fontWeight: 700, color: C.red }}>−₹{fmt2(billDiscValue)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                  <span style={{ color: C.textSub }}>Taxable after disc.</span>
                  <span style={{ fontWeight: 600 }}>₹{fmt2(taxableAfterDisc)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: C.brand }}>Tax on discounted base</span>
                  <span style={{ fontWeight: 700, color: C.brand }}>₹{fmt2(taxAfterDisc)}</span>
                </div>
              </div>
            )}

            {/* ── Round off ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, padding: "9px 12px", background: "#f8fafc", borderRadius: 8, border: "1.5px solid #e5e7eb" }}>
              <label htmlFor="sround" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.text }}>
                <input type="checkbox" id="sround" checked={roundOff} onChange={(e) => setRoundOff(e.target.checked)} style={{ width: 16, height: 16, accentColor: C.brand }} />
                Round off
              </label>
              <span style={{ fontSize: 13, fontWeight: 700, color: roundOff ? C.green : C.textSub }}>
                {roundOff ? `+₹${fmt2(roundDiff)}` : "Off"}
              </span>
            </div>

            {/* ── Grand Total ── */}
            <div style={{ background: C.green, borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, boxShadow: "0 3px 10px rgba(22,163,74,0.25)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>Grand Total</div>
                {billDiscValue > 0 && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
                    incl. ₹{fmt2(taxAfterDisc)} tax
                  </div>
                )}
                {!billDiscValue && preTax > 0 && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
                    incl. ₹{fmt2(preTax)} tax
                  </div>
                )}
              </div>
              <span style={{ fontWeight: 900, fontSize: 22, color: "#fff" }}>₹{fmt2(roundedTotal)}</span>
            </div>

            <button className="g-btn success lg" onClick={() => onSave(false)} disabled={saving}>
              <FiCheck size={16} />{saving ? "Saving…" : isEdit ? "Update Invoice" : "Save Invoice"}
            </button>
            <button className="g-btn primary lg" onClick={() => onSave(true)} disabled={saving} style={{ marginTop: 8, width: "100%" }}>
              <FiPrinter size={16} /> Save & Print
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL: SHOP / PRINTER SETTINGS ── */}
      <Modal show={showShopSettings} title="Shop & Printer Settings" onClose={() => setShowShopSettings(false)} width={480}
        footer={<>
          <button className="g-btn ghost" onClick={() => setShowShopSettings(false)}>Cancel</button>
          <button className="g-btn primary" onClick={() => { saveShopSettings(shopForm); setShowShopSettings(false); showToast("Settings saved!"); }}>Save Settings</button>
        </>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Shop Name">
            <input className="g-inp" value={shopForm.name} onChange={(e) => setShopForm((p) => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="Address">
            <input className="g-inp" value={shopForm.address} onChange={(e) => setShopForm((p) => ({ ...p, address: e.target.value }))} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="State">
              <input className="g-inp" value={shopForm.state} onChange={(e) => setShopForm((p) => ({ ...p, state: e.target.value }))} />
            </Field>
            <Field label="Phone">
              <input className="g-inp" value={shopForm.phone} onChange={(e) => setShopForm((p) => ({ ...p, phone: e.target.value }))} />
            </Field>
          </div>
          <Field label="GSTIN">
            <input className="g-inp" value={shopForm.gstin} onChange={(e) => setShopForm((p) => ({ ...p, gstin: e.target.value }))} />
          </Field>
          <Field label="Receipt Footer Text">
            <input className="g-inp" value={shopForm.footer} onChange={(e) => setShopForm((p) => ({ ...p, footer: e.target.value }))} />
          </Field>
          <Field label="Paper Width">
            <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 8, padding: 3 }}>
              {["58mm", "80mm"].map((w) => (
                <button key={w} onClick={() => setShopForm((p) => ({ ...p, paperWidth: w }))} style={{
                  flex: 1, padding: "6px 0", border: "none", borderRadius: 6, cursor: "pointer",
                  fontWeight: 700, fontSize: 13,
                  background: shopForm.paperWidth === w ? C.brand : "transparent",
                  color: shopForm.paperWidth === w ? "#fff" : C.textSub,
                }}>{w}</button>
              ))}
            </div>
          </Field>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1.5px solid #e5e7eb" }}>
            <input type="checkbox" id="autoPrintChk" checked={shopForm.autoPrint || false} onChange={(e) => setShopForm((p) => ({ ...p, autoPrint: e.target.checked }))} style={{ width: 18, height: 18, accentColor: C.brand }} />
            <label htmlFor="autoPrintChk" style={{ fontSize: 13, fontWeight: 600, cursor: "pointer", color: C.text }}>
              Auto-print receipt after saving invoice
            </label>
          </div>
          <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: C.green }}>
            Settings are saved in your browser. Set your thermal printer as the default printer in your OS for one-click printing.
          </div>
        </div>
      </Modal>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(-10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>
    </div>
  );
}
