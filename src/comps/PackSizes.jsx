import { useState } from "react";
import { Link } from "react-router-dom";
import { FiPlus, FiLink, FiX, FiPackage } from "react-icons/fi";
import { C, API, Field, asNum, fmt2, generateEan13 } from "../ui.jsx";
import BulkItemSelect from "./BulkItemSelect.jsx";
import toast from "../toast.js";

/* ── PackSizes ─────────────────────────────────────────────
   The pack sizes of a bulk item, managed from the bulk item's page.
   Each size is its own item with its own barcode; it holds no stock
   and is priced at weight × the bulk item's per-kg rates.

   Props:
     bulk        - the bulk item (from get_item_detail.php)
     packs       - its sizes: id, name, code, pack_weight, mrp, sale_price,
                   purchase_price, packs_available
     stockKg     - the bulk item's stock in kg
     itemMaster  - all items (get_items_all.php), for "connect existing"
     onChanged   - called after any change, to reload the page
*/
const weightLabel = (kg) => {
  const g = Math.round(asNum(kg) * 1000);
  return g >= 1000 && g % 1000 === 0 ? `${g / 1000}KG` : g >= 1000 ? `${asNum(kg)}KG` : `${g}G`;
};
// "BADAM (BULK)" -> "BADAM", so a 250 g size is suggested as "BADAM 250G".
const baseName = (name) => String(name || "").replace(/\s*[(-]?\s*\b(BULK|LOOSE)\b\s*\)?/gi, " ").replace(/\s+/g, " ").trim();

async function post(body) {
  const r = await fetch(`${API}/set_pack.php`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.status !== "success") throw new Error(j.message || "Failed");
  return j;
}

