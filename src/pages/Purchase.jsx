import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiPlus, FiTrash2, FiDollarSign, FiRefreshCw, FiX } from "react-icons/fi";
import { C, GLOBAL_CSS, API, Field, Modal, StatusBadge, SortTH, DATE_RANGES, applyDateRange, fmt2, todayISO } from "../ui.jsx";

const PAY_MODES = ["Cash", "UPI", "Card", "Bank", "Cheque", "Other"];
const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();

export default function Purchase() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ from: "", to: "", q: "", status: "", billType: "", dateRange: "This Month" });
  const [sort, setSort] = useState({ key: "bill_date", direction: "desc" });

  // Pay modal
  const [showPay, setShowPay] = useState(false);
  const [payRow, setPayRow] = useState(null);
  const [payDate, setPayDate] = useState(todayISO());
  const [payLines, setPayLines] = useState([{ type: "Cash", amount: "", referenceNo: "", note: "" }]);
  const [paySaving, setPaySaving] = useState(false);

  // Delete modal
  const [showDel, setShowDel] = useState(false);
  const [delRow, setDelRow] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const r = applyDateRange(filters.dateRange);
    if (r) setFilters((p) => ({ ...p, ...r }));
  }, [filters.dateRange]);

  const fetch_ = async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      if (filters.from) qs.set("from", filters.from);
      if (filters.to) qs.set("to", filters.to);
      if (filters.q) qs.set("q", filters.q);
      if (filters.status) qs.set("status", filters.status);
      qs.set("limit", "500");
      const res = await fetch(`${API}/get_purchase_bills.php?${qs}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.status !== "success") throw new Error(j.message || "Failed");
      setData((j.data || []).map((r) => ({
        id: Number(r.id), bill_date: r.bill_date, bill_no: r.bill_no,
        distributor_name: r.distributor_name, distributor_gstin: r.distributor_gstin,
        distributor_id: r.distributor_id, due_date: r.due_date,
        grand_total: Number(r.grand_total || 0), paid_amount: Number(r.paid_amount || 0),
        payment_status: r.payment_status || "Unpaid",
        rounded_grand_total: Number(r.rounded_grand_total || 0),
        round_off_enabled: r.round_off_enabled == "1",
        bill_type: r.bill_type || "GST",
      })));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { const t = setTimeout(fetch_, 250); return () => clearTimeout(t); }, [filters.from, filters.to, filters.q, filters.status]);

  const sorted = useMemo(() => {
    let arr = [...data];
    // Client-side bill type filter
    if (filters.billType) arr = arr.filter((r) => (r.bill_type || "GST") === filters.billType);
    const { key, direction: dir } = sort;
    return arr.sort((a, b) => {
      let va = a[key], vb = b[key];
      if (key.includes("date")) { va = va ? new Date(va).getTime() : 0; vb = vb ? new Date(vb).getTime() : 0; }
      else if (typeof va === "number") { /* numeric */ }
      else { va = String(va ?? "").toLowerCase(); vb = String(vb ?? "").toLowerCase(); }
      return dir === "asc" ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
    });
  }, [data, sort, filters.billType]);

  const totBills = sorted.length;
  const totGrand = sorted.reduce((s, r) => s + Number(r.round_off_enabled ? r.rounded_grand_total : r.grand_total), 0);
  const totPaid = sorted.reduce((s, r) => s + r.paid_amount, 0);
  const totBal = totGrand - totPaid;

  const onSort = (k) => setSort((p) => ({ key: k, direction: p.key === k && p.direction === "asc" ? "desc" : "asc" }));

  const openPay = (row) => {
    const bal = Number(row.round_off_enabled ? row.rounded_grand_total : row.grand_total) - row.paid_amount;
    setPayRow(row); setPayDate(todayISO());
    setPayLines([{ type: "Cash", amount: bal.toFixed(2), referenceNo: "", note: "" }]);
    setShowPay(true);
  };

  const savePay = async () => {
    if (!payRow) return;
    const lines = payLines.map((p) => ({ type: p.type, amount: Number(p.amount || 0), referenceNo: String(p.referenceNo || "").trim(), note: String(p.note || "").trim() })).filter((p) => p.amount > 0);
    if (!lines.length) return alert("Enter at least one amount");
    try {
      setPaySaving(true);
      for (const p of lines) {
        const res = await fetch(`${API}/add_purchase_payment.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ distributorId: payRow.distributor_id, purchaseId: payRow.id, payDate, mode: p.type, amount: p.amount, referenceNo: p.referenceNo, note: p.note, createdBy: user?.id || 1 }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j.status !== "success") throw new Error(j.message || "Failed");
      }
      alert("Payment saved"); setShowPay(false); fetch_();
    } catch (e) { alert(e.message); } finally { setPaySaving(false); }
  };

  const deletePurchase = async () => {
    if (!delRow) return;
    try {
      setDeleting(true);
      const res = await fetch(`${API}/delete_purchase.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purchaseId: delRow.id, updatedBy: user?.id || 1 }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.status !== "success") throw new Error(j.message || "Failed");
      setShowDel(false); fetch_();
    } catch (e) { alert(e.message); } finally { setDeleting(false); }
  };

  const fc = (k, v) => setFilters((p) => ({ ...p, [k]: v }));

  return (
    <div id="g-root" style={{ padding: "24px 28px", background: C.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Purchase</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textSub }}>{totBills} bills &middot; {`₹${fmt2(totGrand)}`} total &middot; Balance {`₹${fmt2(totBal)}`}</p>
        </div>
        <button className="g-btn primary" onClick={() => navigate("/addpurchase")}><FiPlus size={14} /> New Purchase</button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", alignItems: "center", marginBottom: 18 }}>
        <input className="g-inp sm" style={{ flex: 2, minWidth: 220 }} value={filters.q} onChange={(e) => fc("q", e.target.value)} placeholder="Search by distributor, bill no or GSTIN…" />
        <select className="g-sel sm" style={{ width: 130 }} value={filters.dateRange} onChange={(e) => fc("dateRange", e.target.value)}>
          {DATE_RANGES.map((r) => <option key={r}>{r}</option>)}
        </select>
        <input className="g-inp sm" type="date" style={{ width: 130 }} value={filters.from} onChange={(e) => fc("from", e.target.value)} />
        <input className="g-inp sm" type="date" style={{ width: 130 }} value={filters.to} onChange={(e) => fc("to", e.target.value)} />
        <select className="g-sel sm" style={{ width: 120 }} value={filters.status} onChange={(e) => fc("status", e.target.value)}>
          <option value="">All Status</option>
          <option value="Unpaid">Unpaid</option>
          <option value="Partial">Partial</option>
          <option value="Paid">Paid</option>
        </select>
        <select className="g-sel sm" style={{ width: 110 }} value={filters.billType} onChange={(e) => fc("billType", e.target.value)}>
          <option value="">All Types</option>
          <option value="GST">GST</option>
          <option value="NON-GST">NON-GST</option>
        </select>
        <button className="g-btn ghost sm" onClick={fetch_} disabled={loading}><FiRefreshCw size={14} /></button>
      </div>

      {/* Table */}
      <div className="g-card">
        <div style={{ overflowX: "auto" }}>
          <table className="g-table">
            <thead>
              <tr>
                <SortTH label="Date" colKey="bill_date" sortConfig={sort} onSort={onSort} />
                <SortTH label="Bill No" colKey="bill_no" sortConfig={sort} onSort={onSort} />
                <SortTH label="Distributor" colKey="distributor_name" sortConfig={sort} onSort={onSort} />
                <th>Type</th>
                <SortTH label="Due Date" colKey="due_date" sortConfig={sort} onSort={onSort} />
                <SortTH label="Total ₹" colKey="grand_total" sortConfig={sort} onSort={onSort} />
                <SortTH label="Paid ₹" colKey="paid_amount" sortConfig={sort} onSort={onSort} />
                <th>Balance ₹</th>
                <th>Status</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign: "center", padding: 24, color: C.textSub }}>Loading…</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: "center", padding: 24, color: C.textSub }}>No records found</td></tr>
              ) : sorted.map((r) => {
                const total = r.round_off_enabled ? r.rounded_grand_total : r.grand_total;
                const bal = total - r.paid_amount;
                const overdue = r.due_date && r.due_date < todayISO() && r.payment_status !== "Paid";
                return (
                  <tr key={r.id} onClick={() => navigate(`/addpurchase?purchaseId=${r.id}`)} style={{ cursor: "pointer" }}>
                    <td>{r.bill_date}</td>
                    <td style={{ fontWeight: 600 }}>{r.bill_no}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.distributor_name}</div>
                      {r.distributor_gstin && <div style={{ fontSize: 12, color: C.textSub }}>{r.distributor_gstin}</div>}
                    </td>
                    <td><StatusBadge status={r.bill_type || "GST"} /></td>
                    <td>
                      <span style={{ color: overdue ? C.red : C.text, fontWeight: overdue ? 700 : 400 }}>
                        {r.due_date || "—"}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>₹{fmt2(total)}</td>
                    <td>₹{fmt2(r.paid_amount)}</td>
                    <td style={{ fontWeight: 700, color: bal > 0 ? C.orange : C.green }}>₹{fmt2(bal)}</td>
                    <td><StatusBadge status={r.payment_status} /></td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {r.payment_status !== "Paid" && (
                          <button className="g-btn success sm" title="Add Payment" onClick={(e) => { e.stopPropagation(); openPay(r); }}>
                            <FiDollarSign size={12} />
                          </button>
                        )}
                        <button className="g-btn danger sm" title="Delete" onClick={(e) => { e.stopPropagation(); setDelRow(r); setShowDel(true); }}>
                          <FiTrash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Modal */}
      <Modal show={showPay} title="Add Payment" onClose={() => setShowPay(false)} footer={
        <><button className="g-btn ghost" onClick={() => setShowPay(false)}>Cancel</button><button className="g-btn success" onClick={savePay} disabled={paySaving}>{paySaving ? "Saving…" : "Save Payment"}</button></>
      }>
        {payRow && (
          <div style={{ background: C.brandLight, border: `1.5px solid #93c5fd`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
            <div><strong>Bill:</strong> {payRow.bill_no} · <strong>Distributor:</strong> {payRow.distributor_name}</div>
            <div style={{ marginTop: 4 }}><strong>Total:</strong> ₹{fmt2(payRow.round_off_enabled ? payRow.rounded_grand_total : payRow.grand_total)} · <strong>Paid:</strong> ₹{fmt2(payRow.paid_amount)} · <strong>Balance:</strong> ₹{fmt2((payRow.round_off_enabled ? payRow.rounded_grand_total : payRow.grand_total) - payRow.paid_amount)}</div>
          </div>
        )}
        <Field label="Payment Date"><input className="g-inp" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></Field>
        <div style={{ marginTop: 14 }}>
          {payLines.map((p, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "160px 1fr 36px", gap: 10, alignItems: "end", marginBottom: 12 }}>
              <Field label={i === 0 ? "Mode" : ""}>
                <select className="g-sel" value={p.type} onChange={(e) => setPayLines((prev) => { const n = [...prev]; n[i] = { ...n[i], type: e.target.value }; return n; })}>
                  {PAY_MODES.map((m) => <option key={m}>{m}</option>)}
                </select>
              </Field>
              <Field label={i === 0 ? "Amount (₹)" : ""}>
                <input className="g-inp" value={p.amount} onChange={(e) => setPayLines((prev) => { const n = [...prev]; n[i] = { ...n[i], amount: e.target.value }; return n; })} inputMode="decimal" placeholder="0.00" />
              </Field>
              <div style={{ paddingBottom: 2 }}>
                {payLines.length > 1 && (
                  <button className="g-btn danger sm" onClick={() => setPayLines((p) => p.filter((_, j) => j !== i))}><FiX size={13} /></button>
                )}
              </div>
              <div style={{ gridColumn: "1 / 3" }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <input className="g-inp sm" style={{ flex: 1 }} value={p.referenceNo} onChange={(e) => setPayLines((prev) => { const n = [...prev]; n[i] = { ...n[i], referenceNo: e.target.value }; return n; })} placeholder="Txn / Cheque No (optional)" />
                  <input className="g-inp sm" style={{ flex: 1 }} value={p.note} onChange={(e) => setPayLines((prev) => { const n = [...prev]; n[i] = { ...n[i], note: e.target.value }; return n; })} placeholder="Note (optional)" />
                </div>
              </div>
            </div>
          ))}
          <button className="g-btn ghost sm" onClick={() => setPayLines((p) => [...p, { type: "Cash", amount: "", referenceNo: "", note: "" }])}>+ Add Line</button>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal show={showDel} title="Delete Purchase?" onClose={() => setShowDel(false)} footer={
        <><button className="g-btn ghost" onClick={() => setShowDel(false)} disabled={deleting}>Cancel</button><button className="g-btn" style={{ background: C.red, color: "#fff", height: 40, padding: "0 18px", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer" }} onClick={deletePurchase} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</button></>
      }>
        {delRow && (
          <div>
            <p style={{ fontSize: 15, color: C.text, marginBottom: 12 }}>Are you sure you want to delete this bill? This cannot be undone.</p>
            <div style={{ background: C.redLight, border: `1.5px solid #fca5a5`, borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
              <div><strong>Bill No:</strong> {delRow.bill_no}</div>
              <div><strong>Distributor:</strong> {delRow.distributor_name}</div>
              <div><strong>Date:</strong> {delRow.bill_date}</div>
              <div><strong>Total:</strong> ₹{fmt2(delRow.grand_total)}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
