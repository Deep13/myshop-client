import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiPackage, FiTruck, FiShoppingCart, FiAlertTriangle, FiEdit2, FiCheck, FiX } from "react-icons/fi";
import { C, GLOBAL_CSS, API, Field, asNum, todayISO, fmtINR, fmt2 } from "../ui.jsx";

const today = todayISO();
const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();
const in90  = new Date(new Date().getTime() + 90 * 86400000).toISOString().slice(0, 10);

function InfoRow({ label, value, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f3f4f6", fontSize: 13 }}>
      <span style={{ color: C.textSub }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: C.text }}>{value}</span>
    </div>
  );
}

function SectionCard({ icon, title, children, color }) {
  return (
    <div className="g-card" style={{ marginBottom: 20 }}>
      <div className="g-card-head">
        <div className="g-card-title">
          <span style={{ color: color || C.brand }}>{icon}</span>
          {title}
        </div>
      </div>
      <div className="g-card-body" style={{ padding: 0 }}>{children}</div>
    </div>
  );
}

export default function ItemDetail() {
  const { itemId } = useParams();
  const navigate   = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving]   = useState(false);

  const startEdit = () => {
    const it = data.item;
    setEditForm({
      name: it.name || "",
      code: it.code || "",
      hsn: it.hsn || "",
      mrp: String(it.mrp || ""),
      salePrice: String(it.salePrice || it.sale_price || ""),
      purchasePrice: String(it.purchasePrice || it.purchase_price || ""),
      tax: String(it.tax || it.tax_pct || ""),
      is_primary: it.is_primary != 0,
    });
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    if (!editForm.name.trim() || !editForm.code.trim()) return alert("Name and Code are required");
    setSaving(true);
    try {
      const r = await fetch(`${API}/update_item.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: Number(itemId),
          name: editForm.name.trim(),
          code: editForm.code.trim(),
          hsn: editForm.hsn.trim(),
          mrp: asNum(editForm.mrp),
          salePrice: asNum(editForm.salePrice),
          purchasePrice: asNum(editForm.purchasePrice),
          tax: asNum(editForm.tax),
          is_primary: editForm.is_primary,
          updatedBy: user?.id || 1,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Update failed");
      // Update local data
      setData((prev) => ({
        ...prev,
        item: {
          ...prev.item,
          name: editForm.name.trim(),
          code: editForm.code.trim(),
          hsn: editForm.hsn.trim(),
          mrp: asNum(editForm.mrp),
          sale_price: asNum(editForm.salePrice),
          salePrice: asNum(editForm.salePrice),
          purchase_price: asNum(editForm.purchasePrice),
          purchasePrice: asNum(editForm.purchasePrice),
          tax: asNum(editForm.tax),
          tax_pct: asNum(editForm.tax),
          is_primary: editForm.is_primary ? 1 : 0,
        },
      }));
      setEditing(false);
    } catch (e) {
      alert(e.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const ef = (key, val) => setEditForm((p) => ({ ...p, [key]: val }));

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/get_item_detail.php?item_id=${itemId}`);
        const j = await r.json();
        if (j.status === "success") setData(j);
        else alert(j.message);
      } catch (e) { alert("Failed to load"); }
      finally { setLoading(false); }
    })();
  }, [itemId]);

  if (loading) return (
    <div id="g-root" style={{ padding: "40px", textAlign: "center", color: C.textSub }}>
      <style>{GLOBAL_CSS}</style>Loading item details…
    </div>
  );

  if (!data) return null;

  const { item, batches, purchase_history, sales_history } = data;

  // Aggregate totals
  const totalStock     = batches.reduce((a, b) => a + asNum(b.current_qty), 0);
  const totalPurchased = purchase_history.reduce((a, r) => a + asNum(r.qty), 0);
  const totalSold      = sales_history.reduce((a, r) => a + asNum(r.qty), 0);
  const stockValue     = batches.reduce((a, b) => a + asNum(b.current_qty) * asNum(b.purchase_price), 0);
  const hasExpired     = batches.some((b) => b.exp_date && b.exp_date < today && asNum(b.current_qty) > 0);
  const hasExpiring    = batches.some((b) => b.exp_date && b.exp_date >= today && b.exp_date <= in90 && asNum(b.current_qty) > 0);

  return (
    <div id="g-root" style={{ padding: "20px 26px", background: C.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
        <button className="g-btn ghost sm" onClick={() => navigate("/inventory")}>
          <FiArrowLeft size={14} /> Back
        </button>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: C.brand, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
          <FiPackage size={20} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.text }}>{item.name}</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: C.textSub }}>
            Code: <strong>{item.code}</strong>
            {item.hsn && <> · HSN: {item.hsn}</>}
          </p>
        </div>
        {hasExpired  && <span style={{ marginLeft: 8, padding: "3px 10px", borderRadius: 6, background: C.redLight,    color: C.red,    fontWeight: 700, fontSize: 12 }}>⚠ Expired Stock</span>}
        {hasExpiring && <span style={{ marginLeft: 8, padding: "3px 10px", borderRadius: 6, background: C.yellowLight, color: C.yellow, fontWeight: 700, fontSize: 12 }}>⚠ Expiring Soon</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>

        {/* LEFT — item details + stats */}
        <div>
          {/* Item master details */}
          <div className="g-card" style={{ marginBottom: 20 }}>
            <div className="g-card-head">
              <div className="g-card-title"><FiPackage size={15} style={{ color: C.brand }} /> Item Details</div>
              {!editing ? (
                <button className="g-btn ghost sm" onClick={startEdit}><FiEdit2 size={13} /> Edit</button>
              ) : (
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="g-btn ghost sm" onClick={cancelEdit} disabled={saving}><FiX size={13} /> Cancel</button>
                  <button className="g-btn primary sm" onClick={saveEdit} disabled={saving}><FiCheck size={13} /> {saving ? "Saving…" : "Save"}</button>
                </div>
              )}
            </div>
            {!editing ? (
              <div style={{ padding: "0 18px 4px" }}>
                <InfoRow label="Name"           value={item.name} bold />
                <InfoRow label="Code"           value={item.code} bold />
                <InfoRow label="HSN"            value={item.hsn || "—"} />
                <InfoRow label="MRP"            value={`₹${item.mrp}`} bold />
                <InfoRow label="Sale Price"     value={`₹${item.salePrice || item.sale_price}`} />
                <InfoRow label="Purchase Price" value={`₹${item.purchasePrice || item.purchase_price}`} />
                <InfoRow label="Tax %"          value={asNum(item.tax || item.tax_pct) > 0 ? `${item.tax || item.tax_pct}%` : "None"} />
              </div>
            ) : (
              <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                <Field label="Item Name" required>
                  <input className="g-inp" value={editForm.name} onChange={(e) => ef("name", e.target.value)} />
                </Field>
                <Field label="Item Code" required>
                  <input className="g-inp" value={editForm.code} onChange={(e) => ef("code", e.target.value)} />
                </Field>
                <Field label="HSN Code">
                  <input className="g-inp" value={editForm.hsn} onChange={(e) => ef("hsn", e.target.value)} />
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="MRP (₹)">
                    <input className="g-inp" value={editForm.mrp} onChange={(e) => ef("mrp", e.target.value)} inputMode="decimal" />
                  </Field>
                  <Field label="Sale Price (₹)">
                    <input className="g-inp" value={editForm.salePrice} onChange={(e) => ef("salePrice", e.target.value)} inputMode="decimal" />
                  </Field>
                  <Field label="Purchase Price (₹)">
                    <input className="g-inp" value={editForm.purchasePrice} onChange={(e) => ef("purchasePrice", e.target.value)} inputMode="decimal" />
                  </Field>
                  <Field label="Tax %">
                    <input className="g-inp" value={editForm.tax} onChange={(e) => ef("tax", e.target.value)} inputMode="decimal" />
                  </Field>
                </div>
              </div>
            )}
          </div>

          {/* Stock summary */}
          <div className="g-card" style={{ marginBottom: 20 }}>
            <div className="g-card-head"><div className="g-card-title">Stock Summary</div></div>
            <div style={{ padding: 18 }}>
              <div className="g-grid-2" style={{ gap: 12 }}>
                {[
                  { l: "Current Stock", v: totalStock,              c: totalStock > 0 ? C.green : C.red,   bold: true },
                  { l: "Stock Value",   v: fmtINR(stockValue),      c: C.brand,   bold: true },
                  { l: "Total Bought",  v: totalPurchased,           c: C.text,    bold: false },
                  { l: "Total Sold",    v: totalSold,                c: C.text,    bold: false },
                  { l: "Batches",       v: batches.length,           c: C.text,    bold: false },
                  { l: "Sales Bills",   v: sales_history.length,     c: C.text,    bold: false },
                ].map(({ l, v, c, bold }) => (
                  <div key={l} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", border: "1.5px solid #e5e7eb" }}>
                    <div style={{ fontSize: 11, color: C.textSub, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{l}</div>
                    <div style={{ fontSize: 17, fontWeight: bold ? 900 : 700, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — batches, purchase history, sales history */}
        <div>

          {/* Batches */}
          <SectionCard icon={<FiPackage size={15} />} title={`Inventory Batches (${batches.length})`}>
            {batches.length === 0 ? (
              <div style={{ padding: "20px 18px", color: C.textSub, fontSize: 13 }}>No inventory batches found. Add stock via Purchase.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="g-table">
                  <thead>
                    <tr>
                      <th>Batch No</th>
                      <th>Expiry</th>
                      <th style={{ textAlign: "right" }}>Stock</th>
                      <th style={{ textAlign: "right" }}>PTR</th>
                      <th style={{ textAlign: "right" }}>MRP</th>
                      <th style={{ textAlign: "right" }}>Sale ₹</th>
                      <th>Type</th>
                      <th>Purchase Bill</th>
                      <th>Distributor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b, i) => {
                      const isExp    = b.exp_date && b.exp_date < today;
                      const isExpNear = b.exp_date && b.exp_date >= today && b.exp_date <= in90;
                      const qty      = asNum(b.current_qty);
                      return (
                        <tr key={i} style={{ background: isExp ? "#fff5f5" : isExpNear ? "#fffbeb" : undefined }}>
                          <td style={{ fontWeight: 600 }}>{b.batch_no || "—"}</td>
                          <td style={{ color: isExp ? C.red : isExpNear ? C.yellow : C.text, fontWeight: isExp || isExpNear ? 700 : 400, fontSize: 13 }}>
                            {b.exp_date || "—"}
                            {isExp    && <div style={{ fontSize: 10, color: C.red,    fontWeight: 700 }}>EXPIRED</div>}
                            {isExpNear && !isExp && <div style={{ fontSize: 10, color: C.yellow, fontWeight: 700 }}>EXPIRING</div>}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 800, color: qty <= 0 ? C.red : qty < 10 ? C.orange : C.green }}>{qty}</td>
                          <td style={{ textAlign: "right" }}>₹{fmt2(b.purchase_price)}</td>
                          <td style={{ textAlign: "right" }}>₹{fmt2(b.mrp)}</td>
                          <td style={{ textAlign: "right" }}>₹{fmt2(b.sale_price)}</td>
                          <td>
                            <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700,
                              background: b.gst_flag == 1 ? C.brandLighter : "#f3f4f6",
                              color: b.gst_flag == 1 ? C.brand : "#374151" }}>
                              {b.gst_flag == 1 ? "GST" : "NON-GST"}
                            </span>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {b.purchase_bill_no
                              ? <span style={{ color: C.brand, cursor: "pointer", textDecoration: "underline" }} onClick={() => navigate(`/addpurchase?purchaseId=${b.purchase_bill_id}`)}>{b.purchase_bill_no}</span>
                              : "—"}
                            {b.purchase_bill_date && <div style={{ fontSize: 11, color: C.textSub }}>{b.purchase_bill_date}</div>}
                          </td>
                          <td style={{ fontSize: 12, color: C.textSub }}>{b.distributor_name || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Purchase History */}
          <SectionCard icon={<FiTruck size={15} />} title={`Purchase History (${purchase_history.length} bills)`} color={C.orange}>
            {purchase_history.length === 0 ? (
              <div style={{ padding: "20px 18px", color: C.textSub, fontSize: 13 }}>No purchase history found.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="g-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Bill No</th>
                      <th>Distributor</th>
                      <th>Batch</th>
                      <th>Expiry</th>
                      <th style={{ textAlign: "right" }}>Qty</th>
                      <th style={{ textAlign: "right" }}>PTR</th>
                      <th style={{ textAlign: "right" }}>Amount</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchase_history.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 12 }}>{r.bill_date}</td>
                        <td>
                          <span style={{ color: C.brand, cursor: "pointer", fontWeight: 600 }} onClick={() => navigate(`/addpurchase?purchaseId=${r.bill_id}`)}>
                            {r.bill_no}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: C.textSub }}>{r.distributor_name}</td>
                        <td style={{ fontSize: 12 }}>{r.batch_no || "—"}</td>
                        <td style={{ fontSize: 12, color: r.exp_date && r.exp_date < today ? C.red : C.text }}>{r.exp_date || "—"}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{r.qty}</td>
                        <td style={{ textAlign: "right" }}>₹{fmt2(r.purchase_price)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>₹{fmt2(r.amount)}</td>
                        <td>
                          <span style={{ padding: "2px 7px", borderRadius: 5, fontSize: 11, fontWeight: 700,
                            background: r.gst_flag == 1 ? C.brandLighter : "#f3f4f6",
                            color: r.gst_flag == 1 ? C.brand : "#374151" }}>
                            {r.gst_flag == 1 ? "GST" : "NON-GST"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Sales History */}
          <SectionCard icon={<FiShoppingCart size={15} />} title={`Sales History (${sales_history.length} bills)`} color={C.green}>
            {sales_history.length === 0 ? (
              <div style={{ padding: "20px 18px", color: C.textSub, fontSize: 13 }}>No sales history found.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="g-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Invoice No</th>
                      <th>Customer</th>
                      <th>Batch</th>
                      <th style={{ textAlign: "right" }}>Qty</th>
                      <th style={{ textAlign: "right" }}>Sale ₹</th>
                      <th style={{ textAlign: "right" }}>Amount</th>
                      <th>GST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales_history.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 12 }}>{r.invoice_date}</td>
                        <td>
                          <span style={{ color: C.green, cursor: "pointer", fontWeight: 600 }} onClick={() => navigate(`/addsales?id=${r.invoice_id || r.id}`)}>
                            {r.invoice_no}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: C.textSub }}>{r.customer_name || "Cash"}</td>
                        <td style={{ fontSize: 12 }}>{r.batch_no || "—"}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{r.qty}</td>
                        <td style={{ textAlign: "right" }}>₹{fmt2(r.price)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>₹{fmt2(r.amount)}</td>
                        <td>
                          {r.gst_flag != null ? (
                            <span style={{ padding: "2px 7px", borderRadius: 5, fontSize: 11, fontWeight: 700,
                              background: r.gst_flag == 1 ? C.brandLighter : "#f3f4f6",
                              color: r.gst_flag == 1 ? C.brand : "#374151" }}>
                              {r.gst_flag == 1 ? "GST" : "NON-GST"}
                            </span>
                          ) : <span style={{ color: C.textLight, fontSize: 12 }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
