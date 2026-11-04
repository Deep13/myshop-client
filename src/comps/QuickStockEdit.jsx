import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiSearch, FiCheck, FiX } from "react-icons/fi";
import { C, API, asNum, fmtDate, todayISO, sameBarcode, Pagination } from "../ui.jsx";
import toast from "../toast.js";

/* Quick Edit: one row per batch, MRP / Sale / Stock typeable in place.
   Scan (or type) in the search box → Enter jumps to the first batch's MRP →
   Tab to Sale, Tab to Stock → Enter goes down a row, or back to the search
   box from the last row, ready for the next scan. Edits pile up across
   searches (changed cells turn yellow) and go in one Save. */

const PAGE_SIZE = 50;
const FIELDS = [
  { key: "mrp",        col: "mrp",         label: "MRP" },
  { key: "salePrice",  col: "sale_price",  label: "Sale ₹" },
  { key: "currentQty", col: "current_qty", label: "Stock" },
];
const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();
const same = (a, b) => asNum(a) === asNum(b) && String(a).trim() !== "";

export default function QuickStockEdit({ inventory, onSaved, onClose }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [edits, setEdits] = useState({}); // { [invId]: { mrp?, salePrice?, currentQty? } } — only changed values
  const [saving, setSaving] = useState(false);
  const searchRef = useRef(null);
  const cellRefs = useRef({}); // "rowIdx:fieldIdx" → input
  const today = todayISO();

  useEffect(() => { searchRef.current?.focus(); }, []);

  // Packet rows are cut from a bulk item's kg and have no stock of their own.
  const batches = useMemo(() => inventory
    .filter((b) => Number(b.is_pack) !== 1 && asNum(b.id) > 0)
    .sort((a, b) => (a.item_name || "").localeCompare(b.item_name || "") || asNum(a.id) - asNum(b.id)),
  [inventory]);

  const rows = useMemo(() => {
    const t = q.trim();
    if (!t) return batches;
    const scanned = batches.filter((b) => sameBarcode(b.item_code, t));
    if (scanned.length) return scanned;
    const low = t.toLowerCase();
    return batches.filter((b) =>
      (b.item_name || "").toLowerCase().includes(low) ||
      (b.item_code || "").toLowerCase().includes(low) ||
      (b.batch_no || "").toLowerCase().includes(low));
  }, [batches, q]);

  useEffect(() => setPage(1), [q]);
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const changedCount = Object.keys(edits).length;

  // Leaving the page with unsaved edits loses them — say so.
  useEffect(() => {
    if (!changedCount) return;
    const fn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [changedCount]);

  const valueOf = (b, f) => edits[b.id]?.[f.key] ?? String(Number(asNum(b[f.col])));
  const setValue = (b, f, val) => setEdits((prev) => {
    const row = { ...(prev[b.id] || {}) };
    if (same(val, b[f.col])) delete row[f.key]; else row[f.key] = val;
    const next = { ...prev };
    if (Object.keys(row).length) next[b.id] = row; else delete next[b.id];
    return next;
  });

  const focusCell = (r, c) => {
    const el = cellRefs.current[`${r}:${c}`];
    if (el) { el.focus(); el.select(); return true; }
    return false;
  };
  const backToSearch = () => { searchRef.current?.focus(); searchRef.current?.select(); };

  const onCellKey = (e, r, c) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!focusCell(r + 1, c)) backToSearch();
    } else if (e.key === "ArrowDown") { e.preventDefault(); focusCell(r + 1, c); }
    else if (e.key === "ArrowUp")    { e.preventDefault(); if (!focusCell(r - 1, c)) backToSearch(); }
    else if (e.key === "Escape")     { e.preventDefault(); backToSearch(); }
  };

  const save = async () => {
    if (!changedCount || saving) return;
    for (const [id, ch] of Object.entries(edits)) {
      for (const [k, v] of Object.entries(ch)) {
        if (String(v).trim() === "" || isNaN(Number(v)) || Number(v) < 0) {
          const b = batches.find((x) => String(x.id) === id);
          toast.warn(`${b?.item_name || "A row"}: ${FIELDS.find((f) => f.key === k).label} must be a number, 0 or more`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const r = await fetch(`${API}/bulk_update_inventory.php`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changes: Object.entries(edits).map(([id, ch]) => ({ inventoryId: Number(id), ...ch })),
          updatedBy: user?.id || 0,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Save failed");
      toast.success(`Saved ${j.updated} batch${j.updated === 1 ? "" : "es"}`);
      setEdits({});
      await onSaved?.();
      backToSearch();
    } catch (e) { toast.error(e.message || "Save failed"); }
    finally { setSaving(false); }
  };

  // Ctrl+S saves from anywhere in the grid.
  useEffect(() => {
    const fn = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  });

  const close = () => {
    if (changedCount && !window.confirm(`Discard ${changedCount} unsaved change${changedCount === 1 ? "" : "s"}?`)) return;
    onClose?.();
  };

  return (
    <div className="g-card">
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 14px", borderBottom: "1.5px solid #e5e7eb", background: "#f8fafc", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
          <FiSearch size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textSub, pointerEvents: "none" }} />
          <input ref={searchRef} className="g-inp search" style={{ width: "100%" }} value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); if (!focusCell(0, 0)) toast.warn(`Nothing found for "${q.trim()}"`); }
              else if (e.key === "ArrowDown") { e.preventDefault(); focusCell(0, 0); }
            }}
            onFocus={(e) => e.target.select()}
            placeholder="Scan barcode or search name / code / batch, then Enter" />
        </div>
        <span style={{ fontSize: 12, color: C.textSub, whiteSpace: "nowrap" }}>{rows.length} batches</span>
        <span style={{ fontSize: 11, color: C.textLight, whiteSpace: "nowrap" }}>Enter = next row · Tab = next box · Ctrl+S = save</span>
        <button className="g-btn ghost sm" onClick={() => setEdits({})} disabled={!changedCount || saving}>Undo all</button>
        <button className="g-btn primary sm" onClick={save} disabled={!changedCount || saving}>
          <FiCheck size={13} /> {saving ? "Saving…" : `Save ${changedCount || ""} change${changedCount === 1 ? "" : "s"}`}
        </button>
        <button className="g-btn ghost sm" onClick={close} title="Close Quick Edit"><FiX size={14} /></button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="g-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Batch</th>
              <th>Expiry</th>
              {FIELDS.map((f) => <th key={f.key} style={{ textAlign: "right", width: 120 }}>{f.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 28, color: C.textSub }}>No batches found</td></tr>
            ) : paged.map((b, r) => {
              const expired = b.exp_date && b.exp_date < today;
              const isBulk = Number(b.is_bulk) === 1;
              return (
                <tr key={b.id} style={{ background: edits[b.id] ? "#fffbeb" : undefined }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{b.item_name}</div>
                    <div style={{ fontSize: 11, color: C.textSub }}>{b.item_code}{isBulk ? " · stock in kg" : ""}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{b.batch_no || <span style={{ color: C.textLight }}>—</span>}</td>
                  <td style={{ fontSize: 12, color: expired ? C.red : C.textSub, fontWeight: expired ? 700 : 400 }}>{b.exp_date ? fmtDate(b.exp_date) : "—"}</td>
                  {FIELDS.map((f, c) => {
                    const changed = edits[b.id]?.[f.key] !== undefined;
                    return (
                      <td key={f.key} style={{ textAlign: "right" }}>
                        <input ref={(el) => (cellRefs.current[`${r}:${c}`] = el)}
                          className="g-inp sm" inputMode="decimal"
                          value={valueOf(b, f)}
                          onChange={(e) => setValue(b, f, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => onCellKey(e, r, c)}
                          title={changed ? `Was ${Number(asNum(b[f.col]))}` : ""}
                          style={{ width: 100, textAlign: "right", fontWeight: 700,
                                   background: changed ? "#fde68a" : undefined,
                                   borderColor: changed ? "#f59e0b" : undefined }} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination total={rows.length} page={page} onPage={setPage} pageSize={PAGE_SIZE} />
    </div>
  );
}
