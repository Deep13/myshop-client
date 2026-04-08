import React, { useEffect, useMemo, useState } from "react";
import { FiSearch, FiRefreshCw, FiPhone, FiUser, FiDollarSign, FiX, FiDownload, FiCheck } from "react-icons/fi";
import { C, GLOBAL_CSS, API, fmt2, SortTH, Modal, Field, todayISO, Pagination, PAGE_SIZE } from "../ui.jsx";
import { downloadExcel } from "../excelExport.js";
import usePageMeta from "../usePageMeta.js";
import toast from "../toast.js";

const PAY_MODES = ["Cash", "UPI", "Card", "Bank", "Cheque", "Other"];
const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();

export default function Customers() {
  usePageMeta("Customers", "Customer list, balances and payment history");
  const [rawSales, setRawSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: "name", direction: "asc" });
  const [page, setPage] = useState(1);

  // Pay modal
  const [showPay, setShowPay] = useState(false);
  const [payCustomer, setPayCustomer] = useState(null);
  const [payDate, setPayDate] = useState(todayISO());
  const [payLines, setPayLines] = useState([{ type: "Cash", amount: "", referenceNo: "", note: "" }]);
  const [paySaving, setPaySaving] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/get_sales.php?limit=5000`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.status !== "success") throw new Error(j.message || "Failed");
      setRawSales(j.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Also fetch invoices with balance for accurate balance tracking
  const [invoicesWithBal, setInvoicesWithBal] = useState([]);
  const loadBalances = async () => {
    try {
      // Use dashboard endpoint to get need_to_collect (all invoices with balance > 0)
      const res = await fetch(`${API}/get_dashboard.php`);
      const j = await res.json().catch(() => ({}));
      if (j.status === "success") {
        setInvoicesWithBal(j.data?.need_to_collect || []);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); loadBalances(); }, []);

  // Aggregate customers from sales data
  const data = useMemo(() => {
    const map = {};
    rawSales.forEach((r) => {
      const name = (r.party || "Cash").trim();
      const phone = (r.phone || "").trim();
      const key = name.toLowerCase();
      if (!map[key]) {
        map[key] = {
          name, phone, totalAmount: 0, invoiceCount: 0,
          lastDate: r.date, lastInvoice: r.invoice, balance: 0,
          unpaidBills: [],
        };
      }
      if (phone && !map[key].phone) map[key].phone = phone;
      map[key].totalAmount += Number(r.amount || 0);
      map[key].invoiceCount += 1;
      if (r.date > map[key].lastDate) {
        map[key].lastDate = r.date;
        map[key].lastInvoice = r.invoice;
      }
    });
    // Merge balance info from need_to_collect
    invoicesWithBal.forEach((inv) => {
      const name = (inv.customer_name || "Cash").trim();
      const key = name.toLowerCase();
      if (map[key]) {
        map[key].balance += Number(inv.balance || 0);
        map[key].unpaidBills.push({
          id: inv.id,
          invoice_no: inv.invoice_no,
          invoice_date: inv.invoice_date,
          total: Number(inv.total || 0),
          balance: Number(inv.balance || 0),
        });
      } else {
        // Customer exists only in unpaid — create entry
        map[key] = {
          name, phone: "", totalAmount: Number(inv.total || 0), invoiceCount: 1,
          lastDate: inv.invoice_date, lastInvoice: inv.invoice_no,
          balance: Number(inv.balance || 0),
          unpaidBills: [{
            id: inv.id,
            invoice_no: inv.invoice_no,
            invoice_date: inv.invoice_date,
            total: Number(inv.total || 0),
            balance: Number(inv.balance || 0),
          }],
        };
      }
    });
    return Object.values(map);
  }, [rawSales, invoicesWithBal]);

  const filtered = useMemo(() => {
    let rows = [...data];
    if (q.trim()) {
      const qLow = q.trim().toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(qLow) || r.phone.includes(qLow));
    }
    const { key, direction: dir } = sort;
    return rows.sort((a, b) => {
      let va = a[key], vb = b[key];
      if (["totalAmount", "invoiceCount", "balance"].includes(key)) { va = Number(va); vb = Number(vb); }
      else { va = String(va ?? "").toLowerCase(); vb = String(vb ?? "").toLowerCase(); }
      return dir === "asc" ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
    });
  }, [data, q, sort]);

  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);
  useEffect(() => setPage(1), [q, sort]);

  const totalCustomers = filtered.length;
  const totalRevenue = filtered.reduce((s, r) => s + r.totalAmount, 0);
  const totalBalance = filtered.reduce((s, r) => s + r.balance, 0);
  const onSort = (k) => setSort((p) => ({ key: k, direction: p.key === k && p.direction === "asc" ? "desc" : "asc" }));

  const openPay = (customer) => {
    setPayCustomer(customer);
    setPayDate(todayISO());
    setPayLines([{ type: "Cash", amount: customer.balance.toFixed(2), referenceNo: "", note: "" }]);
    setShowPay(true);
  };

  // Distribute payment across unpaid bills oldest-first
  const savePay = async () => {
    if (!payCustomer) return;
    const lines = payLines.map((p) => ({ type: p.type, amount: Number(p.amount || 0) })).filter((p) => p.amount > 0);
    if (!lines.length) return toast.warn("Enter at least one amount");
    const totalPaying = lines.reduce((s, l) => s + l.amount, 0);

    // Sort unpaid bills by date ascending (oldest first)
    const bills = [...payCustomer.unpaidBills].sort((a, b) => (a.invoice_date || "").localeCompare(b.invoice_date || ""));

    // Build per-bill allocation
    const allocations = [];
    let remaining = totalPaying;
    for (const bill of bills) {
      if (remaining <= 0) break;
      const forThisBill = Math.min(remaining, bill.balance);
      allocations.push({ invoiceId: bill.id, amount: forThisBill });
      remaining -= forThisBill;
    }

    if (!allocations.length) return toast.warn("No unpaid bills to apply payment to");

    try {
      setPaySaving(true);
      // For each allocation, distribute the payment modes proportionally
      for (const alloc of allocations) {
        let allocRemaining = alloc.amount;
        for (let li = 0; li < lines.length && allocRemaining > 0; li++) {
          const lineAmt = Math.min(lines[li].amount, allocRemaining);
          if (lineAmt <= 0) continue;
          const res = await fetch(`${API}/add_sales_payment.php`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invoiceId: alloc.invoiceId,
              payType: lines[li].type,
              amount: lineAmt,
              createdBy: user?.id || 1,
            }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok || j.status !== "success") throw new Error(j.message || "Failed");
          allocRemaining -= lineAmt;
          lines[li].amount -= lineAmt;
        }
      }
      toast.success("Payment recorded"); setShowPay(false);
      load(); loadBalances();
    } catch (e) { toast.error(e.message); } finally { setPaySaving(false); }
  };

  return (
    <div id="g-root" style={{ padding: "20px 26px", background: C.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
        {[
          { label: "Customers", value: totalCustomers, color: C.brand },
          { label: "Total Revenue", value: `₹${fmt2(totalRevenue)}`, color: C.green },
          { label: "Outstanding", value: `₹${fmt2(totalBalance)}`, color: totalBalance > 0 ? C.orange : C.green },
          { label: "Avg / Customer", value: `₹${fmt2(totalCustomers ? totalRevenue / totalCustomers : 0)}`, color: C.text },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "#fff", borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "12px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
          <FiSearch size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: C.textSub, pointerEvents: "none" }} />
          <input className="g-inp sm search" style={{ width: "100%" }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer name or phone…" />
        </div>
        <span style={{ fontSize: 11, color: C.textSub, whiteSpace: "nowrap" }}>{filtered.length} results</span>
        <button className="g-btn ghost sm" title="Download Excel" onClick={() => {
          downloadExcel([
            { key: "name", label: "Customer" },
            { key: "phone", label: "Phone" },
            { key: "invoiceCount", label: "Invoices", type: "int" },
            { key: "totalAmount", label: "Total ₹", type: "number" },
            { key: "balance", label: "Balance ₹", type: "number" },
            { key: "lastDate", label: "Last Date" },
            { key: "lastInvoice", label: "Last Invoice" },
          ], filtered, "Customers");
          setDownloaded(true); setTimeout(() => setDownloaded(false), 2000);
        }}>{downloaded ? <FiCheck size={14} /> : <FiDownload size={14} />}</button>
        <button className="g-btn ghost sm" onClick={() => { load(); loadBalances(); }} disabled={loading}><FiRefreshCw size={14} /></button>
      </div>

      {/* Table */}
      <div className="g-card">
        <div style={{ overflowX: "auto" }}>
          <table className="g-table">
            <thead>
              <tr>
                <SortTH label="Customer" colKey="name" sortConfig={sort} onSort={onSort} />
                <th>Phone</th>
                <SortTH label="Invoices" colKey="invoiceCount" sortConfig={sort} onSort={onSort} />
                <SortTH label="Total ₹" colKey="totalAmount" sortConfig={sort} onSort={onSort} />
                <SortTH label="Balance ₹" colKey="balance" sortConfig={sort} onSort={onSort} />
                <SortTH label="Last Date" colKey="lastDate" sortConfig={sort} onSort={onSort} />
                <th>Last Invoice</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 24, color: C.textSub }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 24, color: C.textSub }}>No customers found</td></tr>
              ) : paged.map((r, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: C.brandLighter, display: "flex", alignItems: "center", justifyContent: "center", color: C.brand, flexShrink: 0 }}>
                        <FiUser size={13} />
                      </div>
                      <span style={{ fontWeight: 600 }}>{r.name}</span>
                    </div>
                  </td>
                  <td style={{ color: r.phone ? C.text : C.textLight }}>
                    {r.phone ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><FiPhone size={12} /> {r.phone}</span> : "—"}
                  </td>
                  <td style={{ fontWeight: 700 }}>{r.invoiceCount}</td>
                  <td style={{ fontWeight: 700 }}>₹{fmt2(r.totalAmount)}</td>
                  <td style={{ fontWeight: 700, color: r.balance > 0 ? C.orange : C.green }}>₹{fmt2(r.balance)}</td>
                  <td style={{ fontSize: 13 }}>{r.lastDate}</td>
                  <td style={{ fontSize: 13, color: C.brand, fontWeight: 600 }}>{r.lastInvoice}</td>
                  <td>
                    {r.balance > 0 && (
                      <button className="g-btn success sm" title="Collect Payment" onClick={() => openPay(r)}>
                        <FiDollarSign size={12} /> Collect
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination total={filtered.length} page={page} onPage={setPage} />
      </div>

      {/* Pay Modal */}
      <Modal show={showPay} title="Collect Payment" onClose={() => setShowPay(false)} width={580} footer={
        <><button className="g-btn ghost" onClick={() => setShowPay(false)}>Cancel</button><button className="g-btn success" onClick={savePay} disabled={paySaving}>{paySaving ? "Saving…" : "Save Payment"}</button></>
      }>
        {payCustomer && (
          <>
            <div style={{ background: C.brandLight, border: "1.5px solid #93c5fd", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
              <div><strong>Customer:</strong> {payCustomer.name}{payCustomer.phone && <> · <FiPhone size={11} style={{ verticalAlign: "middle" }} /> {payCustomer.phone}</>}</div>
              <div style={{ marginTop: 4 }}><strong>Outstanding:</strong> <span style={{ color: C.orange, fontWeight: 800 }}>₹{fmt2(payCustomer.balance)}</span> across {payCustomer.unpaidBills.length} invoice{payCustomer.unpaidBills.length !== 1 ? "s" : ""}</div>
            </div>

            {/* Unpaid bills breakdown */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, marginBottom: 6, textTransform: "uppercase" }}>Unpaid Invoices (oldest first)</div>
              <div style={{ maxHeight: 140, overflowY: "auto", border: "1.5px solid #e5e7eb", borderRadius: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, color: C.textSub }}>Invoice</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, color: C.textSub }}>Date</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700, color: C.textSub }}>Total</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700, color: C.textSub }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...payCustomer.unpaidBills].sort((a, b) => (a.invoice_date || "").localeCompare(b.invoice_date || "")).map((b) => (
                      <tr key={b.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "5px 10px", fontWeight: 600, color: C.brand }}>{b.invoice_no}</td>
                        <td style={{ padding: "5px 10px", color: C.textSub }}>{b.invoice_date}</td>
                        <td style={{ padding: "5px 10px", textAlign: "right" }}>₹{fmt2(b.total)}</td>
                        <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: 700, color: C.orange }}>₹{fmt2(b.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Field label="Payment Date"><input className="g-inp" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></Field>
            <div style={{ marginTop: 14 }}>
              {payLines.map((p, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "150px 1fr 36px", gap: 10, alignItems: "end", marginBottom: 10 }}>
                  <Field label={i === 0 ? "Mode" : ""}>
                    <select className="g-sel" value={p.type} onChange={(e) => setPayLines((prev) => { const n = [...prev]; n[i] = { ...n[i], type: e.target.value }; return n; })}>
                      {PAY_MODES.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label={i === 0 ? "Amount (₹)" : ""}>
                    <input className="g-inp" value={p.amount} onChange={(e) => setPayLines((prev) => { const n = [...prev]; n[i] = { ...n[i], amount: e.target.value }; return n; })} inputMode="decimal" placeholder="0.00" />
                  </Field>
                  <div style={{ paddingBottom: 2 }}>
                    {payLines.length > 1 && (
                      <button className="g-btn danger sm" onClick={() => setPayLines((p) => p.filter((_, j) => j !== i))}><FiX size={13} /></button>
                    )}
                  </div>
                </div>
              ))}
              <button className="g-btn ghost sm" onClick={() => setPayLines((p) => [...p, { type: "Cash", amount: "", referenceNo: "", note: "" }])}>+ Add Line</button>
            </div>

            {/* Payment distribution preview */}
            {(() => {
              const totalPaying = payLines.reduce((s, l) => s + Number(l.amount || 0), 0);
              const bills = [...payCustomer.unpaidBills].sort((a, b) => (a.invoice_date || "").localeCompare(b.invoice_date || ""));
              let rem = totalPaying;
              const allocs = bills.map((b) => {
                const amt = Math.min(rem, b.balance);
                rem -= amt;
                return { ...b, allocated: amt };
              }).filter((a) => a.allocated > 0);
              if (totalPaying > 0 && allocs.length > 0) {
                return (
                  <div style={{ marginTop: 14, background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: C.green, marginBottom: 4 }}>Payment will be applied to:</div>
                    {allocs.map((a) => (
                      <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                        <span>{a.invoice_no} ({a.invoice_date})</span>
                        <span style={{ fontWeight: 700 }}>₹{fmt2(a.allocated)}</span>
                      </div>
                    ))}
                    {rem > 0 && <div style={{ color: C.red, marginTop: 4 }}>⚠ ₹{fmt2(rem)} exceeds total outstanding</div>}
                  </div>
                );
              }
              return null;
            })()}
          </>
        )}
      </Modal>
    </div>
  );
}
