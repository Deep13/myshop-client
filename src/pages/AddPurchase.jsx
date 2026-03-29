import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiTrash2, FiX, FiCheck, FiPlus, FiTruck, FiSearch, FiPackage, FiCreditCard, FiUpload } from "react-icons/fi";
import * as XLSX from "xlsx";
import { C, GLOBAL_CSS, API, Field, Modal, asNum, todayISO, fmt2 } from "../ui.jsx";

/* ── helpers ── */
const blankRow = () => ({ itemId: 0, itemName: "", code: "", hsn: "", batchNo: "", expDate: "", mrp: "", qty: "", purchasePrice: "", salePrice: "", discount: "", tax: "", amount: "" });
const blankNewItem = () => ({ itemName: "", itemCode: "", hsn: "", mrp: "", salePrice: "", purchasePrice: "", tax: "", is_primary: true });
const PAY_MODES = ["Cash", "UPI", "Card", "Bank", "Cheque", "Other"];

function calcRowAmt(row) {
  return asNum(row.qty) * asNum(row.purchasePrice);
}

function SectionHead({ num, title, icon, actions }) {
  return (
    <div style={{ padding: "12px 18px", borderBottom: "1.5px solid #e5e7eb", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{num}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ color: C.brand }}>{icon}</span>
          <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{title}</span>
        </div>
      </div>
      {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
    </div>
  );
}

export default function AddPurchase() {
  const [sp] = useSearchParams();
  const purchaseId = sp.get("purchaseId");
  const isEdit = Boolean(purchaseId);

  /* item master — loaded from DB */
  const [itemMaster, setItemMaster] = useState([]);
  const [masterLoaded, setMasterLoaded] = useState(false);

  /* distributor */
  const [selDist, setSelDist] = useState(null);
  const [distQ, setDistQ] = useState("");
  const [distSug, setDistSug] = useState([]);
  const [showDistSug, setShowDistSug] = useState(false);
  const [gstin, setGstin] = useState("");
  const distRef = useRef(null);

  /* bill info */
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(todayISO());
  const [billType, setBillType] = useState("GST"); // GST | NON-GST
  const isGST = billType === "GST";
  const [gstMode, setGstMode] = useState("exclusive"); // "inclusive" | "exclusive"

  /* rows */
  const [rows, setRows] = useState([blankRow(), blankRow()]);
  const itemRefs = useRef({});
  const batchRefs = useRef({});
  const [activeSug, setActiveSug] = useState(null);
  const [itemSearch, setItemSearch] = useState({}); // per-row search text

  /* payment */
  const [multiPay, setMultiPay] = useState(false);
  const [payMode, setPayMode] = useState("Cash");
  const [received, setReceived] = useState("0");
  const [recTouched, setRecTouched] = useState(false);
  const [payments, setPayments] = useState([{ type: "Cash", amount: "" }]);

  /* round off */
  const [roundOff, setRoundOff] = useState(true);

  /* upload / import */
  const [showMapping, setShowMapping] = useState(false);
  const [uploadHeaders, setUploadHeaders] = useState([]);
  const [uploadRows, setUploadRows] = useState([]);
  const [colMap, setColMap] = useState({});
  const [uploadFile, setUploadFile] = useState(null);
  const fileInputRef = useRef(null);

  /* ui */
  const [saving, setSaving] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemForRow, setAddItemForRow] = useState(null); // track which row triggered "Add to Master"
  const [showAddDist, setShowAddDist] = useState(false);
  const [newDist, setNewDist] = useState({ name: "", gstin: "", phone: "" });
  const [newItem, setNewItem] = useState(blankNewItem());
  const [showPriceWarning, setShowPriceWarning] = useState(false);
  const [priceWarnings, setPriceWarnings] = useState([]);
  const [pendingSaveData, setPendingSaveData] = useState(null);

  /* ── Load item master from DB ── */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/get_items_all.php?limit=500`);
        const j = await r.json();
        if (j.status === "success") { setItemMaster(j.data || []); setMasterLoaded(true); }
      } catch { setMasterLoaded(true); }
    })();
  }, []);

  /* ── Load for edit ── */
  useEffect(() => {
    if (!purchaseId || !masterLoaded) return;
    (async () => {
      try {
        const r = await fetch(`${API}/get_purchase.php?id=${purchaseId}`);
        const j = await r.json();
        if (!r.ok || j.status !== "success") throw new Error(j.message);
        const h = j.header;
        setSelDist({ id: h.distributor_id, name: h.distributor_name, gstin: h.distributor_gstin });
        setDistQ(`${h.distributor_name}${h.distributor_gstin ? ` (${h.distributor_gstin})` : ""}`);
        setGstin(h.distributor_gstin || "");
        setBillNo(h.bill_no); setBillDate(h.bill_date); setDueDate(h.due_date || "");
        setBillType(h.bill_type || "GST");
        setGstMode(h.gst_mode || "exclusive");
        setRows(j.items.map((r) => ({
          itemId: asNum(r.item_id), itemName: r.item_name, code: r.item_code,
          hsn: r.hsn, batchNo: r.batch_no, expDate: r.exp_date || "",
          mrp: r.mrp, qty: r.qty, purchasePrice: r.purchase_price,
          salePrice: r.sale_price, discount: r.discount, tax: r.tax, amount: r.amount,
        })));
        setRoundOff(Boolean(h.round_off_enabled));
        if (j.payments?.length) setPayments(j.payments.map((p) => ({ type: p.mode, amount: String(p.amount) })));
      } catch (e) { alert(e.message || "Failed to load"); }
    })();
  }, [purchaseId, masterLoaded]);

  /* ── Item search filtering ── */
  const getSug = (text) => {
    const q = String(text || "").trim().toLowerCase();
    if (!q) return [];
    return itemMaster.filter((it) => it.name.toLowerCase().includes(q) || it.code.toLowerCase().includes(q) || (it.hsn || "").includes(q)).slice(0, 10);
  };

  const updRow = (i, patch) => setRows((prev) => {
    const n = [...prev];
    const u = { ...n[i], ...patch };
    u.amount = calcRowAmt(u).toFixed(2);
    n[i] = u;
    return n;
  });

  /* Recalculate amounts when billType changes */
  useEffect(() => {
    setRows((prev) => prev.map((r) => ({ ...r, amount: calcRowAmt(r).toFixed(2) })));
  }, [isGST]);

  const pickItem = (ri, item) => {
    setActiveSug(null);
    setItemSearch((p) => ({ ...p, [ri]: "" }));
    setRows((prev) => {
      // Check if this item already exists in another filled row
      const existingIdx = prev.findIndex((r, i) => i !== ri && r.itemId === item.id && String(r.itemName || "").trim());
      if (existingIdx >= 0) {
        // Increment qty of existing row instead of filling a new one
        const n = [...prev];
        const existing = { ...n[existingIdx] };
        existing.qty = String(asNum(existing.qty) + 1);
        existing.amount = calcRowAmt(existing).toFixed(2);
        n[existingIdx] = existing;
        // Clear the current row search
        n[ri] = blankRow();
        return n;
      }
      // No duplicate — fill the current row
      const fill = {
        itemId: item.id, itemName: item.name, code: item.code,
        hsn: item.hsn || "", mrp: item.mrp ?? "", salePrice: item.salePrice ?? "",
        purchasePrice: item.purchasePrice ?? "", tax: item.tax ?? "", qty: 1, discount: "",
      };
      const n = [...prev];
      n[ri] = { ...n[ri], ...fill };
      n[ri].amount = calcRowAmt(n[ri]).toFixed(2);
      if (ri === n.length - 1) n.push(blankRow());
      return n;
    });
    setTimeout(() => batchRefs.current[ri]?.focus(), 0);
  };

  /* close sug on outside click */
  useEffect(() => { const c = () => setActiveSug(null); document.addEventListener("click", c); return () => document.removeEventListener("click", c); }, []);

  /* ── Distributor search ── */
  useEffect(() => { const c = (e) => { if (!distRef.current?.contains(e.target)) setShowDistSug(false); }; document.addEventListener("mousedown", c); return () => document.removeEventListener("mousedown", c); }, []);
  useEffect(() => {
    const q = distQ.trim(); if (!q) { setDistSug([]); return; }
    const t = setTimeout(async () => {
      try { const r = await fetch(`${API}/get_distributors.php?q=${encodeURIComponent(q)}&limit=8`); const j = await r.json().catch(() => ({})); setDistSug(r.ok && j.status === "success" ? (j.data || []) : []); } catch { setDistSug([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [distQ]);

  const pickDist = (d) => { setSelDist(d); setGstin(d.gstin || ""); setDistQ(`${d.name}${d.gstin ? ` (${d.gstin})` : ""}`); setShowDistSug(false); };

  /* ── Totals ── */
  const subTotal = useMemo(() => rows.reduce((a, r) => a + asNum(r.amount), 0), [rows]);
  const taxTotal = useMemo(() => {
    if (!isGST) return 0;
    if (gstMode === "inclusive") {
      // Tax is already inside the purchase price, extract it: tax = amount * rate / (100 + rate)
      return rows.reduce((a, r) => {
        const rate = asNum(r.tax);
        return a + (rate > 0 ? asNum(r.amount) * rate / (100 + rate) : 0);
      }, 0);
    }
    // Exclusive: tax is added on top
    return rows.reduce((a, r) => a + (asNum(r.amount) * asNum(r.tax)) / 100, 0);
  }, [rows, isGST, gstMode]);
  // For inclusive: grand total = subTotal (tax is already inside), for exclusive: grand total = subTotal + tax on top
  const grandTotal = useMemo(() => gstMode === "inclusive" ? subTotal : subTotal + taxTotal, [subTotal, taxTotal, gstMode]);
  const roundedTotal = useMemo(() => roundOff ? Math.ceil(grandTotal) : grandTotal, [grandTotal, roundOff]);
  const roundDiff = useMemo(() => roundedTotal - grandTotal, [roundedTotal, grandTotal]);
  const sumPay = useMemo(() => payments.reduce((a, p) => a + asNum(p.amount), 0), [payments]);
  const totalPaid = useMemo(() => multiPay ? sumPay : asNum(received), [multiPay, sumPay, received]);
  const balance = useMemo(() => roundedTotal - totalPaid, [roundedTotal, totalPaid]);
  useEffect(() => { if (!multiPay && !recTouched) setReceived(roundedTotal.toFixed(2)); }, [roundedTotal, multiPay, recTouched]);

  /* ── Save distributor ── */
  const saveDist = async () => {
    const name = newDist.name.trim(); if (!name) return alert("Name required");
    const r = await fetch(`${API}/add_distributor.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, gstin: newDist.gstin.trim(), phone: newDist.phone.trim() }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.status !== "success") return alert(j.message || "Failed");
    pickDist(j.data); setShowAddDist(false);
  };

  /* ── Save item to master ── */
  const saveNewItem = async () => {
    const name = newItem.itemName.trim(), code = newItem.itemCode.trim();
    if (!name) return alert("Item name required");
    if (!code) return alert("Item code required");
    try {
      const r = await fetch(`${API}/add_item.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, code, hsn: newItem.hsn.trim(), mrp: asNum(newItem.mrp), salePrice: asNum(newItem.salePrice), purchasePrice: asNum(newItem.purchasePrice), tax: asNum(newItem.tax), is_primary: !!newItem.is_primary }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Failed");
      const created = j.data;
      setItemMaster((p) => [created, ...p]);
      // Auto-select the newly created item in the row that triggered "Add to Master"
      if (addItemForRow !== null) {
        pickItem(addItemForRow, created);
        setAddItemForRow(null);
      }
      setShowAddItem(false);
      setNewItem(blankNewItem());
    } catch (e) { alert(e.message || "Failed"); }
  };

  /* ── Upload bill file ── */
  const OUR_COLS = [
    { key: "itemName", label: "Item Name", required: true },
    { key: "code", label: "Item Code" },
    { key: "hsn", label: "HSN" },
    { key: "batchNo", label: "Batch No" },
    { key: "expDate", label: "Expiry Date" },
    { key: "mrp", label: "MRP" },
    { key: "qty", label: "Qty", required: true },
    { key: "purchasePrice", label: "Purchase Price", required: true },
    { key: "salePrice", label: "Sale Price" },
    { key: "tax", label: "Tax %" },
  ];

  const DIST_DETECT_KEYS = ["distributor", "supplier", "vendor", "party", "company", "firm"];
  const GSTIN_PATTERN = /\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}/;

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    const ext = file.name.split(".").pop().toLowerCase();

    if (["xlsx", "xls", "csv"].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const wb = XLSX.read(ev.target.result, { type: "array", cellDates: true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
          if (json.length < 2) return alert("File appears empty or has no data rows.");

          const headers = json[0].map((h) => String(h).trim());
          const dataRows = json.slice(1).filter((r) => r.some((c) => String(c).trim()));
          setUploadHeaders(headers);
          setUploadRows(dataRows);

          // Auto-detect column mapping
          const autoMap = {};
          const lowerHeaders = headers.map((h) => h.toLowerCase());
          const matchers = [
            { key: "itemName", patterns: ["item", "product", "name", "description", "particular", "medicine"] },
            { key: "code", patterns: ["code", "sku", "item code", "product code"] },
            { key: "hsn", patterns: ["hsn", "sac", "hsn/sac"] },
            { key: "batchNo", patterns: ["batch", "lot", "batch no"] },
            { key: "expDate", patterns: ["exp", "expiry", "expiry date", "exp date", "best before"] },
            { key: "mrp", patterns: ["mrp", "m.r.p", "max retail"] },
            { key: "qty", patterns: ["qty", "quantity", "pcs", "nos", "units"] },
            { key: "purchasePrice", patterns: ["rate", "price", "purchase", "cost", "buy", "purchase price", "unit price"] },
            { key: "salePrice", patterns: ["sale", "sell", "selling", "sale price", "selling price", "sp"] },
            { key: "tax", patterns: ["tax", "gst", "gst%", "tax%", "tax rate", "gst rate"] },
          ];
          for (const m of matchers) {
            const idx = lowerHeaders.findIndex((h) => m.patterns.some((p) => h === p || h.includes(p)));
            if (idx >= 0) autoMap[m.key] = idx;
          }
          setColMap(autoMap);

          // Try to detect distributor from file metadata or first rows
          tryDetectDistributor(json, headers);

          setShowMapping(true);
        } catch (err) {
          alert("Failed to parse file: " + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Image/PDF — just upload for reference, show alert
      uploadFileToServer(file);
    }
    e.target.value = "";
  };

  const tryDetectDistributor = (json, headers) => {
    // Look for GSTIN pattern or distributor name in the first few rows
    const searchArea = json.slice(0, 5).flat().map((c) => String(c));
    for (const cell of searchArea) {
      const gstMatch = cell.match(GSTIN_PATTERN);
      if (gstMatch) {
        // Try to find distributor by GSTIN
        (async () => {
          try {
            const r = await fetch(`${API}/get_distributors.php?q=${encodeURIComponent(gstMatch[0])}&limit=1`);
            const j = await r.json().catch(() => ({}));
            if (j.status === "success" && j.data?.length) pickDist(j.data[0]);
          } catch {}
        })();
        return;
      }
    }
  };

  const uploadFileToServer = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch(`${API}/upload_bill.php`, { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (j.status !== "success") alert(j.message || "Upload failed");
    } catch { alert("Upload failed"); }
  };

  const applyMapping = () => {
    // Validate required columns are mapped
    const missing = OUR_COLS.filter((c) => c.required && colMap[c.key] === undefined);
    if (missing.length) return alert(`Please map: ${missing.map((c) => c.label).join(", ")}`);

    const newRows = uploadRows.map((row) => {
      const r = blankRow();
      for (const col of OUR_COLS) {
        if (colMap[col.key] !== undefined) {
          let val = row[colMap[col.key]];
          if (val instanceof Date) val = val.toISOString().slice(0, 10);
          else val = String(val ?? "").trim();
          r[col.key] = val;
        }
      }
      // Try to match item from master by name or code
      const nameL = (r.itemName || "").toLowerCase();
      const codeL = (r.code || "").toLowerCase();
      const match = itemMaster.find((it) =>
        it.code.toLowerCase() === codeL ||
        it.name.toLowerCase() === nameL ||
        it.name.toLowerCase().includes(nameL) ||
        nameL.includes(it.name.toLowerCase())
      );
      if (match) {
        r.itemId = match.id;
        r.itemName = match.name;
        r.code = match.code;
        r.hsn = r.hsn || match.hsn || "";
        r.mrp = r.mrp || String(match.mrp || "");
        r.salePrice = r.salePrice || String(match.salePrice || "");
        r.purchasePrice = r.purchasePrice || String(match.purchasePrice || "");
        r.tax = r.tax || String(match.tax || "");
      }
      r.amount = calcRowAmt(r).toFixed(2);
      return r;
    }).filter((r) => r.itemName);

    if (!newRows.length) return alert("No valid rows found after mapping.");
    setRows([...newRows, blankRow()]);
    setShowMapping(false);
    // Upload file for reference
    if (uploadFile) uploadFileToServer(uploadFile);
  };

  /* ── Build save payload ── */
  const buildSavePayload = () => {
    if (!selDist) { alert("Please select a distributor"); return null; }
    if (!billNo.trim()) { alert("Bill number is required"); return null; }
    const cleanRows = rows.map((r) => ({
      itemName: String(r.itemName || "").trim(), code: String(r.code || "").trim(),
      hsn: String(r.hsn || "").trim(), batchNo: String(r.batchNo || "").trim(),
      expDate: r.expDate || "", mrp: asNum(r.mrp), qty: asNum(r.qty),
      purchasePrice: asNum(r.purchasePrice), salePrice: asNum(r.salePrice),
      discount: String(r.discount || "").trim(), tax: isGST ? asNum(r.tax) : 0,
      amount: asNum(r.amount),
    })).filter((r) => r.itemName && r.qty > 0);
    if (!cleanRows.length) { alert("Add at least one item"); return null; }
    for (const r of cleanRows) {
      if (!itemMaster.some((it) => it.code === r.code)) { alert(`Item "${r.itemName}" not in item master. Please select from suggestions.`); return null; }
    }
    const payList = multiPay ? payments.map((p) => ({ type: p.type, amount: asNum(p.amount) })).filter((p) => p.amount > 0) : [{ type: payMode, amount: asNum(received) }];
    const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();
    const totals = { subTotal: asNum(subTotal), taxTotal: asNum(taxTotal), grandTotal: asNum(grandTotal), roundOffEnabled: roundOff, roundOffDiff: asNum(roundDiff), roundedGrandTotal: asNum(roundedTotal) };
    const base = { distributorId: selDist.id, distributorName: selDist.name, gstin: gstin.trim(), billNo: billNo.trim(), billDate, dueDate, billType, gstMode: isGST ? gstMode : "exclusive", rows: cleanRows, totals, payments: payList, user };
    return base;
  };

  /* ── Actually persist the purchase ── */
  const doSave = async (payload) => {
    const { user, ...base } = payload;
    try {
      setSaving(true);
      if (isEdit) {
        const r = await fetch(`${API}/update_purchase.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...base, purchaseId: Number(purchaseId), updatedBy: user?.id || 1 }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.status !== "success") throw new Error(j.message || "Update failed");
        alert("Purchase Updated!"); window.location.href = "/purchase";
      } else {
        const r = await fetch(`${API}/save_purchase.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...base, createdBy: user?.id || 1 }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.status !== "success") throw new Error(j.message || "Save failed");
        const newId = j.purchaseId;
        for (const p of base.payments) {
          if (!p.amount || p.amount <= 0) continue;
          await fetch(`${API}/add_purchase_payment.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ distributorId: selDist.id, purchaseId: newId, payDate: billDate, mode: p.type, amount: p.amount, referenceNo: "", note: "" }) });
        }
        alert("Purchase Saved!"); window.location.href = "/purchase";
      }
    } catch (e) { alert(e.message || "Failed"); } finally { setSaving(false); }
  };

  /* ── Main save — check for cheaper past purchases first ── */
  const onSave = async () => {
    const payload = buildSavePayload();
    if (!payload) return;

    // For new purchases, check if any items were bought cheaper before
    if (!isEdit) {
      try {
        const res = await fetch(`${API}/check_purchase_prices.php`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: payload.rows }),
        });
        const j = await res.json().catch(() => ({}));
        if (j.status === "success" && j.data?.length > 0) {
          setPriceWarnings(j.data);
          setPendingSaveData(payload);
          setShowPriceWarning(true);
          return; // Don't save yet — show warning first
        }
      } catch { /* proceed with save if check fails */ }
    }

    await doSave(payload);
  };

  // Ctrl+S shortcut
  useEffect(() => {
    const fn = () => { if (!saving) onSave(); };
    window.addEventListener("shortcut-save", fn);
    return () => window.removeEventListener("shortcut-save", fn);
  }, [saving, onSave]);

  const filledCount = rows.filter((r) => String(r.itemName || "").trim()).length;

  /* ══════════════════════════════ RENDER ══════════════════════════════ */
  return (
    <div id="g-root" style={{ padding: "18px 24px", background: C.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* PAGE HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: C.brand, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", boxShadow: `0 3px 10px rgba(3,76,157,0.3)` }}>
            <FiTruck size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.text }}>{isEdit ? "Edit Purchase Bill" : "New Purchase Entry"}</h2>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: C.textSub }}>{isEdit ? `Bill #${purchaseId}` : "Fill all steps and save"}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* GST / NON-GST toggle — prominent */}
          <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 9, padding: 3, gap: 3 }}>
            {["GST", "NON-GST"].map((t) => (
              <button key={t} onClick={() => setBillType(t)} style={{ padding: "6px 18px", borderRadius: 7, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.15s", background: billType === t ? (t === "GST" ? C.brand : "#374151") : "transparent", color: billType === t ? "#fff" : C.textSub }}>
                {t}
              </button>
            ))}
          </div>
          {/* Inclusive / Exclusive toggle — only when GST */}
          {isGST && (
            <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 9, padding: 3, gap: 3 }}>
              {[{ k: "exclusive", l: "Exclusive" }, { k: "inclusive", l: "Inclusive" }].map(({ k, l }) => (
                <button key={k} onClick={() => setGstMode(k)} style={{ padding: "6px 14px", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s", background: gstMode === k ? "#059669" : "transparent", color: gstMode === k ? "#fff" : C.textSub }}>
                  {l}
                </button>
              ))}
            </div>
          )}
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={handleFileUpload} />
          <button className="g-btn ghost" onClick={() => fileInputRef.current?.click()} title="Upload Excel/PDF/Image of purchase bill">
            <FiUpload size={14} /> Upload Bill
          </button>
          <button className="g-btn ghost" onClick={() => window.history.back()}>← Back</button>
          <button className="g-btn success" onClick={onSave} disabled={saving} style={{ minWidth: 130 }}>
            <FiCheck size={14} />{saving ? "Saving…" : isEdit ? "Update" : "Save Purchase"}
          </button>
        </div>
      </div>

      {/* ── STEP 1: SUPPLIER ── */}
      <div className="g-card" style={{ marginBottom: 18 }}>
        <SectionHead num="1" icon={<FiTruck size={15} />} title="Supplier Details" />
        <div style={{ padding: 18 }}>
          <div className="g-grid-2">
            {/* Distributor search */}
            <div className="g-span-2">
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <Field label="Distributor / Supplier" required style={{ flex: 1 }}>
                  <div ref={distRef} style={{ position: "relative" }}>
                    <FiSearch size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textSub, pointerEvents: "none" }} />
                    <input className="g-inp" style={{ paddingLeft: 36 }} value={distQ}
                      onChange={(e) => { setSelDist(null); setDistQ(e.target.value); setShowDistSug(true); }}
                      onFocus={() => setShowDistSug(true)}
                      onBlur={() => setTimeout(() => { if (!selDist) { setDistQ(""); setGstin(""); } }, 160)}
                      placeholder="Search by name or GSTIN…" />
                    {showDistSug && distSug.length > 0 && (
                      <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50, background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,0.1)", maxHeight: 240, overflow: "auto" }}>
                        {distSug.map((d) => (
                          <div key={d.id} className="g-sug" onMouseDown={() => pickDist(d)} style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{d.name}</div>
                            <div style={{ fontSize: 12, color: C.textSub, marginTop: 1 }}>GSTIN: {d.gstin || "—"}{d.phone ? ` · ${d.phone}` : ""}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>
                <button className="g-btn ghost" style={{ height: 40, marginBottom: 0 }} onClick={() => { setNewDist({ name: "", gstin: "", phone: "" }); setShowAddDist(true); }}>
                  <FiPlus size={14} /> New Distributor
                </button>
              </div>
              {selDist && (
                <div style={{ marginTop: 10, background: C.brandLighter, border: `1.5px solid #bfdbfe`, borderRadius: 9, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: C.brand, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}><FiTruck size={16} /></div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.brand }}>{selDist.name}</div>
                    {gstin && <div style={{ fontSize: 12, color: "#1e40af", marginTop: 1 }}>GSTIN: {gstin}</div>}
                  </div>
                  <div style={{ marginLeft: "auto", fontSize: 12, color: C.green, fontWeight: 700 }}>✓ Selected</div>
                </div>
              )}
            </div>

            <Field label="GSTIN (auto-filled)">
              <input className="g-inp" value={gstin} disabled placeholder="Auto-filled" />
            </Field>
            <Field label="Bill / Invoice No" required>
              <input className="g-inp" value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="e.g. INV-2025-001" />
            </Field>
            <Field label="Bill Date" required>
              <input className="g-inp" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
            </Field>
            <Field label="Due Date">
              <input className="g-inp" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>
        </div>
      </div>

      {/* ── STEP 2: ITEMS ── */}
      <div className="g-card" style={{ marginBottom: 18 }}>
        <SectionHead
          num="2"
          icon={<FiPackage size={15} />}
          title={`Items / Medicines${filledCount > 0 ? ` — ${filledCount} added` : ""}${!isGST ? "  [NON-GST — Tax not applied]" : ""}`}
          actions={
            <button className="g-btn ghost sm" onClick={() => { setNewItem(blankNewItem()); setAddItemForRow(null); setShowAddItem(true); }}>
              <FiPlus size={13} /> Add to Master
            </button>
          }
        />
        {!masterLoaded && <div style={{ padding: "12px 18px", fontSize: 13, color: C.textSub }}>Loading item master…</div>}
        <div>
          <table className="g-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 36, paddingLeft: 14 }}>#</th>
                <th style={{ minWidth: 210 }}>Item Name</th>
                <th style={{ minWidth: 95 }}>Batch No</th>
                <th style={{ minWidth: 128 }}>Expiry Date</th>
                <th style={{ minWidth: 72 }}>MRP ₹</th>
                <th style={{ minWidth: 55 }}>Qty</th>
                <th style={{ minWidth: 98 }}>Buy Price ₹</th>
                <th style={{ minWidth: 90 }}>Sale Price ₹</th>
                {isGST && <th style={{ minWidth: 62 }}>Tax %</th>}
                <th style={{ minWidth: 98, textAlign: "right", paddingRight: 14 }}>Amount ₹</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const searchText = itemSearch[idx] !== undefined ? itemSearch[idx] : r.itemName;
                const sug = getSug(searchText);
                const filled = r.itemName.trim();
                return (
                  <tr key={idx}>
                    <td style={{ paddingLeft: 12 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: filled ? C.brandLighter : "#f3f4f6", color: filled ? C.brand : C.textSub, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{idx + 1}</div>
                    </td>

                    {/* Item name — search + pick only */}
                    <td style={{ position: "relative" }}>
                      {filled ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 6px" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.itemName}</div>
                            <div style={{ fontSize: 11, color: C.textSub }}>{r.code}</div>
                          </div>
                          <button onClick={() => { updRow(idx, { ...blankRow() }); setItemSearch((p) => ({ ...p, [idx]: "" })); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, padding: 3, borderRadius: 4, display: "flex" }}>
                            <FiX size={13} />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ position: "relative" }}>
                            <FiSearch size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: C.textLight, pointerEvents: "none" }} />
                            <input
                              ref={(el) => (itemRefs.current[idx] = el)}
                              className="g-td-inp"
                              style={{ paddingLeft: 26 }}
                              value={searchText}
                              onChange={(e) => {
                                const val = e.target.value;
                                setItemSearch((p) => ({ ...p, [idx]: val }));
                                setActiveSug(idx);
                                // Auto-select if exactly one item matches the typed code
                                const q = val.trim().toLowerCase();
                                if (q) {
                                  const exact = itemMaster.filter((it) =>
                                    it.code.toLowerCase() === q || it.name.toLowerCase() === q
                                  );
                                  if (exact.length === 1) pickItem(idx, exact[0]);
                                }
                              }}
                              onFocus={() => setActiveSug(idx)}
                              placeholder={idx === 0 ? "Search item…" : ""}
                              autoComplete="off"
                            />
                          </div>
                          {activeSug === idx && sug.length > 0 && (
                            <div onMouseDown={(e) => e.stopPropagation()} style={{ position: "absolute", top: "100%", left: 0, width: 340, zIndex: 30, background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: 220, overflow: "auto" }}>
                              {sug.map((it) => (
                                <div key={it.id} className="g-sug" onMouseDown={() => pickItem(idx, it)} style={{ padding: "9px 14px", borderBottom: "1px solid #f3f4f6" }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{it.name} <span style={{ color: C.textSub, fontWeight: 500 }}>({it.code})</span></div>
                                  <div style={{ fontSize: 11, color: C.textSub, marginTop: 1 }}>MRP: ₹{it.mrp} · Buy: ₹{it.purchasePrice} · Tax: {it.tax}%</div>
                                </div>
                              ))}
                            </div>
                          )}
                          {activeSug === idx && String(searchText || "").trim().length > 0 && sug.length === 0 && (
                            <div style={{ position: "absolute", top: "100%", left: 0, width: 280, zIndex: 30, background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", padding: "10px 14px" }}>
                              <div style={{ fontSize: 12, color: C.textSub }}>No item found.</div>
                              <button className="g-btn ghost sm" style={{ marginTop: 8 }} onClick={() => { const code = String(itemSearch[idx] || "").trim(); setNewItem({ ...blankNewItem(), itemCode: code }); setAddItemForRow(idx); setShowAddItem(true); }}><FiPlus size={12} /> Add to Master</button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td><input className="g-td-inp" ref={(el) => (batchRefs.current[idx] = el)} value={r.batchNo} onChange={(e) => updRow(idx, { batchNo: e.target.value })} placeholder="Batch" /></td>
                    <td><input className="g-td-inp" type="date" value={r.expDate} onChange={(e) => updRow(idx, { expDate: e.target.value })} style={{ fontSize: 13 }} /></td>
                    <td><input className="g-td-inp" value={r.mrp} onChange={(e) => updRow(idx, { mrp: e.target.value })} inputMode="decimal" placeholder="0" /></td>
                    <td><input className="g-td-inp" value={r.qty} onChange={(e) => updRow(idx, { qty: e.target.value })} inputMode="numeric" placeholder="0" style={{ textAlign: "center" }} /></td>
                    <td><input className="g-td-inp" value={r.purchasePrice} onChange={(e) => updRow(idx, { purchasePrice: e.target.value })} inputMode="decimal" placeholder="0" /></td>
                    <td><input className="g-td-inp" value={r.salePrice} onChange={(e) => updRow(idx, { salePrice: e.target.value })} inputMode="decimal" placeholder="0" /></td>
                    {isGST && <td><input className="g-td-inp" value={r.tax} onChange={(e) => updRow(idx, { tax: e.target.value })} inputMode="decimal" placeholder="0" /></td>}
                    <td style={{ textAlign: "right", paddingRight: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: filled ? C.text : "#d1d5db" }}>
                        {filled ? `₹${fmt2(r.amount)}` : "—"}
                      </span>
                    </td>
                    <td style={{ paddingRight: 8 }}>
                      <button onClick={() => { if (rows.length > 1) setRows((p) => p.filter((_, i) => i !== idx)); }} disabled={rows.length <= 1}
                        style={{ background: "none", border: "none", cursor: rows.length <= 1 ? "not-allowed" : "pointer", color: "#d1d5db", padding: 6, borderRadius: 6, display: "flex", transition: "color 0.15s" }}
                        onMouseEnter={(e) => { if (rows.length > 1) e.currentTarget.style.color = C.red; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "#d1d5db"; }}>
                        <FiTrash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 18px" }}>
          <button className="g-btn ghost sm" onClick={() => setRows((p) => [...p, blankRow()])}>
            <FiPlus size={13} /> Add Row
          </button>
        </div>
      </div>

      {/* ── STEP 3: PAYMENT + SUMMARY ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 18, alignItems: "start" }}>

        {/* Payment */}
        <div className="g-card" style={{ marginBottom: 0 }}>
          <SectionHead num="3" icon={<FiCreditCard size={15} />} title="Payment"
            actions={
              <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: 3, gap: 3 }}>
                {["Single", "Multiple"].map((m) => {
                  const active = (m === "Multiple") === multiPay;
                  return (
                    <button key={m} onClick={() => { setMultiPay(m === "Multiple"); if (m === "Single") { setRecTouched(false); setPayments([{ type: "Cash", amount: "" }]); } }}
                      style={{ padding: "4px 12px", borderRadius: 6, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.15s", background: active ? C.brand : "transparent", color: active ? "#fff" : C.textSub }}>
                      {m}
                    </button>
                  );
                })}
              </div>
            }
          />
          <div style={{ padding: 18 }}>
            {!multiPay ? (
              <div style={{ display: "grid", gridTemplateColumns: "200px 1fr auto", gap: 14, alignItems: "end" }}>
                <Field label="Mode">
                  <select className="g-sel" value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                    {PAY_MODES.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Amount Paid (₹)">
                  <input className="g-inp" value={received} onChange={(e) => { setRecTouched(true); setReceived(e.target.value); }} inputMode="decimal" placeholder="0.00" />
                </Field>
                <div style={{ paddingBottom: 2, textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: C.textSub, fontWeight: 700, marginBottom: 4 }}>Balance</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: balance <= 0 ? C.green : C.orange }}>₹{fmt2(balance)}</div>
                </div>
              </div>
            ) : (
              <div>
                {payments.map((p, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "180px 1fr 38px", gap: 12, alignItems: "end", marginBottom: 12 }}>
                    <Field label={i === 0 ? "Mode" : ""}>
                      <select className="g-sel" value={p.type} onChange={(e) => setPayments((prev) => { const n = [...prev]; n[i] = { ...n[i], type: e.target.value }; return n; })}>
                        {PAY_MODES.map((m) => <option key={m}>{m}</option>)}
                      </select>
                    </Field>
                    <Field label={i === 0 ? "Amount (₹)" : ""}>
                      <input className="g-inp" value={p.amount} onChange={(e) => setPayments((prev) => { const n = [...prev]; n[i] = { ...n[i], amount: e.target.value }; return n; })} inputMode="decimal" placeholder="0.00" />
                    </Field>
                    <div style={{ paddingBottom: 2 }}>
                      {payments.length > 1 && <button className="g-btn danger sm" onClick={() => setPayments((p) => p.filter((_, j) => j !== i))}><FiX size={13} /></button>}
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1.5px solid #f3f4f6", marginTop: 4 }}>
                  <button className="g-btn ghost sm" onClick={() => setPayments((p) => [...p, { type: "Cash", amount: "" }])}><FiPlus size={13} /> Add Line</button>
                  <div style={{ display: "flex", gap: 24 }}>
                    {[{ l: "Paid", v: fmt2(sumPay), c: C.text }, { l: "Balance", v: fmt2(balance), c: balance <= 0 ? C.green : C.orange }].map(({ l, v, c }) => (
                      <div key={l} style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, color: C.textSub, fontWeight: 700 }}>{l}</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: c }}>₹{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="g-card" style={{ marginBottom: 0 }}>
          <div className="g-card-head"><div className="g-card-title">Summary</div></div>
          <div className="g-card-body">
            {[
              ...(isGST && gstMode === "inclusive"
                ? [{ l: "Total (Tax Inclusive)", v: `₹${fmt2(subTotal)}` }, { l: "Tax (included)", v: `₹${fmt2(taxTotal)}` }]
                : [{ l: "Subtotal", v: `₹${fmt2(subTotal)}` }, ...(isGST ? [{ l: "Tax Total", v: `₹${fmt2(taxTotal)}` }] : [])]
              ),
            ].map(({ l, v }) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: C.textSub, marginBottom: 10 }}>
                <span>{l}</span><span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1.5px solid #e5e7eb" }}>
              <label htmlFor="roundchk" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.text }}>
                <input type="checkbox" id="roundchk" checked={roundOff} onChange={(e) => setRoundOff(e.target.checked)} style={{ width: 16, height: 16, accentColor: C.brand }} />
                Round off
              </label>
              <span style={{ fontSize: 13, fontWeight: 700, color: roundOff ? C.green : C.textSub }}>{roundOff ? `+₹${fmt2(roundDiff)}` : "Off"}</span>
            </div>

            <div style={{ background: C.brand, borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, boxShadow: `0 3px 10px rgba(3,76,157,0.25)` }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>Grand Total</span>
              <span style={{ fontWeight: 900, fontSize: 22, color: "#fff" }}>₹{fmt2(roundedTotal)}</span>
            </div>

            <button className="g-btn success lg" onClick={onSave} disabled={saving}>
              <FiCheck size={16} />{saving ? "Saving…" : isEdit ? "Update Purchase" : "Save Purchase"}
            </button>

            {/* Bill type indicator */}
            <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: isGST ? C.brandLighter : "#f3f4f6", border: `1.5px solid ${isGST ? "#bfdbfe" : "#e5e7eb"}`, fontSize: 13, fontWeight: 700, color: isGST ? C.brand : "#374151", textAlign: "center" }}>
              {isGST ? `GST Bill (${gstMode === "inclusive" ? "Tax Inclusive" : "Tax Exclusive"})` : "NON-GST Bill"}
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL: ADD DISTRIBUTOR ── */}
      <Modal show={showAddDist} title="Add New Distributor" onClose={() => setShowAddDist(false)}
        footer={<><button className="g-btn ghost" onClick={() => setShowAddDist(false)}>Cancel</button><button className="g-btn primary" onClick={saveDist}>Save</button></>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Distributor Name" required hint="Full name of the company or person">
            <input className="g-inp lg" value={newDist.name} onChange={(e) => setNewDist((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. ABC Pharma" />
          </Field>
          <Field label="GSTIN" hint="Optional"><input className="g-inp lg" value={newDist.gstin} onChange={(e) => setNewDist((p) => ({ ...p, gstin: e.target.value }))} placeholder="Optional" /></Field>
          <Field label="Phone" hint="Optional"><input className="g-inp lg" value={newDist.phone} onChange={(e) => setNewDist((p) => ({ ...p, phone: e.target.value }))} placeholder="Optional" type="tel" /></Field>
        </div>
      </Modal>

      {/* ── MODAL: ADD ITEM TO MASTER ── */}
      <Modal show={showAddItem} title="Add Item to Master" onClose={() => setShowAddItem(false)} width={580}
        footer={<><button className="g-btn ghost" onClick={() => setShowAddItem(false)}>Cancel</button><button className="g-btn primary" onClick={saveNewItem}>Save Item</button></>}>
        <div className="g-grid-2">
          <div className="g-span-2">
            <Field label="Item / Medicine Name" required>
              <input className="g-inp lg" value={newItem.itemName} onChange={(e) => setNewItem((p) => ({ ...p, itemName: e.target.value }))} placeholder="e.g. Paracetamol 500mg" />
            </Field>
          </div>
          <Field label="Item Code" required hint="Short unique code">
            <input className="g-inp lg" value={newItem.itemCode} onChange={(e) => setNewItem((p) => ({ ...p, itemCode: e.target.value }))} placeholder="e.g. PCM500" />
          </Field>
          <Field label="HSN Code" hint="For GST">
            <input className="g-inp lg" value={newItem.hsn} onChange={(e) => setNewItem((p) => ({ ...p, hsn: e.target.value }))} placeholder="Optional" />
          </Field>
          <Field label="MRP (₹)"><input className="g-inp lg" value={newItem.mrp} onChange={(e) => setNewItem((p) => ({ ...p, mrp: e.target.value }))} inputMode="decimal" placeholder="0.00" /></Field>
          <Field label="Sale Price (₹)"><input className="g-inp lg" value={newItem.salePrice} onChange={(e) => setNewItem((p) => ({ ...p, salePrice: e.target.value }))} inputMode="decimal" placeholder="0.00" /></Field>
          <Field label="Purchase Price (₹)"><input className="g-inp lg" value={newItem.purchasePrice} onChange={(e) => setNewItem((p) => ({ ...p, purchasePrice: e.target.value }))} inputMode="decimal" placeholder="0.00" /></Field>
          <Field label="Tax %"><input className="g-inp lg" value={newItem.tax} onChange={(e) => setNewItem((p) => ({ ...p, tax: e.target.value }))} inputMode="decimal" placeholder="e.g. 12" /></Field>
        </div>
      </Modal>

      {/* ── MODAL: COLUMN MAPPING ── */}
      <Modal show={showMapping} title="Map Columns from Uploaded Bill" onClose={() => setShowMapping(false)} width={720}
        footer={<>
          <button className="g-btn ghost" onClick={() => setShowMapping(false)}>Cancel</button>
          <button className="g-btn primary" onClick={applyMapping}><FiCheck size={14} /> Apply & Import</button>
        </>}>
        <div>
          <p style={{ fontSize: 13, color: C.textSub, marginTop: 0, marginBottom: 14 }}>
            Map your file columns to our fields. Required fields are marked with *.
          </p>

          {/* Mapping selects */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            {OUR_COLS.map((col) => (
              <div key={col.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text, minWidth: 120 }}>
                  {col.label}{col.required ? <span style={{ color: C.red }}> *</span> : ""}
                </span>
                <select className="g-sel sm" style={{ flex: 1 }} value={colMap[col.key] ?? ""} onChange={(e) => {
                  const v = e.target.value;
                  setColMap((p) => {
                    const n = { ...p };
                    if (v === "") delete n[col.key];
                    else n[col.key] = Number(v);
                    return n;
                  });
                }}>
                  <option value="">— Skip —</option>
                  {uploadHeaders.map((h, i) => (
                    <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Preview */}
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, marginBottom: 6, textTransform: "uppercase" }}>
            Preview ({Math.min(uploadRows.length, 5)} of {uploadRows.length} rows)
          </div>
          <div style={{ overflowX: "auto", border: "1.5px solid #e5e7eb", borderRadius: 8, maxHeight: 220 }}>
            <table className="g-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  {OUR_COLS.filter((c) => colMap[c.key] !== undefined).map((c) => (
                    <th key={c.key} style={{ whiteSpace: "nowrap", fontSize: 11 }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uploadRows.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    {OUR_COLS.filter((c) => colMap[c.key] !== undefined).map((c) => {
                      let val = row[colMap[c.key]];
                      if (val instanceof Date) val = val.toISOString().slice(0, 10);
                      return <td key={c.key} style={{ whiteSpace: "nowrap" }}>{String(val ?? "")}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: C.brandLighter, border: "1.5px solid #bfdbfe", fontSize: 12, color: C.brand }}>
            Items will be auto-matched with your item master by name/code. Unmatched items will show as-is for manual selection.
          </div>
        </div>
      </Modal>

      {/* ── MODAL: PRICE WARNING ── */}
      <Modal show={showPriceWarning} title="Price & MRP Alert" onClose={() => setShowPriceWarning(false)} width={720}
        footer={<>
          <button className="g-btn ghost" onClick={() => setShowPriceWarning(false)}>Go Back & Edit</button>
          <button className="g-btn success" onClick={async () => { setShowPriceWarning(false); if (pendingSaveData) await doSave(pendingSaveData); }}>
            <FiCheck size={14} /> Save Anyway
          </button>
        </>}>
        <div>
          <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 9, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#9a3412" }}>
            Review the following price/MRP changes before saving.
          </div>
          {priceWarnings.map((w, i) => (
            <div key={i} style={{ marginBottom: 16, border: `1.5px solid ${C.borderLight}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.borderLight}` }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{w.item_name}</span>
                  <span style={{ fontSize: 12, color: C.textSub, marginLeft: 8 }}>({w.item_code})</span>
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 13, fontWeight: 700 }}>
                  {w.current_price > 0 && <span>Price: <span style={{ color: C.red }}>₹{w.current_price.toFixed(2)}</span></span>}
                  {w.current_mrp > 0 && <span>MRP: <span style={{ color: C.brand }}>₹{w.current_mrp.toFixed(2)}</span></span>}
                </div>
              </div>

              {/* Cheaper purchase history */}
              {w.cheaper_purchases?.length > 0 && (
                <div>
                  <div style={{ padding: "8px 16px", fontSize: 12, fontWeight: 700, color: C.orange, background: "#fff7ed" }}>
                    Bought cheaper before
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#fafbfc" }}>
                        {["Past Price", "Qty", "Distributor", "Bill No", "Date"].map((h) => (
                          <th key={h} style={{ padding: "7px 12px", fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #f1f5f9" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {w.cheaper_purchases.map((p, j) => (
                        <tr key={j} style={{ borderBottom: "1px solid #f9fafb" }}>
                          <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 700, color: C.green }}>₹{p.purchase_price.toFixed(2)}</td>
                          <td style={{ padding: "8px 12px", fontSize: 13 }}>{p.qty}</td>
                          <td style={{ padding: "8px 12px", fontSize: 13 }}>{p.distributor_name}</td>
                          <td style={{ padding: "8px 12px", fontSize: 12, color: C.textSub }}>{p.bill_no}</td>
                          <td style={{ padding: "8px 12px", fontSize: 12, color: C.textSub }}>{p.bill_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* MRP change history */}
              {w.mrp_changes?.length > 0 && (
                <div>
                  <div style={{ padding: "8px 16px", fontSize: 12, fontWeight: 700, color: C.brand, background: "#eff6ff" }}>
                    MRP was different before
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#fafbfc" }}>
                        {["Past MRP", "Price", "Distributor", "Bill No", "Date"].map((h) => (
                          <th key={h} style={{ padding: "7px 12px", fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #f1f5f9" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {w.mrp_changes.map((m, j) => (
                        <tr key={j} style={{ borderBottom: "1px solid #f9fafb" }}>
                          <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 700, color: m.mrp < w.current_mrp ? C.green : C.red }}>₹{m.mrp.toFixed(2)}</td>
                          <td style={{ padding: "8px 12px", fontSize: 13 }}>₹{m.purchase_price.toFixed(2)}</td>
                          <td style={{ padding: "8px 12px", fontSize: 13 }}>{m.distributor_name}</td>
                          <td style={{ padding: "8px 12px", fontSize: 12, color: C.textSub }}>{m.bill_no}</td>
                          <td style={{ padding: "8px 12px", fontSize: 12, color: C.textSub }}>{m.bill_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
