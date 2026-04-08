import React, { useState, useRef } from "react";
import { FiSettings, FiPrinter, FiImage, FiSave, FiUpload, FiTrash2, FiEye } from "react-icons/fi";
import { C, GLOBAL_CSS, Field } from "../ui.jsx";
import { getShopSettings, saveShopSettings, printReceipt } from "../thermalPrint.js";
import usePageMeta from "../usePageMeta.js";
import toast from "../toast.js";

export default function Settings() {
  usePageMeta("Settings", "Shop details, printer, inventory and invoice settings");
  const [form, setForm] = useState(getShopSettings);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);

  const f = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const handleSave = () => {
    saveShopSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Handle logo upload — convert to base64 data URL
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.warn("Please select an image file");
    if (file.size > 200 * 1024) return toast.warn("Logo must be under 200KB for thermal printing");
    const reader = new FileReader();
    reader.onload = (ev) => f("logo", ev.target.result);
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    f("logo", "");
    if (fileRef.current) fileRef.current.value = "";
  };

  // Test print with sample data
  const testPrint = () => {
    // Temporarily save so printReceipt picks up current settings
    saveShopSettings(form);
    printReceipt({
      invoiceNo: "TEST-001",
      invoiceDate: new Date().toISOString().slice(0, 10),
      customerType: "Cash Sale",
      customerName: "Cash",
      phone: "",
      items: [
        { name: "Sample Item 1", mrp: 100, qty: 2, price: 95, amount: 190, tax: 18 },
        { name: "Sample Item 2", mrp: 50, qty: 1, price: 45, amount: 45, tax: 5 },
        { name: "Sample Item 3", mrp: 30, qty: 3, price: 28, amount: 84, tax: 0 },
      ],
      totalQty: 6,
      subTotal: 319,
      total: 319,
      received: 319,
      balance: 0,
    });
  };

  return (
    <div id="g-root" style={{ padding: "20px 26px", background: C.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: C.brand, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
          <FiSettings size={20} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.text }}>Settings</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: C.textSub }}>Shop details, printer & invoice settings</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button className="g-btn ghost" onClick={testPrint}>
            <FiEye size={14} /> Test Print
          </button>
          <button className="g-btn success" onClick={handleSave}>
            <FiSave size={14} /> {saved ? "Saved!" : "Save Settings"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

        {/* LEFT — Shop Details */}
        <div className="g-card">
          <div className="g-card-head">
            <div className="g-card-title"><FiSettings size={15} style={{ color: C.brand }} /> Shop Details</div>
          </div>
          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Shop / Business Name">
              <input className="g-inp" value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="e.g. Ganga Instamart" />
            </Field>
            <Field label="Address">
              <input className="g-inp" value={form.address} onChange={(e) => f("address", e.target.value)} placeholder="Full address with PIN" />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="State">
                <input className="g-inp" value={form.state} onChange={(e) => f("state", e.target.value)} placeholder="e.g. 19-West Bengal" />
              </Field>
              <Field label="Phone">
                <input className="g-inp" value={form.phone} onChange={(e) => f("phone", e.target.value)} placeholder="Phone number" />
              </Field>
            </div>
            <Field label="GSTIN">
              <input className="g-inp" value={form.gstin} onChange={(e) => f("gstin", e.target.value)} placeholder="15-digit GSTIN" style={{ fontFamily: "monospace", letterSpacing: "0.05em" }} />
            </Field>
            <Field label="Receipt Footer Text">
              <input className="g-inp" value={form.footer} onChange={(e) => f("footer", e.target.value)} placeholder="e.g. Thanks for shopping!" />
            </Field>
          </div>
        </div>

        {/* RIGHT — Printer & Logo */}
        <div>
          {/* Printer Settings */}
          <div className="g-card" style={{ marginBottom: 20 }}>
            <div className="g-card-head">
              <div className="g-card-title"><FiPrinter size={15} style={{ color: C.brand }} /> Printer Settings</div>
            </div>
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Paper Width">
                <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 8, padding: 3 }}>
                  {["58mm", "80mm"].map((w) => (
                    <button key={w} onClick={() => f("paperWidth", w)} style={{
                      flex: 1, padding: "8px 0", border: "none", borderRadius: 6, cursor: "pointer",
                      fontWeight: 700, fontSize: 14,
                      background: form.paperWidth === w ? C.brand : "transparent",
                      color: form.paperWidth === w ? "#fff" : C.textSub,
                      transition: "all 0.15s",
                    }}>{w}</button>
                  ))}
                </div>
              </Field>

              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#f8fafc", borderRadius: 8, border: "1.5px solid #e5e7eb" }}>
                <input type="checkbox" id="autoPrint" checked={form.autoPrint || false} onChange={(e) => f("autoPrint", e.target.checked)} style={{ width: 18, height: 18, accentColor: C.brand }} />
                <label htmlFor="autoPrint" style={{ fontSize: 13, fontWeight: 600, cursor: "pointer", color: C.text }}>
                  Auto-print receipt after saving invoice
                </label>
              </div>

              <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#166534" }}>
                Set your thermal printer as the <strong>default printer</strong> in your OS settings for seamless one-click printing. The receipt will be sent directly to the printer without a preview dialog.
              </div>
            </div>
          </div>

          {/* Inventory Settings */}
          <div className="g-card" style={{ marginBottom: 20 }}>
            <div className="g-card-head">
              <div className="g-card-title"><FiSettings size={15} style={{ color: C.brand }} /> Inventory Settings</div>
            </div>
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Low Stock Limit" hint="Items with qty at or below this will show as low stock on dashboard">
                <input className="g-inp" type="number" min="1" max="999" value={form.lowStockLimit || 5} onChange={(e) => f("lowStockLimit", Math.max(1, parseInt(e.target.value) || 1))} style={{ width: 120 }} />
              </Field>
            </div>
          </div>

          {/* Logo Settings */}
          <div className="g-card">
            <div className="g-card-head">
              <div className="g-card-title"><FiImage size={15} style={{ color: C.brand }} /> Invoice Logo</div>
            </div>
            <div style={{ padding: 18 }}>
              {/* Current logo preview */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 10, border: "2px dashed #d1d5db",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "#f8fafc", overflow: "hidden", flexShrink: 0,
                }}>
                  {form.logo ? (
                    <img src={form.logo} alt="Logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  ) : (
                    <svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 12 L14 12 L22 44 L52 44" stroke="#9ca3af" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                      <path d="M22 44 L20 36 L54 36 L58 16 L16 16" stroke="#9ca3af" strokeWidth="4" strokeLinejoin="round" fill="none"/>
                      <circle cx="26" cy="52" r="4.5" fill="#9ca3af"/><circle cx="48" cy="52" r="4.5" fill="#9ca3af"/>
                    </svg>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                    {form.logo ? "Custom Logo" : "Default Cart Icon"}
                  </div>
                  <div style={{ fontSize: 12, color: C.textSub, marginBottom: 8 }}>
                    Upload a PNG or JPG image (max 200KB). Black & white images work best on thermal printers.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: "none" }} />
                    <button className="g-btn primary sm" onClick={() => fileRef.current?.click()}>
                      <FiUpload size={12} /> Upload Logo
                    </button>
                    {form.logo && (
                      <button className="g-btn danger sm" onClick={removeLogo}>
                        <FiTrash2 size={12} /> Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {form.logo && (
                <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#92400e" }}>
                  For best results on thermal printers, use a black & white image with high contrast. The logo is stored in your browser.
                </div>
              )}
            </div>
          </div>

          {/* CA Details */}
          <div className="g-card" style={{ marginTop: 20 }}>
            <div className="g-card-head">
              <div className="g-card-title"><FiSettings size={15} style={{ color: C.brand }} /> CA / Accountant Details</div>
            </div>
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="CA Name">
                <input className="g-inp" value={form.caName || ""} onChange={(e) => f("caName", e.target.value)} placeholder="e.g. Rajesh Kumar & Associates" />
              </Field>
              <Field label="CA Email">
                <input className="g-inp" type="email" value={form.caEmail || ""} onChange={(e) => f("caEmail", e.target.value)} placeholder="e.g. ca@example.com" />
              </Field>
              <Field label="CA Phone / WhatsApp">
                <input className="g-inp" type="tel" value={form.caPhone || ""} onChange={(e) => f("caPhone", e.target.value)} placeholder="e.g. 9876543210" />
              </Field>
              <div style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#1e40af" }}>
                These details are used in the Reports section to send GST data to your CA via email or WhatsApp.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
