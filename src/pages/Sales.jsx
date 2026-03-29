import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiPlus, FiTrash2, FiRefreshCw, FiPrinter, FiDownload } from "react-icons/fi";
import { C, GLOBAL_CSS, API, Field, Modal, StatusBadge, SortTH, DATE_RANGES, applyDateRange, fmt2, todayISO } from "../ui.jsx";
import { printReceipt } from "../thermalPrint.js";
import { downloadExcel } from "../excelExport.js";

const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();

export default function Sales() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ from: "", to: "", q: "", payType: "", dateRange: "This Month" });
  const [sort, setSort] = useState({ key: "date", direction: "desc" });

  const [showDel, setShowDel] = useState(false);
  const [delRow, setDelRow] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showDownload, setShowDownload] = useState(false);

  // Close download dropdown on outside click
  useEffect(() => {
    if (!showDownload) return;
    const close = () => setShowDownload(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showDownload]);

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

  /* ── Download reports ── */
  const downloadReport = async (type) => {
    try {
      const qs = new URLSearchParams();
      qs.set("type", type);
      if (filters.from) qs.set("from", filters.from);
      if (filters.to) qs.set("to", filters.to);
      const res = await fetch(`${API}/get_sales_download.php?${qs}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.status !== "success") throw new Error(j.message || "Failed");
      const rows = j.data || [];
      if (!rows.length) return alert("No data found for selected period.");

      const range = [filters.from, filters.to].filter(Boolean).join("_to_") || "all";

      if (type === "summary") {
        downloadExcel([
          { key: "date", label: "Date" },
          { key: "invoice_no", label: "Invoice No" },
          { key: "customer_type", label: "Type" },
          { key: "customer_name", label: "Customer" },
          { key: "phone", label: "Phone" },
          { key: "item_count", label: "Items", type: "int" },
          { key: "total_qty", label: "Qty", type: "int" },
          { key: "subtotal", label: "Subtotal", type: "number" },
          { key: "tax_total", label: "Tax", type: "number" },
          { key: "discount", label: "Discount", type: "number" },
          { key: "rounded_final_total", label: "Total", type: "number" },
          { key: "received", label: "Received", type: "number" },
          { key: "balance", label: "Balance", type: "number" },
          { key: "payment_type", label: "Payment Mode" },
        ], rows, `Sales_Summary_${range}`);
      } else if (type === "items") {
        downloadExcel([
          { key: "date", label: "Date" },
          { key: "invoice_no", label: "Invoice No" },
          { key: "customer_name", label: "Customer" },
          { key: "item_name", label: "Item Name" },
          { key: "item_code", label: "Item Code" },
          { key: "hsn", label: "HSN" },
          { key: "batch_no", label: "Batch" },
          { key: "qty", label: "Qty", type: "int" },
          { key: "mrp", label: "MRP", type: "number" },
          { key: "sale_price", label: "Sale Price", type: "number" },
          { key: "tax_pct", label: "Tax %", type: "number" },
          { key: "taxable_amount", label: "Taxable Amt", type: "number" },
          { key: "tax_amount", label: "Tax Amt", type: "number" },
          { key: "amount", label: "Amount", type: "number" },
          { key: "discount_amount", label: "Discount", type: "number" },
          { key: "payment_type", label: "Payment" },
        ], rows, `Sales_Items_${range}`);
      } else if (type === "master") {
        downloadExcel([
          { key: "item_name", label: "Item Name" },
          { key: "item_code", label: "Item Code" },
          { key: "hsn", label: "HSN" },
          { key: "mrp", label: "MRP", type: "number" },
          { key: "sale_price", label: "Sale Price", type: "number" },
          { key: "purchase_price", label: "Purchase Price", type: "number" },
          { key: "tax_pct", label: "Tax %", type: "number" },
          { key: "total_qty_sold", label: "Qty Sold", type: "int" },
          { key: "invoice_count", label: "Invoices", type: "int" },
          { key: "total_taxable", label: "Taxable Revenue", type: "number" },
          { key: "total_tax", label: "Tax Collected", type: "number" },
          { key: "total_revenue", label: "Total Revenue", type: "number" },
          { key: "total_cost", label: "Total Cost", type: "number" },
          { key: "total_profit", label: "Profit", type: "number" },
        ], rows, `Sales_ItemMaster_${range}`);
      }
    } catch (e) { alert(e.message || "Download failed"); }
  };

  const printInvoice = async (row, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`${API}/get_invoice.php?id=${row.id}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.status !== "success") throw new Error(j.message || "Failed");
      const inv = j.invoice;
      const items = (j.items || []).map((it) => ({
        name: it.item_name, mrp: Number(it.mrp || 0), qty: Number(it.qty || 0),
        price: Number(it.price || 0), amount: Number(it.amount || 0), tax: Number(it.tax || 0),
      }));
      printReceipt({
        invoiceNo: inv.invoice_no, invoiceDate: inv.invoice_date,
        customerType: inv.customer_type === "Retail" ? "Cash Sale" : inv.customer_type,
        customerName: inv.customer_name || "Cash", phone: inv.phone || "",
        items, totalQty: items.reduce((s, i) => s + i.qty, 0),
        subTotal: Number(inv.subtotal || 0),
        discount: Number(inv.bill_discount_value || 0),
        total: Number(inv.rounded_final_total || inv.final_total || 0),
        received: Number(inv.received || 0), balance: Number(inv.balance || 0),
      });
    } catch (e) { alert(e.message || "Failed to print"); }
  };

  const deleteInvoice = async () => {
    if (!delRow) return;
    try {
      setDeleting(true);
      const res = await fetch(`${API}/delete_invoice.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: delRow.id, updatedBy: user?.id || 1 }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.status !== "success") throw new Error(j.message || "Failed");
      setShowDel(false); fetch_();
    } catch (e) { alert(e.message); } finally { setDeleting(false); }
  };

  return (
    <div id="g-root" style={{ padding: "24px 28px", background: C.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Sales</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textSub }}>{totals.count} invoices &middot; {`₹${fmt2(totals.amount)}`} total</p>
        </div>
        <button className="g-btn primary" onClick={() => navigate("/addsales")}><FiPlus size={14} /> New Sale</button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", alignItems: "center", marginBottom: 18 }}>
        <input className="g-inp sm" style={{ flex: 2, minWidth: 220 }} value={filters.q} onChange={(e) => fc("q", e.target.value)} placeholder="Search by name, phone or invoice no…" />
        <select className="g-sel sm" style={{ width: 130 }} value={filters.dateRange} onChange={(e) => fc("dateRange", e.target.value)}>
          {DATE_RANGES.map((r) => <option key={r}>{r}</option>)}
        </select>
        <input className="g-inp sm" type="date" style={{ width: 130 }} value={filters.from} onChange={(e) => fc("from", e.target.value)} />
        <input className="g-inp sm" type="date" style={{ width: 130 }} value={filters.to} onChange={(e) => fc("to", e.target.value)} />
        <button className="g-btn ghost sm" onClick={fetch_} disabled={loading}><FiRefreshCw size={14} /></button>
        {/* Download dropdown */}
        <div style={{ position: "relative" }}>
          <button className="g-btn ghost sm" onClick={(e) => { e.stopPropagation(); setShowDownload((p) => !p); }}><FiDownload size={14} /> Download</button>
          {showDownload && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 50, background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,0.12)", minWidth: 200, padding: "6px 0" }}>
              {[
                { type: "summary", label: "Sales Summary", desc: "One row per invoice" },
                { type: "items", label: "Sales Item-wise", desc: "Every item line detail" },
                { type: "master", label: "Item Master Report", desc: "Per-item totals & profit" },
              ].map(({ type, label, desc }) => (
                <button key={type} onClick={(e) => { e.stopPropagation(); setShowDownload(false); downloadReport(type); }}
                  style={{ display: "block", width: "100%", padding: "10px 16px", border: "none", background: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{label}</div>
                  <div style={{ fontSize: 11, color: C.textSub, marginTop: 1 }}>{desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>
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
                      <button className="g-btn ghost sm" title="Print" onClick={(e) => printInvoice(r, e)}>
                        <FiPrinter size={12} />
                      </button>
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
