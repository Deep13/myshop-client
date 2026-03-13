import React, { useEffect, useMemo, useRef, useState } from "react";
import { Form, Table, Button, Card, Modal } from "react-bootstrap";
import { IoMdAddCircle } from "react-icons/io";
import { useSearchParams } from "react-router-dom";
const API_BASE = "http://localhost/myshop-backend";
const todayISO = () => new Date().toISOString().slice(0, 10);
function SimpleModal({ show, title, onClose, children, footer }) {
  React.useEffect(() => {
    if (!show) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: "100%",
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid #eee",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 700 }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              border: "1px solid #ddd",
              background: "#fff",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 14 }}>{children}</div>

        {footer ? (
          <div
            style={{
              padding: 14,
              borderTop: "1px solid #eee",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
// -------------------- Initial Item Master --------------------
const INITIAL_ITEM_MASTER = [
  { id: 1, code: "PCM650", name: "Paracetamol 650", hsn: "30045010", mrp: 50, salePrice: 48, purchasePrice: 40, tax: 12 },
  { id: 2, code: "CET10", name: "Cetirizine 10", hsn: "30049099", mrp: 30, salePrice: 28, purchasePrice: 22, tax: 5 },
  { id: 3, code: "OMP20", name: "Omeprazole 20", hsn: "30049099", mrp: 90, salePrice: 85, purchasePrice: 70, tax: 12 },
];

// -------------------- helpers --------------------
const asNum = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};

const blankRow = () => ({
  itemName: "",
  code: "",
  hsn: "",
  batchNo: "",
  expDate: "",
  mrp: "",
  qty: "",
  purchasePrice: "",
  salePrice: "",
  discount: "",
  tax: "",
  amount: "",
});

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

// Net amount before tax (qty * purchasePrice - discount)
function calcRowAmount(row) {
  const qty = asNum(row.qty);
  const unit = asNum(row.purchasePrice);
  const base = qty * unit;

  const hasDisc = Boolean(String(row.discount || "").trim());
  if (!hasDisc) return base;

  const d = parsePercentOrNumber(row.discount);
  let discValue = 0;
  if (d.type === "percent") discValue = (base * d.value) / 100;
  else discValue = d.value;

  if (discValue > base) discValue = base;
  return base - discValue;
}

export default function AddPurchase() {
  // -------------------- Item Master as state (editable) --------------------
  const [itemMaster, setItemMaster] = useState(INITIAL_ITEM_MASTER);
  // -------------------- Payments --------------------
  const [searchParams] = useSearchParams();
  const purchaseId = searchParams.get("purchaseId"); // string or null
  const isEdit = Boolean(purchaseId);
  useEffect(() => {
    if (!purchaseId) return;

    const loadPurchase = async () => {
      try {
        const res = await fetch(`${API_BASE}/get_purchase.php?id=${purchaseId}`);
        const json = await res.json();

        if (!res.ok || json.status !== "success") {
          throw new Error(json.message || "Failed to load purchase");
        }

        const h = json.header;
        const items = json.items;
        const payments = json.payments || [];

        // ---------- header ----------
        setSelectedDistributor({
          id: h.distributor_id,
          name: h.distributor_name,
          gstin: h.distributor_gstin,
        });
        setDistQuery(`${h.distributor_name}${h.distributor_gstin ? ` (${h.distributor_gstin})` : ""}`);
        setGstin(h.distributor_gstin || "");

        setBillNo(h.bill_no);
        setBillDate(h.bill_date);
        setDueDate(h.due_date);

        // ---------- items ----------
        setRows(
          items.map((r) => ({
            itemName: r.item_name,
            code: r.item_code,
            hsn: r.hsn,
            batchNo: r.batch_no,
            expDate: r.exp_date,
            mrp: r.mrp,
            qty: r.qty,
            purchasePrice: r.purchase_price,
            salePrice: r.sale_price,
            discount: r.discount,
            tax: r.tax,
            amount: r.amount,
          })),
        );

        // ---------- round off ----------
        setRoundOffEnabled(Boolean(h.round_off_enabled));
        setRoundOffDiff(Number(h.round_off_diff));
        setRoundedGrandTotal(Number(h.rounded_grand_total));

        // ---------- payments ----------
        setPayments(
          payments.map((p) => ({
            id: p.id,
            date: p.pay_date,
            mode: p.mode,
            amount: p.amount,
            reference: p.reference_no,
            note: p.note,
          })),
        );
      } catch (e) {
        alert(e.message);
      }
    };

    loadPurchase();
  }, [purchaseId]);

  const itemSuggestions = (text) => {
    const q = String(text || "")
      .trim()
      .toLowerCase();
    if (!q) return [];
    return itemMaster
      .filter((it) => {
        const name = (it.name || "").toLowerCase();
        const code = (it.code || "").toLowerCase();
        const hsn = String(it.hsn || "").toLowerCase();
        return name.includes(q) || code.includes(q) || hsn.includes(q);
      })
      .slice(0, 8);
  };

  const findItemByExactCode = (text) => {
    const q = String(text || "")
      .trim()
      .toLowerCase();
    if (!q) return null;
    return (
      itemMaster.find(
        (it) =>
          String(it.code || "")
            .trim()
            .toLowerCase() === q,
      ) || null
    );
  };

  // -------------------- Distributor / Bill info --------------------
  const [distributorName, setDistributorName] = useState("");
  const [gstin, setGstin] = useState("");
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(todayISO());

  // -------------------- Items table --------------------
  const [rows, setRows] = useState([blankRow(), blankRow()]);
  const itemNameRefs = useRef({});
  const batchRefs = useRef({}); // ✅ focus to batch on select
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
      updated.amount = calcRowAmount(updated).toFixed(2);
      next[index] = updated;
      return next;
    });
  };

  // ✅ Item pick -> focus batch field same row (no jump to next row)
  const onPickItem = (rowIndex, item) => {
    setActiveItemRow(null);

    const filled = {
      itemName: item.name,
      code: item.code,
      hsn: item.hsn || "",
      mrp: item.mrp ?? "",
      salePrice: item.salePrice ?? "",
      purchasePrice: item.purchasePrice ?? "",
      tax: item.tax ?? "",
      qty: 1,
      discount: "",
      // Keep existing batch/exp if already typed, else blank
      batchNo: rows[rowIndex]?.batchNo || "",
      expDate: rows[rowIndex]?.expDate || "",
    };

    setRows((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], ...filled };
      next[rowIndex].amount = calcRowAmount(next[rowIndex]).toFixed(2);

      // ensure one extra blank row exists
      if (rowIndex === next.length - 1) next.push(blankRow());
      return next;
    });

    // focus batch field
    setTimeout(() => {
      batchRefs.current[rowIndex]?.focus();
    }, 0);
  };

  // -------------------- Totals --------------------
  const subTotal = useMemo(() => rows.reduce((acc, r) => acc + asNum(r.amount), 0), [rows]);

  const taxTotal = useMemo(() => {
    return rows.reduce((acc, r) => {
      const amt = asNum(r.amount);
      const taxPct = asNum(r.tax);
      return acc + (amt * taxPct) / 100;
    }, 0);
  }, [rows]);

  const grandTotal = useMemo(() => subTotal + taxTotal, [subTotal, taxTotal]);
  // -------------------- Round Off --------------------
  const [roundOffEnabled, setRoundOffEnabled] = useState(true);
  const [roundOffDiff, setRoundOffDiff] = useState(0);
  const [roundedGrandTotal, setRoundedGrandTotal] = useState(grandTotal);

  useEffect(() => {
    if (!roundOffEnabled) return;
    setRoundedGrandTotal(Math.ceil(grandTotal));
  }, [grandTotal, roundOffEnabled]);

  useEffect(() => {
    // return roundedGrandTotal - grandTotal;
    setRoundOffDiff(roundedGrandTotal - grandTotal);
  }, [roundedGrandTotal, grandTotal]);
  const [multiPayment, setMultiPayment] = useState(false);

  const [paymentType, setPaymentType] = useState("Cash"); // single payment mode
  const [received, setReceived] = useState("0"); // single received amount (string)

  const blankPayment = () => ({ type: "Cash", amount: "" });
  const [payments, setPayments] = useState([blankPayment()]); // multi payments
  const [receivedTouched, setReceivedTouched] = useState(false);

  useEffect(() => {
    if (!multiPayment && !receivedTouched) {
      setReceived(roundedGrandTotal.toFixed(2));
    }
  }, [roundedGrandTotal, multiPayment, receivedTouched]);

  const sumPayments = useMemo(() => {
    return payments.reduce((acc, p) => acc + asNum(p.amount), 0);
  }, [payments]);

  const totalPaid = useMemo(() => {
    return multiPayment ? sumPayments : asNum(received);
  }, [multiPayment, sumPayments, received]);
  const balance = useMemo(() => {
    return asNum(roundedGrandTotal) - asNum(totalPaid);
  }, [roundedGrandTotal, totalPaid]);

  const updatePaymentRow = (idx, patch) => {
    setPayments((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const addMorePayment = () => setPayments((prev) => [...prev, blankPayment()]);
  const removePayment = (idx) => setPayments((prev) => prev.filter((_, i) => i !== idx));

  // -------------------- Add Item Modal --------------------
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({
    itemName: "",
    itemCode: "",
    batchNo: "",
    expDate: "",
    hsn: "",
    mrp: "",
    salePrice: "",
    purchasePrice: "",
    qty: 1,
    tax: "",
    is_primary: true, // ✅ NEW
  });

  const resetNewItem = () =>
    setNewItem({
      itemName: "",
      itemCode: "",
      batchNo: "",
      expDate: "",
      hsn: "",
      mrp: "",
      salePrice: "",
      purchasePrice: "",
      qty: 1,
      tax: "",
      is_primary: true, // ✅ NEW
    });

  const openAddItem = () => {
    resetNewItem();
    setShowAddItem(true);
  };

  const closeAddItem = () => {
    console.log("Closing Add Item Modal");
    setShowAddItem(false);
  };
  const [selectedDistributor, setSelectedDistributor] = useState(null); // {id,name,gstin,phone}
  const onSelectDistributor = (d) => {
    setSelectedDistributor(d);
    setDistributorName(d.name);
    setGstin(d.gstin || "");
    setDistQuery(`${d.name}${d.gstin ? ` (${d.gstin})` : ""}`);
    setShowDistSug(false);
  };
  const enforceDistributorSelection = () => {
    if (!selectedDistributor) {
      setDistQuery("");
      setDistributorName("");
      setGstin("");
    }
  };
  const [showAddDist, setShowAddDist] = useState(false);
  const [newDist, setNewDist] = useState({ name: "", gstin: "", phone: "" });
  const openAddDistributor = () => {
    setNewDist({ name: "", gstin: "", phone: "" });
    setShowAddDist(true);
  };

  const saveNewDistributor = async () => {
    const name = newDist.name.trim();
    if (!name) return alert("Distributor name required");

    const res = await fetch(`${API_BASE}/add_distributor.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        gstin: newDist.gstin.trim(),
        phone: newDist.phone.trim(),
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.status !== "success") {
      alert(json.message || "Failed to add distributor");
      return;
    }

    // Auto-select newly created distributor
    const created = json.data;
    onSelectDistributor(created);

    setShowAddDist(false);
  };

  const addItemToMasterAndInsert = async () => {
    const name = String(newItem.itemName || "").trim();
    const code = String(newItem.itemCode || "").trim();

    if (!name) return alert("Item Name is required");
    if (!code) return alert("Item Code is required");

    const codeLower = code.toLowerCase();
    const exists = itemMaster.some((it) => String(it.code || "").toLowerCase() === codeLower);
    if (exists) return alert("Item Code already exists. Use a unique code.");
    try {
      const res = await fetch(`${API_BASE}/add_item.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code,
          hsn: String(newItem.hsn || "").trim(),
          mrp: asNum(newItem.mrp),
          salePrice: asNum(newItem.salePrice),
          purchasePrice: asNum(newItem.purchasePrice),
          tax: asNum(newItem.tax),
          is_primary: !!newItem.is_primary,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Failed to add item");
      }

      const created = json.data;

      // Add to local master
      setItemMaster((prev) => [created, ...prev]);

      // Insert into current row
      setRows((prev) => {
        const next = [...prev];
        const idx = typeof activeItemRow === "number" && activeItemRow >= 0 && activeItemRow < next.length ? activeItemRow : next.findIndex((r) => !String(r.itemName || "").trim());

        const target = idx >= 0 ? idx : next.length - 1;

        next[target] = {
          ...next[target],
          itemName: created.name,
          code: created.code,
          hsn: created.hsn || "",
          mrp: created.mrp ?? "",
          salePrice: created.salePrice ?? "",
          purchasePrice: created.purchasePrice ?? "",
          tax: created.tax,
          qty: 1,
          discount: "",
        };

        next[target].amount = calcRowAmount(next[target]).toFixed(2);
        if (target === next.length - 1) next.push(blankRow());

        setTimeout(() => batchRefs.current[target]?.focus(), 0);
        return next;
      });

      setShowAddItem(false);
    } catch (e) {
      alert(e.message || "Failed");
    }
  };

  // -------------------- Save Purchase (JSON) --------------------
  const [saving, setSaving] = useState(false);
  const [distQuery, setDistQuery] = useState("");
  const [distSug, setDistSug] = useState([]);
  const [showDistSug, setShowDistSug] = useState(false);
  const distBoxRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!distBoxRef.current) return;
      if (!distBoxRef.current.contains(e.target)) setShowDistSug(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const q = distQuery.trim();
    if (!q) {
      setDistSug([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/get_distributors.php?q=${encodeURIComponent(q)}&limit=8`);
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.status === "success") setDistSug(json.data || []);
        else setDistSug([]);
      } catch {
        setDistSug([]);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [distQuery]);

  const onSavePurchase = async () => {
    if (isEdit) {
      await updatePurchase();
    } else {
      await createPurchase();
    }
  };

  const createPurchase = async () => {
    try {
      setSaving(true);

      if (!selectedDistributor) return alert("Please select a Distributor from suggestions.");

      if (!billNo.trim()) return alert("Bill No required");

      const cleanRows = rows
        .map((r) => ({
          itemName: String(r.itemName || "").trim(),
          code: String(r.code || "").trim(),
          hsn: String(r.hsn || "").trim(),
          batchNo: String(r.batchNo || "").trim(),
          expDate: r.expDate || "",
          mrp: asNum(r.mrp),
          qty: asNum(r.qty),
          purchasePrice: asNum(r.purchasePrice),
          salePrice: asNum(r.salePrice),
          discount: String(r.discount || "").trim(),
          tax: asNum(r.tax),
          amount: asNum(r.amount),
        }))
        .filter((r) => r.itemName && r.qty > 0);

      if (!cleanRows.length) return alert("Add at least 1 item.");

      const paymentList = multiPayment ? payments.map((p) => ({ type: p.type, amount: asNum(p.amount) })).filter((p) => p.amount > 0) : [{ type: paymentType, amount: asNum(received) }];
      if (paymentList.length === 0) return alert("Enter payment amount.");
      if (paymentList.some((p) => p.amount < 0)) return alert("Payment cannot be negative.");
      const user = await localStorage.getItem("user");
      const userObj = user ? JSON.parse(user) : null;

      const payload = {
        distributorId: selectedDistributor.id,
        distributorName: selectedDistributor.name,
        gstin: gstin.trim(),
        billNo: billNo.trim(),
        billDate,
        dueDate,
        rows: cleanRows,
        totals: {
          subTotal: asNum(subTotal),
          taxTotal: asNum(taxTotal),
          grandTotal: asNum(grandTotal),
          roundOffEnabled,
          roundOffDiff: asNum(roundOffDiff),
          roundedGrandTotal: asNum(roundedGrandTotal),
        },
        payments: paymentList,
        createdBy: userObj?.id, // TODO: replace with actual logged in user ID
      };

      const res = await fetch(`${API_BASE}/save_purchase.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.status !== "success") throw new Error(json.message || "Save failed");
      const purchaseId = json.purchaseId;

      // save payments (if any amount > 0)
      for (const p of paymentList) {
        if (!p.amount || p.amount <= 0) continue;

        await fetch(`${API_BASE}/add_purchase_payment.php`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            distributorId: selectedDistributor.id,
            purchaseId,
            payDate: billDate, // default
            mode: p.type,
            amount: p.amount,
            referenceNo: "",
            note: "",
          }),
        });
      }

      alert(`Purchase Saved! ID: ${json.purchaseId}`);
      setRows([blankRow(), blankRow()]);
      window.location.href = `/`; // redirect to view page
    } catch (e) {
      alert(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };
  const updatePurchase = async () => {
    try {
      setSaving(true);

      if (!selectedDistributor) return alert("Please select a Distributor from suggestions.");

      if (!billNo.trim()) return alert("Bill No required");

      const cleanRows = rows
        .map((r) => ({
          itemName: String(r.itemName || "").trim(),
          code: String(r.code || "").trim(),
          hsn: String(r.hsn || "").trim(),
          batchNo: String(r.batchNo || "").trim(),
          expDate: r.expDate || "",
          mrp: asNum(r.mrp),
          qty: asNum(r.qty),
          purchasePrice: asNum(r.purchasePrice),
          salePrice: asNum(r.salePrice),
          discount: String(r.discount || "").trim(),
          tax: asNum(r.tax),
          amount: asNum(r.amount),
        }))
        .filter((r) => r.itemName && r.qty > 0);

      if (!cleanRows.length) return alert("Add at least 1 item.");

      const paymentList = multiPayment ? payments.map((p) => ({ type: p.type, amount: asNum(p.amount) })).filter((p) => p.amount > 0) : [{ type: paymentType, amount: asNum(received) }];
      if (paymentList.length === 0) return alert("Enter payment amount.");
      if (paymentList.some((p) => p.amount < 0)) return alert("Payment cannot be negative.");
      const user = await localStorage.getItem("user");
      const userObj = user ? JSON.parse(user) : null;

      const payload = {
        purchaseId: Number(purchaseId), // from URL ?purchaseId=10
        distributorId: selectedDistributor.id,
        distributorName: selectedDistributor.name,
        gstin: gstin.trim(),
        billNo: billNo.trim(),
        billDate,
        dueDate,
        rows: cleanRows,
        totals: {
          subTotal: asNum(subTotal),
          taxTotal: asNum(taxTotal),
          grandTotal: asNum(grandTotal),
          roundOffEnabled,
          roundOffDiff: asNum(roundOffDiff),
          roundedGrandTotal: asNum(roundedGrandTotal),
        },
        payments: paymentList,
        updatedBy: userObj?.id, // TODO: replace with actual logged in user ID
      };

      const res = await fetch(`${API_BASE}/update_purchase.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Update failed");
      }

      alert(`Purchase Updated! ID: ${json.purchaseId}`);

      window.location.href = `/purchase`;
    } catch (e) {
      alert(e.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 20, background: "#fff", textAlign: "left" }}>
      <h3>Purchase Entry</h3>

      {/* -------------------- Header details -------------------- */}
      <Card style={{ borderRadius: 10, border: "1px solid #00000025", marginTop: 12 }}>
        <Card.Body>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div ref={distBoxRef} style={{ position: "relative", flex: 1 }}>
              <Form.Label>Distributor (Select)</Form.Label>
              <Form.Control
                value={distQuery}
                onChange={(e) => {
                  // typing allowed only to search, but MUST select from dropdown
                  setSelectedDistributor(null);
                  setDistQuery(e.target.value);
                  setShowDistSug(true);
                }}
                onFocus={() => setShowDistSug(true)}
                onBlur={() => {
                  // enforce selection after leaving the field
                  setTimeout(enforceDistributorSelection, 150);
                }}
                placeholder="Type name or GSTIN to search..."
                autoComplete="off"
              />

              {showDistSug && distSug.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: "#fff",
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    marginTop: 6,
                    maxHeight: 220,
                    overflow: "auto",
                  }}
                >
                  {distSug.map((d) => (
                    <div key={d.id} onMouseDown={() => onSelectDistributor(d)} style={{ padding: "10px 12px", cursor: "pointer" }}>
                      <div style={{ fontWeight: 700 }}>{d.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        GSTIN: {d.gstin || "-"} {d.phone ? ` • ${d.phone}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button variant="outline-primary" onClick={openAddDistributor}>
              + Add Distributor
            </Button>
          </div>

          {/* GSTIN is auto-filled (readonly) */}
          <div style={{ width: 300, marginTop: 10 }}>
            <Form.Label>GSTIN</Form.Label>
            <Form.Control value={gstin} disabled />
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <div style={{ width: 220 }}>
              <Form.Label>Bill No</Form.Label>
              <Form.Control value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="BILL123" />
            </div>
            <div style={{ width: 220 }}>
              <Form.Label>Bill Date</Form.Label>
              <Form.Control type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
            </div>
            <div style={{ width: 220 }}>
              <Form.Label>Due Date</Form.Label>
              <Form.Control type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* -------------------- Items table -------------------- */}
      <Table bordered className="text-start" style={{ marginTop: 18 }}>
        <thead>
          <tr className="align-middle">
            <th style={{ width: 280 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span>Item Name / Code</span>
                <IoMdAddCircle size={22} style={{ cursor: "pointer", color: "#034C9D" }} title="Add new item" onClick={openAddItem} />
              </div>
            </th>
            <th style={{ width: 90 }}>Code</th>
            <th style={{ width: 110 }}>HSN</th>
            <th style={{ width: 110 }}>Batch</th>
            <th style={{ width: 140 }}>Exp</th>
            <th style={{ width: 80 }}>MRP</th>
            <th style={{ width: 70 }}>QTY</th>
            <th style={{ width: 120 }}>Purchase Price</th>
            <th style={{ width: 120 }}>Sale Price</th>
            <th style={{ width: 110 }}>Discount</th>
            <th style={{ width: 70 }}>Tax %</th>
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

                      // exact code match -> pick
                      const matched = findItemByExactCode(val);
                      if (matched) onPickItem(idx, matched);
                    }}
                    onFocus={() => {
                      setActiveItemRow(idx);
                    }}
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
                            HSN: {it.hsn || "-"} • MRP: ₹{it.mrp} • Purchase: ₹{it.purchasePrice} • Sale: ₹{it.salePrice}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </td>

                <td>
                  <Form.Control style={{ border: 0, boxShadow: "none" }} value={r.code} onChange={(e) => updateRow(idx, { code: e.target.value })} />
                </td>
                <td>
                  <Form.Control style={{ border: 0, boxShadow: "none" }} value={r.hsn} onChange={(e) => updateRow(idx, { hsn: e.target.value })} />
                </td>

                <td>
                  <Form.Control
                    ref={(el) => (batchRefs.current[idx] = el)} // ✅ focus here after item pick
                    style={{ border: 0, boxShadow: "none" }}
                    value={r.batchNo}
                    onChange={(e) => updateRow(idx, { batchNo: e.target.value })}
                  />
                </td>

                <td>
                  <Form.Control style={{ border: 0, boxShadow: "none" }} type="date" value={r.expDate} onChange={(e) => updateRow(idx, { expDate: e.target.value })} />
                </td>

                <td>
                  <Form.Control style={{ border: 0, boxShadow: "none" }} value={r.mrp} onChange={(e) => updateRow(idx, { mrp: e.target.value })} inputMode="decimal" />
                </td>
                <td>
                  <Form.Control style={{ border: 0, boxShadow: "none" }} value={r.qty} onChange={(e) => updateRow(idx, { qty: e.target.value })} inputMode="decimal" />
                </td>
                <td>
                  <Form.Control style={{ border: 0, boxShadow: "none" }} value={r.purchasePrice} onChange={(e) => updateRow(idx, { purchasePrice: e.target.value })} inputMode="decimal" />
                </td>
                <td>
                  <Form.Control style={{ border: 0, boxShadow: "none" }} value={r.salePrice} onChange={(e) => updateRow(idx, { salePrice: e.target.value })} inputMode="decimal" />
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

      {/* -------------------- Totals + Save -------------------- */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          Amount = Qty × Purchase Price (minus Discount). Tax is calculated separately.
          <Card style={{ borderRadius: 10, border: "1px solid #00000025", marginTop: 16 }}>
            <Card.Body>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h5 style={{ margin: 0 }}>Payment</h5>

                <Form.Check
                  type="switch"
                  id="multiPaySwitch"
                  label={multiPayment ? "Multiple payments" : "Single payment"}
                  checked={multiPayment}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setMultiPayment(on);
                    if (!on) {
                      // switch to single mode
                      setReceivedTouched(false);
                      setPayments([blankPayment()]);
                    } else {
                      // switch to multi mode
                      setReceivedTouched(true);
                      if (payments.length === 0) setPayments([blankPayment()]);
                    }
                  }}
                />
              </div>

              {!multiPayment ? (
                <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "flex-end" }}>
                  <div style={{ width: 220 }}>
                    <Form.Label>Payment Mode</Form.Label>
                    <Form.Select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Card">Card</option>
                      <option value="Bank">Bank</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Other">Other</option>
                    </Form.Select>
                  </div>

                  <div style={{ width: 220 }}>
                    <Form.Label>Received</Form.Label>
                    <Form.Control
                      value={received}
                      onChange={(e) => {
                        setReceivedTouched(true);
                        setReceived(e.target.value);
                      }}
                      inputMode="decimal"
                      placeholder="0.00"
                    />
                  </div>

                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Balance</div>
                    <div style={{ fontWeight: 800, color: balance <= 0 ? "green" : "#b00020" }}>₹ {balance.toFixed(2)}</div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ marginTop: 12 }}>
                    {payments.map((p, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "flex-end",
                          marginBottom: 10,
                        }}
                      >
                        <div style={{ width: 220 }}>
                          <Form.Label>{i === 0 ? "Payment Mode" : " "}</Form.Label>
                          <Form.Select value={p.type} onChange={(e) => updatePaymentRow(i, { type: e.target.value })}>
                            <option value="Cash">Cash</option>
                            <option value="UPI">UPI</option>
                            <option value="Card">Card</option>
                            <option value="Bank">Bank</option>
                            <option value="Cheque">Cheque</option>
                            <option value="Other">Other</option>
                          </Form.Select>
                        </div>

                        <div style={{ width: 220 }}>
                          <Form.Label>{i === 0 ? "Amount" : " "}</Form.Label>
                          <Form.Control value={p.amount} onChange={(e) => updatePaymentRow(i, { amount: e.target.value })} inputMode="decimal" placeholder="0.00" />
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          {payments.length > 1 && (
                            <Button variant="outline-danger" size="sm" onClick={() => removePayment(i)} style={{ height: 38 }}>
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button variant="outline-primary" size="sm" onClick={addMorePayment}>
                    Add More Payment
                  </Button>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 20, marginTop: 12 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>Total Paid</div>
                      <div style={{ fontWeight: 800 }}>₹ {totalPaid.toFixed(2)}</div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>Balance</div>
                      <div style={{ fontWeight: 800, color: balance <= 0 ? "green" : "#b00020" }}>₹ {balance.toFixed(2)}</div>
                    </div>
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </div>

        <div style={{ width: 420 }}>
          <div style={{ marginTop: 10 }}>
            <Form.Check
              type="checkbox"
              label="Round off to next rupee"
              checked={roundOffEnabled}
              onChange={(e) => {
                setRoundOffEnabled(e.target.checked);
              }}
            />

            {roundOffEnabled && <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>Round off: +₹ {roundOffDiff.toFixed(2)}</div>}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <div>Subtotal</div>
            <div>₹ {subTotal.toFixed(2)}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <div>Tax Total</div>
            <div>₹ {taxTotal.toFixed(2)}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <div>Grand Total</div>
            <div>₹ {roundedGrandTotal.toFixed(2)}</div>
          </div>

          <Button style={{ marginTop: 12, width: "100%" }} variant="success" onClick={() => (purchaseId ? updatePurchase() : createPurchase())} disabled={saving}>
            {saving ? "Saving..." : purchaseId ? "Update Purchase" : "Save Purchase"}
          </Button>
        </div>
      </div>

      <SimpleModal
        show={showAddItem}
        title="Add New Item"
        onClose={closeAddItem}
        footer={
          <>
            <Button variant="secondary" onClick={closeAddItem}>
              Cancel
            </Button>
            <Button variant="primary" onClick={addItemToMasterAndInsert}>
              Save Item
            </Button>
          </>
        }
      >
        {/* --- Your form fields --- */}
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Form.Label>Item Name</Form.Label>
            <Form.Control value={newItem.itemName} onChange={(e) => setNewItem((p) => ({ ...p, itemName: e.target.value }))} />
          </div>
          <div style={{ width: 180 }}>
            <Form.Label>Item Code</Form.Label>
            <Form.Control value={newItem.itemCode} onChange={(e) => setNewItem((p) => ({ ...p, itemCode: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <Form.Label>Batch No</Form.Label>
            <Form.Control value={newItem.batchNo} onChange={(e) => setNewItem((p) => ({ ...p, batchNo: e.target.value }))} />
          </div>
          <div style={{ width: 200 }}>
            <Form.Label>Expiry</Form.Label>
            <Form.Control type="date" value={newItem.expDate} onChange={(e) => setNewItem((p) => ({ ...p, expDate: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
          <div style={{ width: 160 }}>
            <Form.Label>HSN</Form.Label>
            <Form.Control value={newItem.hsn} onChange={(e) => setNewItem((p) => ({ ...p, hsn: e.target.value }))} />
          </div>
          <div style={{ width: 120 }}>
            <Form.Label>Tax %</Form.Label>
            <Form.Control value={newItem.tax} onChange={(e) => setNewItem((p) => ({ ...p, tax: e.target.value }))} inputMode="decimal" />
          </div>
          <div style={{ width: 120 }}>
            <Form.Label>Quantity</Form.Label>
            <Form.Control value={newItem.qty} onChange={(e) => setNewItem((p) => ({ ...p, qty: e.target.value }))} inputMode="decimal" />
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
          <div style={{ width: 140 }}>
            <Form.Label>MRP</Form.Label>
            <Form.Control value={newItem.mrp} onChange={(e) => setNewItem((p) => ({ ...p, mrp: e.target.value }))} inputMode="decimal" />
          </div>
          <div style={{ width: 160 }}>
            <Form.Label>Sale Price</Form.Label>
            <Form.Control value={newItem.salePrice} onChange={(e) => setNewItem((p) => ({ ...p, salePrice: e.target.value }))} inputMode="decimal" />
          </div>
          <div style={{ width: 160 }}>
            <Form.Label>Purchase Price</Form.Label>
            <Form.Control value={newItem.purchasePrice} onChange={(e) => setNewItem((p) => ({ ...p, purchasePrice: e.target.value }))} inputMode="decimal" />
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 10, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant={newItem.is_primary ? "primary" : "outline-primary"} size="sm" onClick={() => setNewItem((p) => ({ ...p, is_primary: true }))}>
              Primary
            </Button>

            <Button variant={!newItem.is_primary ? "primary" : "outline-primary"} size="sm" onClick={() => setNewItem((p) => ({ ...p, is_primary: false }))}>
              Non-primary
            </Button>
          </div>
        </div>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 10 }}>
          Press <b>Esc</b> to close. Click outside to close.
        </div>
      </SimpleModal>

      <SimpleModal
        show={showAddDist}
        title="Add Distributor"
        onClose={() => setShowAddDist(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddDist(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveNewDistributor}>
              Save
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <Form.Label>Distributor Name</Form.Label>
            <Form.Control value={newDist.name} onChange={(e) => setNewDist((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. ABC Distributors" />
          </div>

          <div>
            <Form.Label>GST Number (GSTIN)</Form.Label>
            <Form.Control value={newDist.gstin} onChange={(e) => setNewDist((p) => ({ ...p, gstin: e.target.value }))} placeholder="Optional" />
          </div>

          <div>
            <Form.Label>Phone Number</Form.Label>
            <Form.Control value={newDist.phone} onChange={(e) => setNewDist((p) => ({ ...p, phone: e.target.value }))} placeholder="Optional" />
          </div>
        </div>
      </SimpleModal>
    </div>
  );
}
