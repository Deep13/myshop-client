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
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700;800&display=swap');

#g-root, #g-root * {
  box-sizing: border-box !important;
  font-family: 'Noto Sans', sans-serif !important;
  -webkit-font-smoothing: antialiased;
}

#g-root .g-inp {
  display: block !important; width: 100% !important;
  height: 40px !important; padding: 0 12px !important;
  font-size: 14px !important; font-weight: 500 !important;
  color: #111827 !important; background: #fff !important;
  border: 1.5px solid #d1d5db !important; border-radius: 8px !important;
  outline: none !important; box-shadow: none !important;
  transition: border-color 0.15s !important;
  -webkit-appearance: none !important; appearance: none !important;
}
#g-root .g-inp:focus { border-color: #034C9D !important; box-shadow: 0 0 0 3px rgba(3,76,157,0.09) !important; }
#g-root .g-inp:disabled { background: #f9fafb !important; color: #9ca3af !important; cursor: not-allowed !important; }
#g-root .g-inp::placeholder { color: #9ca3af !important; font-weight: 400 !important; }
#g-root .g-inp.sm { height: 34px !important; font-size: 13px !important; padding: 0 10px !important; border-radius: 7px !important; }
#g-root .g-inp.lg { height: 46px !important; font-size: 15px !important; padding: 0 14px !important; border-radius: 9px !important; }

#g-root .g-sel {
  display: block !important; width: 100% !important;
  height: 40px !important; padding: 0 34px 0 12px !important;
  font-size: 14px !important; font-weight: 500 !important; color: #111827 !important;
  background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 10px center !important;
  border: 1.5px solid #d1d5db !important; border-radius: 8px !important;
  outline: none !important; cursor: pointer !important;
  -webkit-appearance: none !important; appearance: none !important;
}
#g-root .g-sel:focus { border-color: #034C9D !important; box-shadow: 0 0 0 3px rgba(3,76,157,0.09) !important; }
#g-root .g-sel.sm { height: 34px !important; font-size: 13px !important; padding: 0 30px 0 10px !important; border-radius: 7px !important; }
#g-root .g-sel.lg { height: 46px !important; font-size: 15px !important; padding: 0 36px 0 14px !important; }

#g-root .g-lbl {
  display: block !important; font-size: 13px !important;
  font-weight: 700 !important; color: #374151 !important;
  margin-bottom: 5px !important;
}
#g-root .g-hint { font-size: 12px !important; color: #6b7280 !important; margin-top: 4px !important; }

#g-root .g-btn {
  display: inline-flex !important; align-items: center !important;
  justify-content: center !important; gap: 6px !important;
  height: 38px !important; padding: 0 16px !important;
  font-size: 14px !important; font-weight: 700 !important;
  border-radius: 8px !important; cursor: pointer !important;
  transition: all 0.15s !important; white-space: nowrap !important;
  border: none !important;
}
#g-root .g-btn.primary { background: #034C9D !important; color: #fff !important; box-shadow: 0 2px 6px rgba(3,76,157,0.22) !important; }
#g-root .g-btn.primary:hover { background: #023a7a !important; }
#g-root .g-btn.success { background: #16a34a !important; color: #fff !important; box-shadow: 0 2px 6px rgba(22,163,74,0.22) !important; }
#g-root .g-btn.success:hover { background: #15803d !important; }
#g-root .g-btn.success.lg { height: 48px !important; font-size: 16px !important; width: 100% !important; }
#g-root .g-btn.outline { background: #fff !important; color: #034C9D !important; border: 2px solid #034C9D !important; }
#g-root .g-btn.outline:hover { background: #dbeafe !important; }
#g-root .g-btn.ghost { background: #fff !important; color: #374151 !important; border: 1.5px solid #e5e7eb !important; }
#g-root .g-btn.ghost:hover { border-color: #034C9D !important; color: #034C9D !important; background: #eff6ff !important; }
#g-root .g-btn.danger { background: #fff !important; color: #dc2626 !important; border: 1.5px solid #fca5a5 !important; }
#g-root .g-btn.danger:hover { background: #fee2e2 !important; }
#g-root .g-btn.sm { height: 30px !important; font-size: 12px !important; padding: 0 10px !important; gap: 4px !important; border-radius: 6px !important; }
#g-root .g-btn.lg { height: 46px !important; font-size: 15px !important; padding: 0 22px !important; }
#g-root .g-btn:disabled { opacity: 0.5 !important; cursor: not-allowed !important; }

