import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiCheck, FiPlus, FiShoppingCart, FiX, FiTrash2, FiSearch, FiTag } from "react-icons/fi";
import { C, GLOBAL_CSS, API, Field, asNum, todayISO, fmt2 } from "../ui.jsx";

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

  const [custType, setCustType]   = useState("Retail");
  const [custName, setCustName]   = useState("");
  const [phone, setPhone]         = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayISO());

  const [rows, setRows]           = useState([blankRow(), blankRow()]);
  const [activeSug, setActiveSug] = useState(null);
  const [searchText, setSearchText] = useState({});
  const qtyRefs = useRef({});

  const [inventory, setInventory] = useState([]);

  const [billDisc, setBillDisc]   = useState("");
  const [roundOff, setRoundOff]   = useState(true);

  const [multiPay, setMultiPay]   = useState(false);
  const [payMode, setPayMode]     = useState("Cash");
  const [received, setReceived]   = useState("0");
  const [recTouched, setRecTouched] = useState(false);
  const [payments, setPayments]   = useState([{ type: "Cash", amount: "" }]);

  const [saving, setSaving]       = useState(false);

  /* ── Load inventory with include_zero=1 so all batches show ── */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/get_inventory.php?include_zero=1`);
        const j = await r.json();
        if (j.status === "success") setInventory(j.data || []);
      } catch { }
    })();
  }, []);

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
      } catch (e) { alert(e.message || "Load failed"); }
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
      .slice(0, 12);
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
      const stock  = invRec ? asNum(invRec.current_qty) : Infinity;
      let qty = asNum(val);
      // Cap qty at available stock
      if (qty > stock) qty = stock;
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
    const mrp  = asNum(inv.mrp);
    const sp   = asNum(inv.sale_price);
    const disc = mrp > 0 ? fmt2(Math.max(0, mrp - sp)) : "";
    const fill = {
      invId: asNum(inv.id), itemId: asNum(inv.item_id),
      itemName: inv.item_name, code: inv.item_code,
      hsn: inv.hsn || "", batchNo: inv.batch_no || "",
      expDate: inv.exp_date || "", mrp: String(mrp),
      salePrice: fmt2(sp), discount: disc,
      tax: String(inv.tax_pct || ""), qty: "1",
    };
    fill.amount = fmt2(calcRowAmount(fill));
    setRows((prev) => {
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
  useEffect(() => { if (!multiPay && !recTouched) setReceived(roundedTotal.toFixed(2)); }, [roundedTotal, multiPay, recTouched]);

  /* ── Save ── */
  const onSave = async () => {
    if (!invoiceNo.trim()) return alert("Invoice number required");
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
    if (!cleanRows.length) return alert("Add at least one item");
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
        phone, rows: cleanRows, payments: payList, totals,
        ...(isEdit ? { invoiceId: Number(invoiceId), updatedBy: 1 } : {}),
      };
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Failed");
      alert(isEdit ? "Invoice Updated!" : "Invoice Saved!");
      window.location.href = "/sales";
    } catch (e) { alert(e.message || "Failed"); } finally { setSaving(false); }
  };

  // Ctrl+S shortcut
  useEffect(() => {
    const fn = () => { if (!saving) onSave(); };
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

      {/* PAGE HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: C.green, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", boxShadow: "0 3px 10px rgba(22,163,74,0.3)" }}>
            <FiShoppingCart size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.text }}>{isEdit ? "Edit Invoice" : "New Sale"}</h2>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: C.textSub }}>{isEdit ? `Invoice #${invoiceId}` : "Add items and save"}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="g-btn ghost" onClick={() => window.history.back()}>← Back</button>
          <button className="g-btn success" onClick={onSave} disabled={saving} style={{ minWidth: 130 }}>
            <FiCheck size={14} />{saving ? "Saving…" : isEdit ? "Update" : "Save Invoice"}
          </button>
        </div>
      </div>

      {/* ── STEP 1: CUSTOMER ── */}
      <div className="g-card" style={{ marginBottom: 18 }}>
        <SectionHead num="1" icon={<FiShoppingCart size={15} />} title="Customer & Invoice Details" />
        <div style={{ padding: 18 }}>
          <div className="g-grid-2">
            <Field label="Invoice No" required>
              <input className="g-inp" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="Auto-generated" />
            </Field>
            <Field label="Invoice Date" required>
              <input className="g-inp" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </Field>
            <Field label="Customer Type">
              <select className="g-sel" value={custType} onChange={(e) => setCustType(e.target.value)}>
                {["Retail", "Wholesale", "Credit"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Customer Name" hint="Leave blank for cash sale">
              <input className="g-inp" value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Cash" />
            </Field>
            <Field label="Phone">
              <input className="g-inp" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" type="tel" />
            </Field>
          </div>
        </div>
      </div>

      {/* ── STEP 2: ITEMS ── */}
      <div className="g-card" style={{ marginBottom: 18 }}>
        <SectionHead num="2" icon={<FiShoppingCart size={15} />}
          title={`Items${filledCount > 0 ? ` — ${filledCount} added` : ""}`}
        />

        <div style={{ overflowX: "auto" }}>
          <table className="g-table" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th style={{ width: 36, paddingLeft: 14 }}>#</th>
                <th style={{ minWidth: 200 }}>Item</th>
                <th style={{ minWidth: 90 }}>Expiry</th>
                <th style={{ minWidth: 80 }}>MRP ₹</th>
                <th style={{ minWidth: 95 }}>
                  Discount ₹
                  <div style={{ fontSize: 9.5, fontWeight: 500, color: C.textLight, textTransform: "none", letterSpacing: 0 }}>MRP − Sale</div>
                </th>
                <th style={{ minWidth: 95 }}>
                  Sale Price ₹
                  <div style={{ fontSize: 9.5, fontWeight: 500, color: C.textLight, textTransform: "none", letterSpacing: 0 }}>Tax-inclusive</div>
                </th>
                <th style={{ minWidth: 70 }}>
                  Tax %
                  <div style={{ fontSize: 9.5, fontWeight: 500, color: C.textLight, textTransform: "none", letterSpacing: 0 }}>GST rate</div>
                </th>
                <th style={{ minWidth: 90 }}>
                  Qty
                  <div style={{ fontSize: 9.5, fontWeight: 500, color: C.textLight, textTransform: "none", letterSpacing: 0 }}>Max = stock</div>
                </th>
                <th style={{ minWidth: 95, textAlign: "right", paddingRight: 14 }}>
                  Amount ₹
                  <div style={{ fontSize: 9.5, fontWeight: 500, color: C.textLight, textTransform: "none", letterSpacing: 0 }}>Qty × Sale</div>
                </th>
                <th style={{ width: 40 }}></th>
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
                    <td style={{ paddingLeft: 12 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: filled ? C.greenLight : "#f3f4f6", color: filled ? C.green : C.textSub, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{idx + 1}</div>
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
                            <FiSearch size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: C.textLight, pointerEvents: "none" }} />
                            <input className="g-td-inp" style={{ paddingLeft: 26 }} value={st}
                              onChange={(e) => handleSearchChange(idx, e.target.value)}
                              onFocus={() => setActiveSug(idx)}
                              placeholder={idx === 0 ? "Search or scan code…" : ""}
                              autoComplete="off" />
                          </div>

                          {/* Suggestions dropdown */}
                          {activeSug === idx && sug.length > 0 && (
                            <div onMouseDown={(e) => e.stopPropagation()}
                              style={{ position: "absolute", top: "100%", left: 0, width: 420, zIndex: 30, background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: 300, overflow: "auto" }}>
                              <div style={{ padding: "6px 12px", fontSize: 11, fontWeight: 700, color: C.textSub, background: "#f8fafc", borderBottom: "1px solid #f3f4f6", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                Select batch from inventory
                              </div>
                              {sug.map((inv) => {
                                const isExp  = inv.exp_date && inv.exp_date < today;
                                const qty    = asNum(inv.current_qty);
                                const isZero = qty <= 0;
                                const savePct = discountPct(inv.mrp, inv.sale_price);
                                return (
                                  <div key={inv.id} className="g-sug" onMouseDown={() => pickBatch(idx, inv)}
                                    style={{ padding: "9px 14px", borderBottom: "1px solid #f3f4f6", background: isZero ? "#fafafa" : "#fff" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: isZero ? C.textSub : C.text }}>
                                          {inv.item_name}
                                          <span style={{ color: C.textLight, fontWeight: 400, fontSize: 11, marginLeft: 4 }}>({inv.item_code})</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>
                                          Batch: <strong>{inv.batch_no || "—"}</strong>
                                          {" · "}Exp: <span style={{ color: isExp ? C.red : C.textSub, fontWeight: isExp ? 700 : 400 }}>{inv.exp_date || "—"}</span>
                                          {" · "}MRP: <strong>₹{inv.mrp}</strong>
                                          {" · "}Sale: <strong>₹{inv.sale_price}</strong>
                                          {savePct > 0 && <span style={{ color: C.green }}> ({savePct.toFixed(1)}% off)</span>}
                                        </div>
                                      </div>
                                      <div style={{ flexShrink: 0, textAlign: "center", minWidth: 76 }}>
                                        <div style={{
                                          padding: "3px 8px", borderRadius: 6, fontWeight: 800, fontSize: 12,
                                          background: isZero ? C.redLight : isExp ? C.yellowLight : C.greenLight,
                                          color: isZero ? C.red : isExp ? C.yellow : C.green,
                                          border: `1px solid ${isZero ? "#fca5a5" : isExp ? "#fde047" : "#86efac"}`,
                                        }}>
                                          {isZero ? "No stock" : `${qty} left`}
                                        </div>
                                        {isExp && <div style={{ fontSize: 9, color: C.red, fontWeight: 700, marginTop: 2 }}>EXPIRED</div>}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {activeSug === idx && String(st || "").trim().length > 0 && sug.length === 0 && (
                            <div style={{ position: "absolute", top: "100%", left: 0, width: 260, zIndex: 30, background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 10, boxShadow: "0 8px 20px rgba(0,0,0,0.08)", padding: "12px 14px" }}>
                              <div style={{ fontSize: 12, color: C.textSub }}>No stock found. Add stock via Purchase first.</div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Expiry */}
                    <td style={{ fontSize: 12, color: isExpired ? C.red : C.textSub, fontWeight: isExpired ? 700 : 400, paddingLeft: 10 }}>
                      {r.expDate || "—"}
                    </td>

                    {/* MRP — read only after batch picked */}
                    <td>
                      <input className="g-td-inp" value={r.mrp}
                        onChange={(e) => {
                          // When MRP changes, recalc discount keeping sale price
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

                    {/* Discount — editable, updates sale price */}
                    <td>
                      <input className="g-td-inp" value={r.discount}
                        onChange={(e) => onDiscountChange(idx, e.target.value)}
                        inputMode="decimal" placeholder="0"
                      />
                      {dPct > 0 && filled && (
                        <div style={{ fontSize: 9.5, color: C.green, fontWeight: 700, paddingLeft: 8 }}>
                          {dPct.toFixed(1)}% off
                        </div>
                      )}
                    </td>

                    {/* Sale Price — editable, updates discount */}
                    <td>
                      <input className="g-td-inp" value={r.salePrice}
                        onChange={(e) => onSalePriceChange(idx, e.target.value)}
                        inputMode="decimal" placeholder="0"
                        style={{ fontWeight: 600 }}
                      />
                    </td>

                    {/* Tax % — editable; amount stays same, breakdown recalculates */}
                    <td>
                      <input className="g-td-inp" value={r.tax}
                        onChange={(e) => updRow(idx, { tax: e.target.value })}
                        inputMode="decimal" placeholder="0"
                        style={{ textAlign: "center", color: asNum(r.tax) > 0 ? C.brand : C.textSub }}
                      />
                      {filled && asNum(r.tax) > 0 && (
                        <div style={{ fontSize: 9.5, color: C.brand, fontWeight: 600, textAlign: "center" }}>
                          GST
                        </div>
                      )}
                    </td>

                    {/* Qty — capped at stock */}
                    <td>
                      <input
                        ref={(el) => (qtyRefs.current[idx] = el)}
                        className="g-td-inp"
                        value={r.qty}
                        onChange={(e) => onQtyChange(idx, e.target.value)}
                        inputMode="numeric" placeholder="0"
                        style={{ textAlign: "center", fontWeight: 600 }}
                      />
                      {filled && stockQty !== null && (
                        <div style={{ fontSize: 9.5, textAlign: "center", fontWeight: 700,
                          color: isZeroStock ? C.red : C.textLight, paddingLeft: 4 }}>
                          {isZeroStock ? "No stock" : `max ${stockQty}`}
                        </div>
                      )}
                    </td>

                    {/* Amount */}
                    <td style={{ textAlign: "right", paddingRight: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: filled ? C.text : "#d1d5db" }}>
                        {filled ? `₹${fmt2(r.amount)}` : "—"}
                      </div>
                      {filled && asNum(r.tax) > 0 && asNum(r.amount) > 0 && (
                        <div style={{ fontSize: 9.5, color: C.textLight, fontWeight: 500, textAlign: "right" }}>
                          incl. ₹{fmt2(taxInAmount(asNum(r.amount), asNum(r.tax)))} tax
                        </div>
                      )}
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

            <button className="g-btn success lg" onClick={onSave} disabled={saving}>
              <FiCheck size={16} />{saving ? "Saving…" : isEdit ? "Update Invoice" : "Save Invoice"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
