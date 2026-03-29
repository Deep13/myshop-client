import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { C, GLOBAL_CSS, API, fmtINR, todayISO } from "./ui.jsx";
import {
  FiShoppingCart, FiTruck, FiPackage, FiAlertTriangle,
  FiClock, FiDollarSign, FiRefreshCw, FiTrendingUp, FiTrendingDown,
  FiCreditCard, FiSmartphone
} from "react-icons/fi";
import { BsCash } from "react-icons/bs";

const asN = (x) => { const n = Number(x); return isFinite(n) ? n : 0; };

/* ── tiny stat card ── */
function StatCard({ label, value, sub, color, icon, bg }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0",
      padding: "18px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
      transition: "box-shadow 0.15s, transform 0.15s",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)"; e.currentTarget.style.transform = "none"; }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: color || C.text, letterSpacing: "-0.02em" }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: C.textLight, marginTop: 4 }}>{sub}</div>}
        </div>
        {icon && (
          <div style={{ width: 40, height: 40, borderRadius: 11, background: bg || C.brandLighter, display: "flex", alignItems: "center", justifyContent: "center", color: color || C.brand }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── period tabs ── */
const PERIODS = ["Today", "Yesterday", "7 Days", "30 Days"];

/* ── section heading ── */
function SectionHead({ icon, title, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: color + "22", display: "flex", alignItems: "center", justifyContent: "center", color }}>
        {icon}
      </div>
      <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{title}</span>
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("Today");

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/get_dashboard.php`);
      const j = await res.json();
      if (j.status === "success") setData(j.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const periodKey = { "Today": "today", "Yesterday": "yesterday", "7 Days": "days7", "30 Days": "days30" }[period];
  const sales = data?.sales?.[periodKey] || { total: 0, count: 0 };
  const purchase = data?.purchase?.[periodKey] || { total: 0, count: 0 };
  const modes = data?.sales_by_mode?.[periodKey] || {};
  const cashTotal = asN(modes.cash);
  const upiTotal = asN(modes.upi);
  const cardTotal = asN(modes.card);
  const inv = data?.inventory || {};
  const expiring = data?.expiring_items || [];
  const expired = data?.expired_items || [];
  const needPay = data?.need_to_pay || [];
  const needColl = data?.need_to_collect || [];
  const today = todayISO();

  return (
    <div id="g-root" style={{ padding: "24px 28px", background: C.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── TOP BAR ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Dashboard</h2>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: C.textSub }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <button className="g-btn ghost" onClick={load} disabled={loading}>
          <FiRefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Refresh
        </button>
      </div>

      {loading && !data ? (
        <div style={{ textAlign: "center", padding: 60, color: C.textSub, fontSize: 15 }}>Loading dashboard…</div>
      ) : (
        <>
          {/* ══════════════════════════════════
              SECTION 1 — SALES & PURCHASE
          ══════════════════════════════════ */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 20, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1.5px solid #e5e7eb", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: C.brandLighter, display: "flex", alignItems: "center", justifyContent: "center", color: C.brand }}><FiTrendingUp size={15} /></div>
                <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Sales & Purchase</span>
              </div>
              {/* Period tabs */}
              <div className="g-toggle-wrap">
                {PERIODS.map((p) => (
                  <button key={p} className={`g-toggle-btn${period === p ? " active" : ""}`} onClick={() => setPeriod(p)}>{p}</button>
                ))}
              </div>
            </div>
            <div style={{ padding: "18px 18px" }}>
              <div className="g-grid-4" style={{ marginBottom: 0 }}>
                <StatCard label="Sales — Bills" value={sales.count} color={C.brand} icon={<FiShoppingCart size={16} />} bg={C.brandLighter} />
                <StatCard label="Sales — Amount" value={fmtINR(sales.total)} color={C.brand} icon={<FiTrendingUp size={16} />} bg={C.brandLighter} />
                <StatCard label="Purchase — Bills" value={purchase.count} color={C.orange} icon={<FiTruck size={16} />} bg={C.orangeLight} />
                <StatCard label="Purchase — Amount" value={fmtINR(purchase.total)} color={C.orange} icon={<FiTrendingDown size={16} />} bg={C.orangeLight} />
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════
              SECTION — SALES BY PAYMENT MODE
          ══════════════════════════════════ */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 20, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1.5px solid #e5e7eb", background: "#f8fafc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: C.greenLight, display: "flex", alignItems: "center", justifyContent: "center", color: C.green }}><FiDollarSign size={15} /></div>
                <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Sales by Payment Mode</span>
                <span style={{ fontSize: 12, color: C.textLight, fontWeight: 500, marginLeft: 4 }}>({period})</span>
              </div>
            </div>
            <div style={{ padding: "18px 18px" }}>
              <div className="g-grid-4">
                <StatCard label="Total Sales" value={fmtINR(sales.total)} color={C.brand} icon={<FiShoppingCart size={16} />} bg={C.brandLighter} sub={`${sales.count} bills`} />
                <StatCard label="Cash" value={fmtINR(cashTotal)} color={C.green} icon={<BsCash size={16} />} bg={C.greenLight} sub={sales.total ? `${((cashTotal / sales.total) * 100).toFixed(1)}%` : "0%"} />
                <StatCard label="UPI" value={fmtINR(upiTotal)} color="#7c3aed" icon={<FiSmartphone size={16} />} bg="#f5f3ff" sub={sales.total ? `${((upiTotal / sales.total) * 100).toFixed(1)}%` : "0%"} />
                <StatCard label="Card" value={fmtINR(cardTotal)} color="#0891b2" icon={<FiCreditCard size={16} />} bg="#ecfeff" sub={sales.total ? `${((cardTotal / sales.total) * 100).toFixed(1)}%` : "0%"} />
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════
              SECTION 2 — INVENTORY
          ══════════════════════════════════ */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 20, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1.5px solid #e5e7eb", background: "#f8fafc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: C.greenLight, display: "flex", alignItems: "center", justifyContent: "center", color: C.green }}><FiPackage size={15} /></div>
                <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Inventory Value</span>
              </div>
            </div>
            <div style={{ padding: 18 }}>
              <div className="g-grid-4">
                <StatCard label="Current Stock (PTR)" value={fmtINR(inv.stock_by_ptr || 0)} color={C.green} icon={<FiPackage size={16} />} bg={C.greenLight} sub="By purchase price" />
                <StatCard label="Current Stock (MRP)" value={fmtINR(inv.stock_by_mrp || 0)} color={C.green} icon={<FiPackage size={16} />} bg={C.greenLight} sub="By MRP" />
                <StatCard label="Expired Stock (PTR)" value={fmtINR(inv.expired_by_ptr || 0)} color={C.red} icon={<FiAlertTriangle size={16} />} bg={C.redLight} sub="By purchase price" />
                <StatCard label="Expired Stock (MRP)" value={fmtINR(inv.expired_by_mrp || 0)} color={C.red} icon={<FiAlertTriangle size={16} />} bg={C.redLight} sub="By MRP" />
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════
              SECTIONS 3 & 4 — EXPIRING / EXPIRED
          ══════════════════════════════════ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 20 }}>

            {/* Expiring Items */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: "1.5px solid #e5e7eb", background: "#fffbeb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: C.yellowLight, display: "flex", alignItems: "center", justifyContent: "center", color: C.yellow }}><FiClock size={14} /></div>
                  <span style={{ fontWeight: 800, fontSize: 14, color: C.text }}>Expiring Soon <span style={{ color: C.textSub, fontWeight: 600 }}>(next 90 days)</span></span>
                </div>
                <span style={{ fontWeight: 800, fontSize: 14, color: C.yellow, background: C.yellowLight, padding: "2px 10px", borderRadius: 20 }}>{expiring.length}</span>
              </div>
              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                {expiring.length === 0 ? (
                  <div style={{ padding: "24px 18px", textAlign: "center", color: C.textLight, fontSize: 13 }}>✅ No items expiring soon</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Item", "Batch", "Exp Date", "Qty", "Value (PTR)"].map((h) => (
                          <th key={h} style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", borderBottom: "1.5px solid #f3f4f6", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {expiring.map((r, i) => {
                        const daysLeft = Math.ceil((new Date(r.exp_date) - new Date(today)) / 86400000);
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid #f9fafb" }}>
                            <td style={{ padding: "8px 12px", fontSize: 13 }}>
                              <div style={{ fontWeight: 600 }}>{r.item_name}</div>
                              <div style={{ fontSize: 11, color: C.textSub }}>{r.item_code}</div>
                            </td>
                            <td style={{ padding: "8px 12px", fontSize: 12, color: C.textSub }}>{r.batch_no || "—"}</td>
                            <td style={{ padding: "8px 12px", fontSize: 12 }}>
                              <span style={{ color: daysLeft <= 30 ? C.red : C.yellow, fontWeight: 700 }}>{r.exp_date}</span>
                              <div style={{ fontSize: 11, color: C.textLight }}>{daysLeft}d left</div>
                            </td>
                            <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600 }}>{r.current_qty}</td>
                            <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600 }}>₹{(asN(r.current_qty) * asN(r.purchase_price)).toFixed(0)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Expired Items */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: "1.5px solid #e5e7eb", background: "#fff5f5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: C.redLight, display: "flex", alignItems: "center", justifyContent: "center", color: C.red }}><FiAlertTriangle size={14} /></div>
                  <span style={{ fontWeight: 800, fontSize: 14, color: C.text }}>Expired Items <span style={{ color: C.textSub, fontWeight: 600 }}>(in stock)</span></span>
                </div>
                <span style={{ fontWeight: 800, fontSize: 14, color: C.red, background: C.redLight, padding: "2px 10px", borderRadius: 20 }}>{expired.length}</span>
              </div>
              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                {expired.length === 0 ? (
                  <div style={{ padding: "24px 18px", textAlign: "center", color: C.textLight, fontSize: 13 }}>✅ No expired stock</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Item", "Batch", "Exp Date", "Qty", "Value (PTR)"].map((h) => (
                          <th key={h} style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", borderBottom: "1.5px solid #f3f4f6", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {expired.map((r, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #f9fafb" }}>
                          <td style={{ padding: "8px 12px", fontSize: 13 }}>
                            <div style={{ fontWeight: 600 }}>{r.item_name}</div>
                            <div style={{ fontSize: 11, color: C.textSub }}>{r.item_code}</div>
                          </td>
                          <td style={{ padding: "8px 12px", fontSize: 12, color: C.textSub }}>{r.batch_no || "—"}</td>
                          <td style={{ padding: "8px 12px", fontSize: 12, color: C.red, fontWeight: 700 }}>{r.exp_date}</td>
                          <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600 }}>{r.current_qty}</td>
                          <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600 }}>₹{(asN(r.current_qty) * asN(r.purchase_price)).toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════
              SECTIONS 5 & 6 — PAYABLES / RECEIVABLES
          ══════════════════════════════════ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>

            {/* Need to Pay */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: "1.5px solid #e5e7eb", background: "#fff7ed", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: C.orangeLight, display: "flex", alignItems: "center", justifyContent: "center", color: C.orange }}><FiTruck size={14} /></div>
                  <span style={{ fontWeight: 800, fontSize: 14, color: C.text }}>Need to Pay</span>
                </div>
                <span style={{ fontWeight: 800, fontSize: 14, color: C.orange }}>{fmtINR(data?.need_to_pay_total || 0)}</span>
              </div>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {needPay.length === 0 ? (
                  <div style={{ padding: "24px 18px", textAlign: "center", color: C.textLight, fontSize: 13 }}>✅ All distributor payments cleared</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Distributor", "Bill No", "Bill Date", "Due Date", "Balance"].map((h) => (
                          <th key={h} style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", borderBottom: "1.5px solid #f3f4f6", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {needPay.map((r, i) => {
                        const overdue = r.due_date && r.due_date < today;
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid #f9fafb", cursor: "pointer" }} onClick={() => navigate(`/addpurchase?purchaseId=${r.id}`)}>
                            <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600 }}>{r.distributor_name}</td>
                            <td style={{ padding: "8px 12px", fontSize: 12, color: C.textSub }}>{r.bill_no}</td>
                            <td style={{ padding: "8px 12px", fontSize: 12, color: C.textSub }}>{r.bill_date}</td>
                            <td style={{ padding: "8px 12px", fontSize: 12 }}>
                              <span style={{ color: overdue ? C.red : C.text, fontWeight: overdue ? 700 : 400 }}>{r.due_date || "—"}</span>
                              {overdue && <div style={{ fontSize: 10, color: C.red }}>OVERDUE</div>}
                            </td>
                            <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 800, color: C.orange }}>₹{asN(r.balance).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              <div style={{ padding: "10px 18px", borderTop: "1.5px solid #f3f4f6", background: "#fafafa", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: C.textSub }}>{needPay.length} bills pending</span>
                <button className="g-btn ghost sm" onClick={() => navigate("/purchase")}>View All →</button>
              </div>
            </div>

            {/* Need to Collect */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: "1.5px solid #e5e7eb", background: "#f0fdf4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: C.greenLight, display: "flex", alignItems: "center", justifyContent: "center", color: C.green }}><FiDollarSign size={14} /></div>
                  <span style={{ fontWeight: 800, fontSize: 14, color: C.text }}>Need to Collect</span>
                </div>
                <span style={{ fontWeight: 800, fontSize: 14, color: C.green }}>{fmtINR(data?.need_to_collect_total || 0)}</span>
              </div>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {needColl.length === 0 ? (
                  <div style={{ padding: "24px 18px", textAlign: "center", color: C.textLight, fontSize: 13 }}>✅ All customer payments collected</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Customer", "Invoice", "Date", "Balance"].map((h) => (
                          <th key={h} style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", borderBottom: "1.5px solid #f3f4f6", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {needColl.map((r, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #f9fafb", cursor: "pointer" }} onClick={() => navigate(`/addsales?id=${r.id}`)}>
                          <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600 }}>{r.customer_name}</td>
                          <td style={{ padding: "8px 12px", fontSize: 12, color: C.textSub }}>{r.invoice_no}</td>
                          <td style={{ padding: "8px 12px", fontSize: 12, color: C.textSub }}>{r.invoice_date}</td>
                          <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 800, color: C.green }}>₹{asN(r.balance).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div style={{ padding: "10px 18px", borderTop: "1.5px solid #f3f4f6", background: "#fafafa", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: C.textSub }}>{needColl.length} invoices pending</span>
                <button className="g-btn ghost sm" onClick={() => navigate("/sales")}>View All →</button>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
