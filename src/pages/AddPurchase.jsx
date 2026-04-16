import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiTrash2, FiX, FiCheck, FiPlus, FiTruck, FiSearch, FiPackage, FiCreditCard, FiUpload } from "react-icons/fi";
import * as XLSX from "xlsx";
import { C, GLOBAL_CSS, API, Field, Modal, asNum, todayISO, fmt2, fmtDate } from "../ui.jsx";
import DateInput from "../comps/DateInput.jsx";
import usePageMeta from "../usePageMeta.js";
import toast from "../toast.js";

/* ── helpers ── */
const blankRow = () => ({ itemId: 0, itemName: "", code: "", hsn: "", batchNo: "", expDate: "", mrp: "", qty: "", freeQty: "", purchasePrice: "", salePrice: "", discount: "", tax: "", amount: "" });
const blankNewItem = () => ({ itemName: "", itemCode: "", hsn: "", mrp: "", salePrice: "", purchasePrice: "", tax: "", is_primary: true });
const PAY_MODES = ["Cash", "UPI", "Card", "Bank", "Cheque", "Other"];
const user = (() => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
})();

function parseDiscount(val, price) {
  const s = String(val || "").trim();
  if (!s) return 0;
  if (s.endsWith("%")) { const pct = parseFloat(s) || 0; return price * pct / 100; }
  return parseFloat(s) || 0;
}

function calcRowAmt(row) {
  const price = asNum(row.purchasePrice);
  const disc = parseDiscount(row.discount, price);
  return asNum(row.qty) * (price - disc);
}

