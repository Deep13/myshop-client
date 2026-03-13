import React, { useState, useEffect, useMemo } from "react";
import { Form, Table, Button, Card } from "react-bootstrap";
import { FaPrint, FaEdit, FaTrash, FaSortUp, FaSortDown } from "react-icons/fa";
import { IoMdAddCircle } from "react-icons/io";
import { Link } from "react-router-dom";
const API_BASE = "http://localhost/myshop-backend";
import { useNavigate } from "react-router-dom";

const initialData = [
  {
    date: "2025-01-10",
    invoice: "INV001",
    party: "ABC Traders",
    transaction: "Sale",
    paymentType: "Cash",
    amount: 1200,
  },
  {
    date: "2025-01-12",
    invoice: "INV002",
    party: "XYZ Store",
    transaction: "Sale",
    paymentType: "UPI",
    amount: 900,
  },
  {
    date: "2025-01-15",
    invoice: "INV003",
    party: "Mega Mart",
    transaction: "Sale",
    paymentType: "Card",
    amount: 2300,
  },
];

const formatDate = (d) => d.toISOString().split("T")[0];

export default function Sales() {
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    party: "",
    paymentType: "",
    dateRange: "Today",
  });
  const navigate = useNavigate();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ sorting state
  const [sortConfig, setSortConfig] = useState({ key: "date", direction: "desc" });
  const onEdit = (row) => {
    navigate(`/addsales?id=${row.invoiceId}`);
  };

  // ⏳ Automatically update From/To when date range dropdown changes
  useEffect(() => {
    applyDateRange(filters.dateRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.dateRange]);
  const fetchSales = async () => {
    try {
      setLoading(true);
      setError("");

      const qs = new URLSearchParams();
      if (filters.from) qs.set("from", filters.from);
      if (filters.to) qs.set("to", filters.to);
      if (filters.party) qs.set("party", filters.party);
      if (filters.paymentType) qs.set("paymentType", filters.paymentType);

      const url = `${API_BASE}/get_sales.php?${qs.toString()}`;
      const res = await fetch(url);
      const json = await res.json();

      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Failed to load sales");
      }

      // map backend keys -> your UI keys
      const mapped = (json.data || []).map((r) => ({
        date: r.date,
        invoice: r.invoice,
        party: r.party,
        phone: r.phone,
        transaction: r.transaction,
        paymentType: r.paymentType,
        amount: Number(r.amount || 0),
        invoiceId: r.id, // useful for edit/print/delete
      }));

      setData(mapped);
    } catch (e) {
      setError(e.message || "Failed");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // fetch when filters change (with small debounce)
  useEffect(() => {
    const t = setTimeout(() => fetchSales(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.from, filters.to, filters.party, filters.paymentType]);

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
        startWeek.setDate(today.getDate() - today.getDay()); // Sunday
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
        // Do not auto-set dates
        return;

      default:
        return;
    }

    setFilters((prev) => ({ ...prev, from, to }));
  };

  const handleChange = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });

  const handleChangeDate = (e) => {
    setFilters({ ...filters, dateRange: "Custom", [e.target.name]: e.target.value });
  };

  // 🔍 Filtering Logic
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const itemDate = new Date(item.date);
      const fromDate = filters.from ? new Date(filters.from) : null;
      const toDate = filters.to ? new Date(filters.to) : null;

      return (
        (!fromDate || itemDate >= fromDate) &&
        (!toDate || itemDate <= toDate) &&
        (!filters.party || item.party.toLowerCase().includes(filters.party.toLowerCase())) &&
        (!filters.paymentType || item.paymentType === filters.paymentType)
      );
    });
  }, [data, filters]);

  // ↕️ Sorting Logic
  const sortedData = useMemo(() => {
    const arr = [...filteredData];
    const { key, direction } = sortConfig;

    const compare = (a, b) => {
      let va = a[key];
      let vb = b[key];

      if (key === "date") {
        va = new Date(va).getTime();
        vb = new Date(vb).getTime();
      } else if (key === "amount") {
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
  }, [filteredData, sortConfig]);

  const requestSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  // ✅ Header cell component:
  // - reserves fixed width for arrow (no layout shift)
  // - keeps text left aligned
  // - prevents wrapping
  const TH = ({ colKey, label }) => (
    <th
      onClick={() => requestSort(colKey)}
      style={{
        cursor: "pointer",
        textAlign: "left",
        whiteSpace: "nowrap",
        userSelect: "none",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span>{label}</span>

        {/* reserve icon space always */}
        <span style={{ display: "inline-flex", width: 14, justifyContent: "center" }}>
          {sortConfig.key === colKey ? sortConfig.direction === "asc" ? <FaSortUp /> : <FaSortDown /> : <span style={{ display: "inline-block", width: 14 }} />}
        </span>
      </span>
    </th>
  );

  const totalSales = sortedData.reduce((sum, item) => sum + item.amount, 0);

  // actions (wire to your real logic)
  const onPrint = async (row) => {
    try {
      const full = await fetchInvoiceById(row.invoiceId);
      openThermalPrintWindow(full);
    } catch (e) {
      alert(e.message || "Print failed");
    }
  };
  //   const onEdit = (row) => console.log("edit", row);
  const onDelete = async (row) => {
    const ok = window.confirm(`Delete invoice ${row.invoice}?`);
    if (!ok) return;

    try {
      const res = await fetch(`${API_BASE}/delete_invoice.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.invoiceId }),
      });
      const json = await res.json();
      if (!res.ok || json.status !== "success") throw new Error(json.message || "Delete failed");

      fetchSales(); // refresh list
    } catch (e) {
      alert(e.message || "Delete failed");
    }
  };

  const fetchInvoiceById = async (invoiceId) => {
    const res = await fetch(`${API_BASE}/get_invoice.php?id=${invoiceId}`);
    const json = await res.json();
    if (!res.ok || json.status !== "success") throw new Error(json.message || "Failed to load invoice");
    return json;
  };

  const openThermalPrintWindow = (payload) => {
    const w = window.open("", "_blank", "width=400,height=800");
    if (!w) {
      alert("Popup blocked. Allow popups to print.");
      return;
    }

    const esc = (s) =>
      String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const rowsHtml = payload.items
      .map(
        (r) => `
      <tr>
        <td class="left">
          <div class="b">${esc(r.item_name)}</div>
          <div class="s">HSN:${esc(r.hsn)}  B:${esc(r.batch_no)}  Exp:${esc(r.exp_date || "-")}</div>
          <div class="s">${esc(r.qty)} x ${esc(r.mrp)} ${r.discount ? ` Disc:${esc(r.discount)}` : ""}</div>
        </td>
        <td class="right">${Number(r.amount || 0).toFixed(2)}</td>
      </tr>
    `,
      )
      .join("");

    const inv = payload.invoice;

    const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Invoice ${esc(inv.invoice_no)}</title>
<style>
@page { size: 80mm auto; margin: 6mm; }
body { font-family: monospace; font-size: 12px; margin: 0; }
.wrap { width: 68mm; }
.center { text-align: center; }
.right { text-align: right; vertical-align: top; }
.left { text-align: left; vertical-align: top; }
.b { font-weight: 700; }
.s { font-size: 11px; opacity: 0.9; }
hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
table { width: 100%; border-collapse: collapse; }
td { padding: 4px 0; }
.row { display:flex; justify-content:space-between; }
</style>
</head>
<body>
<div class="wrap">
  <div class="center b">Ganga Medical Store</div>
  <div class="center s">Tax Invoice</div>
  <hr/>
  <div class="s">
    <div class="row"><div>Inv:</div><div>${esc(inv.invoice_no)}</div></div>
    <div class="row"><div>Date:</div><div>${esc(inv.invoice_date)}</div></div>
    <div class="row"><div>Cust:</div><div>${esc(inv.customer_name)}</div></div>
    <div class="row"><div>Phone:</div><div>${esc(inv.phone || "-")}</div></div>
  </div>
  <hr/>
  <table>${rowsHtml}</table>
  <hr/>
  <div class="row"><div>Subtotal</div><div>${Number(inv.subtotal || 0).toFixed(2)}</div></div>
  <div class="row"><div>Discount</div><div>- ${Number(inv.bill_discount_value || 0).toFixed(2)}</div></div>
  <div class="row b"><div>Total</div><div>${Number(inv.rounded_final_total || 0).toFixed(2)}</div></div>
  <div class="row"><div>Received</div><div>${Number(inv.received || 0).toFixed(2)}</div></div>
  <div class="row"><div>Balance</div><div>${Number(inv.balance || 0).toFixed(2)}</div></div>
  <hr/>
  <div class="center s">Thank you! Visit again.</div>
</div>
<script>
  window.onload = function() { window.focus(); window.print(); setTimeout(()=>window.close(), 300); }
</script>
</body>
</html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        justifyContent: "flex-start",
        alignItems: "flex-start",
        padding: 20,
        flexDirection: "column",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
        <h3 style={{ margin: 0, color: "#034C9D" }}>Sales Page</h3>
        <Link to="/addsales">
          <IoMdAddCircle style={{ color: "#034C9D" }} size={30} />
        </Link>
      </div>

      <Card style={{ background: "#fff", borderRadius: 8, width: "100%", marginTop: 20, marginBottom: 20, border: "1px solid #00000040" }} className="mb-4">
        <Card.Body style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h4>Total Sales: ₹{totalSales}</h4>
          </div>

          <div style={{ display: "flex", gap: 10, flexDirection: "row" }}>
            <Form.Select id="DateSelector" name="dateRange" value={filters.dateRange} onChange={handleChange} style={{ border: 0 }}>
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

            <Form.Select name="paymentType" value={filters.paymentType} onChange={handleChange} style={{ border: 0, marginLeft: 20 }}>
              <option value="">All Payment Type</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
            </Form.Select>

            <Form.Control type="text" name="party" value={filters.party} onChange={handleChange} placeholder="Enter party name" />
          </div>
        </Card.Body>
      </Card>
      {loading && <div style={{ marginBottom: 10 }}>Loading...</div>}
      {error && <div style={{ marginBottom: 10, color: "red" }}>{error}</div>}
      {/* ✅ text-start ensures left alignment for headers + body */}
      <Table bordered hover className="text-start" style={{ borderRadius: 8 }}>
        <thead>
          <tr className="header-row">
            <TH colKey="date" label="Date" />
            <TH colKey="invoice" label="Invoice No" />
            <TH colKey="party" label="Party Name" />
            <TH colKey="transaction" label="Transaction" />
            <TH colKey="paymentType" label="Payment Type" />
            <TH colKey="amount" label="Amount (₹)" />
            <th style={{ textAlign: "left", whiteSpace: "nowrap", width: 50, color: "#034C9D" }}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan="7" className="text-center">
                No records found
              </td>
            </tr>
          ) : (
            sortedData.map((item, idx) => (
              <tr key={idx}>
                <td style={{ textAlign: "left", verticalAlign: "middle" }}>{item.date}</td>
                <td style={{ textAlign: "left", verticalAlign: "middle" }}>{item.invoice}</td>
                <td style={{ textAlign: "left", verticalAlign: "middle" }}>
                  {item.party} {item.phone && `(${item.phone})`}
                </td>
                <td style={{ textAlign: "left", verticalAlign: "middle" }}>{item.transaction}</td>
                <td style={{ textAlign: "left", verticalAlign: "middle" }}>{item.paymentType}</td>
                <td style={{ textAlign: "left", verticalAlign: "middle" }}>₹{item.amount}</td>
                <td style={{ whiteSpace: "nowrap", textAlign: "left" }}>
                  <Button variant="link" size="lg" className="p-0 me-3" title="Print" onClick={() => onPrint(item)}>
                    <FaPrint />
                  </Button>
                  <Button variant="link" size="lg" className="p-0 me-3" title="Edit" onClick={() => onEdit(item)}>
                    <FaEdit />
                  </Button>
                  <Button variant="link" size="lg" className="p-0 text-danger" title="Delete" onClick={() => onDelete(item)}>
                    <FaTrash />
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
}
