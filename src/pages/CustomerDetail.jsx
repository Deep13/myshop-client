import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiUser, FiEdit2, FiCheck, FiX, FiDollarSign, FiFileText, FiPhone } from "react-icons/fi";
import { C, GLOBAL_CSS, API, Field, fmt2, fmtDate, fmtINR } from "../ui.jsx";
import usePageMeta from "../usePageMeta.js";
import toast from "../toast.js";

export default function CustomerDetail() {
  const { name: nameParam } = useParams();
  const decoded = decodeURIComponent(nameParam || "");
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving]   = useState(false);
  usePageMeta(data ? `${data.customer?.name || "Customer"} — Detail` : "Customer Detail", "Customer invoices, payments and balance");

  const load = async () => {
    try {
      setLoading(true);
      const r = await fetch(`${API}/get_customer.php?name=${encodeURIComponent(decoded)}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Failed");
      setData(j);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [nameParam]);

  const startEdit = () => {
    const c = data.customer;
    setEditForm({ name: c.name || "", phone: c.phone || "", gstin: c.gstin || "" });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!editForm.name.trim()) return toast.warn("Name is required");
    setSaving(true);
    try {
      const r = await fetch(`${API}/update_customer.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldName: data.customer.name, ...editForm }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Update failed");
      setEditing(false);
      toast.success(`Updated · ${j.invoices_updated || 0} invoices synced`);
      // If the name changed, navigate to the new URL so subsequent reloads work
      if (editForm.name.trim() !== data.customer.name) {
        navigate(`/customers/${encodeURIComponent(editForm.name.trim())}`, { replace: true });
      } else {
        await load();
      }
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.textSub }}>Loading…</div>;
  if (!data?.customer) return <div style={{ padding: 40, textAlign: "center", color: C.textSub }}>Customer not found</div>;

  const c = data.customer;
  const invoices = data.invoices || [];
  const totalAmount = invoices.reduce((s, i) => s + Number(i.rounded_final_total || i.final_total || 0), 0);
  const totalReceived = invoices.reduce((s, i) => s + Number(i.received || 0), 0);
  const balance = invoices.reduce((s, i) => s + Number(i.balance || 0), 0);

  return (
    <div id="g-root" style={{ padding: "24px 28px", background: C.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="g-btn ghost sm" onClick={() => navigate("/customers")}><FiArrowLeft size={14} /> Back</button>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: C.brandLighter, display: "flex", alignItems: "center", justifyContent: "center", color: C.brand }}><FiUser size={18} /></div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{c.name}</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: C.textSub }}>
              {c.phone && <><FiPhone size={11} style={{ verticalAlign: "middle" }} /> {c.phone} · </>}
              {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
              {c.first_date && <> · since {fmtDate(c.first_date)}</>}
            </p>
          </div>
        </div>
        {!editing && <button className="g-btn primary sm" onClick={startEdit}><FiEdit2 size={12} /> Edit</button>}
      </div>

      {/* Stats */}
      <div className="g-grid-4" style={{ marginBottom: 20 }}>
        <Stat label="Invoices" value={invoices.length} color={C.text} />
        <Stat label="Total Billed" value={fmtINR(totalAmount)} color={C.brand} />
        <Stat label="Received"     value={fmtINR(totalReceived)} color={C.green} />
        <Stat label="Balance"      value={fmtINR(balance)} color={balance > 0.01 ? C.orange : C.green} />
      </div>

      {/* Details / Edit */}
      <div className="g-card" style={{ marginBottom: 20 }}>
        <div className="g-card-head"><div className="g-card-title"><FiFileText size={14} style={{ color: C.brand }} /> Details</div></div>
        <div style={{ padding: 18 }}>
          {!editing ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
              <InfoRow label="Name"  value={c.name} />
              <InfoRow label="Phone" value={c.phone || "—"} />
              <InfoRow label="GSTIN" value={c.gstin || "—"} />
              <InfoRow label="Last invoice date" value={c.last_date ? fmtDate(c.last_date) : "—"} />
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 12, padding: "8px 12px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8 }}>
                Editing will rename this customer and update the phone / GSTIN on <strong>all {invoices.length}</strong> existing invoices.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Name *"><input className="g-inp" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></Field>
                <Field label="Phone"><input className="g-inp" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} inputMode="tel" /></Field>
                <Field label="GSTIN"><input className="g-inp" value={editForm.gstin} onChange={(e) => setEditForm({ ...editForm, gstin: e.target.value.toUpperCase() })} style={{ fontFamily: "monospace" }} /></Field>
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                  <button className="g-btn ghost" onClick={() => setEditing(false)} disabled={saving}><FiX size={14} /> Cancel</button>
                  <button className="g-btn success" onClick={saveEdit} disabled={saving}><FiCheck size={14} /> {saving ? "Saving…" : "Save"}</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Invoices */}
      <div className="g-card" style={{ marginBottom: 20 }}>
        <div className="g-card-head"><div className="g-card-title"><FiFileText size={14} style={{ color: C.brand }} /> Invoices ({invoices.length})</div></div>
        <div style={{ overflowX: "auto" }}>
          <table className="g-table">
            <thead><tr>
              <th>Date</th><th>Invoice No</th><th>Type</th>
              <th style={{ textAlign: "right" }}>Total</th>
              <th style={{ textAlign: "right" }}>Received</th>
              <th style={{ textAlign: "right" }}>Balance</th>
            </tr></thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: C.textSub }}>No invoices</td></tr>
              ) : invoices.map((inv) => {
                const total = Number(inv.rounded_final_total || inv.final_total || 0);
                const recv = Number(inv.received || 0);
                const bal = Number(inv.balance || 0);
                return (
                  <tr key={inv.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/addsales?id=${inv.id}`)}>
                    <td>{fmtDate(inv.invoice_date)}</td>
                    <td style={{ fontWeight: 600, color: C.brand }}>{inv.invoice_no}</td>
                    <td style={{ fontSize: 12, color: C.textSub }}>{inv.customer_type}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>₹{fmt2(total)}</td>
                    <td style={{ textAlign: "right" }}>₹{fmt2(recv)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: bal > 0.01 ? C.orange : C.green }}>₹{fmt2(bal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payments */}
      <div className="g-card">
        <div className="g-card-head"><div className="g-card-title"><FiDollarSign size={14} style={{ color: C.green }} /> Payments ({(data.payments || []).length})</div></div>
        <div style={{ overflowX: "auto" }}>
          <table className="g-table">
            <thead><tr>
              <th>Invoice</th><th>Mode</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr></thead>
            <tbody>
              {(data.payments || []).length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: "center", padding: 24, color: C.textSub }}>No payments</td></tr>
              ) : data.payments.map((p) => {
                const inv = invoices.find((i) => i.id == p.invoice_id);
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600, color: C.brand }}>{inv ? inv.invoice_no : "—"}</td>
                    <td>{p.pay_type}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: C.green }}>₹{fmt2(p.amount)}</td>
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
