import { useEffect, useRef, useState } from "react";
import { CATEGORIES } from "../data/categories.js";

/* ── CategorySelect ────────────────────────────────────────
   Dropdown of canonical item categories. When user picks one,
   calls onPick(category) with the full { name, hsn, tax } object
   so the parent can auto-fill HSN and tax fields.

   Props:
     value    - current category name (string)
     onChange - called with new category name (string)
     onPick   - called with full { name, hsn, tax } on selection
     className / inputStyle / placeholder
*/
export default function CategorySelect({ value, onChange, onPick, className, inputStyle, placeholder }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [search, setSearch] = useState("");
  const wrapRef = useRef();

  useEffect(() => {
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = (search || "").toLowerCase().trim();
  const filtered = q
    ? CATEGORIES.filter((c) => c.name.toLowerCase().includes(q))
    : CATEGORIES;

  const pick = (c) => {
    onChange(c.name);
    onPick?.(c);
    setSearch("");
    setOpen(false);
    setHighlight(-1);
  };

  const openDropdown = () => {
    setSearch("");
    setOpen(true);
    setHighlight(-1);
  };

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative" }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="text"
        className={className}
        value={open ? search : (value || "")}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); setHighlight(-1); }}
        onFocus={openDropdown}
        onClick={(e) => { e.stopPropagation(); if (!open) openDropdown(); }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, -1)); }
          else if (e.key === "Enter" && highlight >= 0) { e.preventDefault(); pick(filtered[highlight]); }
          else if (e.key === "Escape") { setOpen(false); }
        }}
        placeholder={placeholder || "Select category"}
        style={{ width: "100%", boxSizing: "border-box", cursor: "pointer", ...inputStyle }}
      />
      {open && filtered.length > 0 && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0,
            zIndex: 100001, background: "#fff",
            border: "1.5px solid #e2e8f0", borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
            maxHeight: 260, overflowY: "auto",
          }}
        >
          {filtered.map((c, i) => (
            <div
              key={c.name}
              onMouseDown={(e) => {
                // preventDefault keeps focus on the input, stopPropagation stops outer click handlers
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                pick(c);
              }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: "8px 10px", cursor: "pointer",
                borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none",
                background: highlight === i ? "#f0f9ff" : "#fff",
                display: "flex", alignItems: "center", gap: 10,
              }}
            >
              <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{c.name}</div>
              <div style={{ fontSize: 10, color: "#64748b", textAlign: "right" }}>
                {c.hsn ? `HSN ${c.hsn} · ` : ""}{c.tax}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
