import { useEffect, useRef, useState } from "react";

/* ── BulkItemSelect ────────────────────────────────────────
   Picks the bulk item a packet is cut from. The bulk item is an
   ordinary item that holds its stock in kg (e.g. "KAJU BULK");
   packets themselves are excluded, since links are one level deep.

   Props:
     items    - item master list (from get_items_all.php)
     valueId  - currently linked bulk item id (number | null)
     excludeId- this item's own id, so it can't point at itself
     onPick   - called with the chosen item, or null when cleared
*/
export default function BulkItemSelect({ items, valueId, excludeId, onPick, className, inputStyle }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [search, setSearch] = useState("");
  const wrapRef = useRef();

  useEffect(() => {
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selected = (items || []).find((it) => Number(it.id) === Number(valueId)) || null;
  const q = (search || "").toLowerCase().trim();
  const filtered = (items || [])
    .filter((it) => Number(it.id) !== Number(excludeId) && !it.bulkItemId)
    .filter((it) => !q || (it.name || "").toLowerCase().includes(q) || (it.code || "").toLowerCase().includes(q))
    .slice(0, 50);

  const pick = (it) => {
    onPick?.(it);
    setSearch("");
    setOpen(false);
    setHighlight(-1);
  };

  const openDropdown = () => { setSearch(""); setOpen(true); setHighlight(-1); };

  return (
    <div ref={wrapRef} style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <input
        type="text"
        className={className}
        value={open ? search : (selected ? selected.name : "")}
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
        placeholder="Not a packet — search to link one"
        style={{ width: "100%", boxSizing: "border-box", cursor: "pointer", ...inputStyle }}
      />
      {selected && !open && (
        <button type="button"
          onClick={(e) => { e.stopPropagation(); pick(null); }}
          title="Unlink from the bulk item"
          style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", color: "#64748b", fontSize: 16, lineHeight: 1 }}>×</button>
      )}
      {open && filtered.length > 0 && (
        <div onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0,
            zIndex: 100001, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.10)", maxHeight: 260, overflowY: "auto",
          }}>
          {filtered.map((it, i) => (
            <div key={it.id}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); pick(it); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: "8px 10px", cursor: "pointer",
                borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none",
                background: highlight === i ? "#f0f9ff" : "#fff",
                display: "flex", alignItems: "center", gap: 10,
              }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{it.name}</div>
              <div style={{ fontSize: 10, color: "#64748b", textAlign: "right" }}>{it.code}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
