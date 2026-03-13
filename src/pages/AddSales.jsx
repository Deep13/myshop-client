import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, Col, Form, Row, Table, Button } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";

const todayISO = () => new Date().toISOString().slice(0, 10);

// -------------------- Dummy masters (replace with API later) --------------------
const CUSTOMER_MASTER = [
  { id: 1, type: "Retail", name: "ABC Traders", phone: "9876543210" },
  { id: 2, type: "Wholesale", name: "XYZ Store", phone: "9998887776" },
  { id: 3, type: "Retail", name: "Mega Mart", phone: "9123456789" },
];

const ITEM_MASTER = [
  {
    id: 1,
    code: "PCM650",
    name: "Paracetamol 650",
    hsn: "30045010",
    batchNo: "BCH001",
    expDate: "2026-08-31",
    mrp: 50,
    price: 48,
    tax: 12,
  },
  {
    id: 2,
    code: "CET10",
    name: "Cetirizine 10",
    hsn: "30049099",
    batchNo: "BCH016",
    expDate: "2026-02-28",
    mrp: 30,
    price: 28,
    tax: 5,
  },
  {
    id: 3,
    code: "OMP20",
    name: "Omeprazole 20",
    hsn: "30049099",
    batchNo: "BCH044",
    expDate: "2027-01-31",
    mrp: 90,
    price: 85,
    tax: 12,
  },
];

// -------------------- helpers --------------------
const blankRow = () => ({
  itemName: "",
  hsn: "",
  batchNo: "",
  expDate: "",
  mrp: "",
  qty: "",
  price: "",
  discount: "",
  tax: "",
  amount: "",
});

const blankPayment = () => ({ type: "Cash", amount: "" });

function parsePercentOrNumber(val) {
  const s = String(val ?? "").trim();
  if (!s) return { type: null, value: 0 };
  if (s.endsWith("%")) {
    const num = Number(s.slice(0, -1));
    return { type: "percent", value: Number.isFinite(num) ? num : 0 };
  }
  const num = Number(s);
  return { type: "number", value: Number.isFinite(num) ? num : 0 };
}

function asNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function calcAmount(row) {
  const mrp = asNum(row.mrp);
  const qty = asNum(row.qty) || 0;

  const hasDiscount = Boolean(String(row.discount || "").trim());
  const discParsed = parsePercentOrNumber(row.discount);

  let unitBase = hasDiscount ? mrp : String(row.price || "").trim() ? asNum(row.price) : mrp;

  if (hasDiscount) {
    let discountPerUnit = discParsed.type === "percent" ? (mrp * discParsed.value) / 100 : discParsed.value;
    if (discountPerUnit > mrp) discountPerUnit = mrp;
    unitBase = mrp - discountPerUnit;
  }

  const taxPct = asNum(row.tax);
  const subTotal = unitBase * qty;
  // const taxAmount = (subTotal * taxPct) / 100;
  return subTotal;
}

const itemSuggestions = (text) => {
  const q = String(text || "")
    .trim()
    .toLowerCase();
  if (!q) return [];
  return ITEM_MASTER.filter((it) => {
    const name = (it.name || "").toLowerCase();
    const code = (it.code || "").toLowerCase();
    const hsn = String(it.hsn || "").toLowerCase();
    return name.includes(q) || code.includes(q) || hsn.includes(q);
  }).slice(0, 8);
};

const findItemByExactCode = (text) => {
  const q = String(text || "")
    .trim()
    .toLowerCase();
  if (!q) return null;
  return (
    ITEM_MASTER.find(
      (it) =>
        String(it.code || "")
          .trim()
          .toLowerCase() === q,
    ) || null
  );
};

