import React, { useEffect, useMemo, useState } from "react";
import { FiRefreshCw, FiTrendingUp, FiClock, FiBarChart2, FiPackage, FiArrowDown, FiArrowUp, FiDownload, FiFileText, FiDollarSign, FiSend } from "react-icons/fi";
import { C, GLOBAL_CSS, API, Modal, fmt2, DATE_RANGES, applyDateRange } from "../ui.jsx";
import { downloadExcel, generateExcelBlob } from "../excelExport.js";
import { getShopSettings } from "../thermalPrint.js";
import usePageMeta from "../usePageMeta.js";

const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();
const isAdmin = user?.role === "admin";

/* ── Tiny bar chart ── */
function BarChart({ data, labelKey, valueKey, color = C.brand, height = 200 }) {
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  const barArea = height - 44; // space for label top + bottom
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height, padding: "0 0 0" }}>
      {data.map((d, i) => {
        const barH = Math.max((d[valueKey] / max) * barArea, 4);
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", minWidth: 0, height: "100%" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, marginBottom: 4, whiteSpace: "nowrap" }}>
              {d[valueKey] >= 1000 ? `${(d[valueKey] / 1000).toFixed(1)}k` : d[valueKey]}
            </div>
            <div style={{ width: "100%", maxWidth: 48, height: barH, background: color, borderRadius: "4px 4px 0 0", transition: "height 0.3s" }} title={`${d[labelKey]}: ₹${fmt2(d[valueKey])}`} />
            <div style={{ fontSize: 9, color: C.textSub, marginTop: 4, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%", maxWidth: 60 }}>{d[labelKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

function HBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, flex: 1 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 0.3s" }} />
    </div>
  );
}

/* ── Summary row for totals ── */
function TotalRow({ cols, data, label = "TOTAL" }) {
  return (
    <tr style={{ background: "#f1f5f9", fontWeight: 800 }}>
      {cols.map((c, i) => (
        <td key={i} style={{ textAlign: c.type === "number" || c.type === "int" ? "right" : "left", fontSize: 13, borderTop: "2px solid #d1d5db" }}>
          {i === 0 ? label : c.sum ? (c.type === "number" ? `₹${fmt2(data.reduce((s, r) => s + Number(r[c.key] || 0), 0))}` : data.reduce((s, r) => s + Number(r[c.key] || 0), 0)) : ""}
        </td>
      ))}
    </tr>
  );
}

const TABS = [
  { key: "sales",    label: "Sales Report",     icon: <FiBarChart2 size={14} /> },
  { key: "purchase", label: "Purchase Report",  icon: <FiTrendingUp size={14} /> },
  { key: "profit",   label: "Profit Analysis",  icon: <FiDollarSign size={14} /> },
  { key: "gstr1",    label: "GSTR-1",           icon: <FiFileText size={14} /> },
  { key: "gstr2a",   label: "GSTR-2A",          icon: <FiFileText size={14} /> },
  { key: "gstr3b",   label: "GSTR-3B",          icon: <FiFileText size={14} /> },
  { key: "hsn",      label: "HSN wise GST",     icon: <FiPackage size={14} /> },
  { key: "accounts", label: "Accounts",         icon: <FiDollarSign size={14} /> },
];

export default function Reports() {
  usePageMeta("Reports", "Sales, purchase, profit, GST and accounting reports");
  const [tab, setTab] = useState("sales");
  const [salesData, setSalesData] = useState(null);
  const [gstData, setGstData] = useState(null);
  const [profitData, setProfitData] = useState(null);
  const [purchaseData, setPurchaseData] = useState(null);
  const [accountsData, setAccountsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeStats, setUpgradeStats] = useState(null);
  const [upgrading, setUpgrading] = useState(false);
  const [dateRange, setDateRange] = useState("This Month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const r = applyDateRange(dateRange);
    if (r) { setFrom(r.from); setTo(r.to); }
  }, [dateRange]);

  const loadSales = async () => {
    try {
      const res = await fetch(`${API}/get_sales_report.php?from=${from}&to=${to}`);
      const j = await res.json().catch(() => ({}));
      if (j.status === "success") setSalesData(j.data);
    } catch (e) { console.error(e); }
  };

  const loadGst = async () => {
    try {
      const res = await fetch(`${API}/get_gst_reports.php?from=${from}&to=${to}`);
      const j = await res.json().catch(() => ({}));
      if (j.status === "success") setGstData(j.data);
    } catch (e) { console.error(e); }
  };

  const loadProfit = async () => {
    try {
      const res = await fetch(`${API}/get_profit_report.php?from=${from}&to=${to}`);
      const j = await res.json().catch(() => ({}));
      if (j.status === "success") setProfitData(j.data);
    } catch (e) { console.error(e); }
  };

  const loadPurchase = async () => {
    try {
      const res = await fetch(`${API}/get_purchase_report.php?from=${from}&to=${to}`);
      const j = await res.json().catch(() => ({}));
      if (j.status === "success") setPurchaseData(j.data);
    } catch (e) { console.error(e); }
  };

  const loadAccounts = async () => {
    try {
      const res = await fetch(`${API}/get_accounts_report.php?from=${from}&to=${to}`);
      const j = await res.json().catch(() => ({}));
      if (j.status === "success") setAccountsData(j.data);
    } catch (e) { console.error(e); }
  };

  const load = async () => {
    if (!from || !to) return;
    setLoading(true);
    await Promise.all([loadSales(), loadGst(), loadProfit(), loadPurchase(), loadAccounts()]);
    setLoading(false);
  };

  useEffect(() => { if (from && to) { const t = setTimeout(load, 200); return () => clearTimeout(t); } }, [from, to]);

  const s = salesData?.summary || {};
  const topItems = salesData?.top_items || [];
  const leastItems = salesData?.least_items || [];
  const hourly = salesData?.hourly || [];
  const daily = salesData?.daily || [];
  const weekly = salesData?.weekly || [];
  const monthly = salesData?.monthly || [];
  const gstr1 = gstData?.gstr1 || [];
  const gstr2a = gstData?.gstr2a || [];
  const gstr3b = gstData?.gstr3b || {};
  const hsnSales = gstData?.hsn_sales || [];
  const hsnPurchase = gstData?.hsn_purchase || [];
  const ps = purchaseData?.summary || {};
  const pTopItems = purchaseData?.top_items || [];
  const pDistributors = purchaseData?.distributors || [];
  const pDaily = purchaseData?.daily || [];
  const pWeekly = purchaseData?.weekly || [];
  const pMonthly = purchaseData?.monthly || [];
  const pPayModes = purchaseData?.pay_modes || [];
  const profitSummary = profitData?.summary || {};
  const profitItems = profitData?.items || [];
  const profitDaily = profitData?.daily || [];
  const profitMonthly = profitData?.monthly || [];

  const peakHour = useMemo(() => {
    if (!hourly.length) return null;
    return hourly.reduce((a, b) => b.total > a.total ? b : a, hourly[0]);
  }, [hourly]);

  const fmtHour = (h) => { if (h === 0) return "12 AM"; if (h < 12) return `${h} AM`; if (h === 12) return "12 PM"; return `${h - 12} PM`; };
  const topMax = topItems.length > 0 ? topItems[0].total_qty : 1;
  const topRevMax = topItems.length > 0 ? Math.max(...topItems.map((i) => i.total_revenue)) : 1;

  /* ── Excel download helpers ── */
  const dlGSTR1 = () => {
    downloadExcel([
      { key: "invoice_no", label: "Invoice No" },
      { key: "invoice_date", label: "Date" },
      { key: "customer_name", label: "Customer" },
      { key: "item_name", label: "Item" },
      { key: "item_code", label: "Code" },
      { key: "hsn", label: "HSN" },
      { key: "qty", label: "Qty", type: "int" },
      { key: "rate", label: "Rate", type: "number" },
      { key: "taxable_value", label: "Taxable Value", type: "number" },
      { key: "tax_pct", label: "GST %", type: "number" },
      { key: "cgst", label: "CGST", type: "number" },
      { key: "sgst", label: "SGST", type: "number" },
      { key: "total_tax", label: "Total Tax", type: "number" },
      { key: "total", label: "Total", type: "number" },
    ], gstr1, `GSTR1_${from}_to_${to}`);
  };

  const dlGSTR2A = () => {
    downloadExcel([
      { key: "bill_no", label: "Bill No" },
      { key: "bill_date", label: "Date" },
      { key: "distributor_name", label: "Distributor" },
      { key: "gstin", label: "GSTIN" },
      { key: "item_name", label: "Item" },
      { key: "item_code", label: "Code" },
      { key: "hsn", label: "HSN" },
      { key: "qty", label: "Qty", type: "int" },
      { key: "rate", label: "Rate", type: "number" },
      { key: "taxable_value", label: "Taxable Value", type: "number" },
      { key: "tax_pct", label: "GST %", type: "number" },
      { key: "cgst", label: "CGST", type: "number" },
      { key: "sgst", label: "SGST", type: "number" },
      { key: "total_tax", label: "Total Tax", type: "number" },
      { key: "total", label: "Total", type: "number" },
    ], gstr2a, `GSTR2A_${from}_to_${to}`);
  };

  const dlGSTR3B = () => {
    const rows = [
      { particular: "Outward Supplies (Sales)", taxable: gstr3b.outward?.taxable_value, cgst: gstr3b.outward?.cgst, sgst: gstr3b.outward?.sgst, igst: 0, total: gstr3b.outward?.total_tax },
      { particular: "Inward Supplies (Purchases)", taxable: gstr3b.inward?.taxable_value, cgst: gstr3b.inward?.cgst, sgst: gstr3b.inward?.sgst, igst: 0, total: gstr3b.inward?.total_tax },
      { particular: "Input Tax Credit (ITC)", taxable: "", cgst: gstr3b.itc?.cgst, sgst: gstr3b.itc?.sgst, igst: 0, total: gstr3b.itc?.total },
      { particular: "Tax Payable", taxable: "", cgst: gstr3b.payable?.cgst, sgst: gstr3b.payable?.sgst, igst: 0, total: gstr3b.payable?.total },
    ];
    downloadExcel([
      { key: "particular", label: "Particular" },
      { key: "taxable", label: "Taxable Value", type: "number" },
      { key: "cgst", label: "CGST", type: "number" },
      { key: "sgst", label: "SGST", type: "number" },
      { key: "igst", label: "IGST", type: "number" },
      { key: "total", label: "Total Tax", type: "number" },
    ], rows, `GSTR3B_${from}_to_${to}`);
  };

  const dlHSN = () => {
    downloadExcel([
      { key: "hsn", label: "HSN Code" },
      { key: "tax_pct", label: "GST %", type: "number" },
      { key: "total_qty", label: "Qty", type: "int" },
      { key: "taxable_value", label: "Taxable Value", type: "number" },
      { key: "cgst", label: "CGST", type: "number" },
      { key: "sgst", label: "SGST", type: "number" },
      { key: "total_value", label: "Total Value", type: "number" },
      { key: "invoice_count", label: "Invoices", type: "int" },
    ], hsnSales, `HSN_Sales_${from}_to_${to}`);
  };

  /* ── Send to CA — generate zip with all reports ── */
  const [sendingCA, setSendingCA] = useState(false);
  const [showCAMenu, setShowCAMenu] = useState(false);

  useEffect(() => {
    if (!showCAMenu) return;
    const close = () => setShowCAMenu(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showCAMenu]);

  const buildCAZip = async () => {
    // Dynamically import JSZip
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const range = `${from}_to_${to}`;

    // GSTR-1
    if (gstr1.length) {
      zip.file(`GSTR1_${range}.xls`, generateExcelBlob([
        { key: "invoice_no", label: "Invoice No" }, { key: "invoice_date", label: "Date" },
        { key: "customer_name", label: "Customer" }, { key: "item_name", label: "Item" },
        { key: "item_code", label: "Code" }, { key: "hsn", label: "HSN" },
        { key: "qty", label: "Qty", type: "int" }, { key: "rate", label: "Rate", type: "number" },
        { key: "taxable_value", label: "Taxable Value", type: "number" },
        { key: "tax_pct", label: "GST %", type: "number" },
        { key: "cgst", label: "CGST", type: "number" }, { key: "sgst", label: "SGST", type: "number" },
        { key: "total_tax", label: "Total Tax", type: "number" }, { key: "total", label: "Total", type: "number" },
      ], gstr1));
    }

    // GSTR-2A
    if (gstr2a.length) {
      zip.file(`GSTR2A_${range}.xls`, generateExcelBlob([
        { key: "bill_no", label: "Bill No" }, { key: "bill_date", label: "Date" },
        { key: "distributor_name", label: "Distributor" }, { key: "gstin", label: "GSTIN" },
        { key: "item_name", label: "Item" }, { key: "item_code", label: "Code" },
        { key: "hsn", label: "HSN" }, { key: "qty", label: "Qty", type: "int" },
        { key: "rate", label: "Rate", type: "number" },
        { key: "taxable_value", label: "Taxable Value", type: "number" },
        { key: "tax_pct", label: "GST %", type: "number" },
        { key: "cgst", label: "CGST", type: "number" }, { key: "sgst", label: "SGST", type: "number" },
        { key: "total_tax", label: "Total Tax", type: "number" }, { key: "total", label: "Total", type: "number" },
      ], gstr2a));
    }

    // GSTR-3B
    if (gstr3b.outward) {
      const g3bRows = [
        { particular: "Outward Supplies (Sales)", taxable: gstr3b.outward?.taxable_value, cgst: gstr3b.outward?.cgst, sgst: gstr3b.outward?.sgst, igst: 0, total: gstr3b.outward?.total_tax },
        { particular: "Inward Supplies (Purchases)", taxable: gstr3b.inward?.taxable_value, cgst: gstr3b.inward?.cgst, sgst: gstr3b.inward?.sgst, igst: 0, total: gstr3b.inward?.total_tax },
        { particular: "Input Tax Credit (ITC)", taxable: "", cgst: gstr3b.itc?.cgst, sgst: gstr3b.itc?.sgst, igst: 0, total: gstr3b.itc?.total },
        { particular: "Tax Payable", taxable: "", cgst: gstr3b.payable?.cgst, sgst: gstr3b.payable?.sgst, igst: 0, total: gstr3b.payable?.total },
      ];
      zip.file(`GSTR3B_${range}.xls`, generateExcelBlob([
        { key: "particular", label: "Particular" }, { key: "taxable", label: "Taxable Value", type: "number" },
        { key: "cgst", label: "CGST", type: "number" }, { key: "sgst", label: "SGST", type: "number" },
        { key: "igst", label: "IGST", type: "number" }, { key: "total", label: "Total Tax", type: "number" },
      ], g3bRows));
    }

    // HSN wise GST
    if (hsnSales.length) {
      zip.file(`HSN_Sales_${range}.xls`, generateExcelBlob([
        { key: "hsn", label: "HSN Code" }, { key: "tax_pct", label: "GST %", type: "number" },
        { key: "total_qty", label: "Qty", type: "int" },
        { key: "taxable_value", label: "Taxable Value", type: "number" },
        { key: "cgst", label: "CGST", type: "number" }, { key: "sgst", label: "SGST", type: "number" },
        { key: "total_value", label: "Total Value", type: "number" },
        { key: "invoice_count", label: "Invoices", type: "int" },
      ], hsnSales));
    }

    // Sales data with item details
    try {
      const qs = new URLSearchParams({ type: "items", from, to });
      const res = await fetch(`${API}/get_sales_download.php?${qs}`);
      const j = await res.json().catch(() => ({}));
      if (j.status === "success" && j.data?.length) {
        zip.file(`Sales_Items_${range}.xls`, generateExcelBlob([
          { key: "date", label: "Date" }, { key: "invoice_no", label: "Invoice No" },
          { key: "customer_name", label: "Customer" }, { key: "item_name", label: "Item Name" },
          { key: "item_code", label: "Item Code" }, { key: "hsn", label: "HSN" },
          { key: "batch_no", label: "Batch" }, { key: "qty", label: "Qty", type: "int" },
          { key: "mrp", label: "MRP", type: "number" }, { key: "sale_price", label: "Sale Price", type: "number" },
          { key: "tax_pct", label: "Tax %", type: "number" },
          { key: "taxable_amount", label: "Taxable Amt", type: "number" },
          { key: "tax_amount", label: "Tax Amt", type: "number" },
          { key: "amount", label: "Amount", type: "number" },
        ], j.data));
      }
    } catch { /* ignore */ }

    return zip.generateAsync({ type: "blob" });
  };

  const sendToCA = async (method) => {
    const shop = getShopSettings();
    if (method === "email" && !shop.caEmail) return alert("Please set your CA's email in Settings first.");
    if (method === "whatsapp" && !shop.caPhone) return alert("Please set your CA's WhatsApp number in Settings first.");

    try {
      setSendingCA(true);
      setShowCAMenu(false);
      const zipBlob = await buildCAZip();
      const range = `${from} to ${to}`;
      const filename = `GST_Reports_${shop.name.replace(/\s+/g, "_")}_${from}_to_${to}.zip`;

      if (method === "download") {
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (method === "email") {
        const subject = encodeURIComponent(`GST Reports - ${shop.name} (${range})`);
        const body = encodeURIComponent(`Dear ${shop.caName || "Sir/Madam"},\n\nPlease find attached the GST reports for ${shop.name} for the period ${range}.\n\nReports included:\n- GSTR-1 (Outward Supplies)\n- GSTR-2A (Inward Supplies)\n- GSTR-3B (Tax Summary)\n- HSN wise GST\n- Sales Item-wise Data\n\nRegards,\n${shop.name}\n${shop.phone}`);
        // Create a File from the blob and try to share via mailto
        const file = new File([zipBlob], filename, { type: "application/zip" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `GST Reports - ${shop.name}`, text: `GST Reports for ${range}` });
        } else {
          window.location.href = `mailto:${shop.caEmail}?subject=${subject}&body=${body}`;
        }
      } else if (method === "whatsapp") {
        const file = new File([zipBlob], filename, { type: "application/zip" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `GST Reports - ${shop.name}`, text: `GST Reports for ${range}` });
        } else {
          const phone = shop.caPhone.replace(/\D/g, "");
          const waPhone = phone.startsWith("91") ? phone : `91${phone}`;
          const text = encodeURIComponent(`GST Reports - ${shop.name} (${range})\n\nReports: GSTR-1, GSTR-2A, GSTR-3B, HSN wise GST, Sales Data`);
          window.open(`https://wa.me/${waPhone}?text=${text}`, "_blank");
        }
      }
    } catch (e) {
      alert("Failed to generate reports: " + (e.message || "Unknown error"));
    } finally {
      setSendingCA(false);
    }
  };

  /* ── Upgrade: remove non-GST items from sales ── */
  const onUpgradeClick = async () => {
    if (!from || !to) return alert("Please select a date range first.");
    try {
      const res = await fetch(`${API}/upgrade_remove_nongst.php`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true, from, to }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.status !== "success") throw new Error(j.message || "Failed");
      setUpgradeStats(j.data);
      setShowUpgrade(true);
    } catch (e) { alert(e.message || "Failed to check"); }
  };

  const confirmUpgrade = async () => {
    try {
      setUpgrading(true);
      const res = await fetch(`${API}/upgrade_remove_nongst.php`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false, from, to }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.status !== "success") throw new Error(j.message || "Failed");
      setShowUpgrade(false);
      alert("Upgrade complete! Non-GST items removed from sales.");
      load(); // Reload reports
    } catch (e) { alert(e.message || "Upgrade failed"); }
    finally { setUpgrading(false); }
  };

  /* ── GST table renderer ── */
  const GSTTable = ({ columns, rows, emptyMsg = "No data" }) => (
    <div style={{ overflowX: "auto" }}>
      <table className="g-table">
        <thead><tr>{columns.map((c) => <th key={c.key} style={{ textAlign: c.type === "number" || c.type === "int" ? "right" : "left" }}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ textAlign: "center", padding: 24, color: C.textSub }}>{emptyMsg}</td></tr>
          ) : (
            <>
              {rows.map((r, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.key} style={{ textAlign: c.type === "number" || c.type === "int" ? "right" : "left", fontWeight: c.bold ? 700 : undefined }}>
                      {c.type === "number" ? `₹${fmt2(r[c.key])}` : r[c.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
              <TotalRow cols={columns} data={rows} />
            </>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div id="g-root" style={{ padding: "20px 26px", background: C.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: C.text, marginRight: 8 }}>Reports</h2>
        <select className="g-sel sm" style={{ width: 140 }} value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
          {DATE_RANGES.map((r) => <option key={r}>{r}</option>)}
        </select>
        <input className="g-inp sm" type="date" style={{ width: 130 }} value={from} onChange={(e) => { setFrom(e.target.value); setDateRange("Custom"); }} />
        <input className="g-inp sm" type="date" style={{ width: 130 }} value={to} onChange={(e) => { setTo(e.target.value); setDateRange("Custom"); }} />
        <div style={{ flex: 1 }} />
        {isAdmin && <button className="g-btn ghost sm" onClick={onUpgradeClick} style={{ color: C.red, borderColor: "#fca5a5" }}>
          <FiArrowUp size={13} /> Upgrade
        </button>}
        {/* Send to CA dropdown */}
        <div style={{ position: "relative" }}>
          <button className="g-btn primary sm" disabled={sendingCA || loading} onClick={(e) => { e.stopPropagation(); setShowCAMenu((p) => !p); }}>
            <FiSend size={13} /> {sendingCA ? "Preparing…" : "Send to CA"}
          </button>
          {showCAMenu && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 50, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.12)", minWidth: 220, padding: "6px 0" }}>
              {[
                { method: "download", label: "Download ZIP", desc: "All reports in one zip file" },
                { method: "email", label: "Send via Email", desc: "Open email with reports" },
                { method: "whatsapp", label: "Send via WhatsApp", desc: "Open WhatsApp with message" },
              ].map(({ method, label, desc }) => (
                <button key={method} onClick={(e) => { e.stopPropagation(); sendToCA(method); }}
                  style={{ display: "block", width: "100%", padding: "10px 16px", border: "none", background: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{label}</div>
                  <div style={{ fontSize: 11, color: C.textSub, marginTop: 1 }}>{desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="g-btn ghost sm" onClick={load} disabled={loading}><FiRefreshCw size={14} /></button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 3, marginBottom: 16, background: "#fff", borderRadius: 10, border: "1.5px solid #e5e7eb", padding: 4, overflowX: "auto" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: tab === t.key ? 700 : 500, whiteSpace: "nowrap",
            color: tab === t.key ? "#fff" : C.textSub,
            background: tab === t.key ? C.brand : "transparent",
            transition: "all 0.15s",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading && !salesData ? (
        <div style={{ textAlign: "center", padding: 60, color: C.textSub }}>Loading reports…</div>
      ) : (
        <>
          {/* ═══════ SALES REPORT ═══════ */}
          {tab === "sales" && (
            <>
              {/* KPI */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 18 }}>
                {[
                  { label: "Total Revenue", value: `₹${fmt2(s.total_revenue)}`, color: C.brand },
                  { label: "Bills", value: s.total_bills || 0, color: C.brand },
                  { label: "Avg Bill", value: `₹${fmt2(s.avg_bill_value)}`, color: C.text },
                  { label: "Items Sold", value: Math.round(s.total_qty_sold || 0), color: C.green },
                  { label: "Unique Items", value: s.unique_items_sold || 0, color: C.text },
                  { label: "Customers", value: s.unique_customers || 0, color: C.brand },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: "#fff", borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 17, fontWeight: 900, color }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div className="g-card">
                  <div className="g-card-head"><div className="g-card-title">Daily Sales</div></div>
                  <div style={{ padding: "16px 18px" }}>
                    {daily.length > 0 ? <BarChart data={daily.slice(-30).map((d) => ({ ...d, label: d.dt.slice(5) }))} labelKey="label" valueKey="total" color={C.brand} />
                    : <div style={{ color: C.textSub, textAlign: "center", padding: 40, fontSize: 13 }}>No data</div>}
                  </div>
                </div>
                <div className="g-card">
                  <div className="g-card-head"><div className="g-card-title">Monthly Sales</div></div>
                  <div style={{ padding: "16px 18px" }}>
                    {monthly.length > 0 ? <BarChart data={monthly.map((d) => ({ ...d, label: d.month }))} labelKey="label" valueKey="total" color={C.green} />
                    : <div style={{ color: C.textSub, textAlign: "center", padding: 40, fontSize: 13 }}>No data</div>}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div className="g-card">
                  <div className="g-card-head"><div className="g-card-title">Weekly Sales</div></div>
                  <div style={{ padding: "16px 18px" }}>
                    {weekly.length > 0 ? <BarChart data={weekly.map((d) => ({ ...d, label: `W${d.wk}` }))} labelKey="label" valueKey="total" color={C.orange} />
                    : <div style={{ color: C.textSub, textAlign: "center", padding: 40, fontSize: 13 }}>No data</div>}
                  </div>
                </div>
                <div className="g-card">
                  <div className="g-card-head"><div className="g-card-title"><FiClock size={14} style={{ color: C.brand }} /> Peak Hours</div></div>
                  <div style={{ padding: "16px 18px" }}>
                    {hourly.length > 0 ? (
                      <>
                        {peakHour && (
                          <div style={{ background: C.brandLighter, borderRadius: 8, padding: "8px 12px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13 }}>{fmtHour(peakHour.hr).split(" ")[0]}</div>
                            <div><div style={{ fontWeight: 800, fontSize: 13, color: C.brand }}>Peak: {fmtHour(peakHour.hr)}</div><div style={{ fontSize: 11, color: C.textSub }}>{peakHour.bill_count} bills · ₹{fmt2(peakHour.total)}</div></div>
                          </div>
                        )}
                        <BarChart data={hourly.map((d) => ({ ...d, label: fmtHour(d.hr) }))} labelKey="label" valueKey="total" color="#6366f1" height={140} />
                      </>
                    ) : <div style={{ color: C.textSub, textAlign: "center", padding: 40, fontSize: 13 }}>No hourly data</div>}
                  </div>
                </div>
              </div>

              {/* Top & Bottom items side by side */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {topItems.length > 0 && (
                  <div className="g-card">
                    <div className="g-card-head"><div className="g-card-title"><FiArrowUp size={14} style={{ color: C.green }} /> Top Selling Items</div></div>
                    <div style={{ padding: "10px 18px" }}>
                      {topItems.slice(0, 10).map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < 9 ? "1px solid #f3f4f6" : "none" }}>
                          <span style={{ width: 22, fontWeight: 800, fontSize: 12, color: i < 3 ? C.brand : C.textSub, textAlign: "center" }}>{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                            <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                          </div>
                          <HBar value={item.total_qty} max={topMax} color={C.green} />
                          <div style={{ textAlign: "right", minWidth: 50 }}>
                            <div style={{ fontWeight: 800, fontSize: 13, color: C.green }}>{item.total_qty}</div>
                            <div style={{ fontSize: 10, color: C.textSub }}>₹{fmt2(item.total_revenue)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {leastItems.length > 0 && (
                  <div className="g-card">
                    <div className="g-card-head"><div className="g-card-title"><FiArrowDown size={14} style={{ color: C.orange }} /> Slow Moving Items</div></div>
                    <div style={{ padding: "10px 18px" }}>
                      {leastItems.slice(0, 10).map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < 9 ? "1px solid #f3f4f6" : "none" }}>
                          <span style={{ width: 22, fontWeight: 800, fontSize: 12, color: C.textSub, textAlign: "center" }}>{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}><div style={{ fontWeight: 600 }}>{item.item_name}</div></div>
                          <div style={{ textAlign: "right", minWidth: 50 }}>
                            <div style={{ fontWeight: 800, fontSize: 13, color: C.orange }}>{item.total_qty}</div>
                            <div style={{ fontSize: 10, color: C.textSub }}>₹{fmt2(item.total_revenue)}</div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, color: item.total_qty <= 2 ? C.red : C.yellow, background: item.total_qty <= 2 ? C.redLight : C.yellowLight }}>
                            {item.total_qty <= 2 ? "Remove?" : "Low"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══════ PURCHASE REPORT ═══════ */}
          {tab === "purchase" && (
            <>
              {/* KPI */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
                {[
                  { label: "Total Bills", value: ps.total_bills || 0, color: C.brand },
                  { label: "Total Purchase", value: `₹${fmt2(ps.total_purchase)}`, color: C.orange },
                  { label: "Total Paid", value: `₹${fmt2(ps.total_paid)}`, color: C.green },
                  { label: "Balance Due", value: `₹${fmt2(ps.total_balance)}`, color: (ps.total_balance || 0) > 0 ? C.red : C.green },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: "#fff", borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "14px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
                {[
                  { label: "Avg Bill", value: `₹${fmt2(ps.avg_bill_value)}`, color: C.text },
                  { label: "Distributors", value: ps.unique_distributors || 0, color: C.brand },
                  { label: "Sub Total", value: `₹${fmt2(ps.sub_total)}`, color: C.text },
                  { label: "Tax Total", value: `₹${fmt2(ps.tax_total)}`, color: C.orange },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: "#fff", borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 17, fontWeight: 900, color }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Charts: Daily & Monthly */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div className="g-card">
                  <div className="g-card-head"><div className="g-card-title">Daily Purchase</div></div>
                  <div style={{ padding: "16px 18px" }}>
                    {pDaily.length > 0 ? <BarChart data={pDaily.slice(-30).map((d) => ({ ...d, label: d.dt.slice(5) }))} labelKey="label" valueKey="total" color={C.orange} />
                    : <div style={{ color: C.textSub, textAlign: "center", padding: 40, fontSize: 13 }}>No data</div>}
                  </div>
                </div>
                <div className="g-card">
                  <div className="g-card-head"><div className="g-card-title">Monthly Purchase</div></div>
                  <div style={{ padding: "16px 18px" }}>
                    {pMonthly.length > 0 ? <BarChart data={pMonthly.map((d) => ({ ...d, label: d.month }))} labelKey="label" valueKey="total" color={C.brand} />
                    : <div style={{ color: C.textSub, textAlign: "center", padding: 40, fontSize: 13 }}>No data</div>}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                {/* Weekly */}
                <div className="g-card">
                  <div className="g-card-head"><div className="g-card-title">Weekly Purchase</div></div>
                  <div style={{ padding: "16px 18px" }}>
                    {pWeekly.length > 0 ? <BarChart data={pWeekly.map((d) => ({ ...d, label: `W${d.wk}` }))} labelKey="label" valueKey="total" color="#6366f1" />
                    : <div style={{ color: C.textSub, textAlign: "center", padding: 40, fontSize: 13 }}>No data</div>}
                  </div>
                </div>
                {/* Payment modes */}
                <div className="g-card">
                  <div className="g-card-head"><div className="g-card-title"><FiClock size={14} style={{ color: C.brand }} /> Payment Modes</div></div>
                  <div style={{ padding: "14px 18px" }}>
                    {pPayModes.length > 0 ? (
                      <>
                        {(() => { const maxPay = Math.max(...pPayModes.map((p) => p.total_amount), 1); return pPayModes.map((p, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < pPayModes.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                            <span style={{ width: 60, fontSize: 13, fontWeight: 700, color: C.text }}>{p.mode}</span>
                            <HBar value={p.total_amount} max={maxPay} color={C.brand} />
                            <div style={{ textAlign: "right", minWidth: 80 }}>
                              <div style={{ fontWeight: 800, fontSize: 13, color: C.brand }}>₹{fmt2(p.total_amount)}</div>
                              <div style={{ fontSize: 10, color: C.textSub }}>{p.pay_count} txns</div>
                            </div>
                          </div>
                        )); })()}
                      </>
                    ) : <div style={{ color: C.textSub, textAlign: "center", padding: 40, fontSize: 13 }}>No payment data</div>}
                  </div>
                </div>
              </div>

              {/* Distributor-wise & Top Items side by side */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {pDistributors.length > 0 && (
                  <div className="g-card">
                    <div className="g-card-head">
                      <div className="g-card-title"><FiTrendingUp size={14} style={{ color: C.orange }} /> Distributor-wise Purchase</div>
                      <button className="g-btn ghost sm" onClick={() => {
                        downloadExcel([
                          { key: "distributor_name", label: "Distributor" },
                          { key: "distributor_gstin", label: "GSTIN" },
                          { key: "bill_count", label: "Bills", type: "int" },
                          { key: "total_amount", label: "Total Amount", type: "number" },
                          { key: "total_paid", label: "Paid", type: "number" },
                          { key: "balance", label: "Balance", type: "number" },
                        ], pDistributors, `Purchase_Distributors_${from}_to_${to}`);
                      }}><FiDownload size={12} /> Excel</button>
                    </div>
                    <div style={{ padding: "10px 18px" }}>
                      {(() => { const maxAmt = pDistributors[0]?.total_amount || 1; return pDistributors.map((d, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < pDistributors.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                          <span style={{ width: 22, fontWeight: 800, fontSize: 12, color: i < 3 ? C.orange : C.textSub, textAlign: "center" }}>{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                            <div style={{ fontWeight: 600 }}>{d.distributor_name}</div>
                            <div style={{ fontSize: 11, color: C.textSub }}>{d.bill_count} bills · Bal: ₹{fmt2(d.balance)}</div>
                          </div>
                          <HBar value={d.total_amount} max={maxAmt} color={C.orange} />
                          <div style={{ textAlign: "right", minWidth: 70 }}>
                            <div style={{ fontWeight: 800, fontSize: 13, color: C.orange }}>₹{fmt2(d.total_amount)}</div>
                            <div style={{ fontSize: 10, color: C.green }}>Paid: ₹{fmt2(d.total_paid)}</div>
                          </div>
                        </div>
                      )); })()}
                    </div>
                  </div>
                )}
                {pTopItems.length > 0 && (
                  <div className="g-card">
                    <div className="g-card-head">
                      <div className="g-card-title"><FiArrowUp size={14} style={{ color: C.brand }} /> Top Purchased Items</div>
                      <button className="g-btn ghost sm" onClick={() => {
                        downloadExcel([
                          { key: "item_name", label: "Item" },
                          { key: "item_code", label: "Code" },
                          { key: "total_qty", label: "Qty", type: "int" },
                          { key: "total_amount", label: "Amount", type: "number" },
                          { key: "bill_count", label: "Bills", type: "int" },
                          { key: "avg_price", label: "Avg Price", type: "number" },
                        ], pTopItems, `Top_Purchase_Items_${from}_to_${to}`);
                      }}><FiDownload size={12} /> Excel</button>
                    </div>
                    <div style={{ padding: "10px 18px" }}>
                      {(() => { const maxAmt = pTopItems[0]?.total_amount || 1; return pTopItems.slice(0, 10).map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < 9 ? "1px solid #f3f4f6" : "none" }}>
                          <span style={{ width: 22, fontWeight: 800, fontSize: 12, color: i < 3 ? C.brand : C.textSub, textAlign: "center" }}>{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                            <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                            <div style={{ fontSize: 11, color: C.textSub }}>{item.bill_count} bills · Avg: ₹{fmt2(item.avg_price)}</div>
                          </div>
                          <HBar value={item.total_amount} max={maxAmt} color={C.brand} />
                          <div style={{ textAlign: "right", minWidth: 60 }}>
                            <div style={{ fontWeight: 800, fontSize: 13, color: C.brand }}>₹{fmt2(item.total_amount)}</div>
                            <div style={{ fontSize: 10, color: C.textSub }}>Qty: {item.total_qty}</div>
                          </div>
                        </div>
                      )); })()}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══════ PROFIT ANALYSIS ═══════ */}
          {tab === "profit" && (
            <>
              {/* KPI */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 18 }}>
                {[
                  { label: "Total Revenue", value: `₹${fmt2(profitSummary.total_revenue)}`, color: C.brand },
                  { label: "Taxable Revenue", value: `₹${fmt2(profitSummary.taxable_revenue)}`, color: C.text },
                  { label: "Total Cost", value: `₹${fmt2(profitSummary.total_cost)}`, color: C.orange },
                  { label: "Net Profit", value: `₹${fmt2(profitSummary.total_profit)}`, color: (profitSummary.total_profit || 0) >= 0 ? C.green : C.red },
                  { label: "Profit Margin", value: `${profitSummary.margin_pct || 0}%`, color: (profitSummary.margin_pct || 0) >= 20 ? C.green : C.orange },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: "#fff", borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "14px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Daily & Monthly profit charts */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div className="g-card">
                  <div className="g-card-head"><div className="g-card-title">Daily Profit</div></div>
                  <div style={{ padding: "16px 18px" }}>
                    {profitDaily.length > 0 ? <BarChart data={profitDaily.slice(-30).map((d) => ({ ...d, label: d.dt.slice(5) }))} labelKey="label" valueKey="profit" color={C.green} />
                    : <div style={{ color: C.textSub, textAlign: "center", padding: 40, fontSize: 13 }}>No data</div>}
                  </div>
                </div>
                <div className="g-card">
                  <div className="g-card-head"><div className="g-card-title">Monthly Profit</div></div>
                  <div style={{ padding: "16px 18px" }}>
                    {profitMonthly.length > 0 ? (
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 200 }}>
                        {(() => { const maxVal = Math.max(...profitMonthly.map((m) => Math.max(m.revenue, m.cost)), 1); return profitMonthly.map((d, i) => (
                            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 4 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: C.green }}>₹{d.profit >= 1000 ? `${(d.profit / 1000).toFixed(1)}k` : d.profit}</div>
                              <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", justifyContent: "center" }}>
                                <div style={{ width: "40%", height: Math.max((d.revenue / maxVal) * 140, 4), background: C.brand, borderRadius: "3px 3px 0 0" }} title={`Revenue: ₹${fmt2(d.revenue)}`} />
                                <div style={{ width: "40%", height: Math.max((d.cost / maxVal) * 140, 4), background: C.orange, borderRadius: "3px 3px 0 0" }} title={`Cost: ₹${fmt2(d.cost)}`} />
                              </div>
                              <div style={{ fontSize: 9, color: C.textSub }}>{d.month}</div>
                            </div>
                          )); })()}
                        })}
                      </div>
                    ) : <div style={{ color: C.textSub, textAlign: "center", padding: 40, fontSize: 13 }}>No data</div>}
                    {profitMonthly.length > 0 && (
                      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 4 }}>
                        <span style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: C.brand, display: "inline-block" }} /> Revenue</span>
                        <span style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: C.orange, display: "inline-block" }} /> Cost</span>
                        <span style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: C.green, display: "inline-block" }} /> Profit</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Top Profitable Items & Least Profitable side by side */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {profitItems.length > 0 && (
                  <div className="g-card">
                    <div className="g-card-head">
                      <div className="g-card-title"><FiArrowUp size={14} style={{ color: C.green }} /> Most Profitable Items</div>
                      <button className="g-btn ghost sm" onClick={() => {
                        downloadExcel([
                          { key: "item_name", label: "Item" },
                          { key: "item_code", label: "Code" },
                          { key: "qty_sold", label: "Qty Sold", type: "int" },
                          { key: "revenue", label: "Revenue", type: "number" },
                          { key: "taxable_revenue", label: "Taxable Revenue", type: "number" },
                          { key: "cost", label: "Cost", type: "number" },
                          { key: "profit", label: "Profit", type: "number" },
                          { key: "margin_pct", label: "Margin %", type: "pct" },
                        ], profitItems, `Profit_Items_${from}_to_${to}`);
                      }}><FiDownload size={12} /> Excel</button>
                    </div>
                    <div style={{ padding: "10px 18px" }}>
                      {profitItems.slice(0, 10).map((item, i) => {
                        const maxProfit = profitItems[0]?.profit || 1;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < 9 ? "1px solid #f3f4f6" : "none" }}>
                            <span style={{ width: 22, fontWeight: 800, fontSize: 12, color: i < 3 ? C.green : C.textSub, textAlign: "center" }}>{i + 1}</span>
                            <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                              <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                              <div style={{ fontSize: 11, color: C.textSub }}>Qty: {item.qty_sold} · Cost: ₹{fmt2(item.cost)}</div>
                            </div>
                            <HBar value={item.profit} max={maxProfit} color={C.green} />
                            <div style={{ textAlign: "right", minWidth: 70 }}>
                              <div style={{ fontWeight: 800, fontSize: 13, color: C.green }}>₹{fmt2(item.profit)}</div>
                              <div style={{ fontSize: 10, color: C.textSub }}>{item.margin_pct}%</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {profitItems.length > 0 && (
                  <div className="g-card">
                    <div className="g-card-head"><div className="g-card-title"><FiArrowDown size={14} style={{ color: C.red }} /> Least Profitable Items</div></div>
                    <div style={{ padding: "10px 18px" }}>
                      {[...profitItems].reverse().slice(0, 10).map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < 9 ? "1px solid #f3f4f6" : "none" }}>
                          <span style={{ width: 22, fontWeight: 800, fontSize: 12, color: C.textSub, textAlign: "center" }}>{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                            <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                            <div style={{ fontSize: 11, color: C.textSub }}>Qty: {item.qty_sold} · Cost: ₹{fmt2(item.cost)}</div>
                          </div>
                          <div style={{ textAlign: "right", minWidth: 70 }}>
                            <div style={{ fontWeight: 800, fontSize: 13, color: item.profit < 0 ? C.red : C.orange }}>₹{fmt2(item.profit)}</div>
                            <div style={{ fontSize: 10, color: C.textSub }}>{item.margin_pct}%</div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, color: item.profit < 0 ? C.red : C.orange, background: item.profit < 0 ? C.redLight : C.orangeLight }}>
                            {item.profit < 0 ? "Loss" : "Low"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══════ GSTR-1 ═══════ */}
          {tab === "gstr1" && (
            <div className="g-card">
              <div className="g-card-head">
                <div className="g-card-title"><FiFileText size={14} style={{ color: C.brand }} /> GSTR-1 — Outward Supplies (Sales)</div>
                <button className="g-btn primary sm" onClick={dlGSTR1} disabled={gstr1.length === 0}><FiDownload size={12} /> Download Excel</button>
              </div>
              <GSTTable columns={[
                { key: "invoice_no", label: "Invoice No" },
                { key: "invoice_date", label: "Date" },
                { key: "customer_name", label: "Customer" },
                { key: "item_name", label: "Item" },
                { key: "hsn", label: "HSN" },
                { key: "qty", label: "Qty", type: "int", sum: true },
                { key: "rate", label: "Rate ₹", type: "number" },
                { key: "taxable_value", label: "Taxable ₹", type: "number", sum: true, bold: true },
                { key: "tax_pct", label: "GST%", type: "number" },
                { key: "cgst", label: "CGST ₹", type: "number", sum: true },
                { key: "sgst", label: "SGST ₹", type: "number", sum: true },
                { key: "total", label: "Total ₹", type: "number", sum: true, bold: true },
              ]} rows={gstr1} emptyMsg="No sales data for this period" />
            </div>
          )}

          {/* ═══════ GSTR-2A ═══════ */}
          {tab === "gstr2a" && (
            <div className="g-card">
              <div className="g-card-head">
                <div className="g-card-title"><FiFileText size={14} style={{ color: C.orange }} /> GSTR-2A — Inward Supplies (Purchases)</div>
                <button className="g-btn primary sm" onClick={dlGSTR2A} disabled={gstr2a.length === 0}><FiDownload size={12} /> Download Excel</button>
              </div>
              <GSTTable columns={[
                { key: "bill_no", label: "Bill No" },
                { key: "bill_date", label: "Date" },
                { key: "distributor_name", label: "Distributor" },
                { key: "gstin", label: "GSTIN" },
                { key: "item_name", label: "Item" },
                { key: "hsn", label: "HSN" },
                { key: "qty", label: "Qty", type: "int", sum: true },
                { key: "rate", label: "Rate ₹", type: "number" },
                { key: "taxable_value", label: "Taxable ₹", type: "number", sum: true, bold: true },
                { key: "tax_pct", label: "GST%", type: "number" },
                { key: "cgst", label: "CGST ₹", type: "number", sum: true },
                { key: "sgst", label: "SGST ₹", type: "number", sum: true },
                { key: "total", label: "Total ₹", type: "number", sum: true, bold: true },
              ]} rows={gstr2a} emptyMsg="No purchase data for this period" />
            </div>
          )}

          {/* ═══════ GSTR-3B ═══════ */}
          {tab === "gstr3b" && (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button className="g-btn primary sm" onClick={dlGSTR3B} disabled={!gstr3b.outward}><FiDownload size={12} /> Download Excel</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
                {[
                  { label: "Output Tax", value: `₹${fmt2(gstr3b.outward?.total_tax)}`, color: C.brand },
                  { label: "Input Tax Credit", value: `₹${fmt2(gstr3b.itc?.total)}`, color: C.green },
                  { label: "Net Payable", value: `₹${fmt2(gstr3b.payable?.total)}`, color: (gstr3b.payable?.total || 0) > 0 ? C.orange : C.green },
                  { label: "Outward Taxable", value: `₹${fmt2(gstr3b.outward?.taxable_value)}`, color: C.text },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: "#fff", borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color }}>{value}</div>
                  </div>
                ))}
              </div>

              <div className="g-card">
                <div className="g-card-head"><div className="g-card-title">GSTR-3B Summary</div></div>
                <div style={{ overflowX: "auto" }}>
                  <table className="g-table">
                    <thead>
                      <tr>
                        <th>Particular</th>
                        <th style={{ textAlign: "right" }}>Taxable Value ₹</th>
                        <th style={{ textAlign: "right" }}>CGST ₹</th>
                        <th style={{ textAlign: "right" }}>SGST ₹</th>
                        <th style={{ textAlign: "right" }}>IGST ₹</th>
                        <th style={{ textAlign: "right" }}>Total Tax ₹</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "3.1 Outward Supplies (Sales)", data: gstr3b.outward, color: C.brand },
                        { label: "4. Inward Supplies (Purchases)", data: gstr3b.inward, color: C.orange },
                        { label: "4(A) Input Tax Credit (ITC)", data: gstr3b.itc, color: C.green },
                        { label: "6.1 Tax Payable", data: gstr3b.payable, color: C.red, bold: true },
                      ].map(({ label, data: d, color, bold }) => (
                        <tr key={label} style={{ background: bold ? "#fef2f2" : undefined }}>
                          <td style={{ fontWeight: 700, color }}>{label}</td>
                          <td style={{ textAlign: "right", fontWeight: bold ? 800 : 500 }}>₹{fmt2(d?.taxable_value)}</td>
                          <td style={{ textAlign: "right", fontWeight: bold ? 800 : 500 }}>₹{fmt2(d?.cgst)}</td>
                          <td style={{ textAlign: "right", fontWeight: bold ? 800 : 500 }}>₹{fmt2(d?.sgst)}</td>
                          <td style={{ textAlign: "right", color: C.textSub }}>₹0.00</td>
                          <td style={{ textAlign: "right", fontWeight: 800, color: bold ? C.red : C.text }}>₹{fmt2(d?.total_tax ?? d?.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ═══════ HSN WISE GST ═══════ */}
          {tab === "hsn" && (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12, gap: 8 }}>
                <button className="g-btn primary sm" onClick={dlHSN} disabled={hsnSales.length === 0}><FiDownload size={12} /> Download Sales HSN</button>
                <button className="g-btn ghost sm" onClick={() => {
                  downloadExcel([
                    { key: "hsn", label: "HSN Code" },
                    { key: "tax_pct", label: "GST %", type: "number" },
                    { key: "total_qty", label: "Qty", type: "int" },
                    { key: "taxable_value", label: "Taxable Value", type: "number" },
                    { key: "cgst", label: "CGST", type: "number" },
                    { key: "sgst", label: "SGST", type: "number" },
                    { key: "bill_count", label: "Bills", type: "int" },
                  ], hsnPurchase, `HSN_Purchase_${from}_to_${to}`);
                }} disabled={hsnPurchase.length === 0}><FiDownload size={12} /> Download Purchase HSN</button>
              </div>

              {/* Sales HSN */}
              <div className="g-card" style={{ marginBottom: 16 }}>
                <div className="g-card-head"><div className="g-card-title"><FiPackage size={14} style={{ color: C.green }} /> HSN-wise Sales Summary</div></div>
                <GSTTable columns={[
                  { key: "hsn", label: "HSN Code" },
                  { key: "tax_pct", label: "GST %", type: "number" },
                  { key: "total_qty", label: "Qty", type: "int", sum: true },
                  { key: "taxable_value", label: "Taxable ₹", type: "number", sum: true, bold: true },
                  { key: "cgst", label: "CGST ₹", type: "number", sum: true },
                  { key: "sgst", label: "SGST ₹", type: "number", sum: true },
                  { key: "total_value", label: "Total ₹", type: "number", sum: true, bold: true },
                  { key: "invoice_count", label: "Invoices", type: "int", sum: true },
                ]} rows={hsnSales} emptyMsg="No HSN data for sales" />
              </div>

              {/* Purchase HSN */}
              <div className="g-card">
                <div className="g-card-head"><div className="g-card-title"><FiPackage size={14} style={{ color: C.orange }} /> HSN-wise Purchase Summary</div></div>
                <GSTTable columns={[
                  { key: "hsn", label: "HSN Code" },
                  { key: "tax_pct", label: "GST %", type: "number" },
                  { key: "total_qty", label: "Qty", type: "int", sum: true },
                  { key: "taxable_value", label: "Taxable ₹", type: "number", sum: true, bold: true },
                  { key: "cgst", label: "CGST ₹", type: "number", sum: true },
                  { key: "sgst", label: "SGST ₹", type: "number", sum: true },
                  { key: "bill_count", label: "Bills", type: "int", sum: true },
                ]} rows={hsnPurchase} emptyMsg="No HSN data for purchases" />
              </div>
            </>
          )}

          {/* ═══════ ACCOUNTS ═══════ */}
          {tab === "accounts" && (() => {
            const ac = accountsData || {};
            const salesModes = ac.sales_by_mode || [];
            const purchaseModes = ac.purchase_by_mode || [];
            const daily = ac.daily_cash_flow || [];
            const netFlow = ac.net_cash_flow || 0;
            const allModes = ["Cash", "UPI", "Card", "Bank", "Cheque", "Other"];
            const modeColors = { Cash: "#16a34a", UPI: "#7c3aed", Card: "#0369a1", Bank: "#0891b2", Cheque: "#ca8a04", Other: "#64748b" };

            return (
              <>
                {/* Summary cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 18 }}>
                  {[
                    { label: "Total Received (Sales)", value: `₹${fmt2(ac.sales_total_received || 0)}`, color: C.green },
                    { label: "Total Paid (Purchase)", value: `₹${fmt2(ac.purchase_total_paid || 0)}`, color: C.orange },
                    { label: "Net Cash Flow", value: `₹${fmt2(netFlow)}`, color: netFlow >= 0 ? C.green : C.red },
                    { label: "Outstanding", value: `₹${fmt2((ac.sales_outstanding || 0) + (ac.purchase_outstanding || 0))}`, color: C.red },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
                  {/* Sales by mode */}
                  <div className="g-card">
                    <div className="g-card-head">
                      <div className="g-card-title"><FiArrowDown size={14} style={{ color: C.green }} /> Sales Received by Mode</div>
                      <button className="g-btn ghost sm" onClick={() => downloadExcel([
                        { key: "mode", label: "Payment Mode" },
                        { key: "total", label: "Amount", type: "number" },
                        { key: "txn_count", label: "Transactions", type: "int" },
                      ], salesModes, `Sales_By_Mode_${from}_to_${to}`)}><FiDownload size={12} /></button>
                    </div>
                    <div className="g-card-body">
                      {salesModes.length === 0 ? (
                        <div style={{ textAlign: "center", padding: 20, color: C.textSub, fontSize: 13 }}>No data</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {salesModes.map((m) => (
                            <div key={m.mode} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div style={{ width: 70, fontSize: 13, fontWeight: 600, color: C.text }}>{m.mode}</div>
                              <div style={{ flex: 1 }}>
                                <HBar value={m.total} max={ac.sales_total_received || 1} color={modeColors[m.mode] || C.brand} />
                              </div>
                              <div style={{ width: 100, textAlign: "right", fontSize: 14, fontWeight: 700, color: C.text }}>₹{fmt2(m.total)}</div>
                              <div style={{ width: 40, textAlign: "right", fontSize: 11, color: C.textSub }}>{m.txn_count}</div>
                            </div>
                          ))}
                          <div style={{ borderTop: "1.5px solid #f1f5f9", paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800 }}>
                            <span>Total</span>
                            <span style={{ color: C.green }}>₹{fmt2(ac.sales_total_received)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Purchase by mode */}
                  <div className="g-card">
                    <div className="g-card-head">
                      <div className="g-card-title"><FiArrowUp size={14} style={{ color: C.orange }} /> Purchase Paid by Mode</div>
                      <button className="g-btn ghost sm" onClick={() => downloadExcel([
                        { key: "mode", label: "Payment Mode" },
                        { key: "total", label: "Amount", type: "number" },
                        { key: "txn_count", label: "Transactions", type: "int" },
                      ], purchaseModes, `Purchase_By_Mode_${from}_to_${to}`)}><FiDownload size={12} /></button>
                    </div>
                    <div className="g-card-body">
                      {purchaseModes.length === 0 ? (
                        <div style={{ textAlign: "center", padding: 20, color: C.textSub, fontSize: 13 }}>No data</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {purchaseModes.map((m) => (
                            <div key={m.mode} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div style={{ width: 70, fontSize: 13, fontWeight: 600, color: C.text }}>{m.mode}</div>
                              <div style={{ flex: 1 }}>
                                <HBar value={m.total} max={ac.purchase_total_paid || 1} color={modeColors[m.mode] || C.brand} />
                              </div>
                              <div style={{ width: 100, textAlign: "right", fontSize: 14, fontWeight: 700, color: C.text }}>₹{fmt2(m.total)}</div>
                              <div style={{ width: 40, textAlign: "right", fontSize: 11, color: C.textSub }}>{m.txn_count}</div>
                            </div>
                          ))}
                          <div style={{ borderTop: "1.5px solid #f1f5f9", paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800 }}>
                            <span>Total</span>
                            <span style={{ color: C.orange }}>₹{fmt2(ac.purchase_total_paid)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Outstanding */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
                  <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, textTransform: "uppercase", marginBottom: 6 }}>Sales Outstanding (to collect)</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: ac.sales_outstanding > 0 ? C.orange : C.green }}>₹{fmt2(ac.sales_outstanding)}</div>
                  </div>
                  <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, textTransform: "uppercase", marginBottom: 6 }}>Purchase Outstanding (to pay)</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: ac.purchase_outstanding > 0 ? C.red : C.green }}>₹{fmt2(ac.purchase_outstanding)}</div>
                  </div>
                </div>

                {/* Daily cash flow chart */}
                {daily.length > 0 && (
                  <div className="g-card">
                    <div className="g-card-head">
                      <div className="g-card-title"><FiBarChart2 size={14} style={{ color: C.brand }} /> Daily Cash Flow</div>
                      <button className="g-btn ghost sm" onClick={() => downloadExcel([
                        { key: "date", label: "Date" },
                        { key: "sales_received", label: "Sales Received", type: "number" },
                        { key: "purchase_paid", label: "Purchase Paid", type: "number" },
                        { key: "net", label: "Net Flow", type: "number" },
                      ], daily, `Daily_CashFlow_${from}_to_${to}`)}><FiDownload size={12} /></button>
                    </div>
                    <div className="g-card-body" style={{ overflowX: "auto" }}>
                      <table className="g-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th style={{ textAlign: "right" }}>Sales Received</th>
                            <th style={{ textAlign: "right" }}>Purchase Paid</th>
                            <th style={{ textAlign: "right" }}>Net Flow</th>
                          </tr>
                        </thead>
                        <tbody>
                          {daily.map((d) => (
                            <tr key={d.date}>
                              <td>{d.date}</td>
                              <td style={{ textAlign: "right", fontWeight: 600, color: C.green }}>₹{fmt2(d.sales_received)}</td>
                              <td style={{ textAlign: "right", fontWeight: 600, color: C.orange }}>₹{fmt2(d.purchase_paid)}</td>
                              <td style={{ textAlign: "right", fontWeight: 700, color: d.net >= 0 ? C.green : C.red }}>₹{fmt2(d.net)}</td>
                            </tr>
                          ))}
                          <tr style={{ background: "#f1f5f9", fontWeight: 800 }}>
                            <td>TOTAL</td>
                            <td style={{ textAlign: "right", color: C.green }}>₹{fmt2(daily.reduce((s, d) => s + d.sales_received, 0))}</td>
                            <td style={{ textAlign: "right", color: C.orange }}>₹{fmt2(daily.reduce((s, d) => s + d.purchase_paid, 0))}</td>
                            <td style={{ textAlign: "right", color: netFlow >= 0 ? C.green : C.red }}>₹{fmt2(netFlow)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}

      {/* ── MODAL: Upgrade — Remove non-GST items ── */}
      <Modal show={showUpgrade} title="Upgrade — Remove Non-GST Items from Sales" onClose={() => setShowUpgrade(false)} width={560}
        footer={<>
          <button className="g-btn ghost" onClick={() => setShowUpgrade(false)} disabled={upgrading}>Cancel</button>
          <button className="g-btn" style={{ background: C.red, color: "#fff", height: 38, padding: "0 18px", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer" }}
            onClick={confirmUpgrade} disabled={upgrading || (!upgradeStats?.sales_items_to_remove && !upgradeStats?.purchase_items_to_reduce && !upgradeStats?.purchase_items_to_delete)}>
            {upgrading ? "Processing…" : "Confirm Upgrade"}
          </button>
        </>}>
        {upgradeStats && (
          <div>
            {upgradeStats.sales_items_to_remove === 0 && upgradeStats.purchase_items_to_reduce === 0 && upgradeStats.purchase_items_to_delete === 0 ? (
              <div style={{ padding: "24px 0", textAlign: "center", color: C.textSub, fontSize: 15 }}>
                No non-GST items found. Nothing to upgrade.
              </div>
            ) : (
              <>
                <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 9, padding: "12px 16px", marginBottom: 18, fontSize: 13, color: "#991b1b" }}>
                  This will permanently remove all non-GST items from sales invoices and purchase bills <strong>between {upgradeStats.from} and {upgradeStats.to}</strong>, adjust totals, and clean up inventory. This action <strong>cannot be undone</strong>.
                </div>

                {/* Sales stats */}
                {upgradeStats.sales_items_to_remove > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>Sales Invoices</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                      {[
                        { label: "Items", value: upgradeStats.sales_items_to_remove, color: C.red },
                        { label: "Amount", value: `₹${fmt2(upgradeStats.sales_total_amount)}`, color: C.red },
                        { label: "Adjust", value: upgradeStats.sales_invoices_to_adjust, color: C.orange },
                        { label: "Delete", value: upgradeStats.sales_invoices_to_delete, color: C.red },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", padding: "10px 12px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
                          <div style={{ fontSize: 17, fontWeight: 800, color }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Purchase stats */}
                {(upgradeStats.purchase_items_to_reduce > 0 || upgradeStats.purchase_items_to_delete > 0) && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>Purchase Bills</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                      {[
                        { label: "Qty Reduced", value: upgradeStats.purchase_items_to_reduce, color: C.orange },
                        { label: "Items Removed", value: upgradeStats.purchase_items_to_delete, color: C.red },
                        { label: "Amount", value: `₹${fmt2(upgradeStats.purchase_amount_reduced)}`, color: C.red },
                        { label: "Bills Affected", value: upgradeStats.purchase_affected_bills, color: C.orange },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", padding: "10px 12px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
                          <div style={{ fontSize: 17, fontWeight: 800, color }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.6 }}>
                  <strong>What will happen:</strong>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                    {upgradeStats.sales_items_to_remove > 0 && <>
                      <li>{upgradeStats.sales_items_to_remove} non-GST item(s) removed from {upgradeStats.sales_affected_invoices} sale invoice(s)</li>
                      {upgradeStats.sales_invoices_to_adjust > 0 && <li>{upgradeStats.sales_invoices_to_adjust} invoice(s) recalculated</li>}
                      {upgradeStats.sales_invoices_to_delete > 0 && <li>{upgradeStats.sales_invoices_to_delete} invoice(s) deleted (had only non-GST items)</li>}
                    </>}
                    {(upgradeStats.purchase_items_to_reduce > 0 || upgradeStats.purchase_items_to_delete > 0) && <>
                      {upgradeStats.purchase_items_to_reduce > 0 && <li>{upgradeStats.purchase_items_to_reduce} purchase item(s) will have qty reduced (only sold qty deducted)</li>}
                      {upgradeStats.purchase_items_to_delete > 0 && <li>{upgradeStats.purchase_items_to_delete} purchase item(s) fully consumed — will be removed from bills</li>}
                      <li>{upgradeStats.purchase_affected_bills} purchase bill(s) will be recalculated (empty bills deleted)</li>
                    </>}
                    <li>Inventory adjusted to match</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