export default function PackSizes({ bulk, packs, stockKg, itemMaster, onChanged }) {
  const [mode, setMode] = useState(null);           // null | "add" | "connect"
  const [busy, setBusy] = useState(false);
  const [grams, setGrams] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [code, setCode] = useState("");
  const [pick, setPick] = useState(null);

  const kg = asNum(grams) / 1000;
  const suggested = kg > 0 ? `${baseName(bulk.name)} ${weightLabel(kg)}` : "";
  const shownName = nameTouched ? name : suggested;
  const perKgSale = asNum(bulk.sale_price), perKgMrp = asNum(bulk.mrp);

  const reset = () => { setMode(null); setGrams(""); setName(""); setNameTouched(false); setCode(""); setPick(null); };

  const addSize = async () => {
    if (!(kg > 0)) return toast.warn("Enter the pack weight in grams");
    if (!shownName.trim()) return toast.warn("Enter a name");
    if (!code.trim()) return toast.warn("Scan, type or generate a barcode");
    setBusy(true);
    try {
      await post({ action: "create", bulkItemId: Number(bulk.id), name: shownName.trim(), code: code.trim(), packWeight: kg });
      toast.success(`${shownName.trim()} added`);
      reset();
      onChanged();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const connect = async () => {
    if (!pick) return toast.warn("Pick the item to connect");
    if (!(kg > 0)) return toast.warn("Enter its weight in grams");
    if (!window.confirm(`Connect ${pick.name} as a ${weightLabel(kg)} pack of ${bulk.name}?\n\n` +
      `Any stock it holds moves into ${bulk.name} as kg, and its price will follow ${bulk.name}'s per-kg price.`)) return;
    setBusy(true);
    try {
      const j = await post({ action: "connect", bulkItemId: Number(bulk.id), itemId: Number(pick.id), packWeight: kg });
      const moved = asNum(j.movedKg);
      toast.success(moved > 0 ? `${pick.name} connected — ${fmt2(moved)} kg moved into ${bulk.name}` : `${pick.name} connected`);
      reset();
      onChanged();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const disconnect = async (p) => {
    if (!window.confirm(`Disconnect ${p.name}?\n\nIt becomes an ordinary item with no stock, keeping its current price.`)) return;
    setBusy(true);
    try {
      await post({ action: "disconnect", itemId: Number(p.id) });
      toast.success(`${p.name} disconnected`);
      onChanged();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="g-card" style={{ marginBottom: 20 }}>
      <div className="g-card-head">
        <div className="g-card-title">
          <span style={{ color: C.brand }}><FiPackage size={15} /></span>
          Pack sizes ({packs.length}) · {fmt2(stockKg)} kg in stock
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="g-btn ghost sm" disabled={busy} onClick={() => { reset(); setMode("add"); }}><FiPlus size={13} /> Add size</button>
          <button className="g-btn ghost sm" disabled={busy} onClick={() => { reset(); setMode("connect"); }}><FiLink size={13} /> Connect existing item</button>
        </div>
      </div>

      <div style={{ padding: "8px 18px 0", fontSize: 12, color: C.textSub }}>
        Every size is priced at its weight × this item's per-kg price
        {perKgSale > 0 ? <> (<b>₹{fmt2(perKgSale)}</b> / kg{perKgMrp > 0 ? <>, MRP <b>₹{fmt2(perKgMrp)}</b> / kg</> : null})</> : null}.
        Each purchase of this item reprices them all.
      </div>

      {mode && (
        <div style={{ margin: "10px 18px 0", padding: "12px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: mode === "add" ? "110px 1fr 1fr" : "2fr 110px", gap: 10, alignItems: "end" }}>
            {mode === "connect" && (
              <Field label="Item">
                <BulkItemSelect className="g-inp" items={itemMaster} valueId={pick?.id ?? null} excludeId={Number(bulk.id)} onPick={setPick} />
              </Field>
            )}
            <Field label="Weight (g)">
              <input className="g-inp" value={grams} onChange={(e) => setGrams(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="250" autoFocus />
            </Field>
            {mode === "add" && (
              <>
                <Field label="Name">
                  <input className="g-inp" value={shownName} placeholder={`${baseName(bulk.name)} 250G`}
                    onChange={(e) => { setNameTouched(true); setName(e.target.value); }} />
                </Field>
                <Field label="Barcode">
                  <div style={{ display: "flex", gap: 6 }}>
                    <input className="g-inp" style={{ flex: 1 }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Scan or type" />
                    <button type="button" className="g-btn ghost sm" onClick={() => setCode(generateEan13())}>Generate</button>
                  </div>
                </Field>
              </>
            )}
          </div>
          {kg > 0 && perKgSale > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: C.textSub }}>
              Will sell at <b>₹{Math.min(Math.round(perKgSale * kg), perKgMrp > 0 ? Math.round(perKgMrp * kg) : Infinity)}</b>
              {perKgMrp > 0 && <> (MRP ₹{Math.round(perKgMrp * kg)})</>}, and each one sold takes {fmt2(kg)} kg off {bulk.name}.
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
            <button className="g-btn ghost sm" disabled={busy} onClick={reset}>Cancel</button>
            <button className="g-btn primary sm" disabled={busy} onClick={mode === "add" ? addSize : connect}>
              {mode === "add" ? <><FiPlus size={13} /> Add size</> : <><FiLink size={13} /> Connect</>}
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: "10px 0 4px" }}>
        {packs.length === 0 ? (
          <div style={{ padding: "14px 18px", fontSize: 13, color: C.textSub }}>No pack sizes yet — add one, or connect a barcode you already have.</div>
        ) : (
          <table className="g-table" style={{ width: "100%" }}>
            <thead><tr>
              <th style={{ paddingLeft: 18 }}>Size</th><th>Barcode</th><th style={{ textAlign: "right" }}>Weight</th>
              <th style={{ textAlign: "right" }}>MRP</th><th style={{ textAlign: "right" }}>Sale</th>
              <th style={{ textAlign: "right" }}>Cost</th><th style={{ textAlign: "right" }}>Packs left</th><th></th>
            </tr></thead>
            <tbody>
              {packs.map((p) => (
                <tr key={p.id}>
                  <td style={{ paddingLeft: 18 }}><Link to={`/inventory/${p.id}`} style={{ color: C.brand, fontWeight: 700, textDecoration: "none" }}>{p.name}</Link></td>
                  <td style={{ color: C.textSub }}>{p.code}</td>
                  <td style={{ textAlign: "right" }}>{weightLabel(p.pack_weight)}</td>
                  <td style={{ textAlign: "right" }}>₹{fmt2(p.mrp)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>₹{fmt2(p.sale_price)}</td>
                  <td style={{ textAlign: "right", color: C.textSub }}>₹{fmt2(p.purchase_price)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: asNum(p.packs_available) > 0 ? C.green : C.red }}>{p.packs_available}</td>
                  <td style={{ textAlign: "right", paddingRight: 12 }}>
                    <button className="g-btn ghost sm" disabled={busy} title="Disconnect this size" onClick={() => disconnect(p)}><FiX size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