export default function AddSales() {
  // -------------------- customer + invoice --------------------
  const [customerType, setCustomerType] = useState("Retail");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const editId = params.get("id"); // string or null
  const isEdit = Boolean(editId);

  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayISO());

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return [];
    return CUSTOMER_MASTER.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 8);
  }, [customerQuery]);

  const [showCustomerSug, setShowCustomerSug] = useState(false);
  const customerBoxRef = useRef(null);
  useEffect(() => {
    if (!isEdit) return;

    (async () => {
      try {
        const res = await fetch(`http://localhost/myshop-backend/get_invoice.php?id=${editId}`);
        const json = await res.json();
        if (!res.ok || json.status !== "success") throw new Error(json.message || "Failed");

        const inv = json.invoice;
        const items = json.items || [];
        const pays = json.payments || [];

        setCustomerType(inv.customer_type || "Retail");
        setCustomerName(inv.customer_name || "");
        setCustomerQuery(inv.customer_name || "");
        setPhone(inv.phone || "");
        setInvoiceNo(inv.invoice_no || "");
        setInvoiceDate(inv.invoice_date || todayISO());

        // rows mapping
        const mappedRows = items.map((it) => ({
          itemName: it.item_name || "",
          hsn: it.hsn || "",
          batchNo: it.batch_no || "",
          expDate: it.exp_date || "",
          mrp: it.mrp || "",
          qty: it.qty || "",
          price: it.price || "",
          discount: it.discount || "",
          tax: it.tax || "",
          amount: Number(it.amount || 0).toFixed(2),
        }));

        setRows([...mappedRows, blankRow()]);

        // payments
        if (pays.length <= 1) {
          setMultiPayment(false);
          setPaymentType(pays[0]?.pay_type || "Cash");
        } else {
          setMultiPayment(true);
          setPayments(pays.map((p) => ({ type: p.pay_type, amount: String(p.amount ?? "") })));
        }

        setBillDiscount(inv.bill_discount || "");
        setRoundOffEnabled(Boolean(Number(inv.round_off_enabled || 0)));
        setReceived(String(inv.received ?? "0"));
        setReceivedTouched(true);
      } catch (e) {
        alert(e.message || "Failed to load invoice");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, editId]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!customerBoxRef.current) return;
      if (!customerBoxRef.current.contains(e.target)) setShowCustomerSug(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    async function fetchNextInvoice() {
      try {
        const res = await fetch("http://localhost/myshop-backend/get_next_invoice.php");
        const data = await res.json();

        if (data.status === "success") {
          setInvoiceNo(data.invoiceNo);
        } else {
          setInvoiceNo("INV001"); // fallback
        }
      } catch (err) {
        console.error("Invoice fetch failed", err);
        setInvoiceNo("INV001");
      }
    }

    fetchNextInvoice();
  }, []);

  const onSelectCustomer = (cust) => {
    setCustomerName(cust.name);
    setPhone(cust.phone);
    setCustomerQuery(cust.name);
    setShowCustomerSug(false);
  };

  const onCustomerQueryChange = (v) => {
    setCustomerQuery(v);
    setCustomerName(v); // manual allowed
  };

  // -------------------- items table --------------------
  const [rows, setRows] = useState([blankRow(), blankRow()]);
  const itemNameRefs = useRef({});
  const [activeItemRow, setActiveItemRow] = useState(null);

  useEffect(() => {
    const close = () => setActiveItemRow(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const updateRow = (index, patch) => {
    setRows((prev) => {
      const next = [...prev];
      const updated = { ...next[index], ...patch };

      // rule: if discount entered -> price blank
      if (patch.discount !== undefined) {
        const hasDisc = String(patch.discount || "").trim().length > 0;
        if (hasDisc) updated.price = "";
      }

      updated.amount = calcAmount(updated).toFixed(2);
      next[index] = updated;
      return next;
    });
  };

  const addRowIfNeededAndFocusNext = (index) => {
    setRows((prev) => {
      const next = [...prev];
      const isLast = index === next.length - 1;
      if (isLast) next.push(blankRow());
      return next;
    });

    setTimeout(() => {
      const nextIndex = index + 1;
      itemNameRefs.current[nextIndex]?.focus();
    }, 0);
  };

  const onPickItem = (rowIndex, item) => {
    setActiveItemRow(null); // ✅ hide suggestions immediately

    const filled = {
      itemName: item.name,
      hsn: item.hsn,
      batchNo: item.batchNo,
      expDate: item.expDate,
      mrp: item.mrp,
      qty: 1,
      price: item.price,
      discount: "",
      tax: item.tax,
    };

    setRows((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], ...filled };
      next[rowIndex].amount = calcAmount(next[rowIndex]).toFixed(2);
      return next;
    });

    addRowIfNeededAndFocusNext(rowIndex);
  };

  const grandTotal = useMemo(() => {
    return rows.reduce((acc, r) => acc + asNum(r.amount), 0);
  }, [rows]);

  // -------------------- payment + totals section --------------------
  const [multiPayment, setMultiPayment] = useState(false);
  const [paymentType, setPaymentType] = useState("Cash"); // single mode
  const [payments, setPayments] = useState([blankPayment()]); // multi mode

  // bill discount on total
  const [billDiscount, setBillDiscount] = useState("");
  const billDiscountParsed = useMemo(() => parsePercentOrNumber(billDiscount), [billDiscount]);

  const billDiscountValue = useMemo(() => {
    const base = grandTotal;
    if (!String(billDiscount || "").trim()) return 0;

    if (billDiscountParsed.type === "percent") {
      const val = (base * billDiscountParsed.value) / 100;
      return Math.max(0, Math.min(val, base));
    }
    return Math.max(0, Math.min(billDiscountParsed.value, base));
  }, [grandTotal, billDiscount, billDiscountParsed]);

  const finalTotal = useMemo(() => {
    const ft = grandTotal - billDiscountValue;
    return ft < 0 ? 0 : ft;
  }, [grandTotal, billDiscountValue]);

  // ✅ Round off checkbox (default ON)
  const [roundOffEnabled, setRoundOffEnabled] = useState(true);

  const roundedFinalTotal = useMemo(() => {
    if (!roundOffEnabled) return finalTotal;
    // "nearest larger zero" -> round UP to next rupee
    return Math.ceil(finalTotal);
  }, [finalTotal, roundOffEnabled]);

  const roundOffDiff = useMemo(() => {
    return roundedFinalTotal - finalTotal; // will be >= 0 when rounding up
  }, [roundedFinalTotal, finalTotal]);

  const sumPayments = useMemo(() => {
    return payments.reduce((acc, p) => acc + asNum(p.amount), 0);
  }, [payments]);

  const [received, setReceived] = useState("0");
  const [receivedTouched, setReceivedTouched] = useState(false);

  // auto-fill received with rounded final total (until user edits it)
  useEffect(() => {
    if (!receivedTouched && !multiPayment) {
      setReceived(roundedFinalTotal.toFixed(2));
    }
  }, [roundedFinalTotal, receivedTouched, multiPayment]);

  // if multi-payment is ON, received is sum of payments
  useEffect(() => {
    if (multiPayment) {
      setReceivedTouched(true);
      setReceived(sumPayments.toFixed(2));
    }
  }, [multiPayment, sumPayments]);

  const balance = useMemo(() => {
    const rec = asNum(received);
    return roundedFinalTotal - rec;
  }, [roundedFinalTotal, received]);

  const updatePaymentRow = (idx, patch) => {
    setPayments((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const addMorePayment = () => setPayments((prev) => [...prev, blankPayment()]);

  // -------------------- SAVE + PRINT helpers --------------------

  function buildInvoicePayload() {
    const cleanRows = rows
      .map((r) => ({
        itemName: String(r.itemName || "").trim(),
        hsn: String(r.hsn || "").trim(),
        batchNo: String(r.batchNo || "").trim(),
        expDate: r.expDate || "",
        mrp: asNum(r.mrp),
        qty: asNum(r.qty),
        price: String(r.discount || "").trim() ? 0 : asNum(r.price), // if discount used, price is not used
        discount: String(r.discount || "").trim(),
        tax: asNum(r.tax),
        amount: asNum(r.amount),
      }))
      .filter((r) => r.itemName && r.qty > 0);

    const paymentData = multiPayment ? payments.map((p) => ({ type: p.type, amount: asNum(p.amount) })).filter((p) => p.amount > 0) : [{ type: paymentType, amount: asNum(received) }];

    return {
      customerType,
      customerName: String(customerName || "Cash").trim(),
      phone: String(phone || "").trim(),
      invoiceNo: String(invoiceNo || "").trim(),
      invoiceDate,
      rows: cleanRows,
      totals: {
        grandTotal: asNum(grandTotal),
        billDiscount: String(billDiscount || "").trim(),
        billDiscountValue: asNum(billDiscountValue),
        finalTotal: asNum(finalTotal),
        roundOffEnabled,
        roundedFinalTotal: asNum(roundedFinalTotal),
        roundOffDiff: asNum(roundOffDiff),
        received: asNum(received),
        balance: asNum(balance),
      },
      payments: paymentData,
      meta: {
        createdAt: new Date().toISOString(),
      },
    };
  }

  async function saveInvoiceToBackend(payload) {
    // ✅ change URL to your PHP backend route
    const res = await fetch("/api/save_invoice.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      throw new Error(data?.message || "Failed to save invoice");
    }

    // Expected backend response: { ok: true, invoiceId: "123", invoiceNo: "INV001" }
    return data;
  }

  function openThermalPrintWindow(payload, savedInfo) {
    const w = window.open("", "_blank", "width=400,height=800");
    if (!w) {
      alert("Popup blocked. Please allow popups for printing.");
      return;
    }

    const esc = (s) =>
      String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const shopName = "Ganga Medical Store"; // change if you want
    const invoiceNoToPrint = savedInfo?.invoiceNo || payload.invoiceNo;

    const rowsHtml = payload.rows
      .map(
        (r) => `
      <tr>
        <td class="left">
          <div class="b">${esc(r.itemName)}</div>
          <div class="s">HSN:${esc(r.hsn)}  B:${esc(r.batchNo)}  Exp:${esc(r.expDate)}</div>
          <div class="s">${esc(r.qty)} x ${esc(r.mrp)} ${r.discount ? ` Disc:${esc(r.discount)}` : ""}</div>
        </td>
        <td class="right">${esc(r.amount.toFixed(2))}</td>
      </tr>
    `,
      )
      .join("");

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${esc(invoiceNoToPrint)}</title>
  <style>
    /* 80mm thermal print */
    @page { size: 80mm auto; margin: 6mm; }
    body { font-family: monospace; font-size: 12px; margin: 0; }
    .wrap { width: 68mm; } /* inside margins */
    .center { text-align: center; }
    .right { text-align: right; vertical-align: top; }
    .left { text-align: left; }
    .b { font-weight: 700; }
    .s { font-size: 11px; opacity: 0.9; }
    hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 4px 0; }
    .tot td { padding: 2px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="center b">${esc(shopName)}</div>
    <div class="center s">Tax Invoice</div>
    <hr/>
    <div class="s">
      <div class="row"><div>Inv:</div><div>${esc(invoiceNoToPrint)}</div></div>
      <div class="row"><div>Date:</div><div>${esc(payload.invoiceDate)}</div></div>
      <div class="row"><div>Cust:</div><div>${esc(payload.customerName || "-")}</div></div>
      <div class="row"><div>Phone:</div><div>${esc(payload.phone || "-")}</div></div>
    </div>
    <hr/>
    <table>
      ${rowsHtml}
    </table>
    <hr/>
    <table class="tot">
      <tr><td class="left">Subtotal</td><td class="right">${esc(payload.totals.grandTotal.toFixed(2))}</td></tr>
      <tr><td class="left">Discount</td><td class="right">- ${esc(payload.totals.billDiscountValue.toFixed(2))}</td></tr>
      <tr><td class="left b">Total</td><td class="right b">${esc(payload.totals.roundedFinalTotal.toFixed(2))}</td></tr>
      ${payload.totals.roundOffEnabled ? `<tr><td class="left">Round Off</td><td class="right">+ ${esc(payload.totals.roundOffDiff.toFixed(2))}</td></tr>` : ""}
      <tr><td class="left">Received</td><td class="right">${esc(payload.totals.received.toFixed(2))}</td></tr>
      <tr><td class="left">Balance</td><td class="right">${esc(payload.totals.balance.toFixed(2))}</td></tr>
    </table>
    <hr/>
    <div class="s">
      ${payload.payments.map((p) => `<div class="row"><div>${esc(p.type)}</div><div>${esc(p.amount.toFixed(2))}</div></div>`).join("")}
    </div>
    <hr/>
    <div class="center s">Thank you! Visit again.</div>
  </div>

  <script>
    window.onload = function () {
      window.focus();
      window.print();
      setTimeout(() => window.close(), 300);
    };
  </script>
</body>
</html>
  `;

    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  const [saving, setSaving] = useState(false);

  async function onSave() {
    await saveInvoiceToBackend();
    window.location.href = "/";
  }

  async function saveInvoiceToBackend() {
    setSaving(true);
    const payload = buildInvoicePayload();
    if (isEdit) payload.invoiceId = Number(editId);

    const endpoint = isEdit ? `http://localhost/myshop-backend/update_invoice.php` : `http://localhost/myshop-backend/save_invoice.php`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok || data.status !== "success") throw new Error(data.message || "Save failed");
    setSaving(false);
    alert(isEdit ? "Updated!" : "Saved!");
    navigate("/sales"); // optional: go back to list

    // {status, message, invoiceId, invoiceNo}
  }

  async function handlePrint() {
    const payload = buildInvoicePayload();
    if (isEdit) payload.invoiceId = Number(editId);

    const endpoint = isEdit ? `http://localhost/myshop-backend/update_invoice.php` : `http://localhost/myshop-backend/save_invoice.php`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok || data.status !== "success") throw new Error(data.message || "Save failed");
    openThermalPrintWindow(data.payload, data.savedInfo);
  }

  return (
    <div style={{ padding: 20, background: "#fff", textAlign: "left" }}>
      <h3>Add Sales</h3>

      {/* Top: Customer + Invoice */}
      <div style={{ display: "flex", marginBottom: 15, flexDirection: "row", gap: 20, justifyContent: "space-between" }}>
        <div style={{ display: "flex", marginBottom: 15, flexDirection: "column", gap: 20 }}>
          <Form.Select style={{ width: 200 }} value={customerType} onChange={(e) => setCustomerType(e.target.value)}>
            <option value="Retail">Retail</option>
            <option value="Wholesale">Wholesale</option>
            <option value="B2B">B2B</option>
          </Form.Select>
          <div style={{ display: "flex", marginBottom: 15, flexDirection: "row", gap: 20, width: 500 }}>
            <div ref={customerBoxRef} style={{ position: "relative", flex: 1 }}>
              <Form.Control
                value={customerQuery}
                onChange={(e) => {
                  onCustomerQueryChange(e.target.value);
                  setShowCustomerSug(true);
                }}
                onFocus={() => setShowCustomerSug(true)}
                placeholder="Search by name or phone"
              />

              {showCustomerSug && filteredCustomers.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    zIndex: 20,
                    background: "#fff",
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    marginTop: 6,
                    maxHeight: 220,
                    overflow: "auto",
                  }}
                >
                  {filteredCustomers.map((c) => (
                    <div key={c.id} onMouseDown={() => onSelectCustomer(c)} style={{ padding: "10px 12px", cursor: "pointer" }}>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        {c.phone} • {c.type}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Form.Control style={{ flex: 1 }} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone Number" />
          </div>
        </div>
        <div>
          <div>
            <Form.Label>Invoice Number</Form.Label>
            <Form.Control value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
          </div>
          <div style={{ marginTop: 15 }}>
            <Form.Label>Invoice Date</Form.Label>
            <Form.Control value={invoiceDate} disabled />
          </div>
        </div>
      </div>

      {/* Items table */}
      <Table bordered className="text-start" style={{ marginTop: 50 }}>
        <thead>
          <tr className="align-middle">
            <th style={{ width: 270 }}>Item Name</th>
            <th style={{ width: 110 }}>HSN</th>
            <th style={{ width: 110 }}>Batch</th>
            <th style={{ width: 130 }}>Exp</th>
            <th style={{ width: 80 }}>MRP</th>
            <th style={{ width: 70 }}>QTY</th>
            <th style={{ width: 90 }}>Price</th>
            <th style={{ width: 110 }}>Discount</th>
            <th style={{ width: 80 }}>Tax %</th>
            <th style={{ width: 120 }}>Amount</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r, idx) => {
            const sug = itemSuggestions(r.itemName);

            return (
              <tr key={idx} className="align-middle">
                <td style={{ position: "relative" }}>
                  <Form.Control
                    ref={(el) => (itemNameRefs.current[idx] = el)}
                    value={r.itemName}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateRow(idx, { itemName: val });
                      setActiveItemRow(idx);

                      // ✅ exact code match auto-select (paste supported)
                      const matched = findItemByExactCode(val);
                      if (matched) onPickItem(idx, matched);
                    }}
                    onFocus={() => setActiveItemRow(idx)}
                    placeholder="Type item name / code..."
                    autoComplete="off"
                    style={{ border: 0, boxShadow: "none" }}
                  />

                  {activeItemRow === idx && sug.length > 0 && String(r.itemName || "").trim() && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 10,
                        background: "#fff",
                        border: "1px solid #ddd",
                        borderRadius: 8,
                        marginTop: 6,
                        maxHeight: 220,
                        overflow: "auto",
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {sug.map((it) => (
                        <div key={it.id} onMouseDown={() => onPickItem(idx, it)} style={{ padding: "10px 12px", cursor: "pointer" }}>
                          <div style={{ fontWeight: 600 }}>
                            {it.name} <span style={{ fontSize: 12, opacity: 0.7 }}>({it.code})</span>
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>
                            HSN: {it.hsn} • MRP: ₹{it.mrp} • Tax: {it.tax}%
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </td>

                <td>
                  <Form.Control style={{ border: 0, boxShadow: "none" }} value={r.hsn} onChange={(e) => updateRow(idx, { hsn: e.target.value })} />
                </td>
                <td>
                  <Form.Control style={{ border: 0, boxShadow: "none" }} value={r.batchNo} onChange={(e) => updateRow(idx, { batchNo: e.target.value })} />
                </td>
                <td>
                  <Form.Control style={{ border: 0, boxShadow: "none" }} type="date" value={r.expDate} onChange={(e) => updateRow(idx, { expDate: e.target.value })} />
                </td>
                <td>
                  <Form.Control style={{ border: 0, boxShadow: "none" }} value={r.mrp} onChange={(e) => updateRow(idx, { mrp: e.target.value })} inputMode="decimal" />
                </td>
                <td>
                  <Form.Control style={{ border: 0, boxShadow: "none" }} value={r.qty} onChange={(e) => updateRow(idx, { qty: e.target.value })} inputMode="numeric" />
                </td>

                <td>
                  <Form.Control
                    style={{ border: 0, boxShadow: "none" }}
                    value={r.price}
                    onChange={(e) => updateRow(idx, { price: e.target.value })}
                    inputMode="decimal"
                    disabled={String(r.discount || "").trim().length > 0}
                    placeholder={String(r.discount || "").trim() ? "Disabled" : ""}
                  />
                </td>

                <td>
                  <Form.Control style={{ border: 0, boxShadow: "none" }} value={r.discount} onChange={(e) => updateRow(idx, { discount: e.target.value })} placeholder="10 or 10%" />
                </td>

                <td>
                  <Form.Control style={{ border: 0, boxShadow: "none" }} value={r.tax} onChange={(e) => updateRow(idx, { tax: e.target.value })} inputMode="decimal" />
                </td>
                <td>
                  <Form.Control style={{ border: 0, boxShadow: "none" }} value={r.amount} disabled />
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {/* Bottom: Payment (left) + Amount details (right) */}

      <div style={{ display: "flex", gap: 16, marginTop: 50, marginBottom: 50 }}>
        {/* LEFT: Payment details */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <h5 style={{ margin: 0 }}>Payment Details</h5>
          </div>

          {!multiPayment ? (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <Form.Select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Online">Online</option>
                </Form.Select>
              </div>
            </div>
          ) : (
            <>
              {payments.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 20,
                    alignItems: "center",
                    marginBottom: 8,
                    flexDirection: "row",
                    justifyContent: "flex-start",
                    width: 400,
                  }}
                >
                  <div>
                    <Form.Select value={p.type} onChange={(e) => updatePaymentRow(i, { type: e.target.value })}>
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="Online">Online</option>
                    </Form.Select>
                  </div>

                  <div style={{ flex: 1 }}>
                    <Form.Label>{i === 0 ? "Amount" : " "}</Form.Label>
                    <Form.Control value={p.amount} onChange={(e) => updatePaymentRow(i, { amount: e.target.value })} placeholder="0.00" inputMode="decimal" />
                  </div>
                </div>
              ))}

              <Button variant="outline-primary" size="sm" onClick={addMorePayment}>
                Add more
              </Button>
            </>
          )}
          {!multiPayment && (
            <Button variant="outline-primary" size="sm" onClick={() => setMultiPayment(true)}>
              Add Payment Type
            </Button>
          )}
        </div>

        {/* RIGHT: Amount details */}
        <div style={{ width: 500, textAlign: "right" }}>
          <div style={{ display: "flex", gap: 12, flexDirection: "column" }}>
            <div>
              <div style={{ flex: 1, display: "flex", flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
                <Form.Label>Discount</Form.Label>
                <Form.Control value={billDiscount} onChange={(e) => setBillDiscount(e.target.value)} placeholder="e.g. 100 or 10%" style={{ width: 200 }} />
              </div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>Discount value: ₹ {billDiscountValue.toFixed(2)}</div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
                <Form.Label>Final Total</Form.Label>
                <Form.Control value={roundedFinalTotal.toFixed(2)} disabled style={{ width: 200 }} />
              </div>
              {roundOffEnabled && <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>Round Off: +₹ {roundOffDiff.toFixed(2)}</div>}
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <Form.Check type="checkbox" label="Round off to next rupee" checked={roundOffEnabled} onChange={(e) => setRoundOffEnabled(e.target.checked)} />
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 12, flexDirection: "column" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
              <Form.Label>Received</Form.Label>
              <Form.Control
                value={received}
                onChange={(e) => {
                  setReceivedTouched(true);
                  setReceived(e.target.value);
                }}
                disabled={multiPayment}
                inputMode="decimal"
                style={{ width: 200 }}
              />
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
              <Form.Label>Balance</Form.Label>
              <Form.Control value={balance.toFixed(2)} disabled style={{ width: 200 }} />
            </div>
          </div>
          <div
            style={{
              position: "fixed",
              right: 24,
              bottom: 24,
              display: "flex",
              gap: 12,
              zIndex: 999,
            }}
          >
            <Button variant="success" onClick={saveInvoiceToBackend} disabled={saving} style={{ minWidth: 120 }}>
              {saving ? "Saving..." : "Save"}
            </Button>

            <Button variant="primary" onClick={handlePrint} disabled={saving} style={{ minWidth: 120 }}>
              Print
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
