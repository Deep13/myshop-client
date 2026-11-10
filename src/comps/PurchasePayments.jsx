import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiEdit2, FiTrash2, FiCheck, FiX, FiPlus, FiRefreshCw } from "react-icons/fi";
import { C, API, Modal, StatusBadge, asNum, fmt2, fmtDate, todayISO } from "../ui.jsx";
import DateInput from "./DateInput.jsx";
import toast from "../toast.js";

/* Everything about paying one purchase bill in one place: what is owed, every
   payment made so far (edit or delete any of them), and a form to add more.
   Used from the Purchase list and from the purchase bill screen. */

const PAY_MODES = ["Cash", "UPI", "Card", "Bank", "Cheque", "Other"];
const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();
const blankLine = (amount = "") => ({ type: "Cash", amount, referenceNo: "", note: "" });

async function post(file, body) {
  const res = await fetch(`${API}/${file}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.status !== "success") throw new Error(j.message || "Something went wrong");
  return j;
}

function Stat({ label, value, color }) {
  return (
    <div style={{ flex: 1, minWidth: 110, background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: color || C.text, marginTop: 2 }}>₹{fmt2(value)}</div>
    </div>
  );
}

export default function PurchasePayments({ show, purchaseId, onClose, onChanged }) {
  const [bill, setBill] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Add form
  const [payDate, setPayDate] = useState(todayISO());
  const [lines, setLines] = useState([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const amountRef = useRef(null);

  // Editing / deleting a recorded payment
  const [editId, setEditId] = useState(0);
  const [edit, setEdit] = useState(null);
  const [delId, setDelId] = useState(0);
  const [busyId, setBusyId] = useState(0);

  const load = useCallback(async (resetForm) => {
    if (!purchaseId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/get_purchase_payments.php?purchaseId=${purchaseId}`);
      const j = await res.json().catch(() => ({}));
      if (j.status !== "success") throw new Error(j.message || "Failed to load payments");
      setList(j.data || []);
      setBill(j.bill || null);
      if (resetForm) {
        const bal = asNum(j.bill?.balance);
        setPayDate(todayISO());
        setLines([blankLine(bal > 0 ? bal.toFixed(2) : "")]);
        setShowForm(bal > 0);
      }
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [purchaseId]);

  useEffect(() => {
    if (!show) return;
    setEditId(0); setDelId(0); setBill(null); setList([]);
    load(true);
  }, [show, load]);

  useEffect(() => {
    if (show && showForm && !loading) setTimeout(() => amountRef.current?.select(), 50);
  }, [show, showForm, loading]);

  const changed = (b) => { if (b) setBill(b); onChanged?.(b); };

  /* ── Add ── */
  const balance = asNum(bill?.balance);
  const entered = lines.reduce((s, l) => s + asNum(l.amount), 0);
  const after = Math.round((balance - entered) * 100) / 100;
  const setLine = (i, patch) => setLines((p) => p.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const save = async () => {
    const clean = lines.map((l) => ({ ...l, amount: Number(asNum(l.amount).toFixed(2)) })).filter((l) => l.amount > 0);
    if (!clean.length) return toast.warn("Enter an amount");
    if (!payDate) return toast.warn("Enter the payment date");
    if (after < -0.005 && !window.confirm(`This pays ₹${fmt2(-after)} more than the balance. Save anyway?`)) return;
    try {
      setSaving(true);
      const j = await post("add_purchase_payment.php", {
        purchaseId, distributorId: bill?.distributor_id, createdBy: user?.id || 0,
        lines: clean.map((l) => ({ payDate, mode: l.type, amount: l.amount, referenceNo: l.referenceNo.trim(), note: l.note.trim() })),
      });
      toast.success(j.message || "Payment saved");
      changed(j.data?.bill);
      await load(true);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  /* ── Edit ── */
  const startEdit = (p) => {
    setDelId(0);
    setEditId(p.id);
    setEdit({ payDate: p.pay_date, mode: p.mode, amount: String(asNum(p.amount)), referenceNo: p.reference_no || "", note: p.note || "" });
  };
  const saveEdit = async () => {
    if (asNum(edit.amount) <= 0) return toast.warn("Amount must be more than 0");
    try {
      setBusyId(editId);
      const j = await post("update_purchase_payment.php", { id: editId, ...edit, amount: Number(asNum(edit.amount).toFixed(2)), updatedBy: user?.id || 0 });
      toast.success("Payment updated");
      setEditId(0);
      changed(j.data?.bill);
      await load(false);
    } catch (e) { toast.error(e.message); }
    finally { setBusyId(0); }
  };

  /* ── Delete ── */
  const doDelete = async (id) => {
    try {
      setBusyId(id);
      const j = await post("delete_purchase_payment.php", { id, purchaseId });
      toast.success("Payment deleted");
      setDelId(0);
      changed(j.data?.bill);
      await load(false);
    } catch (e) { toast.error(e.message); }
    finally { setBusyId(0); }
  };

  const onFormKey = (e) => { if (e.key === "Enter") { e.preventDefault(); save(); } };
  const onEditKey = (e) => { if (e.key === "Enter") { e.preventDefault(); saveEdit(); } if (e.key === "Escape") { e.stopPropagation(); setEditId(0); } };

  const total = asNum(bill?.total);
  const paid = asNum(bill?.paid);
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;

  return (
    <Modal show={show} width={820} onClose={onClose}
      title={bill ? `Payments — Bill ${bill.bill_no}` : "Payments"}
      footer={<button className="g-btn ghost" onClick={onClose}>Close</button>}>

      {!bill ? (
        <div style={{ padding: 30, textAlign: "center", color: C.textSub }}>{loading ? "Loading…" : "Bill not found"}</div>
      ) : (
        <>
          {/* What is owed */}
          <div style={{ background: "#f8fafc", border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, color: C.textSub }}>
                <strong style={{ color: C.text, fontSize: 14 }}>{bill.distributor_name}</strong>
                {" · "}Bill date {fmtDate(bill.bill_date)}
                {bill.due_date && <> · Due {fmtDate(bill.due_date)}</>}
              </div>
              <StatusBadge status={bill.status} />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Stat label="Bill Total" value={total} />
              <Stat label="Paid" value={paid} color={C.green} />
              <Stat label={balance < 0 ? "Overpaid" : "Balance"} value={Math.abs(balance)} color={balance > 0.005 ? C.orange : balance < -0.005 ? C.red : C.green} />
            </div>
            <div style={{ height: 6, background: "#e5e7eb", borderRadius: 4, marginTop: 12, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? C.green : C.brand, transition: "width 0.3s" }} />
            </div>
          </div>

          {/* Payments made */}
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, marginBottom: 6, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
            Payments made ({list.length})
            {loading && <FiRefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} />}
          </div>
          <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 10, overflowX: "auto", marginBottom: 18 }}>
            <table className="g-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Date</th>
                  <th style={{ width: 100 }}>Mode</th>
                  <th style={{ textAlign: "right", width: 110 }}>Amount</th>
                  <th>Reference</th>
                  <th>Note</th>
                  <th>By</th>
                  <th style={{ width: 84 }}></th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: C.textLight, padding: 16 }}>No payments yet</td></tr>
                ) : list.map((p) => editId === p.id ? (
                  <tr key={p.id} style={{ background: C.brandLighter }} onKeyDown={onEditKey}>
                    <td><DateInput className="g-inp sm" value={edit.payDate} onChange={(e) => setEdit((v) => ({ ...v, payDate: e.target.value }))} /></td>
                    <td>
                      <select className="g-sel sm" value={edit.mode} onChange={(e) => setEdit((v) => ({ ...v, mode: e.target.value }))}>
                        {PAY_MODES.map((m) => <option key={m}>{m}</option>)}
                      </select>
                    </td>
                    <td><input className="g-inp sm" autoFocus inputMode="decimal" style={{ textAlign: "right" }} value={edit.amount} onChange={(e) => setEdit((v) => ({ ...v, amount: e.target.value }))} /></td>
                    <td><input className="g-inp sm" value={edit.referenceNo} placeholder="Txn / Cheque No" onChange={(e) => setEdit((v) => ({ ...v, referenceNo: e.target.value }))} /></td>
                    <td colSpan={2}><input className="g-inp sm" value={edit.note} placeholder="Note" onChange={(e) => setEdit((v) => ({ ...v, note: e.target.value }))} /></td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="g-btn success sm" title="Save (Enter)" disabled={busyId === p.id} onClick={saveEdit}><FiCheck size={12} /></button>
                        <button className="g-btn ghost sm" title="Cancel (Esc)" onClick={() => setEditId(0)}><FiX size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id}>
                    <td style={{ color: C.textSub }}>{fmtDate(p.pay_date)}</td>
                    <td style={{ fontWeight: 600 }}>{p.mode}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>₹{fmt2(p.amount)}</td>
                    <td style={{ color: C.textSub }}>{p.reference_no || "—"}</td>
                    <td style={{ color: C.textSub }}>{p.note || "—"}</td>
                    <td style={{ fontSize: 11.5, color: C.textSub, whiteSpace: "nowrap" }}
                      title={[p.created_at && `Recorded ${new Date(p.created_at).toLocaleString("en-IN")}`, p.updated_at && `Edited ${new Date(p.updated_at).toLocaleString("en-IN")}${p.updated_by_name ? ` by ${p.updated_by_name}` : ""}`].filter(Boolean).join("\n")}>
                      {p.created_by_name || "—"}
                      {p.updated_at && <span style={{ color: C.orange }}> · edited</span>}
                    </td>
                    <td>
                      {delId === p.id ? (
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <button className="g-btn danger sm" disabled={busyId === p.id} onClick={() => doDelete(p.id)}>Delete</button>
                          <button className="g-btn ghost sm" onClick={() => setDelId(0)}><FiX size={12} /></button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="g-btn ghost sm" title="Edit payment" onClick={() => startEdit(p)}><FiEdit2 size={12} /></button>
                          <button className="g-btn ghost sm" title="Delete payment" style={{ color: C.red }} onClick={() => { setEditId(0); setDelId(p.id); }}><FiTrash2 size={12} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {list.length > 0 && (
                <tfoot>
                  <tr style={{ background: "#f8fafc", borderTop: "1.5px solid #e2e8f0" }}>
                    <td colSpan={2} style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, color: C.textSub, textTransform: "uppercase", letterSpacing: "0.04em" }}>Total paid</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13.5, fontWeight: 900, color: C.green }}>₹{fmt2(paid)}</td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Add a payment */}
          {!showForm ? (
            <button className="g-btn ghost sm" onClick={() => { setLines([blankLine()]); setShowForm(true); }}>
              <FiPlus size={13} /> Add Payment
            </button>
          ) : (
            <div style={{ border: `1.5px solid ${C.brand}33`, background: C.brandLighter, borderRadius: 12, padding: 14 }} onKeyDown={onFormKey}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Add Payment</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.textSub }}>Date</span>
                  <DateInput className="g-inp sm" style={{ width: 130 }} value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                </div>
              </div>

              {lines.map((l, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: lines.length > 1 ? "120px 140px 1fr 1fr 34px" : "120px 140px 1fr 1fr", gap: 10, marginBottom: 10, alignItems: "center" }}>
                  <select className="g-sel sm" value={l.type} onChange={(e) => setLine(i, { type: e.target.value })}>
                    {PAY_MODES.map((m) => <option key={m}>{m}</option>)}
                  </select>
                  <input ref={i === 0 ? amountRef : undefined} className="g-inp sm" inputMode="decimal" placeholder="Amount ₹"
                    style={{ textAlign: "right", fontWeight: 700 }} value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} />
                  <input className="g-inp sm" placeholder="Txn / Cheque No" value={l.referenceNo} onChange={(e) => setLine(i, { referenceNo: e.target.value })} />
                  <input className="g-inp sm" placeholder="Note" value={l.note} onChange={(e) => setLine(i, { note: e.target.value })} />
                  {lines.length > 1 && (
                    <button className="g-btn ghost sm" title="Remove line" onClick={() => setLines((p) => p.filter((_, j) => j !== i))}><FiX size={12} /></button>
                  )}
                </div>
              ))}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button className="g-btn ghost sm" onClick={() => setLines((p) => [...p, blankLine(after > 0 ? after.toFixed(2) : "")])}>
                    <FiPlus size={12} /> Split mode
                  </button>
                  {balance > 0 && lines.length === 1 && asNum(lines[0].amount) !== balance && (
                    <button className="g-btn ghost sm" onClick={() => setLine(0, { amount: balance.toFixed(2) })}>Full balance ₹{fmt2(balance)}</button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: after < -0.005 ? C.red : C.textSub }}>
                    {after < -0.005 ? `Overpays by ₹${fmt2(-after)}` : `Balance after: ₹${fmt2(Math.max(after, 0))}`}
                  </span>
                  <button className="g-btn success" disabled={saving || entered <= 0} onClick={save}>
                    {saving ? "Saving…" : <><FiCheck size={14} /> Save ₹{fmt2(entered)}</>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
