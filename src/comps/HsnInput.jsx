import { useEffect, useRef, useState } from "react";
import { HSN_CODES } from "../data/hsnCodes.js";

/* ── HsnInput ───────────────────────────────────────────
   Manual text input + dropdown of known HSN codes with
   category and description. User can type a custom HSN
   (free input) OR pick one from the filtered suggestions.

   Props: value, onChange, placeholder, className, style
*/
export default function HsnInput({ value, onChange, placeholder, className, style, inputStyle }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef();

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = (value || "").toLowerCase().trim();
  const filtered = q
    ? HSN_CODES.filter(
        (h) =>
          h.hsn.includes(q) ||
          h.description.toLowerCase().includes(q) ||
          h.category.toLowerCase().includes(q)
      ).slice(0, 20)
    : HSN_CODES.slice(0, 20);

  const pick = (h) => {
    onChange(h.hsn);
    setOpen(false);
    setHighlight(-1);
  };

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", ...style }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="text"
        className={className}
        value={value || ""}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => setOpen(true)}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, -1));
          } else if (e.key === "Enter" && highlight >= 0) {
            e.preventDefault();
            pick(filtered[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder || "HSN code (type or select)"}
        style={{ width: "100%", boxSizing: "border-box", ...inputStyle }}
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
          {filtered.map((h, i) => (
            <div
              key={h.hsn + i}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); pick(h); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: "8px 10px", cursor: "pointer",
                borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none",
                background: highlight === i ? "#f0f9ff" : "#fff",
                display: "flex", alignItems: "center", gap: 10,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13, color: "#034C9D", minWidth: 48 }}>{h.hsn}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {h.description}
                </div>
                <div style={{ fontSize: 10, color: "#64748b" }}>{h.category}{h.gst !== undefined ? ` · ${h.gst}% GST` : ""}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
