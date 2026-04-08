import React, { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { API, asNum, fmt2, todayISO } from "../ui.jsx";
import usePageMeta from "../usePageMeta.js";
import toast from "../toast.js";

const C = {
  brand: "#034C9D", green: "#16a34a", red: "#dc2626",
  orange: "#ea580c", bg: "#f0f4f8", text: "#111827", sub: "#6b7280",
};
const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();

export default function MobileInventory() {
  usePageMeta("Inventory Check", "Scan or search to check item stock");
  const [items, setItems] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  // Selected item + existing batches
  const [selItem, setSelItem] = useState(null);
  const [existingBatches, setExistingBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  // Increase qty modal
  const [incBatch, setIncBatch] = useState(null); // batch to increase
  const [incQty, setIncQty] = useState("1");

  // New batch form
  const [showNewForm, setShowNewForm] = useState(false);
  const [batchNo, setBatchNo] = useState("");
  const [expDate, setExpDate] = useState("");
  const [qty, setQty] = useState("1");
  const [mrp, setMrp] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [taxPct, setTaxPct] = useState("");

  const [saving, setSaving] = useState(false);
  const [savedItems, setSavedItems] = useState([]);
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);
  const searchRef = useRef(null);
  const batchRef = useRef(null);

  // Load items master
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/get_items_all.php?limit=10000`);
        const j = await r.json();
        if (j.status === "success") setItems(j.data || []);
      } catch {}
    })();
  }, []);

  const findByCode = useCallback((code) => {
    // Strip whitespace, newlines, control chars that scanners may add
    const q = code.replace(/[\s\r\n\t\x00-\x1f]/g, "").toLowerCase();
    if (!q) return null;
    return items.find((it) => {
      const c = (it.code || "").toLowerCase();
      return c === q || c === q.replace(/^0+/, "") || q === c.replace(/^0+/, "");
    });
  }, [items]);

  // Fetch existing batches for selected item
  const loadBatches = async (itemId) => {
    setLoadingBatches(true);
    try {
      const r = await fetch(`${API}/get_inventory.php?item_id=${itemId}&include_zero=1`);
      const j = await r.json();
      if (j.status === "success") setExistingBatches(j.data || []);
      else setExistingBatches([]);
    } catch { setExistingBatches([]); }
    finally { setLoadingBatches(false); }
  };

  const pickItem = useCallback((item) => {
    setSelItem(item);
    setShowNewForm(false);
    setIncBatch(null);
    setManualSearch("");
    setSuggestions([]);
    // Defaults for new batch form
    setMrp(String(item.mrp || ""));
    setPurchasePrice(String(item.purchasePrice || item.purchase_price || ""));
    setSalePrice(String(item.salePrice || item.sale_price || ""));
    setTaxPct(String(item.tax || item.tax_pct || ""));
    setBatchNo(""); setExpDate(""); setQty("1");
    loadBatches(item.id);
  }, []);

  // Barcode scan
  const stopScanner = async () => {
    try { await html5QrRef.current?.stop(); } catch {}
    html5QrRef.current = null;
    setScanning(false);
  };

  const onScanResult = useCallback((code) => {
    const item = findByCode(code);
    if (item) {
      pickItem(item);
      stopScanner();
      if (navigator.vibrate) navigator.vibrate(100);
    } else {
      toast.warn(`Item not found: ${code.replace(/[\s\r\n\t\x00-\x1f]/g, "")}\n\n${items.length} items loaded. Please add this item to master first or check if item code matches.`);
    }
  }, [findByCode, pickItem]);

  const toggleScanner = async () => {
    if (scanning) { stopScanner(); return; }
    setScanning(true);
    try {
      const qr = new Html5Qrcode("inv-scanner");
      html5QrRef.current = qr;
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 120 } },
        (text) => onScanResult(text),
        () => {}
      );
    } catch {
      toast.error("Camera access denied or not available");
      setScanning(false);
    }
  };

  useEffect(() => {
    return () => { try { html5QrRef.current?.stop(); } catch {} };
  }, []);

  // Manual search
  useEffect(() => {
    const q = manualSearch.trim().toLowerCase();
    if (!q) { setSuggestions([]); return; }
    setSuggestions(items.filter((it) =>
      (it.name || "").toLowerCase().includes(q) ||
      (it.code || "").toLowerCase().includes(q)
    ).slice(0, 8));
  }, [manualSearch, items]);

  const resetForm = () => {
    setSelItem(null); setExistingBatches([]); setShowNewForm(false);
    setIncBatch(null); setBatchNo(""); setExpDate(""); setQty("1");
    setMrp(""); setPurchasePrice(""); setSalePrice(""); setTaxPct("");
    setManualSearch("");
  };

  // Increase quantity of existing batch
  const onIncreaseQty = async () => {
    if (!incBatch || !asNum(incQty)) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/add_inventory.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: asNum(incBatch.item_id),
          batchNo: incBatch.batch_no || "",
          expDate: incBatch.exp_date || "",
          qty: asNum(incQty),
          mrp: asNum(incBatch.mrp),
          purchasePrice: asNum(incBatch.purchase_price),
          salePrice: asNum(incBatch.sale_price),
          taxPct: asNum(incBatch.tax_pct),
          gstFlag: 1,
          createdBy: user?.id || 1,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Failed");
      setSavedItems((prev) => [{
        name: incBatch.item_name, code: incBatch.item_code,
        batchNo: incBatch.batch_no || "", qty: asNum(incQty),
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      }, ...prev].slice(0, 20));
      setIncBatch(null); setIncQty("1");
      // Refresh batches
      loadBatches(asNum(incBatch.item_id));
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } catch (e) { toast.error(e.message || "Failed"); }
    finally { setSaving(false); }
  };

  // Save new batch
  const onSaveNew = async () => {
    if (!selItem) return;
    if (!asNum(qty)) return toast.warn("Enter quantity");
    setSaving(true);
    try {
      const r = await fetch(`${API}/add_inventory.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selItem.id,
          batchNo: batchNo.trim(),
          expDate: expDate || "",
          qty: asNum(qty),
          mrp: asNum(mrp),
          purchasePrice: asNum(purchasePrice),
          salePrice: asNum(salePrice),
          taxPct: asNum(taxPct),
          gstFlag: 1,
          createdBy: user?.id || 1,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Failed");
      setSavedItems((prev) => [{
        name: selItem.name, code: selItem.code, batchNo: batchNo.trim(),
        qty: asNum(qty),
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      }, ...prev].slice(0, 20));
      setShowNewForm(false); setBatchNo(""); setExpDate(""); setQty("1");
      loadBatches(selItem.id);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } catch (e) { toast.error(e.message || "Failed"); }
    finally { setSaving(false); }
  };

  const logout = () => { localStorage.removeItem("auth"); window.location.href = "/login"; };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans', sans-serif", maxWidth: 480, margin: "0 auto" }}>

      {/* Header */}
      <div style={{
        background: C.brand, color: "#fff", padding: "12px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Add Inventory</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>Scan & add existing stock</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.location.href = "/m/sale"} style={headerBtn}>Sales</button>
          <button onClick={logout} style={headerBtn}>Logout</button>
        </div>
      </div>

      <div style={{ padding: "12px 16px" }}>

        {/* Scanner */}
        <button onClick={toggleScanner} style={{
          width: "100%", padding: "14px", border: "none", borderRadius: 10,
          background: scanning ? C.red : C.brand, color: "#fff",
          fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 12,
        }}>
          {scanning ? "Stop Scanner" : "Scan Barcode"}
        </button>

        <div id="inv-scanner" style={{
          display: scanning ? "block" : "none",
          width: "100%", borderRadius: 10, overflow: "hidden", marginBottom: 12,
        }} ref={scannerRef} />

        {/* Manual search */}
        {!selItem && (
          <div style={{ position: "relative", marginBottom: 12 }}>
            <input ref={searchRef} value={manualSearch}
              onChange={(e) => setManualSearch(e.target.value)}
              placeholder="Search item by name or code..."
              style={{ ...inputStyle, fontSize: 15, padding: "12px 14px" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manualSearch.trim()) {
                  const item = findByCode(manualSearch.trim());
                  if (item) pickItem(item);
                  else if (suggestions.length === 1) pickItem(suggestions[0]);
                }
              }}
            />
            {suggestions.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 10,
                boxShadow: "0 6px 20px rgba(0,0,0,0.12)", maxHeight: 260, overflow: "auto",
              }}>
                {suggestions.map((it) => (
                  <div key={it.id} onClick={() => pickItem(it)} style={{
                    padding: "12px 14px", borderBottom: "1px solid #f3f4f6", cursor: "pointer",
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{it.name}</div>
                    <div style={{ fontSize: 12, color: C.sub }}>{it.code} · MRP: ₹{it.mrp}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Selected Item ── */}
        {selItem && (
          <div style={{ marginBottom: 12 }}>
            {/* Item header card */}
            <div style={{
              background: "#fff", borderRadius: 12, border: "1.5px solid #e5e7eb",
              padding: "14px 16px", marginBottom: 10,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{selItem.name}</div>
                  <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{selItem.code}{selItem.hsn ? ` · HSN: ${selItem.hsn}` : ""}</div>
                </div>
                <button onClick={resetForm} style={{
                  background: "none", border: "none", color: C.sub, cursor: "pointer",
                  fontSize: 20, padding: "0 4px", lineHeight: 1,
                }}>×</button>
              </div>
            </div>

            {/* Existing batches */}
            <div style={{
              background: "#fff", borderRadius: 12, border: "1.5px solid #e5e7eb",
              marginBottom: 10, overflow: "hidden",
            }}>
              <div style={{
                padding: "10px 16px", background: "#f8fafc", borderBottom: "1.5px solid #e5e7eb",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Existing Stock</span>
                <button onClick={() => { setShowNewForm(true); setIncBatch(null); setTimeout(() => batchRef.current?.focus(), 100); }}
                  style={{ fontSize: 12, fontWeight: 700, color: C.brand, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  + New Batch
                </button>
              </div>

              {loadingBatches ? (
                <div style={{ padding: "16px", textAlign: "center", color: C.sub, fontSize: 13 }}>Loading...</div>
              ) : existingBatches.length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center", color: C.sub, fontSize: 13 }}>No existing stock. Add a new batch below.</div>
              ) : (
                <div style={{ maxHeight: 280, overflowY: "auto" }}>
                  {existingBatches.map((b) => {
                    const isExp = b.exp_date && b.exp_date < todayISO();
                    const isSelected = incBatch?.id === b.id;
                    return (
                      <div key={b.id} style={{
                        padding: "10px 16px", borderBottom: "1px solid #f3f4f6",
                        background: isSelected ? "#eff6ff" : "transparent",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                              {b.batch_no || "No batch"}{" "}
                              <span style={{ fontSize: 11, fontWeight: 400, color: C.sub }}>
                                · Exp: <span style={{ color: isExp ? C.red : C.sub, fontWeight: isExp ? 700 : 400 }}>{b.exp_date || "—"}</span>
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>
                              MRP: ₹{fmt2(b.mrp)} · Buy: ₹{fmt2(b.purchase_price)} · Sale: ₹{fmt2(b.sale_price)}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <div style={{
                              fontWeight: 800, fontSize: 14, color: asNum(b.current_qty) > 0 ? C.green : C.red,
                              background: asNum(b.current_qty) > 0 ? "#dcfce7" : "#fee2e2",
                              padding: "3px 10px", borderRadius: 6, minWidth: 40, textAlign: "center",
                            }}>
                              {b.current_qty}
                            </div>
                            <button onClick={() => { setIncBatch(isSelected ? null : b); setIncQty("1"); setShowNewForm(false); }}
                              style={{
                                width: 32, height: 32, border: `1.5px solid ${isSelected ? C.brand : "#d1d5db"}`,
                                borderRadius: 8, background: isSelected ? C.brand : "#fff",
                                color: isSelected ? "#fff" : C.brand,
                                fontSize: 18, fontWeight: 700, cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>+</button>
                          </div>
                        </div>

                        {/* Inline increase qty */}
                        {isSelected && (
                          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>Add Qty:</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 0, flex: 1 }}>
                              <button onClick={() => setIncQty(String(Math.max(1, asNum(incQty) - 1)))} style={qtyBtn}>−</button>
                              <input value={incQty} onChange={(e) => setIncQty(e.target.value)} inputMode="numeric"
                                style={{ flex: 1, height: 36, border: "1.5px solid #d1d5db", borderLeft: "none", borderRight: "none",
                                  textAlign: "center", fontSize: 16, fontWeight: 800, color: C.brand, outline: "none" }} />
                              <button onClick={() => setIncQty(String(asNum(incQty) + 1))} style={{ ...qtyBtn, borderRadius: "0 8px 8px 0" }}>+</button>
                            </div>
                            <button onClick={onIncreaseQty} disabled={saving}
                              style={{
                                padding: "8px 16px", border: "none", borderRadius: 8,
                                background: saving ? C.sub : C.green, color: "#fff",
                                fontSize: 14, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer",
                                whiteSpace: "nowrap",
                              }}>
                              {saving ? "..." : `+${asNum(incQty)}`}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* New batch form */}
            {(showNewForm || existingBatches.length === 0) && (
              <div style={{
                background: "#fff", borderRadius: 12, border: "1.5px solid #e5e7eb",
                padding: "16px", marginBottom: 10,
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 12 }}>New Batch</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>Batch No</label>
                    <input ref={batchRef} value={batchNo} onChange={(e) => setBatchNo(e.target.value)}
                      placeholder="Batch" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Expiry Date</label>
                    <input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>Qty *</label>
                    <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" placeholder="0"
                      style={{ ...inputStyle, fontSize: 18, fontWeight: 800, textAlign: "center", color: C.brand }} />
                  </div>
                  <div>
                    <label style={labelStyle}>MRP ₹</label>
                    <input value={mrp} onChange={(e) => setMrp(e.target.value)} inputMode="decimal" placeholder="0" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Tax %</label>
                    <input value={taxPct} onChange={(e) => setTaxPct(e.target.value)} inputMode="decimal" placeholder="0" style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={labelStyle}>Buy Price ₹</label>
                    <input value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} inputMode="decimal" placeholder="0" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Sale Price ₹</label>
                    <input value={salePrice} onChange={(e) => setSalePrice(e.target.value)} inputMode="decimal" placeholder="0" style={inputStyle} />
                  </div>
                </div>

                <button onClick={onSaveNew} disabled={saving} style={{
                  width: "100%", padding: "14px", border: "none", borderRadius: 10,
                  background: saving ? C.sub : C.green, color: "#fff",
                  fontSize: 16, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer",
                }}>
                  {saving ? "Saving..." : `Add ${asNum(qty) || 0} to Stock`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Recent saves */}
        {savedItems.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 8, textTransform: "uppercase" }}>
              Recently Added ({savedItems.length})
            </div>
            {savedItems.map((s, i) => (
              <div key={i} style={{
                background: "#fff", borderRadius: 8, border: "1.5px solid #e5e7eb",
                padding: "10px 14px", marginBottom: 6,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: C.sub }}>
                    {s.code}{s.batchNo ? ` · ${s.batchNo}` : ""} · {s.time}
                  </div>
                </div>
                <div style={{
                  background: "#dcfce7", color: C.green, fontWeight: 800, fontSize: 14,
                  padding: "4px 12px", borderRadius: 6,
                }}>
                  +{s.qty}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 12px", border: "1.5px solid #d1d5db",
  borderRadius: 8, fontSize: 14, fontWeight: 600, outline: "none",
  boxSizing: "border-box", background: "#fff",
};
const labelStyle = { fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4, textTransform: "uppercase" };
const headerBtn = {
  background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
  padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
};
const qtyBtn = {
  width: 36, height: 36, border: "1.5px solid #d1d5db", borderRadius: "8px 0 0 8px",
  background: "#fff", fontSize: 18, fontWeight: 700, cursor: "pointer", color: "#111827",
  display: "flex", alignItems: "center", justifyContent: "center",
};