function SectionHead({ num, title, icon, actions }) {
  return (
    <div style={{ padding: "12px 18px", borderBottom: "1.5px solid #e5e7eb", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: C.brand,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {num}
        </div>
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
  usePageMeta(isEdit ? "Edit Purchase" : "New Purchase", "Create or edit a purchase bill");

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
  const [highlightIdx, setHighlightIdx] = useState(-1);
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
        const r = await fetch(`${API}/get_items_all.php?limit=10000`);
        const j = await r.json();
        if (j.status === "success") {
          setItemMaster(j.data || []);
          setMasterLoaded(true);
        }
      } catch {
        setMasterLoaded(true);
      }
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
        setBillNo(h.bill_no);
        setBillDate(h.bill_date);
        setDueDate(h.due_date || "");
        setBillType(h.bill_type || "GST");
        setGstMode(h.gst_mode || "exclusive");
        setRows(
          j.items.map((r) => ({
            itemId: asNum(r.item_id),
            itemName: r.item_name,
            code: r.item_code,
            hsn: r.hsn,
            batchNo: r.batch_no,
            expDate: r.exp_date || "",
            mrp: r.mrp,
            qty: r.qty,
            freeQty: r.free_qty || "",
            purchasePrice: r.purchase_price,
            salePrice: r.sale_price,
            discount: r.discount,
            tax: r.tax,
            amount: r.amount,
          })),
        );
        setRoundOff(Boolean(h.round_off_enabled));
        if (j.payments?.length) setPayments(j.payments.map((p) => ({ type: p.mode, amount: String(p.amount) })));
      } catch (e) {
        toast(e.message || "Failed to load", "error");
      }
    })();
  }, [purchaseId, masterLoaded]);

  /* ── Item search filtering ── */
  const getSug = (text) => {
    const q = String(text || "")
      .trim()
      .toLowerCase();
    if (!q) return [];
    return itemMaster.filter((it) => it.name.toLowerCase().includes(q) || it.code.toLowerCase().includes(q) || (it.hsn || "").includes(q)).slice(0, 10);
  };

  const updRow = (i, patch) =>
    setRows((prev) => {
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
      // Always fill the current row — allow same item with different batch
      const fill = {
        itemId: item.id,
        itemName: item.name,
        code: item.code,
        hsn: item.hsn || "",
        mrp: item.mrp ?? "",
        salePrice: item.salePrice ?? "",
        purchasePrice: item.purchasePrice ?? "",
        tax: item.tax ?? "",
        qty: 1,
        discount: "",
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
  useEffect(() => {
    const c = () => setActiveSug(null);
    document.addEventListener("click", c);
    return () => document.removeEventListener("click", c);
  }, []);

  /* ── Distributor search ── */
  useEffect(() => {
    const c = (e) => {
      if (!distRef.current?.contains(e.target)) setShowDistSug(false);
    };
    document.addEventListener("mousedown", c);
    return () => document.removeEventListener("mousedown", c);
  }, []);
  useEffect(() => {
    const q = distQ.trim();
    if (!q) {
      setDistSug([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/get_distributors.php?q=${encodeURIComponent(q)}&limit=8`);
        const j = await r.json().catch(() => ({}));
        setDistSug(r.ok && j.status === "success" ? j.data || [] : []);
      } catch {
        setDistSug([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [distQ]);

  const pickDist = (d) => {
    setSelDist(d);
    setGstin(d.gstin || "");
    setDistQ(`${d.name}${d.gstin ? ` (${d.gstin})` : ""}`);
    setShowDistSug(false);
  };

  /* ── Totals ── */
  const subTotal = useMemo(() => rows.reduce((a, r) => a + asNum(r.amount), 0), [rows]);
  const taxTotal = useMemo(() => {
    if (!isGST) return 0;
    if (gstMode === "inclusive") {
      // Tax is already inside the purchase price, extract it: tax = amount * rate / (100 + rate)
      return rows.reduce((a, r) => {
        const rate = asNum(r.tax);
        return a + (rate > 0 ? (asNum(r.amount) * rate) / (100 + rate) : 0);
      }, 0);
    }
    // Exclusive: tax is added on top
    return rows.reduce((a, r) => a + (asNum(r.amount) * asNum(r.tax)) / 100, 0);
  }, [rows, isGST, gstMode]);
  // For inclusive: grand total = subTotal (tax is already inside), for exclusive: grand total = subTotal + tax on top
  const grandTotal = useMemo(() => (gstMode === "inclusive" ? subTotal : subTotal + taxTotal), [subTotal, taxTotal, gstMode]);
  const roundedTotal = useMemo(() => (roundOff ? Math.round(grandTotal) : grandTotal), [grandTotal, roundOff]);
  const roundDiff = useMemo(() => roundedTotal - grandTotal, [roundedTotal, grandTotal]);
  const sumPay = useMemo(() => payments.reduce((a, p) => a + asNum(p.amount), 0), [payments]);
  const totalPaid = useMemo(() => (multiPay ? sumPay : asNum(received)), [multiPay, sumPay, received]);
  const balance = useMemo(() => roundedTotal - totalPaid, [roundedTotal, totalPaid]);
  useEffect(() => {
    if (!multiPay && !recTouched) setReceived(roundedTotal.toFixed(2));
  }, [roundedTotal, multiPay, recTouched]);

  /* ── Save distributor ── */
  const saveDist = async () => {
    const name = newDist.name.trim();
    if (!name) return toast("Name required", "warn");
    const r = await fetch(`${API}/add_distributor.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, gstin: newDist.gstin.trim(), phone: newDist.phone.trim(), createdBy: user?.id || 1 }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.status !== "success") return toast(j.message || "Failed", "error");
    pickDist(j.data);
    setShowAddDist(false);
  };

  /* ── Save item to master ── */
  const saveNewItem = async () => {
    const name = newItem.itemName.trim(),
      code = newItem.itemCode.trim();
    if (!name) return toast("Item name required", "warn");
    if (!code) return toast("Item code required", "warn");
    try {
      const r = await fetch(`${API}/add_item.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code,
          hsn: newItem.hsn.trim(),
          mrp: asNum(newItem.mrp),
          salePrice: asNum(newItem.salePrice),
          purchasePrice: asNum(newItem.purchasePrice),
          tax: asNum(newItem.tax),
          is_primary: !!newItem.is_primary,
          createdBy: user?.id || 1,
        }),
      });
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
    } catch (e) {
      toast(e.message || "Failed", "error");
    }
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
    { key: "freeQty", label: "Free Qty" },
    { key: "purchasePrice", label: "Purchase Price", required: true },
    { key: "discount", label: "Discount %" },
    { key: "salePrice", label: "Sale Price" },
    { key: "tax", label: "Tax / GST %" },
    { key: "cgst", label: "CGST %", virtual: true },
    { key: "sgst", label: "SGST %", virtual: true },
  ];

  const DIST_DETECT_KEYS = ["distributor", "supplier", "vendor", "party", "company", "firm"];
  const GSTIN_PATTERN = /\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}/;

  const COL_MATCHERS = [
    { key: "itemName", patterns: ["item", "product", "name", "description", "particular", "medicine"] },
    { key: "code", patterns: ["code", "sku", "item code", "product code"] },
    { key: "hsn", patterns: ["hsn", "sac", "hsn/sac"] },
    { key: "batchNo", patterns: ["batch", "lot", "batch no"] },
    { key: "expDate", patterns: ["exp", "expiry", "expiry date", "exp date", "best before"] },
    { key: "mrp", patterns: ["mrp", "m.r.p", "max retail"] },
    { key: "qty", patterns: ["qty", "quantity", "pcs", "nos", "units"] },
    { key: "purchasePrice", patterns: ["rate", "price", "purchase", "cost", "buy", "purchase price", "unit price", "ptr"] },
    { key: "discount", patterns: ["disc", "discount", "dis%", "disc%", "discount%"] },
    { key: "salePrice", patterns: ["sale", "sell", "selling", "sale price", "selling price", "sp"] },
    { key: "tax", patterns: ["tax", "gst", "gst%", "tax%", "tax rate", "gst rate", "igst"] },
    { key: "cgst", patterns: ["cgst", "cgst%", "c.gst", "central gst"] },
    { key: "sgst", patterns: ["sgst", "sgst%", "s.gst", "state gst"] },
  ];

  const autoDetectMapping = (headers) => {
    const autoMap = {};
    const lowerHeaders = headers.map((h) => h.toLowerCase());
    for (const m of COL_MATCHERS) {
      const idx = lowerHeaders.findIndex((h) => m.patterns.some((p) => h === p || h.includes(p)));
      if (idx >= 0) autoMap[m.key] = idx;
    }
    return autoMap;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    const ext = file.name.split(".").pop().toLowerCase();

    if (["xlsx", "xls", "csv"].includes(ext)) {
      // Excel/CSV: parse client-side
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const wb = XLSX.read(ev.target.result, { type: "array", cellDates: true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
          if (json.length < 2) return toast("File appears empty or has no data rows.", "warn");

          const headers = json[0].map((h) => String(h).trim());
          const dataRows = json.slice(1).filter((r) => r.some((c) => String(c).trim()));
          setUploadHeaders(headers);
          setUploadRows(dataRows);
          setColMap(autoDetectMapping(headers));
          tryDetectDistributor(json, headers);
          setShowMapping(true);
        } catch (err) {
          toast("Failed to parse file: " + err.message, "error");
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === "pdf") {
      // PDF: send to server for text extraction
      try {
        const fd = new FormData();
        fd.append("file", file);
        const r = await fetch(`${API}/parse_bill.php`, { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        if (j.status !== "success") {
          toast(j.message || "Failed to extract data from PDF", "error");
          return;
        }
        const headers = j.headers.map((h) => String(h).trim());
        setUploadHeaders(headers);
        setUploadRows(j.rows);
        setColMap(autoDetectMapping(headers));
        setShowMapping(true);
      } catch {
        toast("Failed to parse PDF. Please try Excel or CSV format.", "error");
      }
    } else if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
      // Images — upload for reference, can't auto-parse
      uploadFileToServer(file);
      toast("Image uploaded for reference. Please enter items manually, or re-upload as Excel/CSV/PDF for auto-import.", "info");
    } else {
      toast("Unsupported file type. Please upload Excel (.xlsx), CSV, PDF, or image files.", "warn");
    }
    e.target.value = "";
  };

  const tryDetectDistributor = (json, headers) => {
    // Look for GSTIN pattern or distributor name in the first few rows
    const searchArea = json
      .slice(0, 5)
      .flat()
      .map((c) => String(c));
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
      if (j.status !== "success") toast(j.message || "Upload failed", "error");
    } catch {
      toast("Upload failed", "error");
    }
  };

  /* Parse various date string formats to YYYY-MM-DD */
  const parseDate = (val) => {
    if (!val) return "";
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    let s = String(val).trim();
    if (!s) return "";
    // Already ISO: 2026-03-19
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // DDMMYYYY (8 digits): 19032026
    if (/^\d{8}$/.test(s)) {
      const d = s.slice(0, 2),
        m = s.slice(2, 4),
        y = s.slice(4, 8);
      return `${y}-${m}-${d}`;
    }
    // MMYYYY or MMYY (6 or 4 digits — month/year, assume last day): 032026, 0326
    if (/^\d{6}$/.test(s)) {
      const m = s.slice(0, 2),
        y = s.slice(2, 6);
      const last = new Date(Number(y), Number(m), 0).getDate();
      return `${y}-${m}-${String(last).padStart(2, "0")}`;
    }
    if (/^\d{4}$/.test(s) && Number(s.slice(0, 2)) <= 12) {
      const m = s.slice(0, 2),
        yy = s.slice(2, 4);
      const y = Number(yy) > 50 ? `19${yy}` : `20${yy}`;
      const last = new Date(Number(y), Number(m), 0).getDate();
      return `${y}-${m}-${String(last).padStart(2, "0")}`;
    }
    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const dmyFull = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (dmyFull) {
      const [, d, m, y] = dmyFull;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    // DD/MM/YY or DD-MM-YY
    const dmyShort = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/);
    if (dmyShort) {
      const [, d, m, yy] = dmyShort;
      const y = Number(yy) > 50 ? `19${yy}` : `20${yy}`;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    // MM/YYYY or MM-YYYY (month/year)
    const myFull = s.match(/^(\d{1,2})[/\-.](\d{4})$/);
    if (myFull) {
      const [, m, y] = myFull;
      const last = new Date(Number(y), Number(m), 0).getDate();
      return `${y}-${m.padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    }
    // Fallback: try native Date parse
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return s; // return as-is if nothing works
  };

  const applyMapping = () => {
    // Validate required columns are mapped
    const missing = OUR_COLS.filter((c) => c.required && colMap[c.key] === undefined);
    if (missing.length) return toast(`Please map: ${missing.map((c) => c.label).join(", ")}`, "warn");

    const newRows = uploadRows
      .map((row) => {
        const r = blankRow();
        // Temp fields for virtual columns
        let cgstVal = 0,
          sgstVal = 0,
          discVal = 0;
        for (const col of OUR_COLS) {
          if (colMap[col.key] !== undefined) {
            let val = row[colMap[col.key]];
            if (col.key === "expDate") {
              val = parseDate(val);
            } else if (val instanceof Date) {
              val = val.toISOString().slice(0, 10);
            } else {
              val = String(val ?? "").trim();
            }
            if (col.key === "cgst") {
              cgstVal = asNum(val);
              continue;
            }
            if (col.key === "sgst") {
              sgstVal = asNum(val);
              continue;
            }
            if (col.key === "discount") {
              discVal = asNum(val);
              r.discount = val;
              continue;
            }
            r[col.key] = val;
          }
        }

        // Combine CGST + SGST into tax if tax not already mapped
        if ((cgstVal > 0 || sgstVal > 0) && !asNum(r.tax)) {
          r.tax = String(cgstVal + sgstVal);
        }

        // Apply discount to purchase price if discount is mapped
        if (discVal > 0 && asNum(r.purchasePrice) > 0) {
          const price = asNum(r.purchasePrice);
          r.purchasePrice = fmt2(price - (price * discVal) / 100);
        }

        // Try to match item from master by name or code
        const nameL = (r.itemName || "").toLowerCase().trim();
        const codeL = (r.code || "").toLowerCase().trim();

        // Normalize: strip common suffixes/noise, split into words for fuzzy matching
        const normalize = (s) =>
          s
            .toLowerCase()
            .replace(/[^a-z0-9 ]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const billWords = normalize(nameL)
          .split(" ")
          .filter((w) => w.length > 1);

        // Score each master item: higher = better match
        let bestMatch = null,
          bestScore = 0;
        for (const it of itemMaster) {
          const masterName = normalize(it.name);
          const masterCode = it.code.toLowerCase().trim();

          // Exact code match — best possible
          if (codeL && masterCode === codeL) {
            bestMatch = it;
            bestScore = 100;
            break;
          }

          // Exact name match
          if (masterName === normalize(nameL)) {
            bestMatch = it;
            bestScore = 99;
            continue;
          }

          // Word-based matching: count how many bill words appear in master name
          if (billWords.length > 0) {
            const masterWords = masterName.split(" ");
            const matchedWords = billWords.filter((w) => masterWords.some((mw) => mw.includes(w) || w.includes(mw)));
            const score = (matchedWords.length / Math.max(billWords.length, masterWords.length)) * 90;
            if (score > bestScore && score >= 50) {
              bestScore = score;
              bestMatch = it;
            }
          }

          // Substring match (one contains the other)
          if (bestScore < 60) {
            if (masterName.includes(normalize(nameL)) || normalize(nameL).includes(masterName)) {
              if (60 > bestScore) {
                bestScore = 60;
                bestMatch = it;
              }
            }
          }
        }

        if (bestMatch) {
          r.itemId = bestMatch.id;
          r.itemName = bestMatch.name;
          r.code = bestMatch.code;
          r.hsn = r.hsn || bestMatch.hsn || "";
          r.mrp = r.mrp || String(bestMatch.mrp || "");
          r.salePrice = r.salePrice || String(bestMatch.salePrice || "");
          if (!asNum(r.purchasePrice)) r.purchasePrice = String(bestMatch.purchasePrice || "");
          r.tax = r.tax || String(bestMatch.tax || "");
        }
        r.amount = calcRowAmt(r).toFixed(2);
        return r;
      })
      .filter((r) => r.itemName);

    if (!newRows.length) return toast("No valid rows found after mapping.", "warn");
    setRows([...newRows, blankRow()]);
    setShowMapping(false);
    // Upload file for reference
    if (uploadFile) uploadFileToServer(uploadFile);
  };

  /* ── Build save payload ── */
  const buildSavePayload = () => {
    if (!selDist) {
      toast("Please select a distributor", "warn");
      return null;
    }
    if (!billNo.trim()) {
      toast("Bill number is required", "warn");
      return null;
    }
    const cleanRows = rows
      .map((r) => ({
        itemName: String(r.itemName || "").trim(),
        code: String(r.code || "").trim(),
        hsn: String(r.hsn || "").trim(),
        batchNo: String(r.batchNo || "").trim(),
        expDate: r.expDate || "",
        mrp: asNum(r.mrp),
        qty: asNum(r.qty),
        freeQty: asNum(r.freeQty),
        purchasePrice: asNum(r.purchasePrice),
        salePrice: asNum(r.salePrice),
        discount: String(r.discount || "").trim(),
        tax: isGST ? asNum(r.tax) : 0,
        amount: asNum(r.amount),
      }))
      .filter((r) => r.itemName && r.qty > 0);
    if (!cleanRows.length) {
      toast("Add at least one item", "warn");
      return null;
    }
    for (const r of cleanRows) {
      if (!itemMaster.some((it) => it.code === r.code)) {
        toast(`Item "${r.itemName}" not in item master. Please select from suggestions.`, "warn");
        return null;
      }
    }
    const payList = multiPay ? payments.map((p) => ({ type: p.type, amount: asNum(p.amount) })).filter((p) => p.amount > 0) : [{ type: payMode, amount: asNum(received) }];
    const totals = {
      subTotal: asNum(subTotal),
      taxTotal: asNum(taxTotal),
      grandTotal: asNum(grandTotal),
      roundOffEnabled: roundOff,
      roundOffDiff: asNum(roundDiff),
      roundedGrandTotal: asNum(roundedTotal),
    };
    const base = {
      distributorId: selDist.id,
      distributorName: selDist.name,
      gstin: gstin.trim(),
      billNo: billNo.trim(),
      billDate,
      dueDate,
      billType,
      gstMode: isGST ? gstMode : "exclusive",
      rows: cleanRows,
      totals,
      payments: payList,
    };
    return base;
  };

  /* ── Actually persist the purchase ── */
  const doSave = async (payload) => {
    const base = payload;
    try {
      setSaving(true);
      if (isEdit) {
        const r = await fetch(`${API}/update_purchase.php`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...base, purchaseId: Number(purchaseId), updatedBy: user?.id || 1 }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.status !== "success") throw new Error(j.message || "Update failed");
        toast("Purchase Updated!", "success");
        window.location.href = "/purchase";
      } else {
        const r = await fetch(`${API}/save_purchase.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...base, createdBy: user?.id || 1 }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.status !== "success") throw new Error(j.message || "Save failed");
        const newId = j.purchaseId;
        for (const p of base.payments) {
          if (!p.amount || p.amount <= 0) continue;
          await fetch(`${API}/add_purchase_payment.php`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ distributorId: selDist.id, purchaseId: newId, payDate: billDate, mode: p.type, amount: p.amount, referenceNo: "", note: "", createdBy: user?.id || 1 }),
          });
        }
        toast("Purchase Saved!", "success");
        window.location.href = "/purchase";
      }
    } catch (e) {
      toast(e.message || "Failed", "error");
    } finally {
      setSaving(false);
    }
  };

  /* ── Main save — check for cheaper past purchases first ── */
  const onSave = async () => {
    const payload = buildSavePayload();
    if (!payload) return;

    // For new purchases, check if any items were bought cheaper before
    if (!isEdit) {
      try {
        const res = await fetch(`${API}/check_purchase_prices.php`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: payload.rows }),
        });
        const j = await res.json().catch(() => ({}));
        if (j.status === "success" && j.data?.length > 0) {
          setPriceWarnings(j.data);
          setPendingSaveData(payload);
          setShowPriceWarning(true);
          return; // Don't save yet — show warning first
        }
      } catch {
        /* proceed with save if check fails */
      }
    }

    await doSave(payload);
  };

  // Ctrl+S shortcut
  useEffect(() => {
    const fn = () => {
      if (!saving) onSave();
    };
    window.addEventListener("shortcut-save", fn);
    return () => window.removeEventListener("shortcut-save", fn);
  }, [saving, onSave]);

  const filledCount = rows.filter((r) => String(r.itemName || "").trim()).length;

  /* ══════════════════════════════ RENDER ══════════════════════════════ */
  return (
    <div id="g-root" style={{ padding: "18px 24px", background: C.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── COMPACT HEADER BAR ── */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          marginBottom: 14,
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {/* Bill Date */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.brand, borderRadius: 9, padding: "6px 14px", color: "#fff" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.8, textTransform: "uppercase" }}>Bill Date</div>
            <DateInput
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              style={{ background: "none", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", outline: "none", padding: 0, cursor: "pointer", width: 120 }}
            />
          </div>
        </div>

        {/* Bill No */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 110 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>Bill No</span>
          <input className="g-inp sm" value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="INV-001" style={{ height: 30, fontSize: 13, fontWeight: 700 }} />
        </div>

        {/* Due Date */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 110 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>Due Date</span>
          <DateInput className="g-inp sm" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ height: 30, fontSize: 13 }} />
        </div>

        <div style={{ width: 1, height: 32, background: "#e5e7eb" }} />

        {/* Distributor */}
        <div ref={distRef} style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 180, position: "relative" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>Distributor</span>
          {selDist ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, height: 30 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: C.brand }}>{selDist.name}</span>
              {gstin && <span style={{ fontSize: 11, color: C.textSub }}>{gstin}</span>}
              <button
                onClick={() => {
                  setSelDist(null);
                  setDistQ("");
                  setGstin("");
                }}
                style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, padding: 2, display: "flex" }}
              >
                <FiX size={13} />
              </button>
            </div>
          ) : (
            <>
              <div style={{ position: "relative" }}>
                <FiSearch size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: C.textLight, pointerEvents: "none" }} />
                <input
                  className="g-inp sm"
                  style={{ height: 30, fontSize: 13, paddingLeft: 26 }}
                  value={distQ}
                  onChange={(e) => {
                    setSelDist(null);
                    setDistQ(e.target.value);
                    setShowDistSug(true);
                  }}
                  onFocus={() => setShowDistSug(true)}
                  onBlur={() =>
                    setTimeout(() => {
                      if (!selDist) {
                        setDistQ("");
                        setGstin("");
                      }
                    }, 160)
                  }
                  placeholder="Search distributor…"
                />
              </div>
              {showDistSug && distSug.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: "#fff",
                    border: `1.5px solid ${C.border}`,
                    borderRadius: 10,
                    boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
                    maxHeight: 240,
                    overflow: "auto",
                  }}
                >
                  {distSug.map((d) => (
                    <div key={d.id} className="g-sug" onMouseDown={() => pickDist(d)} style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{d.name}</div>
                      <div style={{ fontSize: 12, color: C.textSub, marginTop: 1 }}>
                        GSTIN: {d.gstin || "—"}
                        {d.phone ? ` · ${d.phone}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <button
          className="g-btn ghost sm"
          onClick={() => {
            setNewDist({ name: "", gstin: "", phone: "" });
            setShowAddDist(true);
          }}
        >
          <FiPlus size={13} />
        </button>

        <div style={{ width: 1, height: 32, background: "#e5e7eb" }} />

        {/* GST toggle */}
        <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 7, padding: 2, gap: 2 }}>
          {["GST", "NON-GST"].map((t) => (
            <button
              key={t}
              onClick={() => setBillType(t)}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                border: "none",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s",
                background: billType === t ? (t === "GST" ? C.brand : "#374151") : "transparent",
                color: billType === t ? "#fff" : C.textSub,
              }}
            >
              {t}
            </button>
          ))}
        </div>
        {isGST && (
          <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 7, padding: 2, gap: 2 }}>
            {[
              { k: "exclusive", l: "Excl" },
              { k: "inclusive", l: "Incl" },
            ].map(({ k, l }) => (
              <button
                key={k}
                onClick={() => setGstMode(k)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: gstMode === k ? "#059669" : "transparent",
                  color: gstMode === k ? "#fff" : C.textSub,
                }}
              >
                {l}
              </button>
            ))}
          </div>
        )}

        <div style={{ flex: "0 0 auto", display: "flex", gap: 8, alignItems: "center", marginLeft: "auto" }}>
          {/* <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={handleFileUpload} />
          <button className="g-btn ghost sm" onClick={() => fileInputRef.current?.click()} title="Import from Excel, CSV, PDF or upload image">
            <FiUpload size={14} />
          </button> */}
          <button className="g-btn success sm" onClick={onSave} disabled={saving} style={{ minWidth: 90 }}>
            <FiCheck size={14} />
            {saving ? "Saving…" : isEdit ? "Update" : "Save"}
          </button>
        </div>
      </div>

      {/* ── STEP 2: ITEMS ── */}
      <div className="g-card" style={{ marginBottom: 18 }}>
        <SectionHead
          num="2"
          icon={<FiPackage size={15} />}
          title={`Items / Medicines${filledCount > 0 ? ` — ${filledCount} added` : ""}${!isGST ? "  [NON-GST — Tax not applied]" : ""}`}
          actions={
            <button
              className="g-btn ghost sm"
              onClick={() => {
                setNewItem(blankNewItem());
                setAddItemForRow(null);
                setShowAddItem(true);
              }}
            >
              <FiPlus size={13} /> Add to Master
            </button>
          }
        />
        {!masterLoaded && <div style={{ padding: "12px 18px", fontSize: 13, color: C.textSub }}>Loading item master…</div>}
        <div>
          <table className="g-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 30, paddingLeft: 10 }}>#</th>
                <th style={{ minWidth: 320 }}>Item Name</th>
                <th style={{ minWidth: 100, textAlign: "right" }}>Batch</th>
                <th style={{ minWidth: 100, textAlign: "right" }}>Expiry</th>
                <th style={{ minWidth: 100, textAlign: "right" }}>MRP</th>
                <th style={{ minWidth: 70, textAlign: "right" }}>Qty</th>
                <th style={{ minWidth: 60, textAlign: "right" }}>Free</th>
                <th style={{ minWidth: 100, textAlign: "right" }}>Buy ₹</th>
                <th style={{ minWidth: 100, textAlign: "right" }}>Disc</th>
                <th style={{ minWidth: 100, textAlign: "right" }}>Sale ₹</th>
                {isGST && <th style={{ minWidth: 100, textAlign: "right" }}>Tax%</th>}
                <th style={{ minWidth: 100, textAlign: "right", paddingRight: 10 }}>Amount</th>
                <th style={{ width: 32 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const searchText = itemSearch[idx] !== undefined ? itemSearch[idx] : r.itemName;
                const sug = getSug(searchText);
                const filled = r.itemName.trim();
                return (
                  <tr key={idx}>
                    <td style={{ paddingLeft: 8 }}>
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: filled ? C.brandLighter : "#f3f4f6",
                          color: filled ? C.brand : C.textSub,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        {idx + 1}
                      </div>
                    </td>

                    {/* Item name — search + pick only */}
                    <td style={{ position: "relative" }}>
                      {filled ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 6px" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.itemName}</div>
                            <div style={{ fontSize: 11, color: C.textSub }}>{r.code}</div>
                          </div>
                          <button
                            onClick={() => {
                              updRow(idx, { ...blankRow() });
                              setItemSearch((p) => ({ ...p, [idx]: "" }));
                            }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, padding: 3, borderRadius: 4, display: "flex", flexShrink: 0 }}
                          >
                            <FiX size={13} />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ position: "relative" }}>
                            <FiSearch size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: C.textLight, pointerEvents: "none" }} />
                            <input
                              ref={(el) => (itemRefs.current[idx] = el)}
                              className="g-td-inp item-search"
                              value={searchText}
                              onChange={(e) => {
                                const val = e.target.value;
                                setItemSearch((p) => ({ ...p, [idx]: val }));
                                setActiveSug(idx);
                                setHighlightIdx(-1);
                                const q = val.trim().toLowerCase();
                                if (q) {
                                  const exact = itemMaster.filter((it) => it.code.toLowerCase() === q || it.name.toLowerCase() === q);
                                  if (exact.length === 1) pickItem(idx, exact[0]);
                                }
                              }}
                              onFocus={() => { setActiveSug(idx); setHighlightIdx(-1); }}
                              onKeyDown={(e) => {
                                if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIdx((h) => Math.min(h + 1, sug.length - 1)); }
                                else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIdx((h) => Math.max(h - 1, 0)); }
                                else if (e.key === "Enter" && highlightIdx >= 0 && sug[highlightIdx]) { e.preventDefault(); pickItem(idx, sug[highlightIdx]); setHighlightIdx(-1); }
                                else if (e.key === "Escape") { setActiveSug(null); setHighlightIdx(-1); }
                              }}
                              placeholder={idx === 0 ? "Search or scan code…" : ""}
                              autoComplete="off"
                            />
                          </div>
                          {/* Suggestions dropdown */}
                          {activeSug === idx && sug.length > 0 && (
                            <div
                              onMouseDown={(e) => e.stopPropagation()}
                              style={{
                                position: "absolute",
                                top: "100%",
                                left: 0,
                                width: 550,
                                zIndex: 30,
                                background: "#fff",
                                border: `1.5px solid ${C.border}`,
                                borderRadius: 12,
                                boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
                                maxHeight: 380,
                                overflow: "hidden",
                              }}
                            >
                              {/* Header row */}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 80px 60px", gap: 0, padding: "8px 16px", background: "#f1f5f9", borderBottom: "1.5px solid #e2e8f0" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>Item</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", textAlign: "right" }}>MRP</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", textAlign: "right" }}>Buy ₹</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", textAlign: "center" }}>Tax%</span>
                              </div>
                              <div style={{ maxHeight: 340, overflowY: "auto" }}>
                                {sug.map((it, si) => {
                                  const isHl = si === highlightIdx;
                                  return (
                                    <div
                                      key={it.id}
                                      onMouseDown={() => pickItem(idx, it)}
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 90px 80px 60px",
                                        gap: 0,
                                        padding: "10px 16px",
                                        cursor: "pointer",
                                        borderBottom: "1px solid #f3f4f6",
                                        background: isHl ? "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)" : "#fff",
                                        color: isHl ? "#fff" : C.text,
                                        transition: "background 0.1s",
                                      }}
                                      onMouseEnter={(e) => {
                                        if (!isHl) e.currentTarget.style.background = "#f0f9ff";
                                      }}
                                      onMouseLeave={(e) => {
                                        if (!isHl) e.currentTarget.style.background = "#fff";
                                      }}
                                    >
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: isHl ? "#fff" : C.text }}>
                                          {it.name}
                                        </div>
                                        <div style={{ fontSize: 11, marginTop: 1, color: isHl ? "rgba(255,255,255,0.75)" : C.textSub }}>
                                          {it.code}
                                          {it.hsn ? ` · HSN: ${it.hsn}` : ""}
                                        </div>
                                      </div>
                                      <div
                                        style={{
                                          fontSize: 13,
                                          fontWeight: 700,
                                          textAlign: "right",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "flex-end",
                                          color: isHl ? "#fff" : C.text,
                                        }}
                                      >
                                        ₹{it.mrp}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: 13,
                                          fontWeight: 600,
                                          textAlign: "right",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "flex-end",
                                          color: isHl ? "rgba(255,255,255,0.9)" : C.textSub,
                                        }}
                                      >
                                        ₹{it.purchasePrice}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: 13,
                                          fontWeight: 600,
                                          textAlign: "center",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          color: isHl ? "rgba(255,255,255,0.9)" : C.brand,
                                        }}
                                      >
                                        {it.tax}%
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {activeSug === idx && String(searchText || "").trim().length > 0 && sug.length === 0 && (
                            <div
                              style={{
                                position: "absolute",
                                top: "100%",
                                left: 0,
                                width: 300,
                                zIndex: 30,
                                background: "#fff",
                                border: `1.5px solid ${C.border}`,
                                borderRadius: 10,
                                boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                                padding: "14px 16px",
                              }}
                            >
                              <div style={{ fontSize: 13, color: C.textSub }}>No item found.</div>
                              <button
                                className="g-btn ghost sm"
                                style={{ marginTop: 8 }}
                                onClick={() => {
                                  const code = String(itemSearch[idx] || "").trim();
                                  setNewItem({ ...blankNewItem(), itemCode: code });
                                  setAddItemForRow(idx);
                                  setShowAddItem(true);
                                }}
                              >
                                <FiPlus size={12} /> Add to Master
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td>
                      <input
                        className="g-td-inp num"
                        ref={(el) => (batchRefs.current[idx] = el)}
                        value={r.batchNo}
                        onChange={(e) => updRow(idx, { batchNo: e.target.value })}
                        placeholder="Batch"
                        style={{ textAlign: "left" }}
                      />
                    </td>
                    <td>
                      <DateInput className="g-td-inp num" value={r.expDate} onChange={(e) => updRow(idx, { expDate: e.target.value })} style={{ fontSize: 11, textAlign: "left" }} />
                    </td>
                    <td>
                      <input className="g-td-inp num" value={r.mrp} onChange={(e) => updRow(idx, { mrp: e.target.value })} inputMode="decimal" placeholder="0" />
                    </td>
                    <td>
                      <input className="g-td-inp num" value={r.qty} onChange={(e) => updRow(idx, { qty: e.target.value })} inputMode="numeric" placeholder="0" style={{ textAlign: "center" }} />
                    </td>
                    <td>
                      <input className="g-td-inp num" value={r.freeQty} onChange={(e) => updRow(idx, { freeQty: e.target.value })} inputMode="numeric" placeholder="0" style={{ textAlign: "center" }} />
                    </td>
                    <td>
                      <input className="g-td-inp num" value={r.purchasePrice} onChange={(e) => updRow(idx, { purchasePrice: e.target.value })} inputMode="decimal" placeholder="0" />
                    </td>
                    <td>
                      <input className="g-td-inp num" value={r.discount} onChange={(e) => updRow(idx, { discount: e.target.value })} placeholder="0 or 10%" style={{ textAlign: "right" }} />
                    </td>
                    <td>
                      <input className="g-td-inp num" value={r.salePrice} onChange={(e) => updRow(idx, { salePrice: e.target.value })} inputMode="decimal" placeholder="0" />
                    </td>
                    {isGST && (
                      <td>
                        <input className="g-td-inp num" value={r.tax} onChange={(e) => updRow(idx, { tax: e.target.value })} inputMode="decimal" placeholder="0" style={{ textAlign: "center" }} />
                      </td>
                    )}
                    <td style={{ textAlign: "right", paddingRight: 10 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: filled ? C.text : "#d1d5db" }}>{filled ? `₹${fmt2(r.amount)}` : "—"}</span>
                    </td>
                    <td style={{ paddingRight: 6 }}>
                      <button
                        onClick={() => {
                          if (rows.length > 1) setRows((p) => p.filter((_, i) => i !== idx));
                        }}
                        disabled={rows.length <= 1}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: rows.length <= 1 ? "not-allowed" : "pointer",
                          color: "#d1d5db",
                          padding: 4,
                          borderRadius: 6,
                          display: "flex",
                          transition: "color 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          if (rows.length > 1) e.currentTarget.style.color = C.red;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "#d1d5db";
                        }}
                      >
                        <FiTrash2 size={13} />
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
          <SectionHead
            num="3"
            icon={<FiCreditCard size={15} />}
            title="Payment"
            actions={
              <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: 3, gap: 3 }}>
                {["Single", "Multiple"].map((m) => {
                  const active = (m === "Multiple") === multiPay;
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        setMultiPay(m === "Multiple");
                        if (m === "Single") {
                          setRecTouched(false);
                          setPayments([{ type: "Cash", amount: "" }]);
                        }
                      }}
                      style={{
                        padding: "4px 12px",
                        borderRadius: 6,
                        border: "none",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        background: active ? C.brand : "transparent",
                        color: active ? "#fff" : C.textSub,
                      }}
                    >
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
                    {PAY_MODES.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Amount Paid (₹)">
                  <input
                    className="g-inp"
                    value={received}
                    onChange={(e) => {
                      setRecTouched(true);
                      setReceived(e.target.value);
                    }}
                    inputMode="decimal"
                    placeholder="0.00"
                  />
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
                      <select
                        className="g-sel"
                        value={p.type}
                        onChange={(e) =>
                          setPayments((prev) => {
                            const n = [...prev];
                            n[i] = { ...n[i], type: e.target.value };
                            return n;
                          })
                        }
                      >
                        {PAY_MODES.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label={i === 0 ? "Amount (₹)" : ""}>
                      <input
                        className="g-inp"
                        value={p.amount}
                        onChange={(e) =>
                          setPayments((prev) => {
                            const n = [...prev];
                            n[i] = { ...n[i], amount: e.target.value };
                            return n;
                          })
                        }
                        inputMode="decimal"
                        placeholder="0.00"
                      />
                    </Field>
                    <div style={{ paddingBottom: 2 }}>
                      {payments.length > 1 && (
                        <button className="g-btn danger sm" onClick={() => setPayments((p) => p.filter((_, j) => j !== i))}>
                          <FiX size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1.5px solid #f3f4f6", marginTop: 4 }}>
                  <button className="g-btn ghost sm" onClick={() => setPayments((p) => [...p, { type: "Cash", amount: "" }])}>
                    <FiPlus size={13} /> Add Line
                  </button>
                  <div style={{ display: "flex", gap: 24 }}>
                    {[
                      { l: "Paid", v: fmt2(sumPay), c: C.text },
                      { l: "Balance", v: fmt2(balance), c: balance <= 0 ? C.green : C.orange },
                    ].map(({ l, v, c }) => (
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
          <div className="g-card-head">
            <div className="g-card-title">Summary</div>
          </div>
          <div className="g-card-body">
            {[
              ...(isGST && gstMode === "inclusive"
                ? [
                    { l: "Total (Tax Inclusive)", v: `₹${fmt2(subTotal)}` },
                    { l: "Tax (included)", v: `₹${fmt2(taxTotal)}` },
                  ]
                : [{ l: "Subtotal", v: `₹${fmt2(subTotal)}` }, ...(isGST ? [{ l: "Tax Total", v: `₹${fmt2(taxTotal)}` }] : [])]),
            ].map(({ l, v }) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: C.textSub, marginBottom: 10 }}>
                <span>{l}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
                padding: "10px 12px",
                background: "#f8fafc",
                borderRadius: 8,
                border: "1.5px solid #e5e7eb",
              }}
            >
              <label htmlFor="roundchk" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.text }}>
                <input type="checkbox" id="roundchk" checked={roundOff} onChange={(e) => setRoundOff(e.target.checked)} style={{ width: 16, height: 16, accentColor: C.brand }} />
                Round off
              </label>
              <span style={{ fontSize: 13, fontWeight: 700, color: roundOff ? (roundDiff >= 0 ? C.green : C.red) : C.textSub }}>{roundOff ? `${roundDiff >= 0 ? "+" : ""}₹${fmt2(roundDiff)}` : "Off"}</span>
            </div>

            <div
              style={{
                background: C.brand,
                borderRadius: 10,
                padding: "14px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
                boxShadow: `0 3px 10px rgba(3,76,157,0.25)`,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>Grand Total</span>
              <span style={{ fontWeight: 900, fontSize: 22, color: "#fff" }}>₹{fmt2(roundedTotal)}</span>
            </div>

            <button className="g-btn success lg" onClick={onSave} disabled={saving}>
              <FiCheck size={16} />
              {saving ? "Saving…" : isEdit ? "Update Purchase" : "Save Purchase"}
            </button>

            {/* Bill type indicator */}
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                borderRadius: 8,
                background: isGST ? C.brandLighter : "#f3f4f6",
                border: `1.5px solid ${isGST ? "#bfdbfe" : "#e5e7eb"}`,
                fontSize: 13,
                fontWeight: 700,
                color: isGST ? C.brand : "#374151",
                textAlign: "center",
              }}
            >
              {isGST ? `GST Bill (${gstMode === "inclusive" ? "Tax Inclusive" : "Tax Exclusive"})` : "NON-GST Bill"}
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL: ADD DISTRIBUTOR ── */}
      <Modal
        show={showAddDist}
        title="Add New Distributor"
        onClose={() => setShowAddDist(false)}
        footer={
          <>
            <button className="g-btn ghost" onClick={() => setShowAddDist(false)}>
              Cancel
            </button>
            <button className="g-btn primary" onClick={saveDist}>
              Save
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Distributor Name" required hint="Full name of the company or person">
            <input className="g-inp lg" value={newDist.name} onChange={(e) => setNewDist((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. ABC Pharma" />
          </Field>
          <Field label="GSTIN" hint="Optional">
            <input className="g-inp lg" value={newDist.gstin} onChange={(e) => setNewDist((p) => ({ ...p, gstin: e.target.value }))} placeholder="Optional" />
          </Field>
          <Field label="Phone" hint="Optional">
            <input className="g-inp lg" value={newDist.phone} onChange={(e) => setNewDist((p) => ({ ...p, phone: e.target.value }))} placeholder="Optional" type="tel" />
          </Field>
        </div>
      </Modal>

      {/* ── MODAL: ADD ITEM TO MASTER ── */}
      <Modal
        show={showAddItem}
        title="Add Item to Master"
        onClose={() => setShowAddItem(false)}
        width={580}
        footer={
          <>
            <button className="g-btn ghost" onClick={() => setShowAddItem(false)}>
              Cancel
            </button>
            <button className="g-btn primary" onClick={saveNewItem}>
              Save Item
            </button>
          </>
        }
      >
        <div className="g-grid-2">
          <div className="g-span-2">
            <Field label="Item / Medicine Name" required>
              <input className="g-inp lg" value={newItem.itemName} onChange={(e) => setNewItem((p) => ({ ...p, itemName: e.target.value }))} placeholder="e.g. Paracetamol 500mg" />
            </Field>
          </div>
          <Field label="Item Code" required hint="Short unique code">
            <div style={{ display: "flex", gap: 6 }}>
              <input className="g-inp lg" style={{ flex: 1 }} value={newItem.itemCode} onChange={(e) => setNewItem((p) => ({ ...p, itemCode: e.target.value }))} placeholder="e.g. PCM500" />
              <button type="button" className="g-btn ghost" style={{ whiteSpace: "nowrap", height: 42 }} onClick={() => setNewItem((p) => ({ ...p, itemCode: "ITM" + Date.now().toString(36).toUpperCase() }))}>
                Generate
              </button>
            </div>
          </Field>
          <Field label="HSN Code" hint="For GST">
            <input className="g-inp lg" value={newItem.hsn} onChange={(e) => setNewItem((p) => ({ ...p, hsn: e.target.value }))} placeholder="Optional" />
          </Field>
          <Field label="MRP (₹)">
            <input className="g-inp lg" value={newItem.mrp} onChange={(e) => setNewItem((p) => ({ ...p, mrp: e.target.value }))} inputMode="decimal" placeholder="0.00" />
          </Field>
          <Field label="Sale Price (₹)">
            <input className="g-inp lg" value={newItem.salePrice} onChange={(e) => setNewItem((p) => ({ ...p, salePrice: e.target.value }))} inputMode="decimal" placeholder="0.00" />
          </Field>
          <Field label="Purchase Price (₹)">
            <input className="g-inp lg" value={newItem.purchasePrice} onChange={(e) => setNewItem((p) => ({ ...p, purchasePrice: e.target.value }))} inputMode="decimal" placeholder="0.00" />
          </Field>
          <Field label="Tax %">
            <input className="g-inp lg" value={newItem.tax} onChange={(e) => setNewItem((p) => ({ ...p, tax: e.target.value }))} inputMode="decimal" placeholder="e.g. 12" />
          </Field>
        </div>
      </Modal>

      {/* ── MODAL: COLUMN MAPPING ── */}
      <Modal
        show={showMapping}
        title="Map Columns from Uploaded Bill"
        onClose={() => setShowMapping(false)}
        width={960}
        footer={
          <>
            <button className="g-btn ghost" onClick={() => setShowMapping(false)}>
              Cancel
            </button>
            <button className="g-btn primary" onClick={applyMapping}>
              <FiCheck size={14} /> Apply & Import ({uploadRows.length} rows)
            </button>
          </>
        }
      >
        <div>
          {/* Raw file data */}
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, marginBottom: 6, textTransform: "uppercase" }}>
            Uploaded Data — {uploadRows.length} rows, {uploadHeaders.length} columns
          </div>
          <div style={{ overflowX: "auto", border: "1.5px solid #e5e7eb", borderRadius: 8, maxHeight: 240, marginBottom: 18 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f1f5f9", position: "sticky", top: 0, zIndex: 1 }}>
                  {uploadHeaders.map((h, i) => {
                    const mappedTo = OUR_COLS.find((c) => colMap[c.key] === i);
                    return (
                      <th
                        key={i}
                        style={{
                          padding: "8px 10px",
                          textAlign: "left",
                          whiteSpace: "nowrap",
                          fontSize: 11,
                          fontWeight: 700,
                          color: mappedTo ? C.brand : C.textSub,
                          borderBottom: "1.5px solid #e2e8f0",
                          background: mappedTo ? C.brandLighter : "#f1f5f9",
                        }}
                      >
                        <div>{h || `Col ${i + 1}`}</div>
                        {mappedTo && <div style={{ fontSize: 9, fontWeight: 800, color: C.brand, marginTop: 2 }}>= {mappedTo.label}</div>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {uploadRows.slice(0, 8).map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    {uploadHeaders.map((_, ci) => {
                      let val = row[ci];
                      if (val instanceof Date) val = val.toISOString().slice(0, 10);
                      const mapped = OUR_COLS.find((c) => colMap[c.key] === ci);
                      return (
                        <td
                          key={ci}
                          style={{
                            padding: "6px 10px",
                            whiteSpace: "nowrap",
                            fontSize: 12,
                            color: mapped ? C.text : C.textSub,
                            fontWeight: mapped ? 600 : 400,
                            background: mapped ? "#fafcff" : "transparent",
                          }}
                        >
                          {String(val ?? "")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mapping selects */}
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, marginBottom: 8, textTransform: "uppercase" }}>Column Mapping — match file columns to our fields</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            {OUR_COLS.map((col) => {
              const mapped = colMap[col.key] !== undefined;
              return (
                <div
                  key={col.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: `1.5px solid ${mapped ? "#bfdbfe" : "#e5e7eb"}`,
                    background: mapped ? C.brandLighter : "#fff",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: mapped ? C.brand : C.text, minWidth: 110 }}>
                    {col.label}
                    {col.required ? <span style={{ color: C.red }}> *</span> : ""}
                  </span>
                  <select
                    className="g-sel sm"
                    style={{ flex: 1, height: 30, fontSize: 12 }}
                    value={colMap[col.key] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setColMap((p) => {
                        const n = { ...p };
                        if (v === "") delete n[col.key];
                        else n[col.key] = Number(v);
                        return n;
                      });
                    }}
                  >
                    <option value="">— Skip —</option>
                    {uploadHeaders.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          <div style={{ padding: "8px 12px", borderRadius: 8, background: C.brandLighter, border: "1.5px solid #bfdbfe", fontSize: 12, color: C.brand }}>
            Mapped columns are highlighted in blue above. Items will be auto-matched with your item master by name/code.
          </div>
        </div>
      </Modal>

      {/* ── MODAL: PRICE WARNING ── */}
      <Modal
        show={showPriceWarning}
        title="Price & MRP Alert"
        onClose={() => setShowPriceWarning(false)}
        width={720}
        footer={
          <>
            <button className="g-btn ghost" onClick={() => setShowPriceWarning(false)}>
              Go Back & Edit
            </button>
            <button
              className="g-btn success"
              onClick={async () => {
                setShowPriceWarning(false);
                if (pendingSaveData) await doSave(pendingSaveData);
              }}
            >
              <FiCheck size={14} /> Save Anyway
            </button>
          </>
        }
      >
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
                  {w.current_price > 0 && (
                    <span>
                      Price: <span style={{ color: C.red }}>₹{w.current_price.toFixed(2)}</span>
                    </span>
                  )}
                  {w.current_mrp > 0 && (
                    <span>
                      MRP: <span style={{ color: C.brand }}>₹{w.current_mrp.toFixed(2)}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Cheaper purchase history */}
              {w.cheaper_purchases?.length > 0 && (
                <div>
                  <div style={{ padding: "8px 16px", fontSize: 12, fontWeight: 700, color: C.orange, background: "#fff7ed" }}>Bought cheaper before</div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#fafbfc" }}>
                        {["Past Price", "Qty", "Distributor", "Bill No", "Date"].map((h) => (
                          <th
                            key={h}
                            style={{ padding: "7px 12px", fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #f1f5f9" }}
                          >
                            {h}
                          </th>
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
                          <td style={{ padding: "8px 12px", fontSize: 12, color: C.textSub }}>{fmtDate(p.bill_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* MRP change history */}
              {w.mrp_changes?.length > 0 && (
                <div>
                  <div style={{ padding: "8px 16px", fontSize: 12, fontWeight: 700, color: C.brand, background: "#eff6ff" }}>MRP was different before</div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#fafbfc" }}>
                        {["Past MRP", "Price", "Distributor", "Bill No", "Date"].map((h) => (
                          <th
                            key={h}
                            style={{ padding: "7px 12px", fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #f1f5f9" }}
                          >
                            {h}
                          </th>
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
                          <td style={{ padding: "8px 12px", fontSize: 12, color: C.textSub }}>{fmtDate(m.bill_date)}</td>
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