#g-root .g-card {
  background: #fff !important; border-radius: 12px !important;
  border: 1.5px solid #e5e7eb !important;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06) !important;
  overflow: hidden !important;
}
#g-root .g-card-head {
  padding: 12px 18px !important; border-bottom: 1.5px solid #e5e7eb !important;
  background: #f8fafc !important;
  display: flex !important; align-items: center !important; justify-content: space-between !important;
}
#g-root .g-card-title {
  font-size: 15px !important; font-weight: 800 !important;
  color: #111827 !important; margin: 0 !important;
  display: flex !important; align-items: center !important; gap: 8px !important;
}
#g-root .g-card-body { padding: 18px !important; }

#g-root .g-table { width: 100% !important; border-collapse: collapse !important; }
#g-root .g-table thead th {
  background: #f1f5f9 !important; color: #6b7280 !important;
  font-size: 11.5px !important; font-weight: 700 !important;
  text-transform: uppercase !important; letter-spacing: 0.05em !important;
  padding: 10px 12px !important; border: none !important;
  border-bottom: 2px solid #e2e8f0 !important; white-space: nowrap !important;
}
#g-root .g-table tbody td {
  padding: 9px 12px !important; border: none !important;
  border-bottom: 1px solid #f3f4f6 !important;
  vertical-align: middle !important; font-size: 13.5px !important;
  color: #111827 !important;
}
#g-root .g-table tbody tr:hover td { background: #f8fafc !important; }
#g-root .g-table tbody tr:last-child td { border-bottom: none !important; }

#g-root .g-td-inp {
  display: block !important; width: 100% !important;
  height: 38px !important; padding: 0 8px !important;
  font-size: 13.5px !important; font-weight: 500 !important;
  color: #111827 !important; background: transparent !important;
  border: none !important; outline: none !important;
}
#g-root .g-td-inp:focus { background: #eff6ff !important; border-radius: 6px !important; }
#g-root .g-td-inp::placeholder { color: #d1d5db !important; }

#g-root .g-step {
  width: 28px !important; height: 28px !important; border-radius: 50% !important;
  background: #034C9D !important; color: #fff !important;
  font-size: 13px !important; font-weight: 800 !important;
  display: flex !important; align-items: center !important; justify-content: center !important;
  flex-shrink: 0 !important;
}

#g-root .g-badge {
  display: inline-flex !important; align-items: center !important;
  padding: 2px 9px !important; border-radius: 999px !important;
  font-size: 11.5px !important; font-weight: 700 !important; white-space: nowrap !important;
}

#g-root .g-sug { cursor: pointer !important; }
#g-root .g-sug:hover { background: #f1f5f9 !important; }

#g-root .g-grid-2 { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 16px !important; }
#g-root .g-grid-3 { display: grid !important; grid-template-columns: 1fr 1fr 1fr !important; gap: 16px !important; }
#g-root .g-grid-4 { display: grid !important; grid-template-columns: 1fr 1fr 1fr 1fr !important; gap: 14px !important; }
#g-root .g-span-2 { grid-column: 1 / 3 !important; }
#g-root .g-span-all { grid-column: 1 / -1 !important; }

#g-root .g-page { padding: 20px 26px !important; background: #f0f4f8 !important; min-height: 100vh !important; }
#g-root .g-page-head {
  display: flex !important; align-items: center !important; justify-content: space-between !important;
  margin-bottom: 20px !important;
}
#g-root .g-page-title { font-size: 20px !important; font-weight: 800 !important; color: #111827 !important; margin: 0 !important; }
#g-root .g-page-sub { font-size: 13px !important; color: #6b7280 !important; margin-top: 2px !important; }

