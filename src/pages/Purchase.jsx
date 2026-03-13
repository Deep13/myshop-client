import React, { useEffect, useMemo, useState } from "react";
import { Form, Table, Card, Button } from "react-bootstrap";
import { FaSortUp, FaSortDown } from "react-icons/fa";
import { IoMdAddCircle } from "react-icons/io";
import { Link, useNavigate } from "react-router-dom";
import { FaMoneyBillWave, FaTrash } from "react-icons/fa";
const API_BASE = "http://localhost/myshop-backend";
import { Modal } from "react-bootstrap";
const formatDate = (d) => d.toISOString().split("T")[0];
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
export default function Purchase() {
  const navigate = useNavigate();
  const [showPay, setShowPay] = useState(false);
  const [payRow, setPayRow] = useState(null); // selected purchase row
  const todayISO = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };
  const [payDate, setPayDate] = useState(todayISO());
  const blankPay = () => ({ type: "Cash", amount: "", referenceNo: "", note: "" });
  const [payLines, setPayLines] = useState([blankPay()]);
  const [paySaving, setPaySaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const openDeleteModal = (row) => {
    setDeleteRow(row);
    setShowDelete(true);
  };

  const closeDeleteModal = () => {
    setShowDelete(false);
    setDeleteRow(null);
  };
  const deletePurchase = async () => {
    if (!deleteRow) return;

    try {
      setDeleting(true);

      const deletedBy = Number(localStorage.getItem("userId") || 0); // optional

      const res = await fetch(`${API_BASE}/delete_purchase.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId: deleteRow.id,
          deletedBy,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Delete failed");
      }

      alert("Deleted");
      closeDeleteModal();
      fetchPurchases(); // refresh list
    } catch (e) {
      alert(e.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const openPayModal = (row) => {
    setPayRow(row);
    setPayDate(todayISO());
    setPayLines([{ ...blankPay(), amount: Number(row.round_off_enabled ? row.rounded_grand_total - row.paid_amount : row.grand_total - row.paid_amount || 0).toFixed(2) }]); // prefill balance as amount
    setShowPay(true);
  };

  const closePayModal = () => {
    setShowPay(false);
    setPayRow(null);
  };

  const updatePayLine = (idx, patch) => {
    setPayLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const addPayLine = () => setPayLines((prev) => [...prev, blankPay()]);
  const removePayLine = (idx) => setPayLines((prev) => prev.filter((_, i) => i !== idx));

  const savePayments = async () => {
    if (!payRow) return;

    const lines = payLines
      .map((p) => ({
        type: p.type,
        amount: Number(p.amount || 0),
        referenceNo: String(p.referenceNo || "").trim(),
        note: String(p.note || "").trim(),
      }))
      .filter((p) => p.amount > 0);

    if (!lines.length) return alert("Enter at least one payment amount.");

    try {
      setPaySaving(true);

      // Save each payment line
      for (const p of lines) {
        const res = await fetch(`${API_BASE}/add_purchase_payment.php`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            distributorId: payRow.distributor_id, // make sure your row has this key
            purchaseId: payRow.id, // purchase id
            payDate, // common date for all lines (simple)
            mode: p.type,
            amount: p.amount,
            referenceNo: p.referenceNo,
            note: p.note,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.status !== "success") {
          throw new Error(json.message || "Failed to add payment");
        }
      }

      alert("Payment saved");
      closePayModal();

      // refresh purchase list
      await fetchPurchases(); // your list reload function
    } catch (e) {
      alert(e.message || "Payment save failed");
    } finally {
      setPaySaving(false);
    }
  };
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    dateRange: "This Month",
    q: "", // distributor search (name/gstin)
    status: "", // Paid / Unpaid / Partial
  });

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [sortConfig, setSortConfig] = useState({ key: "bill_date", direction: "desc" });

  // Auto set date range
  useEffect(() => {
    applyDateRange(filters.dateRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.dateRange]);

  const applyDateRange = (range) => {
    const today = new Date();
    let from = "";
    let to = "";

    switch (range) {
      case "Today":
        from = to = formatDate(today);
        break;

      case "Yesterday": {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        from = to = formatDate(y);
        break;
      }

      case "This Week": {
        const startWeek = new Date(today);
        startWeek.setDate(today.getDate() - today.getDay());
        from = formatDate(startWeek);
        to = formatDate(today);
        break;
      }

      case "This Month": {
        const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        from = formatDate(startMonth);
        to = formatDate(today);
        break;
      }

      case "Last Month": {
        const firstLast = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastLast = new Date(today.getFullYear(), today.getMonth(), 0);
        from = formatDate(firstLast);
        to = formatDate(lastLast);
        break;
      }

      case "This Quarter": {
        const quarter = Math.floor(today.getMonth() / 3);
        const startQuarter = new Date(today.getFullYear(), quarter * 3, 1);
        from = formatDate(startQuarter);
        to = formatDate(today);
        break;
      }

      case "This Year":
        from = `${today.getFullYear()}-01-01`;
        to = formatDate(today);
        break;

      case "Custom":
        return;

      default:
        return;
    }

    setFilters((prev) => ({ ...prev, from, to }));
  };

  const handleChange = (e) => setFilters((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleChangeDate = (e) => setFilters((p) => ({ ...p, dateRange: "Custom", [e.target.name]: e.target.value }));

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      setError("");

      const qs = new URLSearchParams();
      if (filters.from) qs.set("from", filters.from);
      if (filters.to) qs.set("to", filters.to);
      if (filters.q) qs.set("q", filters.q);
      if (filters.status) qs.set("status", filters.status);
      qs.set("limit", "500");

      const url = `${API_BASE}/get_purchase_bills.php?${qs.toString()}`;
      const res = await fetch(url);
      const json = await res.json().catch(() => ({}));

      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Failed to load purchase bills");
      }

      const mapped = (json.data || []).map((r) => ({
        id: Number(r.id),
        bill_date: r.bill_date,
        bill_no: r.bill_no,
        distributor_name: r.distributor_name,
        distributor_gstin: r.distributor_gstin,
        distributor_id: r.distributor_id,
        due_date: r.due_date,
        grand_total: Number(r.grand_total || 0),
        paid_amount: Number(r.paid_amount || 0),
        payment_status: r.payment_status || "Unpaid",
        round_off_enabled: r.round_off_enabled == "1",
        rounded_grand_total: Number(r.rounded_grand_total || 0),
      }));

      setData(mapped);
    } catch (e) {
      setError(e.message || "Failed");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // fetch when filters change
  useEffect(() => {
    const t = setTimeout(fetchPurchases, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.from, filters.to, filters.q, filters.status]);

  // Sorting
  const requestSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const sortedData = useMemo(() => {
    const arr = [...data];
    const { key, direction } = sortConfig;

    const compare = (a, b) => {
      let va = a[key];
      let vb = b[key];

      if (key.includes("date")) {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      } else if (key.includes("total") || key.includes("amount")) {
        va = Number(va);
        vb = Number(vb);
      } else {
        va = String(va ?? "").toLowerCase();
        vb = String(vb ?? "").toLowerCase();
      }

      if (va < vb) return direction === "asc" ? -1 : 1;
      if (va > vb) return direction === "asc" ? 1 : -1;
      return 0;
    };

    arr.sort(compare);
    return arr;
  }, [data, sortConfig]);

  const TH = ({ colKey, label }) => (
    <th onClick={() => requestSort(colKey)} style={{ cursor: "pointer", textAlign: "left", whiteSpace: "nowrap", userSelect: "none" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span>{label}</span>
        <span style={{ display: "inline-flex", width: 14, justifyContent: "center" }}>
          {sortConfig.key === colKey ? sortConfig.direction === "asc" ? <FaSortUp /> : <FaSortDown /> : <span style={{ display: "inline-block", width: 14 }} />}
        </span>
      </span>
    </th>
  );

  // Summary totals
  const totalBills = sortedData.length;
  const totalGrand = sortedData.reduce((s, r) => s + (r.grand_total || 0), 0);
  const totalPaid = sortedData.reduce((s, r) => s + (r.paid_amount || 0), 0);
  const totalBalance = totalGrand - totalPaid;

  const statusBadge = (st) => {
    const base = {
      display: "inline-block",
      padding: "3px 8px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
    };

    if (st === "Paid") return <span style={{ ...base, background: "#d1f7d6", color: "#0f6a2a" }}>Paid</span>;
    if (st === "Partial") return <span style={{ ...base, background: "#fff0c2", color: "#7a5a00" }}>Partial</span>;
    return <span style={{ ...base, background: "#ffd7d7", color: "#8a0b0b" }}>Unpaid</span>;
  };

  const openViewOrEdit = (row) => {
    // You can change route as per your app:
    // e.g. /purchase/edit/:id or /addpurchase?id=...
    navigate(`/addpurchase?purchaseId=${row.id}`);
  };

  return (
    <div style={{ padding: 20, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h3 style={{ margin: 0, color: "#034C9D" }}>Purchase Bills</h3>
        <Link to="/addpurchase">
          <IoMdAddCircle style={{ color: "#034C9D" }} size={30} title="Add Purchase" />
        </Link>
      </div>

      <Card style={{ borderRadius: 8, width: "100%", marginTop: 20, marginBottom: 20, border: "1px solid #00000040" }}>
        <Card.Body style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800 }}>Bills: {totalBills}</div>
            <div style={{ marginTop: 6, opacity: 0.85 }}>
              Total: ₹{totalGrand.toFixed(2)} • Paid: ₹{totalPaid.toFixed(2)} • Balance: ₹{totalBalance.toFixed(2)}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Form.Select name="dateRange" value={filters.dateRange} onChange={handleChange} style={{ border: 0, minWidth: 150 }}>
              <option value="Today">Today</option>
              <option value="Yesterday">Yesterday</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
              <option value="Last Month">Last Month</option>
              <option value="This Quarter">This Quarter</option>
              <option value="This Year">This Year</option>
              <option value="Custom">Custom</option>
            </Form.Select>

            <Form.Control type="date" name="from" value={filters.from} onChange={handleChangeDate} />
            <Form.Control type="date" name="to" value={filters.to} onChange={handleChangeDate} />

            <Form.Control type="text" name="q" value={filters.q} onChange={handleChange} placeholder="Distributor name / GSTIN" style={{ minWidth: 240 }} />

            <Form.Select name="status" value={filters.status} onChange={handleChange} style={{ border: 0, minWidth: 140 }}>
              <option value="">All Status</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Partial">Partial</option>
              <option value="Paid">Paid</option>
            </Form.Select>

            <Button variant="outline-primary" onClick={fetchPurchases} disabled={loading}>
              Refresh
            </Button>
          </div>
        </Card.Body>
      </Card>

      {loading && <div style={{ marginBottom: 10 }}>Loading...</div>}
      {error && <div style={{ marginBottom: 10, color: "red" }}>{error}</div>}

      <Table bordered hover className="text-start">
        <thead>
          <tr>
            <TH colKey="bill_date" label="Bill Date" />
            <TH colKey="bill_no" label="Bill No" />
            <TH colKey="distributor_name" label="Distributor" />
            <TH colKey="due_date" label="Due Date" />
            <TH colKey="grand_total" label="Total (₹)" />
            <TH colKey="balance" label="Balance (₹)" />
            <TH colKey="paid_amount" label="Paid Amount (₹)" />
            <th style={{ textAlign: "left", whiteSpace: "nowrap" }}>Status</th>
            <th style={{ textAlign: "left", whiteSpace: "nowrap", width: 90 }}>Action</th>
          </tr>
        </thead>

        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan="8" className="text-center">
                No records found
              </td>
            </tr>
          ) : (
            sortedData.map((r) => (
              <tr key={r.id}>
                <td style={{ verticalAlign: "middle" }}>{r.bill_date}</td>
                <td style={{ verticalAlign: "middle" }}>{r.bill_no}</td>
                <td style={{ verticalAlign: "middle" }}>
                  {r.distributor_name}
                  {r.distributor_gstin ? <div style={{ fontSize: 12, opacity: 0.7 }}>{r.distributor_gstin}</div> : null}
                </td>
                <td style={{ verticalAlign: "middle" }}>{r.due_date || "-"}</td>
                <td style={{ verticalAlign: "middle" }}>₹{Number(r.round_off_enabled ? r.rounded_grand_total : r.grand_total || 0).toFixed(2)}</td>
                <td style={{ verticalAlign: "middle" }}>₹{Number(r.paid_amount || 0).toFixed(2)}</td>
                <td style={{ verticalAlign: "middle" }}>₹{Number((r.round_off_enabled ? r.rounded_grand_total - r.paid_amount : r.grand_total - r.paid_amount) || 0).toFixed(2)}</td>
                <td style={{ verticalAlign: "middle" }}>{statusBadge(r.payment_status)}</td>
                <td style={{ verticalAlign: "middle" }}>
                  <Button size="sm" variant="outline-primary" onClick={() => openViewOrEdit(r)}>
                    Open
                  </Button>
                  {r.payment_status !== "Paid" && (
                    <Button variant="link" title="Add Payment" onClick={() => openPayModal(r)} style={{ padding: 0, marginRight: 12 }}>
                      <FaMoneyBillWave />
                    </Button>
                  )}
                  <Button variant="link" className="p-0 text-danger" title="Delete" onClick={() => openDeleteModal(r)}>
                    <FaTrash />
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
      <SimpleModal
        show={showPay}
        title="Add Payment"
        onClose={() => setShowPay(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowPay(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={savePayments}>
              Save Payment
            </Button>
          </>
        }
      >
        {payRow && (
          <div style={{ fontSize: 13, marginBottom: 10, opacity: 0.85 }}>
            <div>
              <b>Bill:</b> {payRow.bill_no}
            </div>
            <div>
              <b>Distributor:</b> {payRow.distributor_name}
            </div>
            <div>
              <b>Amount:</b> ₹{Number(payRow.round_off_enabled ? payRow.rounded_grand_total : payRow.grand_total || 0).toFixed(2)}
            </div>
            <div>
              <b>Paid:</b> ₹{Number(payRow.paid_amount || 0).toFixed(2)}
            </div>
            <div>
              <b>Balance:</b> ₹{Number(payRow.round_off_enabled ? payRow.rounded_grand_total - payRow.paid_amount : payRow.grand_total - payRow.paid_amount || 0).toFixed(2)}
            </div>
          </div>
        )}

        <Form.Label>Payment Date</Form.Label>
        <Form.Control type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />

        <div style={{ marginTop: 14 }}>
          {payLines.map((p, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "160px 1fr 80px",
                gap: 10,
                alignItems: "end",
                marginBottom: 10,
              }}
            >
              <div>
                <Form.Label>{i === 0 ? "Mode" : " "}</Form.Label>
                <Form.Select value={p.type} onChange={(e) => updatePayLine(i, { type: e.target.value })}>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Bank">Bank</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other</option>
                </Form.Select>
              </div>

              <div>
                <Form.Label>{i === 0 ? "Amount" : " "}</Form.Label>
                <Form.Control value={p.amount} onChange={(e) => updatePayLine(i, { amount: e.target.value })} inputMode="decimal" placeholder="0.00" />
              </div>

              <div>
                {payLines.length > 1 && (
                  <Button variant="outline-danger" size="sm" onClick={() => removePayLine(i)}>
                    Remove
                  </Button>
                )}
              </div>

              <div style={{ gridColumn: "1 / span 3" }}>
                <Form.Label>Reference / Note (optional)</Form.Label>
                <div style={{ display: "flex", gap: 10 }}>
                  <Form.Control value={p.referenceNo} onChange={(e) => updatePayLine(i, { referenceNo: e.target.value })} placeholder="Txn / Cheque No" />
                  <Form.Control value={p.note} onChange={(e) => updatePayLine(i, { note: e.target.value })} placeholder="Note" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline-primary" size="sm" onClick={addPayLine}>
          + Add more payment
        </Button>
      </SimpleModal>
      <SimpleModal
        show={showDelete}
        title="Delete Purchase?"
        onClose={closeDeleteModal}
        footer={
          <>
            <Button variant="secondary" onClick={closeDeleteModal} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={deletePurchase} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        {deleteRow ? (
          <div style={{ lineHeight: 1.6 }}>
            <div>Are you sure you want to delete this purchase bill?</div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
              <div>
                <b>Bill No:</b> {deleteRow.bill_no}
              </div>
              <div>
                <b>Distributor:</b> {deleteRow.didtributor_name}
              </div>
              <div>
                <b>Date:</b> {deleteRow.bill_date}
              </div>
              <div>
                <b>Total:</b> ₹{Number(deleteRow.round_off_enabled ? deleteRow.rounded_grand_total : deleteRow.grand_total || 0).toFixed(2)}
              </div>
            </div>

            <div style={{ marginTop: 10, color: "#b00020", fontWeight: 700 }}>This action cannot be undone.</div>
          </div>
        ) : null}
      </SimpleModal>
    </div>
  );
}
