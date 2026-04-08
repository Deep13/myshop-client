import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { API, asNum, fmt2, todayISO } from "../ui.jsx";
import { buildReceiptHTML } from "../thermalPrint.js";
import toast from "../toast.js";
import usePageMeta from "../usePageMeta.js";

const C = {
  brand: "#034C9D", green: "#16a34a", red: "#dc2626",
  orange: "#ea580c", bg: "#f0f4f8", text: "#111827", sub: "#6b7280",
};
const PAY_MODES = ["Cash", "UPI", "Card", "Bank", "Cheque", "Other"];
const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();

export default function MobileSale() {
  usePageMeta("Quick Sale", "Scan or search items for a quick sale");
  const [inventory, setInventory] = useState([]);
  const [cart, setCart] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [custName, setCustName] = useState("Cash");
  const [phone, setPhone] = useState("");
  const [multiPay, setMultiPay] = useState(false);
  const [payMode, setPayMode] = useState("Cash");
  const [payLines, setPayLines] = useState([{ type: "Cash", amount: "" }]);
  const [saving, setSaving] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState(null); // { invoiceNo, total, custName, phone }
  const [showCheckout, setShowCheckout] = useState(false);
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);
  const searchRef = useRef(null);

  // Load inventory + next invoice number
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/get_inventory.php?include_zero=1`);
        const j = await r.json();
        if (j.status === "success") setInventory(j.data || []);
      } catch {}
    })();
    (async () => {
      try {
        const r = await fetch(`${API}/get_next_invoice.php`);
        const j = await r.json();
        if (j.status === "success") setInvoiceNo(j.invoiceNo);
      } catch {}
    })();
  }, []);

  // Find item by barcode (item_code)
  const findByCode = useCallback((code) => {
    const q = code.replace(/[\s\r\n\t\x00-\x1f]/g, "").toLowerCase();
    if (!q) return null;
    return inventory.find(
      (it) => {
        const c = (it.item_code || "").toLowerCase();
        return c === q || c === q.replace(/^0+/, "") || q === c.replace(/^0+/, "") || (it.barcode || "").toLowerCase() === q;
      }
    );
  }, [inventory]);

  // Add item to cart
  const addToCart = useCallback((item) => {
    setCart((prev) => {
      const existing = prev.findIndex((c) => c.invId === item.id);
      if (existing >= 0) {
        const n = [...prev];
        const stock = asNum(item.current_qty);
        if (n[existing].qty < stock) n[existing] = { ...n[existing], qty: n[existing].qty + 1 };
        return n;
      }
      return [...prev, {
        invId: item.id,
        itemId: item.item_id,
        itemName: item.item_name,
        code: item.item_code,
        hsn: item.hsn || "",
        batchNo: item.batch_no || "",
        expDate: item.exp_date || "",
        mrp: asNum(item.mrp),
        salePrice: asNum(item.sale_price),
        tax: asNum(item.tax_pct),
        gstFlag: item.gst_flag,
        qty: 1,
        stock: asNum(item.current_qty),
      }];
    });
    setManualSearch("");
    setSuggestions([]);
  }, []);

  // Handle barcode scan result
  const stopScanner = async () => {
    try { await html5QrRef.current?.stop(); } catch {}
    html5QrRef.current = null;
    setScanning(false);
  };

  const onScanResult = useCallback((code) => {
    const item = findByCode(code);
    if (item) {
      addToCart(item);
      stopScanner();
      if (navigator.vibrate) navigator.vibrate(100);
    } else {
      const cleaned = code.replace(/[\s\r\n\t\x00-\x1f]/g, "");
      toast(`Item not found: ${cleaned}\n${inventory.length} items loaded.`, "warn");
    }
  }, [findByCode, addToCart]);

  // Start/stop camera scanner
  const toggleScanner = async () => {
    if (scanning) { stopScanner(); return; }
    setScanning(true);
    try {
      const qr = new Html5Qrcode("mobile-scanner");
      html5QrRef.current = qr;
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 120 } },
        (text) => {
          onScanResult(text);
        },
        () => {}
      );
    } catch (err) {
      toast("Camera access denied or not available", "error");
      setScanning(false);
    }
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      try { html5QrRef.current?.stop(); } catch {}
    };
  }, []);

  // Manual search
  useEffect(() => {
    const q = manualSearch.trim().toLowerCase();
    if (!q) { setSuggestions([]); return; }
    const results = inventory.filter((it) =>
      (it.item_name || "").toLowerCase().includes(q) ||
      (it.item_code || "").toLowerCase().includes(q)
    ).slice(0, 8);
    setSuggestions(results);
  }, [manualSearch, inventory]);

  // Cart calculations
  const cartTotal = useMemo(() => cart.reduce((s, c) => s + c.salePrice * c.qty, 0), [cart]);
  const roundedTotal = useMemo(() => Math.round(cartTotal), [cartTotal]);
  const itemCount = useMemo(() => cart.reduce((s, c) => s + c.qty, 0), [cart]);

  const updateQty = (idx, delta) => {
    setCart((prev) => {
      const n = [...prev];
      const newQty = n[idx].qty + delta;
      if (newQty <= 0) return n.filter((_, i) => i !== idx);
      if (newQty > n[idx].stock) return n;
      n[idx] = { ...n[idx], qty: newQty };
      return n;
    });
  };

  const removeItem = (idx) => setCart((prev) => prev.filter((_, i) => i !== idx));

  // Save invoice
  const onSave = async () => {
    if (!cart.length) return toast("Cart is empty", "warn");
    if (!invoiceNo) return toast("Invoice number missing", "warn");
    setSaving(true);
    try {
      const rows = cart.map((c) => ({
        invId: c.invId,
        itemName: c.itemName,
        code: c.code,
        hsn: c.hsn,
        batchNo: c.batchNo,
        expDate: c.expDate,
        mrp: c.mrp,
        qty: c.qty,
        price: c.salePrice,
        discount: fmt2(Math.max(0, c.mrp - c.salePrice)),
        tax: c.tax,
        amount: c.salePrice * c.qty,
      }));
      const totals = {
        grandTotal: fmt2(cartTotal),
        billDiscount: "",
        billDiscountValue: "0",
        finalTotal: fmt2(cartTotal),
        roundOffEnabled: true,
        roundedFinalTotal: fmt2(roundedTotal),
        roundOffDiff: fmt2(roundedTotal - cartTotal),
        received: fmt2(roundedTotal),
        balance: "0",
      };
      const payList = multiPay
        ? payLines.map((p) => ({ type: p.type, amount: asNum(p.amount) })).filter((p) => p.amount > 0)
        : [{ type: payMode, amount: roundedTotal }];
      if (!payList.length) return toast("Add at least one payment", "warn");
      const body = {
        invoiceNo,
        invoiceDate: todayISO(),
        customerType: "Retail",
        customerName: custName || "Cash",
        phone,
        rows,
        payments: payList,
        totals,
        createdBy: user?.id || 1,
      };
      const r = await fetch(`${API}/save_invoice.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Failed");
      const savedNo = invoiceNo;
      const savedTotal = roundedTotal;
      const savedName = custName || "Cash";
      const savedPhone = phone;
      const savedItems = [...cart];
      setSavedInvoice({ invoiceNo: savedNo, total: savedTotal, custName: savedName, phone: savedPhone, items: savedItems, date: todayISO() });
      setCart([]);
      setShowCheckout(false);
      setMultiPay(false);
      setPayLines([{ type: "Cash", amount: "" }]);
      // Get next invoice number
      try {
        const r2 = await fetch(`${API}/get_next_invoice.php`);
        const j2 = await r2.json();
        if (j2.status === "success") setInvoiceNo(j2.invoiceNo);
      } catch {}
    } catch (e) {
      toast(e.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem("auth");
    window.location.href = "/login";
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans', sans-serif", maxWidth: 480, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{
        background: C.brand, color: "#fff", padding: "12px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Ganga Instamart</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>{invoiceNo}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.location.href = "/m/inventory"} style={{
            background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
            padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>Stock</button>
          <button onClick={logout} style={{
            background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
            padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>Logout</button>
        </div>
      </div>

      {/* ── Scanner Area ── */}
      <div style={{ padding: "12px 16px" }}>
        {/* Camera scanner */}
        <div style={{ marginBottom: 12 }}>
          <button onClick={toggleScanner} style={{
            width: "100%", padding: "14px", border: "none", borderRadius: 10,
            background: scanning ? C.red : C.brand, color: "#fff",
            fontSize: 15, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {scanning ? "Stop Scanner" : "Scan Barcode"}
          </button>
        </div>

        <div id="mobile-scanner" style={{
          display: scanning ? "block" : "none",
          width: "100%", borderRadius: 10, overflow: "hidden", marginBottom: 12,
        }} ref={scannerRef} />

        {/* Manual search */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <input
            ref={searchRef}
            value={manualSearch}
            onChange={(e) => setManualSearch(e.target.value)}
            placeholder="Search item by name or code..."
            style={{
              width: "100%", padding: "12px 14px", border: "1.5px solid #d1d5db",
              borderRadius: 10, fontSize: 15, outline: "none", boxSizing: "border-box",
              background: "#fff",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && manualSearch.trim()) {
                const item = findByCode(manualSearch.trim());
                if (item) { addToCart(item); }
                else if (suggestions.length === 1) { addToCart(suggestions[0]); }
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
                <div key={it.id} onClick={() => addToCart(it)} style={{
                  padding: "12px 14px", borderBottom: "1px solid #f3f4f6", cursor: "pointer",
                }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{it.item_name}</div>
                  <div style={{ fontSize: 12, color: C.sub }}>
                    {it.item_code} · ₹{fmt2(it.sale_price)} · Stock: {it.current_qty}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Post-Save Modal ── */}
      {savedInvoice && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }} onClick={() => setSavedInvoice(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 16, width: "100%", maxWidth: 400,
            padding: "28px 20px", textAlign: "center",
          }}>
            {/* Success icon */}
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#dcfce7", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 28, color: C.green }}>&#10003;</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.text, marginBottom: 4 }}>Invoice Saved!</div>
            <div style={{ fontSize: 14, color: C.sub, marginBottom: 4 }}>{savedInvoice.invoiceNo}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: C.green, marginBottom: 20 }}>&#8377;{fmt2(savedInvoice.total)}</div>

            {/* Action buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Download Invoice as Image */}
              <button onClick={async () => {
                try {
                  const printData = {
                    invoiceNo: savedInvoice.invoiceNo,
                    invoiceDate: savedInvoice.date,
                    customerType: "Cash Sale",
                    customerName: savedInvoice.custName,
                    phone: savedInvoice.phone,
                    items: savedInvoice.items.map((c) => ({
                      name: c.itemName, mrp: c.mrp, qty: c.qty,
                      price: c.salePrice, amount: c.salePrice * c.qty, tax: c.tax,
                    })),
                    totalQty: savedInvoice.items.reduce((s, c) => s + c.qty, 0),
                    subTotal: savedInvoice.total,
                    discount: 0,
                    total: savedInvoice.total,
                    received: savedInvoice.total,
                    balance: 0,
                  };
                  const html = buildReceiptHTML(printData);
                  // Render in hidden iframe, then capture as image via canvas
                  const iframe = document.createElement("iframe");
                  iframe.style.cssText = "position:fixed;left:0;top:0;width:320px;height:auto;border:none;opacity:0;pointer-events:none;z-index:-1";
                  document.body.appendChild(iframe);
                  const doc = iframe.contentDocument || iframe.contentWindow.document;
                  doc.open(); doc.write(html); doc.close();
                  // Wait for render
                  await new Promise((r) => setTimeout(r, 500));
                  const body = doc.body;
                  const w = body.scrollWidth, h = body.scrollHeight;
                  // Use canvas to capture
                  const canvas = document.createElement("canvas");
                  const scale = 3; // high-res
                  canvas.width = w * scale;
                  canvas.height = h * scale;
                  const ctx = canvas.getContext("2d");
                  ctx.scale(scale, scale);
                  ctx.fillStyle = "#fff";
                  ctx.fillRect(0, 0, w, h);
                  // Draw using SVG foreignObject
                  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
                    <foreignObject width="100%" height="100%">
                      <div xmlns="http://www.w3.org/1999/xhtml">${doc.documentElement.outerHTML}</div>
                    </foreignObject>
                  </svg>`;
                  const img = new Image();
                  img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                    canvas.toBlob((blob) => {
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `Invoice_${savedInvoice.invoiceNo}.png`;
                      a.click();
                      URL.revokeObjectURL(url);
                      document.body.removeChild(iframe);
                    }, "image/png");
                  };
                  img.onerror = () => {
                    // Fallback: open HTML in new tab for manual save
                    const blob = new Blob([html], { type: "text/html" });
                    const url = URL.createObjectURL(blob);
                    window.open(url, "_blank");
                    document.body.removeChild(iframe);
                  };
                  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
                } catch {
                  toast("Download failed. Please try again.", "error");
                }
              }} style={{
                width: "100%", padding: "14px", border: "none", borderRadius: 10,
                background: C.brand, color: "#fff",
                fontSize: 15, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                &#128229; Download Invoice
              </button>

              {/* Share via WhatsApp — open chat with customer number */}
              {savedInvoice.phone && savedInvoice.phone.replace(/\D/g, "").length >= 10 && (
                <button onClick={() => {
                  const phoneNum = savedInvoice.phone.replace(/\D/g, "").slice(-10);
                  window.open(`https://wa.me/91${phoneNum}`, "_blank");
                }} style={{
                  width: "100%", padding: "14px", border: "none", borderRadius: 10,
                  background: "#25D366", color: "#fff",
                  fontSize: 15, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  &#128172; WhatsApp Customer
                </button>
              )}

              {/* New Sale */}
              <button onClick={() => { setSavedInvoice(null); setCustName("Cash"); setPhone(""); }} style={{
                width: "100%", padding: "14px", border: "1.5px solid #d1d5db", borderRadius: 10,
                background: "#fff", color: C.text,
                fontSize: 15, fontWeight: 700, cursor: "pointer",
              }}>
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cart ── */}
      <div style={{ padding: "0 16px", paddingBottom: cart.length > 0 ? 100 : 16 }}>
        {cart.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.sub }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>&#128722;</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Cart is empty</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Scan a barcode or search to add items</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.sub, marginBottom: 8, textTransform: "uppercase" }}>
              Cart ({itemCount} items)
            </div>
            {cart.map((c, idx) => (
              <div key={c.invId} style={{
                background: "#fff", borderRadius: 10, border: "1.5px solid #e5e7eb",
                padding: "10px 14px", marginBottom: 8,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.itemName}
                  </div>
                  <div style={{ fontSize: 12, color: C.sub }}>
                    ₹{fmt2(c.salePrice)} × {c.qty} = <b style={{ color: C.text }}>₹{fmt2(c.salePrice * c.qty)}</b>
                  </div>
                </div>
                {/* Qty controls */}
                <div style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
                  <button onClick={() => updateQty(idx, -1)} style={{
                    width: 32, height: 32, border: "1.5px solid #d1d5db", borderRadius: "8px 0 0 8px",
                    background: "#fff", fontSize: 18, fontWeight: 700, cursor: "pointer", color: C.text,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>−</button>
                  <div style={{
                    width: 36, height: 32, border: "1.5px solid #d1d5db", borderLeft: "none", borderRight: "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: 14, color: C.brand, background: "#f8fafc",
                  }}>{c.qty}</div>
                  <button onClick={() => updateQty(idx, 1)} style={{
                    width: 32, height: 32, border: "1.5px solid #d1d5db", borderRadius: "0 8px 8px 0",
                    background: "#fff", fontSize: 18, fontWeight: 700, cursor: "pointer", color: C.text,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>+</button>
                </div>
                <button onClick={() => removeItem(idx)} style={{
                  width: 32, height: 32, border: "none", background: "none",
                  color: "#d1d5db", cursor: "pointer", fontSize: 18, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>×</button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Bottom Bar ── */}
      {cart.length > 0 && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "#fff", borderTop: "1.5px solid #e5e7eb",
          padding: "10px 16px", display: "flex", alignItems: "center",
          justifyContent: "space-between", zIndex: 100,
          maxWidth: 480, margin: "0 auto",
          boxShadow: "0 -4px 12px rgba(0,0,0,0.08)",
        }}>
          <div>
            <div style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>{itemCount} items</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.text }}>₹{fmt2(roundedTotal)}</div>
          </div>
          <button onClick={() => setShowCheckout(true)} style={{
            background: C.green, color: "#fff", border: "none", borderRadius: 10,
            padding: "14px 28px", fontSize: 16, fontWeight: 800, cursor: "pointer",
          }}>Checkout</button>
        </div>
      )}

      {/* ── Checkout Modal ── */}
      {showCheckout && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200,
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }} onClick={() => setShowCheckout(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#fff", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 480,
            padding: "20px 16px 24px", maxHeight: "80vh", overflow: "auto",
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 16 }}>Checkout</div>

            {/* Customer */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>Customer Name</label>
              <input value={custName} onChange={(e) => setCustName(e.target.value)}
                placeholder="Cash" style={{
                  width: "100%", padding: "10px 12px", border: "1.5px solid #d1d5db",
                  borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box",
                }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional" type="tel" style={{
                  width: "100%", padding: "10px 12px", border: "1.5px solid #d1d5db",
                  borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box",
                }} />
            </div>

            {/* Payment mode */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>Payment</label>
                <button onClick={() => { setMultiPay((p) => !p); if (!multiPay) setPayLines([{ type: "Cash", amount: String(roundedTotal) }]); }}
                  style={{ fontSize: 11, fontWeight: 700, color: C.brand, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  {multiPay ? "Single Mode" : "Split Payment"}
                </button>
              </div>
              {!multiPay ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {PAY_MODES.slice(0, 4).map((m) => (
                    <button key={m} onClick={() => setPayMode(m)} style={{
                      flex: 1, minWidth: 70, padding: "10px 0", borderRadius: 8, border: "1.5px solid",
                      borderColor: payMode === m ? C.brand : "#d1d5db",
                      background: payMode === m ? C.brand : "#fff",
                      color: payMode === m ? "#fff" : C.text,
                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                    }}>{m}</button>
                  ))}
                </div>
              ) : (
                <div>
                  {payLines.map((p, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                      <select value={p.type} onChange={(e) => setPayLines((prev) => { const n = [...prev]; n[i] = { ...n[i], type: e.target.value }; return n; })}
                        style={{ flex: 1, padding: "9px 8px", border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: 13, fontWeight: 600, outline: "none", background: "#fff" }}>
                        {PAY_MODES.map((m) => <option key={m}>{m}</option>)}
                      </select>
                      <input value={p.amount} onChange={(e) => setPayLines((prev) => { const n = [...prev]; n[i] = { ...n[i], amount: e.target.value }; return n; })}
                        inputMode="decimal" placeholder="₹ Amount"
                        style={{ flex: 1, padding: "9px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: 14, fontWeight: 700, outline: "none", textAlign: "right" }} />
                      {payLines.length > 1 && (
                        <button onClick={() => setPayLines((prev) => prev.filter((_, j) => j !== i))}
                          style={{ width: 32, height: 36, border: "1.5px solid #fca5a5", borderRadius: 8, background: "#fff", color: C.red, cursor: "pointer", fontSize: 16, fontWeight: 700 }}>×</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setPayLines((prev) => [...prev, { type: "Cash", amount: "" }])}
                    style={{ width: "100%", padding: "8px", border: "1.5px dashed #d1d5db", borderRadius: 8, background: "none", color: C.brand, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    + Add Payment Line
                  </button>
                  {(() => {
                    const totalPay = payLines.reduce((s, l) => s + asNum(l.amount), 0);
                    const diff = roundedTotal - totalPay;
                    if (Math.abs(diff) > 0.01) return (
                      <div style={{ fontSize: 12, fontWeight: 700, color: diff > 0 ? C.orange : C.red, marginTop: 6, textAlign: "right" }}>
                        {diff > 0 ? `₹${fmt2(diff)} remaining` : `₹${fmt2(-diff)} excess`}
                      </div>
                    );
                    return null;
                  })()}
                </div>
              )}
            </div>

            {/* Summary */}
            <div style={{
              background: "#f8fafc", borderRadius: 10, padding: "12px 14px", marginBottom: 16,
              border: "1.5px solid #e5e7eb",
            }}>
              {cart.map((c, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", fontSize: 13,
                  padding: "4px 0", borderBottom: i < cart.length - 1 ? "1px solid #e5e7eb" : "none",
                }}>
                  <span style={{ color: C.sub }}>{c.itemName} × {c.qty}</span>
                  <span style={{ fontWeight: 700 }}>₹{fmt2(c.salePrice * c.qty)}</span>
                </div>
              ))}
              <div style={{
                display: "flex", justifyContent: "space-between", marginTop: 8,
                paddingTop: 8, borderTop: "2px solid #d1d5db",
                fontSize: 18, fontWeight: 900, color: C.text,
              }}>
                <span>Total</span>
                <span>₹{fmt2(roundedTotal)}</span>
              </div>
            </div>

            {/* Save button */}
            <button onClick={onSave} disabled={saving} style={{
              width: "100%", padding: "16px", border: "none", borderRadius: 10,
              background: saving ? C.sub : C.green, color: "#fff",
              fontSize: 16, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer",
            }}>
              {saving ? "Saving..." : `Pay ₹${fmt2(roundedTotal)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
