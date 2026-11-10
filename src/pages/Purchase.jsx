import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiPlus, FiTrash2, FiDollarSign, FiRefreshCw, FiClock } from "react-icons/fi";
import { C, GLOBAL_CSS, API, Modal, StatusBadge, SortTH, DATE_RANGES, applyDateRange, fmt2, fmtDate, todayISO, Pagination } from "../ui.jsx";
import DateInput from "../comps/DateInput.jsx";
import usePageMeta from "../usePageMeta.js";
import toast from "../toast.js";
import PurchasePayments from "../comps/PurchasePayments.jsx";

const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();
const PAGE_SIZE = 20;   // bills per page on this list

export default function Purchase() {
  usePageMeta("Purchase", "View, filter and manage all purchase bills");
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ from: "", to: "", q: "", status: "", billType: "", dateRange: "Today" });
  const [sort, setSort] = useState({ key: "bill_date", direction: "desc" });
  const [page, setPage] = useState(1);

  // Payments window
  const [payBill, setPayBill] = useState(0);

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

  const paged = useMemo(() => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [sorted, page]);
  useEffect(() => setPage(1), [filters, sort]);

  const totBills = sorted.length;
  const totGrand = sorted.reduce((s, r) => s + Number(r.round_off_enabled ? r.rounded_grand_total : r.grand_total), 0);
  const totPaid = sorted.reduce((s, r) => s + r.paid_amount, 0);
  const totBal = totGrand - totPaid;

  const onSort = (k) => setSort((p) => ({ key: k, direction: p.key === k && p.direction === "asc" ? "desc" : "asc" }));


  const deletePurchase = async () => {
    if (!delRow) return;
    try {
      setDeleting(true);
      const res = await fetch(`${API}/delete_purchase.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purchaseId: delRow.id, updatedBy: user?.id || 1 }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.status !== "success") throw new Error(j.message || "Failed");
      setShowDel(false); fetch_();
    } catch (e) { toast.error(e.message); } finally { setDeleting(false); }
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
        <DateInput className="g-inp sm" style={{ width: 130 }} value={filters.from} onChange={(e) => fc("from", e.target.value)} />
        <DateInput className="g-inp sm" style={{ width: 130 }} value={filters.to} onChange={(e) => fc("to", e.target.value)} />
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
              ) : paged.map((r) => {
                const total = r.round_off_enabled ? r.rounded_grand_total : r.grand_total;
                const bal = total - r.paid_amount;
                const overdue = r.due_date && r.due_date < todayISO() && r.payment_status !== "Paid";
                return (
                  <tr key={r.id} onClick={() => navigate(`/addpurchase?purchaseId=${r.id}`)} style={{ cursor: "pointer" }}>
                    <td>{fmtDate(r.bill_date)}</td>
                    <td style={{ fontWeight: 600 }}>{r.bill_no}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.distributor_name}</div>
                      {r.distributor_gstin && <div style={{ fontSize: 12, color: C.textSub }}>{r.distributor_gstin}</div>}
                    </td>
                    <td><StatusBadge status={r.bill_type || "GST"} /></td>
                    <td>
                      <span style={{ color: overdue ? C.red : C.text, fontWeight: overdue ? 700 : 400 }}>
                        {r.due_date ? fmtDate(r.due_date) : "—"}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>₹{fmt2(total)}</td>
                    <td>
                      {r.paid_amount > 0 ? (
                        <span title="View payments" onClick={(e) => { e.stopPropagation(); setPayBill(r.id); }}
                          style={{ color: C.brand, fontWeight: 600, textDecoration: "underline dotted", cursor: "pointer" }}>
                          ₹{fmt2(r.paid_amount)}
                        </span>
                      ) : `₹${fmt2(r.paid_amount)}`}
                    </td>
                    <td style={{ fontWeight: 700, color: bal > 0 ? C.orange : C.green }}>₹{fmt2(bal)}</td>
                    <td><StatusBadge status={r.payment_status} /></td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className={`g-btn sm ${r.payment_status === "Paid" ? "ghost" : "success"}`}
                          title={r.payment_status === "Paid" ? "View / edit payments" : "Add / view payments"}
                          onClick={(e) => { e.stopPropagation(); setPayBill(r.id); }}>
                          {r.payment_status === "Paid" ? <FiClock size={12} /> : <FiDollarSign size={12} />}
                        </button>
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
        <Pagination total={sorted.length} page={page} onPage={setPage} pageSize={PAGE_SIZE} />
      </div>

      <PurchasePayments show={payBill > 0} purchaseId={payBill} onClose={() => setPayBill(0)} onChanged={fetch_} />

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
              <div><strong>Date:</strong> {fmtDate(delRow.bill_date)}</div>
              <div><strong>Total:</strong> ₹{fmt2(delRow.grand_total)}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
