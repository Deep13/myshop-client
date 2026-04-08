import React, { useEffect, useMemo, useState } from "react";
import { FiSearch, FiRefreshCw, FiTruck, FiDollarSign, FiX, FiDownload, FiCheck } from "react-icons/fi";
import { C, GLOBAL_CSS, API, fmt2, SortTH, Modal, Field, todayISO, Pagination, PAGE_SIZE } from "../ui.jsx";
import { downloadExcel } from "../excelExport.js";
import usePageMeta from "../usePageMeta.js";
import toast from "../toast.js";

const PAY_MODES = ["Cash", "UPI", "Card", "Bank", "Cheque", "Other"];
const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();

export default function Distributors() {
  usePageMeta("Distributors", "Distributor list, balances and payment history");
  const [rawBills, setRawBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: "name", direction: "asc" });
  const [page, setPage] = useState(1);

  // Pay modal
  const [showPay, setShowPay] = useState(false);
  const [payDist, setPayDist] = useState(null);
  const [payDate, setPayDate] = useState(todayISO());
  const [payLines, setPayLines] = useState([{ type: "Cash", amount: "", referenceNo: "", note: "" }]);
  const [paySaving, setPaySaving] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/get_purchase_bills.php?limit=5000`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.status !== "success") throw new Error(j.message || "Failed");
      setRawBills(j.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Aggregate distributors with per-bill detail
  const data = useMemo(() => {
    const map = {};
    rawBills.forEach((r) => {
      const name = (r.distributor_name || "").trim();
      const gstin = (r.distributor_gstin || "").trim();
      const key = (r.distributor_id || name.toLowerCase());
      const total = Number(r.round_off_enabled == "1" ? r.rounded_grand_total : r.grand_total) || 0;
      const paid = Number(r.paid_amount || 0);
      const bal = total - paid;
      if (!map[key]) {
        map[key] = {
          id: r.distributor_id, name, gstin,
          totalAmount: 0, paidAmount: 0, billCount: 0,
          lastDate: r.bill_date, lastBillNo: r.bill_no,
          unpaidBills: [],
        };
      }
      map[key].totalAmount += total;
      map[key].paidAmount += paid;
      map[key].billCount += 1;
      if (r.bill_date > map[key].lastDate) {
        map[key].lastDate = r.bill_date;
        map[key].lastBillNo = r.bill_no;
      }
      if (bal > 0.01) {
        map[key].unpaidBills.push({
          id: Number(r.id),
          distributor_id: r.distributor_id,
          bill_no: r.bill_no,
          bill_date: r.bill_date,
          due_date: r.due_date,
          total,
          paid,
          balance: bal,
        });
      }
    });
    return Object.values(map);
  }, [rawBills]);

  const filtered = useMemo(() => {
    let rows = [...data];
    if (q.trim()) {
      const qLow = q.trim().toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(qLow) || r.gstin.toLowerCase().includes(qLow));
    }
    const { key, direction: dir } = sort;
    return rows.sort((a, b) => {
      let va = a[key], vb = b[key];
      if (typeof va === "number") { /* numeric */ }
      else { va = String(va ?? "").toLowerCase(); vb = String(vb ?? "").toLowerCase(); }
      return dir === "asc" ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
    });
  }, [data, q, sort]);

  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);
  useEffect(() => setPage(1), [q, sort]);

  const totalDistributors = filtered.length;
  const totalPurchase = filtered.reduce((s, r) => s + r.totalAmount, 0);
  const totalBalance = filtered.reduce((s, r) => s + (r.totalAmount - r.paidAmount), 0);
  const onSort = (k) => setSort((p) => ({ key: k, direction: p.key === k && p.direction === "asc" ? "desc" : "asc" }));

  const openPay = (dist) => {
    const bal = dist.totalAmount - dist.paidAmount;
    setPayDist(dist);
    setPayDate(todayISO());
    setPayLines([{ type: "Cash", amount: bal.toFixed(2), referenceNo: "", note: "" }]);
    setShowPay(true);
  };

  // Distribute payment across unpaid bills oldest-first
  const savePay = async () => {
    if (!payDist) return;
    const lines = payLines.map((p) => ({ type: p.type, amount: Number(p.amount || 0), referenceNo: String(p.referenceNo || "").trim(), note: String(p.note || "").trim() })).filter((p) => p.amount > 0);
    if (!lines.length) return toast.warn("Enter at least one amount");
    const totalPaying = lines.reduce((s, l) => s + l.amount, 0);

    // Sort unpaid bills by date ascending (oldest first), then by due_date
    const bills = [...payDist.unpaidBills].sort((a, b) => (a.bill_date || "").localeCompare(b.bill_date || "") || (a.due_date || "").localeCompare(b.due_date || ""));

    // Build per-bill allocation
    const allocations = [];
    let remaining = totalPaying;
    for (const bill of bills) {
      if (remaining <= 0) break;
      const forThisBill = Math.min(remaining, bill.balance);
      allocations.push({ purchaseId: bill.id, distributorId: bill.distributor_id, amount: forThisBill });
      remaining -= forThisBill;
    }

    if (!allocations.length) return toast.warn("No unpaid bills to apply payment to");

    try {
      setPaySaving(true);
      // For each allocation, send payment split by modes proportionally
      for (const alloc of allocations) {
        // Clone lines for this allocation
        const linesCopy = lines.map((l) => ({ ...l }));
        let allocRemaining = alloc.amount;
        for (const lc of linesCopy) {
          if (allocRemaining <= 0) break;
          const amt = Math.min(lc.amount, allocRemaining);
          if (amt <= 0) continue;
          const res = await fetch(`${API}/add_purchase_payment.php`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              distributorId: alloc.distributorId,
              purchaseId: alloc.purchaseId,
              payDate,
              mode: lc.type,
              amount: amt,
              referenceNo: lc.referenceNo,
              note: lc.note,
              createdBy: user?.id || 1,
            }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok || j.status !== "success") throw new Error(j.message || "Failed");
          allocRemaining -= amt;
          lc.amount -= amt;
        }
      }
      toast.success("Payment saved"); setShowPay(false); load();
    } catch (e) { toast.error(e.message); } finally { setPaySaving(false); }
  };

  return (
    <div id="g-root" style={{ padding: "20px 26px", background: C.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
        {[
          { label: "Distributors", value: totalDistributors, color: C.brand },
          { label: "Total Purchase", value: `₹${fmt2(totalPurchase)}`, color: C.text },
          { label: "Total Paid", value: `₹${fmt2(totalPurchase - totalBalance)}`, color: C.green },
          { label: "Amount to Pay", value: `₹${fmt2(totalBalance)}`, color: totalBalance > 0 ? C.orange : C.green },
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
          <input className="g-inp sm search" style={{ width: "100%" }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search distributor name or GSTIN…" />
        </div>
        <span style={{ fontSize: 11, color: C.textSub, whiteSpace: "nowrap" }}>{filtered.length} results</span>
        <button className="g-btn ghost sm" title="Download Excel" onClick={() => {
          downloadExcel([
            { key: "name", label: "Distributor" },
            { key: "gstin", label: "GSTIN" },
            { key: "billCount", label: "Bills", type: "int" },
            { key: "totalAmount", label: "Total ₹", type: "number" },
            { key: "paidAmount", label: "Paid ₹", type: "number" },
            { key: "balance", label: "Balance ₹", type: "number" },
            { key: "lastDate", label: "Last Date" },
            { key: "lastBillNo", label: "Last Bill" },
          ], filtered.map((r) => ({ ...r, balance: r.totalAmount - r.paidAmount })), "Distributors");
          setDownloaded(true); setTimeout(() => setDownloaded(false), 2000);
        }}>{downloaded ? <FiCheck size={14} /> : <FiDownload size={14} />}</button>
        <button className="g-btn ghost sm" onClick={load} disabled={loading}><FiRefreshCw size={14} /></button>
      </div>

      {/* Table */}
      <div className="g-card">
        <div style={{ overflowX: "auto" }}>
          <table className="g-table">
            <thead>
              <tr>
                <SortTH label="Distributor" colKey="name" sortConfig={sort} onSort={onSort} />
                <th>GSTIN</th>
                <SortTH label="Bills" colKey="billCount" sortConfig={sort} onSort={onSort} />
                <SortTH label="Total ₹" colKey="totalAmount" sortConfig={sort} onSort={onSort} />
                <SortTH label="Paid ₹" colKey="paidAmount" sortConfig={sort} onSort={onSort} />
                <th>Balance ₹</th>
                <SortTH label="Last Date" colKey="lastDate" sortConfig={sort} onSort={onSort} />
                <th>Last Bill</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: "center", padding: 24, color: C.textSub }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: "center", padding: 24, color: C.textSub }}>No distributors found</td></tr>
              ) : paged.map((r, i) => {
                const bal = r.totalAmount - r.paidAmount;
                return (
                  <tr key={i}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: C.orangeLight, display: "flex", alignItems: "center", justifyContent: "center", color: C.orange, flexShrink: 0 }}>
                          <FiTruck size={13} />
                        </div>
                        <span style={{ fontWeight: 600 }}>{r.name}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: r.gstin ? C.textSub : C.textLight }}>{r.gstin || "—"}</td>
                    <td style={{ fontWeight: 700 }}>{r.billCount}</td>
                    <td style={{ fontWeight: 700 }}>₹{fmt2(r.totalAmount)}</td>
                    <td>₹{fmt2(r.paidAmount)}</td>
                    <td style={{ fontWeight: 700, color: bal > 0 ? C.orange : C.green }}>₹{fmt2(bal)}</td>
                    <td style={{ fontSize: 13 }}>{r.lastDate}</td>
                    <td style={{ fontSize: 13, color: C.brand, fontWeight: 600 }}>{r.lastBillNo}</td>
                    <td>
                      {bal > 0 && (
                        <button className="g-btn success sm" title="Make Payment" onClick={() => openPay(r)}>
                          <FiDollarSign size={12} /> Pay
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination total={filtered.length} page={page} onPage={setPage} />
      </div>

      {/* Pay Modal */}
      <Modal show={showPay} title="Make Payment" onClose={() => setShowPay(false)} width={580} footer={
        <><button className="g-btn ghost" onClick={() => setShowPay(false)}>Cancel</button><button className="g-btn success" onClick={savePay} disabled={paySaving}>{paySaving ? "Saving…" : "Save Payment"}</button></>
      }>
        {payDist && (
          <>
            <div style={{ background: C.brandLight, border: "1.5px solid #93c5fd", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
              <div><strong>Distributor:</strong> {payDist.name}{payDist.gstin && <> · <span style={{ color: C.textSub }}>{payDist.gstin}</span></>}</div>
              <div style={{ marginTop: 4 }}>
                <strong>Total:</strong> ₹{fmt2(payDist.totalAmount)} · <strong>Paid:</strong> ₹{fmt2(payDist.paidAmount)} · <strong>Balance:</strong> <span style={{ color: C.orange, fontWeight: 800 }}>₹{fmt2(payDist.totalAmount - payDist.paidAmount)}</span> across {payDist.unpaidBills.length} bill{payDist.unpaidBills.length !== 1 ? "s" : ""}
              </div>
            </div>

            {/* Unpaid bills breakdown */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, marginBottom: 6, textTransform: "uppercase" }}>Unpaid Bills (oldest first)</div>
              <div style={{ maxHeight: 140, overflowY: "auto", border: "1.5px solid #e5e7eb", borderRadius: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, color: C.textSub }}>Bill No</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, color: C.textSub }}>Date</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, color: C.textSub }}>Due</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700, color: C.textSub }}>Total</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700, color: C.textSub }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...payDist.unpaidBills].sort((a, b) => (a.bill_date || "").localeCompare(b.bill_date || "")).map((b) => {
                      const overdue = b.due_date && b.due_date < todayISO();
                      return (
                        <tr key={b.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "5px 10px", fontWeight: 600, color: C.brand }}>{b.bill_no}</td>
                          <td style={{ padding: "5px 10px", color: C.textSub }}>{b.bill_date}</td>
                          <td style={{ padding: "5px 10px", color: overdue ? C.red : C.textSub, fontWeight: overdue ? 700 : 400 }}>{b.due_date || "—"}{overdue && <span style={{ fontSize: 10, marginLeft: 4 }}>OVERDUE</span>}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right" }}>₹{fmt2(b.total)}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: 700, color: C.orange }}>₹{fmt2(b.balance)}</td>
                        </tr>
                      );
                    })}
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
                  <div style={{ gridColumn: "1 / 3" }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <input className="g-inp sm" style={{ flex: 1 }} value={p.referenceNo} onChange={(e) => setPayLines((prev) => { const n = [...prev]; n[i] = { ...n[i], referenceNo: e.target.value }; return n; })} placeholder="Txn / Cheque No (optional)" />
                      <input className="g-inp sm" style={{ flex: 1 }} value={p.note} onChange={(e) => setPayLines((prev) => { const n = [...prev]; n[i] = { ...n[i], note: e.target.value }; return n; })} placeholder="Note (optional)" />
                    </div>
                  </div>
                </div>
              ))}
              <button className="g-btn ghost sm" onClick={() => setPayLines((p) => [...p, { type: "Cash", amount: "", referenceNo: "", note: "" }])}>+ Add Line</button>
            </div>

            {/* Payment distribution preview */}
            {(() => {
              const totalPaying = payLines.reduce((s, l) => s + Number(l.amount || 0), 0);
              const bills = [...payDist.unpaidBills].sort((a, b) => (a.bill_date || "").localeCompare(b.bill_date || ""));
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
                        <span>{a.bill_no} ({a.bill_date})</span>
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
