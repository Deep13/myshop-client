import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiPackage, FiRefreshCw, FiSearch, FiChevronRight } from "react-icons/fi";
import { C, GLOBAL_CSS, API, asNum, todayISO, fmtINR } from "../ui.jsx";

const today = todayISO();
const in90  = new Date(new Date().getTime() + 90 * 86400000).toISOString().slice(0, 10);

export default function Inventory() {
  const navigate = useNavigate();
  const [items,     setItems]     = useState([]);   // from items master
  const [inventory, setInventory] = useState([]);   // from inventory table
  const [loading,   setLoading]   = useState(true);

  const [q,          setQ]          = useState("");
  const [filterExp,  setFilterExp]  = useState("all");   // all | expiring | expired | instock | outofstock
  const [filterTax,  setFilterTax]  = useState("");       // "" | "0" | "5" | "12" | "18" | "28"

  const load = async () => {
    try {
      setLoading(true);
      const [ri, rItems] = await Promise.all([
        fetch(`${API}/get_inventory.php?include_zero=1`).then((r) => r.json()),
        fetch(`${API}/get_items_all.php?limit=500`).then((r) => r.json()),
      ]);
      if (ri.status === "success")    setInventory(ri.data || []);
      if (rItems.status === "success") setItems(rItems.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  /* Build per-item summary by aggregating inventory batches */
  const itemRows = useMemo(() => {
    return items.map((it) => {
      const batches = inventory.filter((b) => asNum(b.item_id) === asNum(it.id));
      const totalStock     = batches.reduce((a, b) => a + asNum(b.current_qty), 0);
      const stockByPtr     = batches.reduce((a, b) => a + asNum(b.current_qty) * asNum(b.purchase_price), 0);
      const stockByMrp     = batches.reduce((a, b) => a + asNum(b.current_qty) * asNum(b.mrp), 0);
      const batchCount     = batches.length;
      const hasExpired     = batches.some((b) => b.exp_date && b.exp_date < today && asNum(b.current_qty) > 0);
      const hasExpiring    = batches.some((b) => b.exp_date && b.exp_date >= today && b.exp_date <= in90 && asNum(b.current_qty) > 0);
      const nearestExpiry  = batches.filter((b) => b.exp_date && asNum(b.current_qty) > 0).map((b) => b.exp_date).sort()[0] || null;
      return { ...it, batches, totalStock, stockByPtr, stockByMrp, batchCount, hasExpired, hasExpiring, nearestExpiry };
    });
  }, [items, inventory]);

  /* Apply filters */
  const filtered = useMemo(() => {
    let rows = [...itemRows];
    if (q.trim()) {
      const qLow = q.trim().toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(qLow) || r.code.toLowerCase().includes(qLow) || (r.hsn || "").includes(qLow));
    }
    if (filterExp === "expired")     rows = rows.filter((r) => r.hasExpired);
    if (filterExp === "expiring")    rows = rows.filter((r) => r.hasExpiring && !r.hasExpired);
    if (filterExp === "instock")     rows = rows.filter((r) => r.totalStock > 0);
    if (filterExp === "outofstock")  rows = rows.filter((r) => r.totalStock <= 0);
    if (filterTax !== "")            rows = rows.filter((r) => String(asNum(r.tax)) === filterTax);
    return rows;
  }, [itemRows, q, filterExp, filterTax]);

  /* Summary stats */
  const stats = useMemo(() => ({
    totalItems:  itemRows.length,
    inStock:     itemRows.filter((r) => r.totalStock > 0).length,
    outOfStock:  itemRows.filter((r) => r.totalStock <= 0).length,
    expiring:    itemRows.filter((r) => r.hasExpiring).length,
    expired:     itemRows.filter((r) => r.hasExpired).length,
    totalValue:  itemRows.reduce((a, r) => a + r.stockByPtr, 0),
  }), [itemRows]);

  /* Unique tax rates for filter */
  const taxRates = useMemo(() => [...new Set(items.map((i) => String(asNum(i.tax))))].sort((a, b) => Number(a) - Number(b)), [items]);

  return (
    <div id="g-root" style={{ padding: "20px 26px", background: C.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* KPI Summary */}
      <div className="g-grid-4" style={{ marginBottom: 14 }}>
        {[
          { label: "Total Items",   value: stats.totalItems,         color: C.text },
          { label: "In Stock",      value: stats.inStock,            color: C.green },
          { label: "Out of Stock",  value: stats.outOfStock,         color: C.textSub },
          { label: "Stock Value",   value: fmtINR(stats.totalValue), color: C.brand },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "#fff", borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "12px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Alert badges */}
      {(stats.expiring > 0 || stats.expired > 0) && (
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          {stats.expired > 0 && <span onClick={() => setFilterExp("expired")} style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: C.red, background: C.redLight, padding: "4px 12px", borderRadius: 6 }}>{stats.expired} expired</span>}
          {stats.expiring > 0 && <span onClick={() => setFilterExp("expiring")} style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: C.yellow, background: C.yellowLight, padding: "4px 12px", borderRadius: 6 }}>{stats.expiring} expiring soon</span>}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", alignItems: "center", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
          <FiSearch size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: C.textSub, pointerEvents: "none" }} />
          <input className="g-inp sm" style={{ paddingLeft: 28, width: "100%" }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / code / HSN…" />
        </div>
        <select className="g-sel sm" style={{ width: 140 }} value={filterExp} onChange={(e) => setFilterExp(e.target.value)}>
          <option value="all">All Items</option>
          <option value="instock">In Stock Only</option>
          <option value="outofstock">Out of Stock</option>
          <option value="expiring">Expiring (90d)</option>
          <option value="expired">Expired</option>
        </select>
        <select className="g-sel sm" style={{ width: 110 }} value={filterTax} onChange={(e) => setFilterTax(e.target.value)}>
          <option value="">All Tax %</option>
          {taxRates.map((t) => <option key={t} value={t}>{t}% GST</option>)}
        </select>
        {(q || filterExp !== "all" || filterTax) && (
          <button className="g-btn ghost sm" onClick={() => { setQ(""); setFilterExp("all"); setFilterTax(""); }}>Clear</button>
        )}
        <span style={{ fontSize: 11, color: C.textSub, whiteSpace: "nowrap" }}>{filtered.length} results</span>
        <button className="g-btn ghost sm" onClick={load} disabled={loading}><FiRefreshCw size={14} /></button>
      </div>

      {/* Table */}
      <div className="g-card">
        <div style={{ overflowX: "auto" }}>
          <table className="g-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Code</th>
                <th>HSN</th>
                <th style={{ textAlign: "right" }}>Tax %</th>
                <th style={{ textAlign: "right" }}>Total Stock</th>
                <th style={{ textAlign: "right" }}>Batches</th>
                <th style={{ textAlign: "right" }}>Value (PTR)</th>
                <th>Nearest Expiry</th>
                <th style={{ textAlign: "right" }}>MRP</th>
                <th style={{ textAlign: "right" }}>Sale ₹</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ textAlign: "center", padding: 32, color: C.textSub }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: "center", padding: 32, color: C.textSub }}>No items found</td></tr>
              ) : filtered.map((r) => {
                const expColor  = r.hasExpired ? C.red : r.hasExpiring ? C.yellow : C.textSub;
                const stockColor = r.totalStock <= 0 ? C.red : r.totalStock < 10 ? C.orange : C.green;
                return (
                  <tr key={r.id} onClick={() => navigate(`/inventory/${r.id}`)}
                    style={{ cursor: "pointer" }}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.name}</div>
                      {r.hasExpired  && <span style={{ fontSize: 10, fontWeight: 700, color: C.red,    background: C.redLight,    borderRadius: 4, padding: "1px 6px", marginTop: 2, display: "inline-block" }}>EXPIRED</span>}
                      {!r.hasExpired && r.hasExpiring && <span style={{ fontSize: 10, fontWeight: 700, color: C.yellow, background: C.yellowLight, borderRadius: 4, padding: "1px 6px", marginTop: 2, display: "inline-block" }}>EXPIRING</span>}
                    </td>
                    <td style={{ fontWeight: 600, color: C.brand }}>{r.code}</td>
                    <td style={{ color: C.textSub }}>{r.hsn || "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      {asNum(r.tax) > 0
                        ? <span style={{ fontWeight: 700, color: C.brand, background: C.brandLighter, padding: "2px 8px", borderRadius: 5, fontSize: 12 }}>{r.tax}%</span>
                        : <span style={{ color: C.textLight }}>—</span>}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 800, color: stockColor }}>{r.totalStock}</td>
                    <td style={{ textAlign: "right", color: C.textSub }}>{r.batchCount}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtINR(r.stockByPtr)}</td>
                    <td style={{ color: expColor, fontWeight: r.hasExpired || r.hasExpiring ? 700 : 400, fontSize: 13 }}>
                      {r.nearestExpiry || "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>₹{r.mrp}</td>
                    <td style={{ textAlign: "right" }}>₹{r.salePrice}</td>
                    <td style={{ paddingRight: 10 }}>
                      <FiChevronRight size={16} color={C.textLight} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