#g-root .g-toggle-wrap { display: flex !important; background: #f1f5f9 !important; border-radius: 9px !important; padding: 3px !important; gap: 3px !important; }
#g-root .g-toggle-btn {
  padding: 5px 14px !important; border-radius: 7px !important; border: none !important;
  font-size: 13px !important; font-weight: 700 !important; cursor: pointer !important;
  transition: all 0.15s !important; color: #6b7280 !important; background: transparent !important;
}
#g-root .g-toggle-btn.active { background: #034C9D !important; color: #fff !important; }

@keyframes g-modal-in { from{opacity:0;transform:scale(0.95) translateY(10px);}to{opacity:1;transform:none;} }
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
    <div onMouseDown={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div id="g-root" onMouseDown={(e) => e.stopPropagation()} style={{ width, maxWidth: "100%", background: C.white, borderRadius: 14, boxShadow: "0 24px 60px rgba(0,0,0,0.2)", overflow: "hidden", animation: "g-modal-in 0.18s ease", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        <style>{GLOBAL_CSS}</style>
        <div style={{ padding: "14px 20px", borderBottom: `1.5px solid ${C.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: C.text, fontFamily: "'Noto Sans', sans-serif" }}>{title}</span>
          <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", cursor: "pointer", color: C.textSub, width: 32, height: 32, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}><FiX size={16} /></button>
        </div>
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: "12px 20px", borderTop: `1.5px solid ${C.borderLight}`, display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    Paid:      { bg: C.greenLight,  color: C.greenDark },
    Partial:   { bg: C.yellowLight, color: C.yellow },
    Unpaid:    { bg: C.redLight,    color: C.red },
    GST:       { bg: C.brandLight,  color: C.brand },
    "NON-GST": { bg: "#f3f4f6",     color: "#374151" },
  };
  const s = map[status] || { bg: "#f3f4f6", color: "#374151" };
  return <span className="g-badge" style={{ background: s.bg, color: s.color }}>{status}</span>;
}

export function SortTH({ label, colKey, sortConfig, onSort, style }) {
  const active = sortConfig?.key === colKey;
  return (
    <th onClick={() => onSort(colKey)} style={{ cursor: "pointer", whiteSpace: "nowrap", userSelect: "none", ...style }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        <span style={{ fontSize: 9, color: active ? C.brand : C.textLight }}>{active ? (sortConfig.direction === "asc" ? "▲" : "▼") : "⇅"}</span>
      </span>
    </th>
  );
}

export const DATE_RANGES = ["Today", "Yesterday", "This Week", "This Month", "Last Month", "This Quarter", "This Year", "Custom"];

export function applyDateRange(range) {
  const today = new Date();
  const fmt = (d) => d.toISOString().split("T")[0];
  switch (range) {
    case "Today":        return { from: fmt(today), to: fmt(today) };
    case "Yesterday":    { const y = new Date(today); y.setDate(y.getDate()-1); return { from: fmt(y), to: fmt(y) }; }
    case "This Week":    { const s = new Date(today); s.setDate(today.getDate()-today.getDay()); return { from: fmt(s), to: fmt(today) }; }
    case "This Month":   return { from: `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-01`, to: fmt(today) };
    case "Last Month":   { const f=new Date(today.getFullYear(),today.getMonth()-1,1); const l=new Date(today.getFullYear(),today.getMonth(),0); return { from:fmt(f),to:fmt(l) }; }
    case "This Quarter": { const q=Math.floor(today.getMonth()/3); const s=new Date(today.getFullYear(),q*3,1); return { from:fmt(s),to:fmt(today) }; }
    case "This Year":    return { from:`${today.getFullYear()}-01-01`, to:fmt(today) };
    default: return null;
  }
}

export const API = "http://localhost/myshop-backend";
export const asNum = (x) => { const n = Number(x); return isFinite(n) ? n : 0; };
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const fmt2 = (n) => Number(n || 0).toFixed(2);
export const fmtINR = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
