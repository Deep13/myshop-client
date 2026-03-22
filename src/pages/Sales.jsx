import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiPlus, FiTrash2, FiRefreshCw } from "react-icons/fi";
import { C, GLOBAL_CSS, API, Field, Modal, StatusBadge, SortTH, DATE_RANGES, applyDateRange, fmt2, todayISO } from "../ui.jsx";

export default function Sales() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ from: "", to: "", q: "", payType: "", dateRange: "This Month" });
  const [sort, setSort] = useState({ key: "date", direction: "desc" });

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
      if (filters.q) qs.set("party", filters.q);
      if (filters.payType) qs.set("paymentType", filters.payType);
      const res = await fetch(`${API}/get_sales.php?${qs}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.status !== "success") throw new Error(j.message || "Failed");
      setData(j.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { const t = setTimeout(fetch_, 250); return () => clearTimeout(t); }, [filters.from, filters.to, filters.q, filters.payType]);

  const sorted = useMemo(() => {
    const arr = [...data];
    const { key, direction: dir } = sort;
    return arr.sort((a, b) => {
      let va = a[key], vb = b[key];
      if (key === "date") { va = va ? new Date(va).getTime() : 0; vb = vb ? new Date(vb).getTime() : 0; }
      else if (key === "amount") { va = Number(va || 0); vb = Number(vb || 0); }
      else { va = String(va ?? "").toLowerCase(); vb = String(vb ?? "").toLowerCase(); }
      return dir === "asc" ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
    });
  }, [data, sort]);

  const totals = useMemo(() => ({
    count: sorted.length,
    amount: sorted.reduce((s, r) => s + Number(r.amount || 0), 0),
  }), [sorted]);

  const onSort = (k) => setSort((p) => ({ key: k, direction: p.key === k && p.direction === "asc" ? "desc" : "asc" }));
  const fc = (k, v) => setFilters((p) => ({ ...p, [k]: v }));

  const deleteInvoice = async () => {
    if (!delRow) return;
    try {
      setDeleting(true);
      const res = await fetch(`${API}/delete_invoice.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: delRow.id }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.status !== "success") throw new Error(j.message || "Failed");
      setShowDel(false); fetch_();
    } catch (e) { alert(e.message); } finally { setDeleting(false); }
  };

  return (
    <div id="g-root" className="g-page">
      <style>{GLOBAL_CSS}</style>

      {/* KPI Summary */}
      <div className="g-grid-4" style={{ marginBottom: 14 }}>
        {[
          { label: "Invoices", value: totals.count, color: C.brand },
          { label: "Total Sales", value: `₹${fmt2(totals.amount)}`, color: C.brand },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "#fff", borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "12px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", alignItems: "center", marginBottom: 14 }}>
        <select className="g-sel sm" style={{ width: 130 }} value={filters.dateRange} onChange={(e) => fc("dateRange", e.target.value)}>
          {DATE_RANGES.map((r) => <option key={r}>{r}</option>)}
        </select>
        <input className="g-inp sm" type="date" style={{ width: 130 }} value={filters.from} onChange={(e) => fc("from", e.target.value)} />
        <input className="g-inp sm" type="date" style={{ width: 130 }} value={filters.to} onChange={(e) => fc("to", e.target.value)} />
        <input className="g-inp sm" style={{ flex: 1, minWidth: 140 }} value={filters.q} onChange={(e) => fc("q", e.target.value)} placeholder="Search customer name…" />
        <button className="g-btn ghost sm" onClick={fetch_} disabled={loading}><FiRefreshCw size={14} /></button>
        <button className="g-btn primary sm" onClick={() => navigate("/addsales")}><FiPlus size={14} /> New</button>
      </div>

      {/* Table */}
      <div className="g-card">
        <div style={{ overflowX: "auto" }}>
          <table className="g-table">
            <thead>
              <tr>
                <SortTH label="Date" colKey="date" sortConfig={sort} onSort={onSort} />
                <SortTH label="Invoice No" colKey="invoice" sortConfig={sort} onSort={onSort} />
                <SortTH label="Customer" colKey="party" sortConfig={sort} onSort={onSort} />
                <th>Phone</th>
                <th>Payment</th>
                <SortTH label="Amount ₹" colKey="amount" sortConfig={sort} onSort={onSort} />
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: C.textSub }}>Loading…</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: C.textSub }}>No records found</td></tr>
              ) : sorted.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/addsales?id=${r.id}`)} style={{ cursor: "pointer" }}>
                  <td>{r.date}</td>
                  <td style={{ fontWeight: 600 }}>{r.invoice}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.party || "Cash"}</div>
                  </td>
                  <td style={{ color: C.textSub }}>{r.phone || "—"}</td>
                  <td><StatusBadge status={r.paymentType || "Cash"} /></td>
                  <td style={{ fontWeight: 700 }}>₹{fmt2(r.amount)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="g-btn danger sm" onClick={(e) => { e.stopPropagation(); setDelRow(r); setShowDel(true); }}>
                        <FiTrash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Modal */}
      <Modal show={showDel} title="Delete Invoice?" onClose={() => setShowDel(false)}
        footer={<><button className="g-btn ghost" onClick={() => setShowDel(false)} disabled={deleting}>Cancel</button><button className="g-btn" style={{ background: C.red, color: "#fff", height: 38, padding: "0 18px", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }} onClick={deleteInvoice} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</button></>}>
        {delRow && (
          <div>
            <p style={{ fontSize: 14, color: C.text, marginBottom: 12 }}>Delete this invoice? This cannot be undone.</p>
            <div style={{ background: C.redLight, border: "1.5px solid #fca5a5", borderRadius: 9, padding: "10px 14px", fontSize: 13 }}>
              <div><strong>Invoice:</strong> {delRow.invoice}</div>
              <div><strong>Customer:</strong> {delRow.party}</div>
              <div><strong>Date:</strong> {delRow.date}</div>
              <div><strong>Amount:</strong> ₹{fmt2(delRow.amount)}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
