import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiPackage, FiRefreshCw, FiSearch, FiChevronRight, FiPercent, FiTag, FiX } from "react-icons/fi";
import { C, GLOBAL_CSS, API, Modal, asNum, todayISO, fmtINR, fmtDate, Pagination, PAGE_SIZE } from "../ui.jsx";
import CategorySelect from "../comps/CategorySelect.jsx";
import usePageMeta from "../usePageMeta.js";
import toast from "../toast.js";

const today = todayISO();
const in90  = new Date(new Date().getTime() + 90 * 86400000).toISOString().slice(0, 10);

export default function Inventory() {
  usePageMeta("Inventory", "Browse stock, expiry, and batch details for all items");
  const navigate = useNavigate();
  const [items,     setItems]     = useState([]);   // from items master
  const [inventory, setInventory] = useState([]);   // from inventory table
  const [loading,   setLoading]   = useState(true);

  const [q,          setQ]          = useState("");
  const [filterExp,  setFilterExp]  = useState("all");   // all | expiring | expired | instock | outofstock
  const [filterTax,  setFilterTax]  = useState("");       // "" | "0" | "5" | "12" | "18" | "28"
  const [filterCat,  setFilterCat]  = useState("");       // "" | category name | "__none__"
  const [page, setPage] = useState(1);

  // Bulk GST update
  const [showBulkGst, setShowBulkGst] = useState(false);
  const [bulkGstRate, setBulkGstRate] = useState("18");
  const [bulkApplyTo, setBulkApplyTo] = useState("filtered"); // "filtered" | "all"
  const [bulkSaving, setBulkSaving] = useState(false);

  // Row selection + bulk category
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkCat, setShowBulkCat] = useState(false);
  const [bulkCatChoice, setBulkCatChoice] = useState(null);   // { name, hsn, tax } | null
  const [bulkCatSaving, setBulkCatSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [ri, rItems] = await Promise.all([
        fetch(`${API}/get_inventory.php?include_zero=1`).then((r) => r.json()),
        fetch(`${API}/get_items_all.php?limit=10000`).then((r) => r.json()),
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
    if (filterCat === "__none__")    rows = rows.filter((r) => !r.category || r.category === "Uncategorized");
    else if (filterCat !== "")       rows = rows.filter((r) => (r.category || "") === filterCat);
    return rows;
  }, [itemRows, q, filterExp, filterTax, filterCat]);

  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);
  useEffect(() => setPage(1), [q, filterExp, filterTax, filterCat]);

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

  /* Unique categories (with counts) for filter */
  const categoryOptions = useMemo(() => {
    const counts = new Map();
    for (const it of items) {
      const c = (it.category || "").trim();
      counts.set(c || "Uncategorized", (counts.get(c || "Uncategorized") || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  // ── Selection helpers ────────────────────────────────────────
  const toggleRow = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const pageIds = useMemo(() => paged.map((r) => r.id), [paged]);
  const filteredIds = useMemo(() => filtered.map((r) => r.id), [filtered]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const togglePage = () => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (allPageSelected) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    return next;
  });
  const selectAllFiltered = () => setSelectedIds(new Set(filteredIds));
  const clearSelection = () => setSelectedIds(new Set());

  // ── Bulk category update ─────────────────────────────────────
  const bulkUpdateCategory = async () => {
    if (!bulkCatChoice) return toast.warn("Pick a category first");
    if (selectedIds.size === 0) return toast.warn("No items selected");
    setBulkCatSaving(true);
    try {
      const r = await fetch(`${API}/bulk_update_category.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIds: [...selectedIds],
          category: bulkCatChoice.name,
          hsn: bulkCatChoice.hsn || "",
          tax: bulkCatChoice.tax,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Failed");
      toast.success(`Updated ${j.itemsUpdated} items to "${bulkCatChoice.name}"`);
      setShowBulkCat(false);
      setBulkCatChoice(null);
      setSelectedIds(new Set());
      load();
    } catch (e) { toast.error(e.message || "Failed"); }
    finally { setBulkCatSaving(false); }
  };

  const bulkUpdateGst = async () => {
    const target = bulkApplyTo === "filtered" ? filtered : itemRows;
    if (!target.length) return toast.warn("No items to update");
    const ids = target.map((r) => r.id);
    setBulkSaving(true);
    try {
      const r = await fetch(`${API}/bulk_update_tax.php`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxPct: Number(bulkGstRate), itemIds: ids }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Failed");
      toast.success(`GST updated to ${bulkGstRate}% for ${j.itemsUpdated} items`);
      setShowBulkGst(false);
      load();
    } catch (e) { toast.error(e.message || "Failed"); }
    finally { setBulkSaving(false); }
  };

  return (
    <div id="g-root" style={{ padding: "24px 28px", background: C.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Inventory</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textSub }}>
            {stats.totalItems} items &middot; {stats.inStock} in stock &middot; {fmtINR(stats.totalValue)} value
            {stats.expired > 0 && <span style={{ color: C.red, fontWeight: 700, marginLeft: 8, cursor: "pointer" }} onClick={() => setFilterExp("expired")}>{stats.expired} expired</span>}
            {stats.expiring > 0 && <span style={{ color: C.yellow, fontWeight: 700, marginLeft: 8, cursor: "pointer" }} onClick={() => setFilterExp("expiring")}>{stats.expiring} expiring</span>}
          </p>
        </div>
        <button className="g-btn ghost" onClick={load} disabled={loading}>
          <FiRefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", alignItems: "center", marginBottom: 18 }}>
        <div style={{ position: "relative", flex: 2, minWidth: 220 }}>
          <FiSearch size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textSub, pointerEvents: "none" }} />
          <input className="g-inp sm search" style={{ width: "100%" }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / code / HSN…" />
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
        <select className="g-sel sm" style={{ width: 180 }} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="">All Categories</option>
          <option value="__none__">— Uncategorized —</option>
          {categoryOptions.map(([name, count]) => (
            <option key={name} value={name}>{name} ({count})</option>
          ))}
        </select>
        {(q || filterExp !== "all" || filterTax || filterCat) && (
          <button className="g-btn ghost sm" onClick={() => { setQ(""); setFilterExp("all"); setFilterTax(""); setFilterCat(""); }}>Clear</button>
        )}
        <span style={{ fontSize: 11, color: C.textSub, whiteSpace: "nowrap" }}>{filtered.length} results</span>
        <button className="g-btn ghost sm" onClick={() => setShowBulkGst(true)} title="Bulk GST% Update">
          <FiPercent size={14} /> Bulk GST
        </button>
        <button className="g-btn ghost sm" onClick={load} disabled={loading}><FiRefreshCw size={14} /></button>
      </div>

      {/* Table */}
      <div className="g-card">
        <div style={{ overflowX: "auto" }}>
          <table className="g-table">
            <thead>
              <tr>
                <th style={{ width: 32, paddingRight: 0 }}>
                  <input type="checkbox" checked={allPageSelected} onChange={togglePage}
                    title={allPageSelected ? "Unselect this page" : "Select this page"}
                    style={{ cursor: "pointer", width: 15, height: 15 }} />
                </th>
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
                <tr><td colSpan={12} style={{ textAlign: "center", padding: 32, color: C.textSub }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={12} style={{ textAlign: "center", padding: 32, color: C.textSub }}>No items found</td></tr>
              ) : paged.map((r) => {
                const expColor  = r.hasExpired ? C.red : r.hasExpiring ? C.yellow : C.textSub;
                const stockColor = r.totalStock <= 0 ? C.red : r.totalStock < 10 ? C.orange : C.green;
                const isSel = selectedIds.has(r.id);
                return (
                  <tr key={r.id} onClick={() => navigate(`/inventory/${r.id}`)}
                    style={{ cursor: "pointer", background: isSel ? C.brandLighter : undefined }}>
                    <td onClick={(e) => e.stopPropagation()}
                        style={{ paddingRight: 0 }}>
                      <input type="checkbox" checked={isSel}
                        onChange={() => toggleRow(r.id)}
                        style={{ cursor: "pointer", width: 15, height: 15 }} />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.name}</div>
                      {r.category && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: C.textSub, background: "#f1f5f9", borderRadius: 4, padding: "1px 6px", marginTop: 2, marginRight: 4, display: "inline-block" }}>{r.category}</span>
                      )}
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
                      {r.nearestExpiry ? fmtDate(r.nearestExpiry) : "—"}
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
        <Pagination total={filtered.length} page={page} onPage={setPage} />
      </div>

      {/* Bulk GST Modal */}
      <Modal show={showBulkGst} title="Bulk Update GST %" onClose={() => setShowBulkGst(false)} width={440}
        footer={<>
          <button className="g-btn ghost" onClick={() => setShowBulkGst(false)}>Cancel</button>
          <button className="g-btn primary" onClick={bulkUpdateGst} disabled={bulkSaving}>
            {bulkSaving ? "Updating…" : `Update ${(bulkApplyTo === "filtered" ? filtered : itemRows).length} Items`}
          </button>
        </>}>
        <div>
          {/* Apply to */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: C.text, display: "block", marginBottom: 8 }}>Apply to</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { key: "filtered", label: `Filtered Items (${filtered.length})` },
                { key: "all", label: `All Items (${itemRows.length})` },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setBulkApplyTo(key)} style={{
                  flex: 1, padding: "10px 0", borderRadius: 8, border: "1.5px solid",
                  borderColor: bulkApplyTo === key ? C.brand : "#d1d5db",
                  background: bulkApplyTo === key ? C.brandLighter : "#fff",
                  color: bulkApplyTo === key ? C.brand : C.text,
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>{label}</button>
              ))}
            </div>
            {bulkApplyTo === "filtered" && (q || filterExp !== "all" || filterTax) && (
              <div style={{ fontSize: 12, color: C.textSub, marginTop: 6 }}>
                Current filters: {q && `"${q}"`} {filterExp !== "all" && filterExp} {filterTax && `${filterTax}% GST`}
              </div>
            )}
          </div>

          {/* GST Rate */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: C.text, display: "block", marginBottom: 8 }}>New GST Rate</label>
            <div style={{ display: "flex", gap: 6 }}>
              {["0", "5", "12", "18", "28"].map((rate) => (
                <button key={rate} onClick={() => setBulkGstRate(rate)} style={{
                  flex: 1, padding: "12px 0", borderRadius: 8, border: "1.5px solid",
                  borderColor: bulkGstRate === rate ? C.brand : "#d1d5db",
                  background: bulkGstRate === rate ? C.brand : "#fff",
                  color: bulkGstRate === rate ? "#fff" : C.text,
                  fontSize: 16, fontWeight: 800, cursor: "pointer",
                }}>{rate}%</button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div style={{
            padding: "10px 14px", borderRadius: 8, fontSize: 13,
            background: "#fffbeb", border: "1.5px solid #fde68a", color: "#92400e",
          }}>
            This will set <strong>GST to {bulkGstRate}%</strong> on{" "}
            <strong>{(bulkApplyTo === "filtered" ? filtered : itemRows).length} items</strong>{" "}
            in both the items master and all their inventory batches.
          </div>
        </div>
      </Modal>

      {/* ── Floating bulk-action toolbar ───────────────────────── */}
      {selectedIds.size > 0 && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: C.text, color: "#fff", borderRadius: 12,
          padding: "10px 14px", display: "flex", alignItems: "center", gap: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)", zIndex: 200,
          fontSize: 13, fontWeight: 600,
        }}>
          <span>{selectedIds.size} selected</span>
          {selectedIds.size < filteredIds.length && (
            <button onClick={selectAllFiltered} style={{ background: "transparent", border: `1px solid rgba(255,255,255,0.3)`, color: "#fff", padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Select all {filteredIds.length} filtered
            </button>
          )}
          <button onClick={() => { setBulkCatChoice(null); setShowBulkCat(true); }}
            style={{ background: C.brand, border: "none", color: "#fff", padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <FiTag size={13} /> Change Category
          </button>
          <button onClick={clearSelection} title="Clear selection"
            style={{ background: "transparent", border: "none", color: "#fff", padding: 4, borderRadius: 6, cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
            <FiX size={16} />
          </button>
        </div>
      )}

      {/* ── Bulk Category Modal ───────────────────────── */}
      <Modal show={showBulkCat} title={`Change Category — ${selectedIds.size} item${selectedIds.size === 1 ? "" : "s"}`}
        onClose={() => setShowBulkCat(false)} width={640}
        footer={<>
          <button className="g-btn ghost" onClick={() => setShowBulkCat(false)}>Cancel</button>
          <button className="g-btn primary" onClick={bulkUpdateCategory} disabled={bulkCatSaving || !bulkCatChoice}>
            {bulkCatSaving ? "Updating…" : `Apply to ${selectedIds.size} Items`}
          </button>
        </>}>
        {/* minHeight reserves room below the category input for the dropdown.
            The dropdown itself has maxHeight: 260, so ~340px keeps it fully visible. */}
        <div style={{ minHeight: 340 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: C.text, display: "block", marginBottom: 8 }}>New Category</label>
            <CategorySelect className="g-inp"
              value={bulkCatChoice?.name || ""}
              onChange={(v) => setBulkCatChoice((prev) => prev?.name === v ? prev : { name: v, hsn: "", tax: 18 })}
              onPick={(c) => setBulkCatChoice(c)}
              placeholder="Search or pick a category" />
          </div>
          {bulkCatChoice && (
            <div style={{ padding: "12px 14px", borderRadius: 8, fontSize: 13,
              background: "#eff6ff", border: "1.5px solid #bfdbfe", color: "#1e3a8a" }}>
              Setting <strong>Category = {bulkCatChoice.name}</strong>
              {bulkCatChoice.hsn ? <>, <strong>HSN = {bulkCatChoice.hsn}</strong></> : null}
              , <strong>Tax = {bulkCatChoice.tax}%</strong>{" "}
              on <strong>{selectedIds.size}</strong> items (item master + inventory tax).
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
