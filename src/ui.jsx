// ─── Shared Design System — Ganga Instamart ───
export const C = {
  brand: "#034C9D", brandDark: "#023a7a", brandLight: "#dbeafe", brandLighter: "#eff6ff",
  green: "#16a34a", greenDark: "#15803d", greenLight: "#dcfce7",
  orange: "#ea580c", orangeLight: "#fff7ed",
  red: "#dc2626", redLight: "#fee2e2",
  yellow: "#ca8a04", yellowLight: "#fef9c3",
  bg: "#f0f4f8", white: "#ffffff",
  border: "#d1d5db", borderLight: "#e5e7eb",
  text: "#111827", textSub: "#6b7280", textLight: "#9ca3af",
};

export const GLOBAL_CSS = `
#g-root, #g-root * {
  box-sizing: border-box !important;
  font-family: 'Inter', 'Noto Sans', system-ui, -apple-system, sans-serif !important;
  -webkit-font-smoothing: antialiased;
}

/* ── Inputs ── */
#g-root .g-inp {
  display: block !important; width: 100% !important;
  height: 42px !important; padding: 0 13px !important;
  font-size: 14px !important; font-weight: 500 !important;
  color: #111827 !important; background: #fff !important;
  border: 1.5px solid #e2e8f0 !important; border-radius: 9px !important;
  outline: none !important; box-shadow: 0 1px 2px rgba(0,0,0,0.04) !important;
  transition: border-color 0.15s, box-shadow 0.15s !important;
  -webkit-appearance: none !important; appearance: none !important;
}
#g-root .g-inp:focus { border-color: #034C9D !important; box-shadow: 0 0 0 3px rgba(3,76,157,0.1) !important; }
#g-root .g-inp:disabled { background: #f8fafc !important; color: #9ca3af !important; cursor: not-allowed !important; }
#g-root .g-inp::placeholder { color: #a1a1aa !important; font-weight: 400 !important; }
#g-root .g-inp.sm { height: 34px !important; font-size: 13px !important; padding: 0 10px !important; border-radius: 7px !important; }
#g-root .g-inp.sm.search { padding-left: 30px !important; }
#g-root .g-inp.lg { height: 48px !important; font-size: 15px !important; padding: 0 15px !important; border-radius: 10px !important; }

/* ── Select ── */
#g-root .g-sel {
  display: block !important; width: 100% !important;
  height: 42px !important; padding: 0 34px 0 13px !important;
  font-size: 14px !important; font-weight: 500 !important; color: #111827 !important;
  background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 10px center !important;
  border: 1.5px solid #e2e8f0 !important; border-radius: 9px !important;
  outline: none !important; cursor: pointer !important;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04) !important;
  -webkit-appearance: none !important; appearance: none !important;
  transition: border-color 0.15s, box-shadow 0.15s !important;
}
#g-root .g-sel:focus { border-color: #034C9D !important; box-shadow: 0 0 0 3px rgba(3,76,157,0.1) !important; }
#g-root .g-sel.sm { height: 34px !important; font-size: 13px !important; padding: 0 30px 0 10px !important; border-radius: 7px !important; }
#g-root .g-sel.lg { height: 48px !important; font-size: 15px !important; padding: 0 36px 0 15px !important; }

/* ── Labels / Hints ── */
#g-root .g-lbl {
  display: block !important; font-size: 13px !important;
  font-weight: 600 !important; color: #374151 !important;
  margin-bottom: 6px !important; letter-spacing: -0.01em !important;
}
#g-root .g-hint { font-size: 12px !important; color: #6b7280 !important; margin-top: 4px !important; }

/* ── Buttons ── */
#g-root .g-btn {
  display: inline-flex !important; align-items: center !important;
  justify-content: center !important; gap: 6px !important;
  height: 38px !important; padding: 0 18px !important;
  font-size: 13.5px !important; font-weight: 600 !important;
  border-radius: 9px !important; cursor: pointer !important;
  transition: all 0.15s ease !important; white-space: nowrap !important;
  border: none !important; letter-spacing: -0.01em !important;
}
#g-root .g-btn.primary {
  background: linear-gradient(135deg, #034C9D 0%, #0369a1 100%) !important;
  color: #fff !important; box-shadow: 0 2px 8px rgba(3,76,157,0.25) !important;
}
#g-root .g-btn.primary:hover { box-shadow: 0 4px 12px rgba(3,76,157,0.35) !important; filter: brightness(1.05) !important; }
#g-root .g-btn.success {
  background: linear-gradient(135deg, #16a34a 0%, #15803d 100%) !important;
  color: #fff !important; box-shadow: 0 2px 8px rgba(22,163,74,0.25) !important;
}
#g-root .g-btn.success:hover { box-shadow: 0 4px 12px rgba(22,163,74,0.35) !important; filter: brightness(1.05) !important; }
#g-root .g-btn.success.lg { height: 48px !important; font-size: 15px !important; width: 100% !important; border-radius: 10px !important; }
#g-root .g-btn.outline { background: #fff !important; color: #034C9D !important; border: 1.5px solid #034C9D !important; }
#g-root .g-btn.outline:hover { background: #eff6ff !important; }
#g-root .g-btn.ghost {
  background: #fff !important; color: #374151 !important;
  border: 1.5px solid #e2e8f0 !important; box-shadow: 0 1px 2px rgba(0,0,0,0.04) !important;
}
#g-root .g-btn.ghost:hover { border-color: #034C9D !important; color: #034C9D !important; background: #eff6ff !important; }
#g-root .g-btn.danger { background: #fff !important; color: #dc2626 !important; border: 1.5px solid #fca5a5 !important; }
#g-root .g-btn.danger:hover { background: #fee2e2 !important; }
#g-root .g-btn.sm { height: 32px !important; font-size: 12px !important; padding: 0 12px !important; gap: 4px !important; border-radius: 7px !important; }
#g-root .g-btn.lg { height: 46px !important; font-size: 15px !important; padding: 0 24px !important; }
#g-root .g-btn:disabled { opacity: 0.5 !important; cursor: not-allowed !important; pointer-events: none !important; }

/* ── Cards ── */
#g-root .g-card {
  background: #fff !important; border-radius: 14px !important;
  border: 1px solid #e2e8f0 !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02) !important;
  overflow: visible !important;
}
#g-root .g-card-head {
  padding: 14px 20px !important; border-bottom: 1px solid #f1f5f9 !important;
  background: #fafbfc !important; border-radius: 14px 14px 0 0 !important;
  display: flex !important; align-items: center !important; justify-content: space-between !important;
}
#g-root .g-card-title {
  font-size: 15px !important; font-weight: 700 !important;
  color: #111827 !important; margin: 0 !important;
  display: flex !important; align-items: center !important; gap: 8px !important;
  letter-spacing: -0.01em !important;
}
#g-root .g-card-body { padding: 20px !important; }

/* ── Tables ── */
#g-root .g-table { width: 100% !important; border-collapse: collapse !important; }
#g-root .g-table thead th {
  background: #f8fafc !important; color: #64748b !important;
  font-size: 11px !important; font-weight: 700 !important;
  text-transform: uppercase !important; letter-spacing: 0.06em !important;
  padding: 11px 14px !important; border: none !important;
  border-bottom: 1.5px solid #e2e8f0 !important; white-space: nowrap !important;
}
#g-root .g-table tbody td {
  padding: 10px 14px !important; border: none !important;
  border-bottom: 1px solid #f1f5f9 !important;
  vertical-align: middle !important; font-size: 13.5px !important;
  color: #1e293b !important;
}
#g-root .g-table tbody tr { transition: background 0.1s !important; }
#g-root .g-table tbody tr:hover td { background: #f8fafc !important; }
#g-root .g-table tbody tr:last-child td { border-bottom: none !important; }

/* ── Table inline inputs ── */
#g-root .g-td-inp {
  display: block !important; width: 100% !important;
  height: 38px !important; padding: 0 8px !important;
  font-size: 13.5px !important; font-weight: 500 !important;
  color: #111827 !important; background: transparent !important;
  border: 1.5px solid transparent !important; outline: none !important;
  border-radius: 7px !important; transition: all 0.12s !important;
}
#g-root .g-td-inp.num {
  height: 30px !important; padding: 0 6px !important;
  font-size: 12px !important; text-align: right !important;
  border-radius: 6px !important;
}
#g-root .g-td-inp.item-search {
  height: 40px !important; padding: 0 8px 0 28px !important;
  font-size: 14.5px !important; font-weight: 500 !important;
}
#g-root .g-td-inp:focus { background: #eff6ff !important; border-color: #bfdbfe !important; }
#g-root .g-td-inp::placeholder { color: #cbd5e1 !important; }

/* ── Step indicator ── */
#g-root .g-step {
  width: 28px !important; height: 28px !important; border-radius: 50% !important;
  background: linear-gradient(135deg, #034C9D, #0369a1) !important; color: #fff !important;
  font-size: 13px !important; font-weight: 800 !important;
  display: flex !important; align-items: center !important; justify-content: center !important;
  flex-shrink: 0 !important; box-shadow: 0 2px 6px rgba(3,76,157,0.2) !important;
}

/* ── Badges ── */
#g-root .g-badge {
  display: inline-flex !important; align-items: center !important;
  padding: 3px 10px !important; border-radius: 999px !important;
  font-size: 11px !important; font-weight: 700 !important; white-space: nowrap !important;
  letter-spacing: 0.01em !important;
}

/* ── Suggestion dropdowns ── */
#g-root .g-sug { cursor: pointer !important; transition: background 0.1s !important; }
#g-root .g-sug:hover { background: #f1f5f9 !important; }

/* ── Grid layouts ── */
#g-root .g-grid-2 { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 16px !important; }
#g-root .g-grid-3 { display: grid !important; grid-template-columns: 1fr 1fr 1fr !important; gap: 16px !important; }
#g-root .g-grid-4 { display: grid !important; grid-template-columns: 1fr 1fr 1fr 1fr !important; gap: 14px !important; }
#g-root .g-span-2 { grid-column: 1 / 3 !important; }
#g-root .g-span-all { grid-column: 1 / -1 !important; }

/* ── Page layout ── */
#g-root .g-page { padding: 24px 28px !important; background: #f0f4f8 !important; min-height: 100vh !important; }
#g-root .g-page-head {
  display: flex !important; align-items: center !important; justify-content: space-between !important;
  margin-bottom: 22px !important;
}
#g-root .g-page-title {
  font-size: 22px !important; font-weight: 800 !important;
  color: #0f172a !important; margin: 0 !important; letter-spacing: -0.02em !important;
}
#g-root .g-page-sub { font-size: 13px !important; color: #64748b !important; margin-top: 2px !important; }

/* ── Toggle / Tab buttons ── */
#g-root .g-toggle-wrap {
  display: flex !important; background: #f1f5f9 !important;
  border-radius: 10px !important; padding: 3px !important; gap: 2px !important;
}
#g-root .g-toggle-btn {
  padding: 6px 16px !important; border-radius: 8px !important; border: none !important;
  font-size: 13px !important; font-weight: 600 !important; cursor: pointer !important;
  transition: all 0.15s !important; color: #64748b !important; background: transparent !important;
}
#g-root .g-toggle-btn:hover { color: #334155 !important; }
#g-root .g-toggle-btn.active {
  background: #034C9D !important; color: #fff !important;
  box-shadow: 0 1px 3px rgba(3,76,157,0.25) !important;
}

@keyframes g-modal-in { from{opacity:0;transform:scale(0.97) translateY(8px);}to{opacity:1;transform:none;} }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Dark Mode ── */
html.dark #g-root { background: #0f172a !important; color: #e2e8f0 !important; }
html.dark #g-root .g-card,
html.dark #g-root .g-table thead tr { background: #1e293b !important; border-color: #334155 !important; }
html.dark #g-root .g-table tbody td { border-color: #334155 !important; color: #cbd5e1 !important; }
html.dark #g-root .g-table tbody tr:hover td { background: #293548 !important; }
html.dark #g-root .g-inp,
html.dark #g-root .g-sel,
html.dark #g-root .g-td-inp { background: #1e293b !important; color: #e2e8f0 !important; border-color: #475569 !important; }
html.dark #g-root .g-inp:focus,
html.dark #g-root .g-sel:focus,
html.dark #g-root .g-td-inp:focus { border-color: #60a5fa !important; box-shadow: 0 0 0 3px rgba(96,165,250,0.15) !important; }
html.dark #g-root .g-inp::placeholder,
html.dark #g-root .g-td-inp::placeholder { color: #64748b !important; }
html.dark #g-root .g-btn.ghost { background: #1e293b !important; color: #cbd5e1 !important; border-color: #475569 !important; }
html.dark #g-root .g-btn.ghost:hover { background: #334155 !important; border-color: #60a5fa !important; color: #60a5fa !important; }
html.dark #g-root .g-card-head,
html.dark #g-root .g-table thead th { background: #1e293b !important; color: #94a3b8 !important; border-color: #334155 !important; }
html.dark [style*="background: #fff"],
html.dark [style*="background:#fff"],
html.dark [style*="background: rgb(255"],
html.dark div[style*="#f8fafc"],
html.dark div[style*="#f1f5f9"],
html.dark div[style*="#fafafa"] { background-color: #1e293b !important; }
html.dark [style*="color: #111827"],
html.dark [style*="color:#111827"],
html.dark [style*="color: #0f172a"] { color: #e2e8f0 !important; }
`;

