import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FiArrowLeft, FiAlertTriangle, FiCheck, FiRefreshCw, FiSearch } from "react-icons/fi";
import { C, GLOBAL_CSS, API, asNum, fmt2, fmtDate, fmtINR, SortTH } from "../ui.jsx";
import usePageMeta from "../usePageMeta.js";
import toast from "../toast.js";

const REASONS = ["Wastage", "Return to Distributor", "Damaged", "Other"];
const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();

export default function WriteOffExpired() {
  usePageMeta("Expired & expiring stock", "Review and write off expired or soon-to-expire inventory batches");
  const navigate = useNavigate();
  const [rows, setRows]       = useState([]);
  const [totals, setTotals]   = useState({ count: 0, total_qty: 0, value_ptr: 0, value_mrp: 0, expired: { count: 0, qty: 0, value_ptr: 0 }, expiring: { count: 0, qty: 0, value_ptr: 0 } });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [picked, setPicked]   = useState({}); // { id: { selected, reason, note } }

  // Filters + sort
  const [q, setQ]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | expired | expiring
  const [expBucket, setExpBucket] = useState("all"); // all | under_30 | 30_to_90 | over_90 (|days_to_exp|)
  const [windowDays, setWindowDays] = useState(90);   // expiring window in days
  const [minValue, setMinValue]   = useState("");
  const [sort, setSort] = useState({ key: "exp_date", direction: "asc" });

  const load = async () => {
    try {
      setLoading(true);
      const r = await fetch(`${API}/get_expired_inventory.php?days=${windowDays}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Failed");
      setRows(j.data || []);
      setTotals(j.totals || { count: 0, total_qty: 0, value_ptr: 0, value_mrp: 0, expired: { count: 0, qty: 0, value_ptr: 0 }, expiring: { count: 0, qty: 0, value_ptr: 0 } });
      const init = {};
      for (const it of j.data || []) init[it.id] = { selected: false, reason: "Wastage", note: "" };
      setPicked(init);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [windowDays]);

  // Derived rows: apply filters then sort.
  const view = useMemo(() => {
    const today = new Date();
    const daysDiff = (d) => Math.floor((new Date(d) - today) / 86400000); // future positive, past negative
    let arr = rows.map((r) => {
      // Prefer the server-provided days_to_exp (positive = days until expiry,
      // negative = days since expired). Fall back to a client-side calc.
      const daysTo = r.days_to_exp != null ? Number(r.days_to_exp) : (r.exp_date ? daysDiff(r.exp_date) : 0);
      return {
        ...r,
        _value: asNum(r.current_qty) * asNum(r.purchase_price),
        _daysTo: daysTo,           // signed: future > 0, past < 0
        _absDays: Math.abs(daysTo),
        _isExpired: r.status ? r.status === "expired" : daysTo < 0,
      };
    });

    if (statusFilter !== "all") {
      arr = arr.filter((r) => statusFilter === "expired" ? r._isExpired : !r._isExpired);
    }
    if (q.trim()) {
      const qLow = q.trim().toLowerCase();
      arr = arr.filter((r) =>
        (r.item_name || "").toLowerCase().includes(qLow) ||
        (r.item_code || "").toLowerCase().includes(qLow) ||
        (r.batch_no || "").toLowerCase().includes(qLow) ||
        (r.distributor_name || "").toLowerCase().includes(qLow)
      );
    }
    if (expBucket !== "all") {
      arr = arr.filter((r) => {
        const d = r._absDays;
        if (expBucket === "over_90")   return d > 90;
        if (expBucket === "30_to_90")  return d >= 30 && d <= 90;
        if (expBucket === "under_30")  return d < 30;
        return true;
      });
    }
    const mv = asNum(minValue);
    if (mv > 0) arr = arr.filter((r) => r._value >= mv);

    const { key, direction } = sort;
    arr.sort((a, b) => {
      let va = a[key], vb = b[key];
      if (key === "exp_date") { va = va || ""; vb = vb || ""; }
      else if (key === "item_name") { va = String(va || "").toLowerCase(); vb = String(vb || "").toLowerCase(); }
      else { va = Number(va) || 0; vb = Number(vb) || 0; }
      return direction === "asc" ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
    });
    return arr;
  }, [rows, q, statusFilter, expBucket, minValue, sort]);

  const onSort = (k) => setSort((p) => ({ key: k, direction: p.key === k && p.direction === "asc" ? "desc" : "asc" }));

  const selectedIds  = useMemo(() => Object.entries(picked).filter(([, v]) => v.selected).map(([k]) => Number(k)), [picked]);
  const selectedRows = useMemo(() => rows.filter((r) => selectedIds.includes(r.id)), [rows, selectedIds]);
  const selValuePtr  = useMemo(() => selectedRows.reduce((s, r) => s + asNum(r.current_qty) * asNum(r.purchase_price), 0), [selectedRows]);

  const visibleIds   = useMemo(() => view.map((r) => r.id), [view]);
  const visAllChecked = visibleIds.length > 0 && visibleIds.every((id) => picked[id]?.selected);
  const toggleVisible = (on) => {
    const next = { ...picked };
    for (const id of visibleIds) next[id] = { ...next[id], selected: on };
    setPicked(next);
  };
  const update = (id, patch) => setPicked((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  // Bulk-apply reason / note to all currently-selected rows
  const [bulkReason, setBulkReason] = useState("Wastage");
  const applyBulkReason = () => {
    const next = { ...picked };
    for (const id of selectedIds) next[id] = { ...next[id], reason: bulkReason };
    setPicked(next);
    toast.success(`Set reason to "${bulkReason}" for ${selectedIds.length} selected`);
  };

  const submit = async () => {
    if (selectedIds.length === 0) return toast.warn("Select at least one row");
    if (!confirm(`Write off ${selectedIds.length} batch${selectedIds.length === 1 ? "" : "es"}? This sets current_qty to 0 (reversible only via SQL).`)) return;
    setSaving(true);
    try {
      const entries = selectedIds.map((id) => ({
        inventoryId: id,
        reason: picked[id]?.reason || "Wastage",
        note:   picked[id]?.note   || "",
      }));
      const r = await fetch(`${API}/write_off_inventory.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries, createdBy: user?.id || 1 }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Failed");
      toast.success(`Wrote off ${j.written} batches${j.skipped?.length ? ` (skipped ${j.skipped.length})` : ""}`);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const visibleValue = useMemo(() => view.reduce((s, r) => s + r._value, 0), [view]);

  return (
    <div id="g-root" style={{ padding: "24px 28px", background: C.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="g-btn ghost sm" onClick={() => navigate("/inventory")}><FiArrowLeft size={14} /> Back</button>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: C.redLight, color: C.red, display: "flex", alignItems: "center", justifyContent: "center" }}><FiAlertTriangle size={18} /></div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a" }}>Expired &amp; expiring stock</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: C.textSub }}>
              <span style={{ color: C.red, fontWeight: 700 }}>{totals.expired?.count || 0} expired</span> ({fmtINR(totals.expired?.value_ptr || 0)})
              {" · "}
              <span style={{ color: C.orange, fontWeight: 700 }}>{totals.expiring?.count || 0} expiring in {windowDays}d</span> ({fmtINR(totals.expiring?.value_ptr || 0)})
              {view.length !== rows.length && <> · showing <strong>{view.length}</strong> ({fmtINR(visibleValue)})</>}
            </p>
          </div>
        </div>
        <button className="g-btn ghost sm" onClick={load} disabled={loading}><FiRefreshCw size={14} /></button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 340 }}>
          <FiSearch size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textLight }} />
          <input className="g-inp sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item, code, batch, distributor…" style={{ paddingLeft: 28, width: "100%" }} />
        </div>
        <select className="g-sel sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 140 }} title="Status">
          <option value="all">All</option>
          <option value="expired">Expired only</option>
          <option value="expiring">Expiring only</option>
        </select>
        <select className="g-sel sm" value={expBucket} onChange={(e) => setExpBucket(e.target.value)} style={{ width: 170 }} title="Distance from today">
          <option value="all">Any distance</option>
          <option value="under_30">Within 30 days</option>
          <option value="30_to_90">30–90 days</option>
          <option value="over_90">More than 90 days</option>
        </select>
        <select className="g-sel sm" value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))} style={{ width: 130 }} title="Look-ahead window for expiring">
          <option value={30}>Next 30 days</option>
          <option value={60}>Next 60 days</option>
          <option value={90}>Next 90 days</option>
          <option value={180}>Next 180 days</option>
          <option value={365}>Next 365 days</option>
          <option value={0}>Expired only</option>
        </select>
        <input className="g-inp sm" value={minValue} onChange={(e) => setMinValue(e.target.value)} placeholder="Min value ₹" inputMode="decimal" style={{ width: 110 }} />
        {(q || statusFilter !== "all" || expBucket !== "all" || minValue || windowDays !== 90) && (
          <button className="g-btn ghost sm" onClick={() => { setQ(""); setStatusFilter("all"); setExpBucket("all"); setMinValue(""); setWindowDays(90); }}>Clear</button>
        )}
        <div style={{ flex: 1 }} />
        {selectedIds.length > 0 && (
          <>
            <span style={{ fontSize: 12, color: C.textSub }}>Bulk set reason:</span>
            <select className="g-sel sm" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} style={{ width: 180 }}>
              {REASONS.map((x) => <option key={x}>{x}</option>)}
            </select>
            <button className="g-btn ghost sm" onClick={applyBulkReason}>Apply to {selectedIds.length}</button>
          </>
        )}
      </div>

      <div className="g-card">
        <div style={{ overflowX: "auto" }}>
          <table className="g-table">
            <thead>
              <tr>
                <th style={{ width: 36, paddingLeft: 12 }}>
                  <input type="checkbox"
                    checked={visAllChecked}
                    onChange={(e) => toggleVisible(e.target.checked)}
                    title={visibleIds.length === rows.length ? "Select all" : "Select all filtered"} />
                </th>
                <SortTH label="Item" colKey="item_name" sortConfig={sort} onSort={onSort} />
                <th>Batch</th>
                <SortTH label="Expiry" colKey="exp_date" sortConfig={sort} onSort={onSort} />
                <SortTH label="Qty" colKey="current_qty" sortConfig={sort} onSort={onSort} style={{ textAlign: "right" }} />
                <SortTH label="PTR" colKey="purchase_price" sortConfig={sort} onSort={onSort} style={{ textAlign: "right" }} />
                <SortTH label="Value (PTR)" colKey="_value" sortConfig={sort} onSort={onSort} style={{ textAlign: "right" }} />
                <th style={{ width: 180 }}>Reason</th>
                <th style={{ width: 200 }}>Note</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: C.textSub }}>Loading…</td></tr>
              ) : view.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: C.textSub }}>{rows.length === 0 ? "✅ No expired or expiring stock" : "No batches match the filters"}</td></tr>
              ) : view.map((r) => {
                const p = picked[r.id] || { selected: false, reason: "Wastage", note: "" };
                return (
                  <tr key={r.id} style={{ background: p.selected ? "#fff7ed" : undefined }}>
                    <td style={{ paddingLeft: 12 }}>
                      <input type="checkbox" checked={p.selected} onChange={(e) => update(r.id, { selected: e.target.checked })} />
                    </td>
                    <td>
                      <Link to={`/inventory/${r.item_id}`} style={{ fontWeight: 600, color: C.brand, textDecoration: "none", display: "block" }}>{r.item_name}</Link>
                      <div style={{ fontSize: 11, color: C.textSub }}>
                        {r.item_code}
                        {r.purchase_bill_no && (
                          <>
                            {" · "}
                            {r.distributor_id
                              ? <Link to={`/distributors/${r.distributor_id}`} style={{ color: C.brand, textDecoration: "none", fontWeight: 600 }}>{r.distributor_name}</Link>
                              : (r.distributor_name || "—")}
                            {" "}
                            <Link to={`/addpurchase?purchaseId=${r.purchase_bill_id}&filter=${encodeURIComponent(r.item_name || "")}`}
                              title="Open this purchase bill filtered to this item"
                              style={{ color: C.brand, textDecoration: "none", fontWeight: 700 }}>
                              #{r.purchase_bill_no}
                            </Link>
                          </>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: C.textSub }}>{r.batch_no || "—"}</td>
                    <td style={{ fontSize: 12, fontWeight: 700, color: r._isExpired ? C.red : C.orange }}>
                      {fmtDate(r.exp_date)}
                      <div style={{ fontSize: 10, color: C.textLight, fontWeight: 500 }}>
                        {r._isExpired ? `expired ${r._absDays}d ago` : `in ${r._absDays}d`}
                      </div>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{r.current_qty}</td>
                    <td style={{ textAlign: "right" }}>₹{fmt2(r.purchase_price)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>₹{fmt2(r._value)}</td>
                    <td>
                      <select className="g-sel sm" value={p.reason} onChange={(e) => update(r.id, { reason: e.target.value })} disabled={!p.selected}>
                        {REASONS.map((x) => <option key={x}>{x}</option>)}
                      </select>
                    </td>
                    <td>
                      <input className="g-inp sm" value={p.note} onChange={(e) => update(r.id, { note: e.target.value })} placeholder="optional" disabled={!p.selected} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {view.length > 0 && (
          <div style={{ padding: "12px 16px", borderTop: "1.5px solid #e5e7eb", background: "#fafafa", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, color: C.textSub }}>
              Selected: <strong>{selectedIds.length}</strong> batches · value <strong style={{ color: C.red }}>{fmtINR(selValuePtr)}</strong> (PTR)
            </div>
            <button className="g-btn" style={{ background: C.red, color: "#fff" }} onClick={submit} disabled={saving || selectedIds.length === 0}>
              <FiCheck size={14} /> {saving ? "Writing off…" : `Write off ${selectedIds.length || ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
