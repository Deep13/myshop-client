import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiTruck, FiEdit2, FiCheck, FiX, FiDollarSign, FiFileText } from "react-icons/fi";
import { C, GLOBAL_CSS, API, Field, fmt2, fmtDate, fmtINR } from "../ui.jsx";
import usePageMeta from "../usePageMeta.js";
import toast from "../toast.js";

export default function DistributorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving]   = useState(false);
  usePageMeta(data ? `${data.distributor?.name || "Distributor"} — Detail` : "Distributor Detail", "Distributor bills, payments and balance");

  const load = async () => {
    try {
      setLoading(true);
      const r = await fetch(`${API}/get_distributor.php?id=${id}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Failed");
      setData(j);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const startEdit = () => {
    const d = data.distributor;
    setEditForm({
      name: d.name || "",
      gstin: d.gstin || "",
      phone: d.phone || "",
      address: d.address || "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!editForm.name.trim()) return toast.warn("Name is required");
    setSaving(true);
    try {
      const r = await fetch(`${API}/update_distributor.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: Number(id), ...editForm }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Update failed");
      setEditing(false);
      await load();
      toast.success(`Updated · ${j.bills_renamed || 0} bills synced`);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.textSub }}>Loading…</div>;
  if (!data?.distributor) return <div style={{ padding: 40, textAlign: "center", color: C.textSub }}>Distributor not found</div>;

  const d = data.distributor;
  const bills = data.bills || [];
  const payments = data.payments || [];
  const totalAmount = bills.reduce((s, b) => s + Number(b.round_off_enabled == "1" ? b.rounded_grand_total : b.grand_total || 0), 0);
  const totalPaid   = bills.reduce((s, b) => s + Number(b.paid_amount || 0), 0);
  const balance     = totalAmount - totalPaid;

  return (
    <div id="g-root" style={{ padding: "24px 28px", background: C.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="g-btn ghost sm" onClick={() => navigate("/distributors")}><FiArrowLeft size={14} /> Back</button>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: C.orangeLight, display: "flex", alignItems: "center", justifyContent: "center", color: C.orange }}><FiTruck size={18} /></div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{d.name}</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: C.textSub }}>Distributor · {bills.length} bill{bills.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        {!editing && <button className="g-btn primary sm" onClick={startEdit}><FiEdit2 size={12} /> Edit</button>}
      </div>

      {/* Stats */}
      <div className="g-grid-4" style={{ marginBottom: 20 }}>
        <Stat label="Bills" value={bills.length} color={C.text} />
        <Stat label="Total" value={fmtINR(totalAmount)} color={C.brand} />
        <Stat label="Paid"  value={fmtINR(totalPaid)}   color={C.green} />
        <Stat label="Balance" value={fmtINR(balance)} color={balance > 0.01 ? C.orange : C.green} />
      </div>

      {/* Details / Edit */}
      <div className="g-card" style={{ marginBottom: 20 }}>
        <div className="g-card-head"><div className="g-card-title"><FiFileText size={14} style={{ color: C.brand }} /> Details</div></div>
        <div style={{ padding: 18 }}>
          {!editing ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
              <InfoRow label="Name"    value={d.name} />
              <InfoRow label="GSTIN"   value={d.gstin || "—"} />
              <InfoRow label="Phone"   value={d.phone || "—"} />
              <InfoRow label="Address" value={d.address || "—"} />
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Name *"><input className="g-inp" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></Field>
              <Field label="GSTIN"><input className="g-inp" value={editForm.gstin} onChange={(e) => setEditForm({ ...editForm, gstin: e.target.value.toUpperCase() })} style={{ fontFamily: "monospace" }} /></Field>
              <Field label="Phone"><input className="g-inp" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} inputMode="tel" /></Field>
              <Field label="Address"><input className="g-inp" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></Field>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button className="g-btn ghost" onClick={() => setEditing(false)} disabled={saving}><FiX size={14} /> Cancel</button>
                <button className="g-btn success" onClick={saveEdit} disabled={saving}><FiCheck size={14} /> {saving ? "Saving…" : "Save"}</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bills */}
      <div className="g-card" style={{ marginBottom: 20 }}>
        <div className="g-card-head"><div className="g-card-title"><FiFileText size={14} style={{ color: C.brand }} /> Bills ({bills.length})</div></div>
        <div style={{ overflowX: "auto" }}>
          <table className="g-table">
            <thead><tr>
              <th>Date</th><th>Bill No</th><th>Type</th><th>Due Date</th>
              <th style={{ textAlign: "right" }}>Total</th>
              <th style={{ textAlign: "right" }}>Paid</th>
              <th style={{ textAlign: "right" }}>Balance</th>
              <th>Status</th>
            </tr></thead>
            <tbody>
              {bills.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 24, color: C.textSub }}>No bills</td></tr>
              ) : bills.map((b) => {
                const total = Number(b.round_off_enabled == "1" ? b.rounded_grand_total : b.grand_total) || 0;
                const paid = Number(b.paid_amount || 0);
                const bal = total - paid;
                const statusColor = b.payment_status === "Paid" ? C.green : b.payment_status === "Partial" ? C.orange : C.red;
                return (
                  <tr key={b.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/addpurchase?purchaseId=${b.id}`)}>
                    <td>{fmtDate(b.bill_date)}</td>
                    <td style={{ fontWeight: 600, color: C.brand }}>{b.bill_no}</td>
                    <td style={{ fontSize: 12, color: C.textSub }}>{b.bill_type || "GST"}</td>
                    <td>{b.due_date ? fmtDate(b.due_date) : "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>₹{fmt2(total)}</td>
                    <td style={{ textAlign: "right" }}>₹{fmt2(paid)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: bal > 0.01 ? C.orange : C.green }}>₹{fmt2(bal)}</td>
                    <td><span style={{ fontSize: 11, fontWeight: 700, color: statusColor, background: statusColor + "22", padding: "2px 8px", borderRadius: 6 }}>{b.payment_status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payments */}
      <div className="g-card">
        <div className="g-card-head"><div className="g-card-title"><FiDollarSign size={14} style={{ color: C.green }} /> Payments ({payments.length})</div></div>
        <div style={{ overflowX: "auto" }}>
          <table className="g-table">
            <thead><tr>
              <th>Date</th><th>Mode</th><th>Bill</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th>Reference</th><th>Note</th>
            </tr></thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: C.textSub }}>No payments</td></tr>
              ) : payments.map((p) => {
                const bill = bills.find((b) => b.id == p.purchase_id);
                return (
                  <tr key={p.id}>
                    <td>{fmtDate(p.pay_date)}</td>
                    <td style={{ fontWeight: 600 }}>{p.mode}</td>
                    <td style={{ fontSize: 12, color: C.brand }}>{bill ? bill.bill_no : "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: C.green }}>₹{fmt2(p.amount)}</td>
                    <td style={{ fontSize: 12, color: C.textSub }}>{p.reference_no || "—"}</td>
                    <td style={{ fontSize: 12, color: C.textSub }}>{p.note || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "14px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}
function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6", fontSize: 13 }}>
      <span style={{ color: C.textSub }}>{label}</span>
      <span style={{ fontWeight: 600, color: C.text }}>{value}</span>
    </div>
  );
}