import React, { useEffect } from "react";
import { FiX } from "react-icons/fi";

export function Field({ label, required, hint, children, style }) {
  return (
    <div style={style}>
      {label && <label className="g-lbl">{label}{required && <span style={{ color: C.red, marginLeft: 2 }}>*</span>}</label>}
      {children}
      {hint && <div className="g-hint">{hint}</div>}
    </div>
  );
}

export function Card({ title, icon, actions, children, style, mb = true }) {
  return (
    <div className="g-card" style={{ marginBottom: mb ? 18 : 0, ...style }}>
      {(title || actions) && (
        <div className="g-card-head">
          <div className="g-card-title">{icon && <span style={{ color: C.brand }}>{icon}</span>}{title}</div>
          {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
        </div>
      )}
      <div className="g-card-body">{children}</div>
    </div>
  );
}

export function Modal({ show, title, onClose, children, footer, width = 560 }) {
  useEffect(() => {
    if (!show) return;
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", fn); document.body.style.overflow = prev; };
  }, [show, onClose]);
  if (!show) return null;
  return (
    <div onMouseDown={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div id="g-root" onMouseDown={(e) => e.stopPropagation()} style={{ width, maxWidth: "100%", background: C.white, borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)", overflow: "hidden", animation: "g-modal-in 0.2s ease", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        <style>{GLOBAL_CSS}</style>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: C.text, letterSpacing: "-0.01em" }}>{title}</span>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", cursor: "pointer", color: C.textSub, width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#e2e8f0"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}>
            <FiX size={16} />
          </button>
        </div>
        <div style={{ padding: 22, overflowY: "auto", flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: "14px 22px", borderTop: `1px solid ${C.borderLight}`, display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0, background: "#fafbfc" }}>{footer}</div>}
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    Paid:      { bg: "#dcfce7", color: "#166534" },
    Partial:   { bg: "#fef9c3", color: "#854d0e" },
    Unpaid:    { bg: "#fee2e2", color: "#991b1b" },
    GST:       { bg: "#dbeafe", color: "#1e40af" },
    "NON-GST": { bg: "#f1f5f9", color: "#475569" },
  };
  const s = map[status] || { bg: "#f1f5f9", color: "#475569" };
  return <span className="g-badge" style={{ background: s.bg, color: s.color }}>{status}</span>;
}

export function SortTH({ label, colKey, sortConfig, onSort, style }) {
  const active = sortConfig?.key === colKey;
  return (
    <th onClick={() => onSort(colKey)} style={{ cursor: "pointer", whiteSpace: "nowrap", userSelect: "none", ...style }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        <span style={{ fontSize: 9, color: active ? C.brand : "#cbd5e1", transition: "color 0.12s" }}>{active ? (sortConfig.direction === "asc" ? "▲" : "▼") : "⇅"}</span>
      </span>
    </th>
  );
}

export const DATE_RANGES = ["Today", "Yesterday", "This Week", "This Month", "Last Month", "This Quarter", "This Year", "Custom"];

export function applyDateRange(range) {
  const today = new Date();
  // Use local date parts to avoid UTC timezone shift
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  switch (range) {
    case "Today":        return { from: fmt(today), to: fmt(today) };
    case "Yesterday":    { const y = new Date(today.getFullYear(), today.getMonth(), today.getDate()-1); return { from: fmt(y), to: fmt(y) }; }
    case "This Week":    { const s = new Date(today.getFullYear(), today.getMonth(), today.getDate()-today.getDay()); return { from: fmt(s), to: fmt(today) }; }
    case "This Month":   return { from: `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-01`, to: fmt(today) };
    case "Last Month":   { const f=new Date(today.getFullYear(),today.getMonth()-1,1); const l=new Date(today.getFullYear(),today.getMonth(),0); return { from:fmt(f),to:fmt(l) }; }
    case "This Quarter": { const q=Math.floor(today.getMonth()/3); const s=new Date(today.getFullYear(),q*3,1); return { from:fmt(s),to:fmt(today) }; }
    case "This Year":    return { from:`${today.getFullYear()}-01-01`, to:fmt(today) };
    default: return null;
  }
}

export const PAGE_SIZE = 100;
export function Pagination({ total, page, onPage }) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1.5px solid #e5e7eb", background: "#fafafa", fontSize: 13 }}>
      <span style={{ color: "#6b7280", fontWeight: 500 }}>Showing {from}–{to} of {total}</span>
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={() => onPage(1)} disabled={page === 1}
          style={{ ...pgBtn, opacity: page === 1 ? 0.4 : 1 }}>«</button>
        <button onClick={() => onPage(page - 1)} disabled={page === 1}
          style={{ ...pgBtn, opacity: page === 1 ? 0.4 : 1 }}>‹</button>
        {Array.from({ length: pages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 2)
          .reduce((acc, p, i, arr) => {
            if (i > 0 && p - arr[i - 1] > 1) acc.push("...");
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) =>
            p === "..." ? <span key={`e${i}`} style={{ padding: "0 4px", color: "#9ca3af" }}>…</span> :
            <button key={p} onClick={() => onPage(p)}
              style={{ ...pgBtn, background: p === page ? "#034C9D" : "#fff", color: p === page ? "#fff" : "#374151", borderColor: p === page ? "#034C9D" : "#d1d5db", fontWeight: p === page ? 700 : 500 }}>{p}</button>
          )}
        <button onClick={() => onPage(page + 1)} disabled={page === pages}
          style={{ ...pgBtn, opacity: page === pages ? 0.4 : 1 }}>›</button>
        <button onClick={() => onPage(pages)} disabled={page === pages}
          style={{ ...pgBtn, opacity: page === pages ? 0.4 : 1 }}>»</button>
      </div>
    </div>
  );
}
const pgBtn = { minWidth: 32, height: 32, border: "1.5px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", color: "#374151" };

export const API = import.meta.env.VITE_API_URL || "http://localhost/myshop-backend";
export const asNum = (x) => { const n = Number(x); return isFinite(n) ? n : 0; };
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
export const fmt2 = (n) => Number(n || 0).toFixed(2);
export const fmtINR = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
