import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiShoppingCart, FiTruck, FiPackage, FiAlertTriangle,
  FiClock, FiDollarSign, FiRefreshCw, FiTrendingUp, FiTrendingDown,
  FiCreditCard, FiSmartphone, FiLogOut, FiChevronDown, FiChevronUp,
} from "react-icons/fi";
import { BsCash } from "react-icons/bs";
import { API, fmtINR, todayISO, fmtDate } from "../ui.jsx";
import { getShopSettings } from "../thermalPrint.js";
import DateInput from "../comps/DateInput.jsx";
import usePageMeta from "../usePageMeta.js";

const C = {
  brand: "#034C9D", brandLight: "#e0ecfa",
  green: "#16a34a", greenLight: "#dcfce7",
  red: "#dc2626", redLight: "#fee2e2",
  orange: "#ea580c", orangeLight: "#ffedd5",
  yellow: "#ca8a04", yellowLight: "#fef9c3",
  bg: "#f0f4f8", card: "#fff",
  text: "#0f172a", textSub: "#64748b", textLight: "#94a3b8",
  border: "#e2e8f0",
};

const asN = (x) => { const n = Number(x); return isFinite(n) ? n : 0; };
const PERIODS = ["Today", "Yesterday", "7 Days", "30 Days", "Custom"];

/* ── compact stat card for mobile ── */
function Stat({ label, value, sub, color, icon, bg }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`,
      padding: 12, display: "flex", alignItems: "center", gap: 10,
    }}>
      {icon && (
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          color, flexShrink: 0,
        }}>{icon}</div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase", letterSpacing: 0.04, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: color || C.text, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: C.textLight, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── collapsible section ── */
function Section({ title, icon, color, bg, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 12 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", border: "none", cursor: "pointer",
          padding: "10px 14px", background: bg || "#f8fafc",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: open ? `1px solid ${C.border}` : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color }}>
            {icon}
          </div>
          <span style={{ fontWeight: 800, fontSize: 13, color: C.text, textAlign: "left" }}>{title}</span>
          {count !== undefined && (
            <span style={{ fontSize: 11, fontWeight: 800, color, background: "#fff", padding: "1px 8px", borderRadius: 12 }}>{count}</span>
          )}
        </div>
        {open ? <FiChevronUp size={16} color={C.textSub} /> : <FiChevronDown size={16} color={C.textSub} />}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

export default function MobileDashboard() {
  usePageMeta("Admin Dashboard", "Mobile overview for admin");
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("Today");
  // Custom date range — default to last 7 days
  const t = todayISO();
  const sevenAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const [customFrom, setCustomFrom] = useState(sevenAgo);
  const [customTo, setCustomTo] = useState(t);
  const lowStockLimit = getShopSettings().lowStockLimit || 5;

  const load = async (rangeFrom, rangeTo) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ low_stock_limit: String(lowStockLimit) });
      if (rangeFrom && rangeTo) {
        params.set("from", rangeFrom);
        params.set("to", rangeTo);
      }
      const res = await fetch(`${API}/get_dashboard.php?${params.toString()}`);
      const j = await res.json();
      if (j.status === "success") setData(j.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  // Refetch when custom range changes (only while Custom is active)
  useEffect(() => {
    if (period === "Custom" && customFrom && customTo && customFrom <= customTo) {
      load(customFrom, customTo);
    }
  }, [period, customFrom, customTo]);

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("auth");
    window.location.href = "/login";
  };

  const periodKey = { "Today": "today", "Yesterday": "yesterday", "7 Days": "days7", "30 Days": "days30", "Custom": "custom" }[period];
  const sales = data?.sales?.[periodKey] || { total: 0, count: 0 };
  const purchase = data?.purchase?.[periodKey] || { total: 0, count: 0 };
  const modes = data?.sales_by_mode?.[periodKey] || {};
  const cashTotal = asN(modes.cash);
  const upiTotal = asN(modes.upi);
  const cardTotal = asN(modes.card);
  const inv = data?.inventory || {};
  const expiring = data?.expiring_items || [];
  const expired = data?.expired_items || [];
  const lowStock = data?.low_stock_items || [];
  const needPay = data?.need_to_pay || [];
  const needColl = data?.need_to_collect || [];
  const today = todayISO();

  return (
    <div style={{ minHeight: "100vh", background: C.bg, paddingBottom: 80, fontFamily: "'Noto Sans', 'Inter', system-ui, sans-serif" }}>
      {/* ── Sticky header ── */}
      <header style={{
        background: `linear-gradient(135deg, ${C.brand} 0%, #0369a1 100%)`,
        color: "#fff", padding: "12px 14px",
        position: "sticky", top: 0, zIndex: 10,
        boxShadow: "0 2px 8px rgba(3,76,157,0.25)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: "-0.02em" }}>Dashboard</div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>
              {new Date().toLocaleDateString("en-IN", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => period === "Custom" ? load(customFrom, customTo) : load()}
              disabled={loading}
              style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", padding: 8, borderRadius: 8, cursor: "pointer" }}>
              <FiRefreshCw size={16} style={{ animation: loading ? "mdspin 1s linear infinite" : "none" }} />
            </button>
            <button onClick={logout}
              style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", padding: 8, borderRadius: 8, cursor: "pointer" }}>
              <FiLogOut size={16} />
            </button>
          </div>
        </div>

        {/* Period tabs */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, overflowX: "auto", paddingBottom: 2 }}>
          {PERIODS.map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{
                flexShrink: 0, padding: "6px 14px", fontSize: 12, fontWeight: 700,
                borderRadius: 20, border: "none", cursor: "pointer",
                background: period === p ? "#fff" : "rgba(255,255,255,0.15)",
                color: period === p ? C.brand : "#fff",
              }}>{p}</button>
          ))}
        </div>

        {/* Custom date range pickers */}
        {period === "Custom" && (
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <DateInput value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              style={{ background: "rgba(255,255,255,0.95)", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, color: C.text, width: "100%" }} />
            <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>to</span>
            <DateInput value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              style={{ background: "rgba(255,255,255,0.95)", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, color: C.text, width: "100%" }} />
          </div>
        )}
      </header>

      {loading && !data ? (
        <div style={{ textAlign: "center", padding: 50, color: C.textSub, fontSize: 14 }}>Loading…</div>
      ) : (
        <div style={{ padding: 12 }}>
          {/* ── Quick nav ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <button onClick={() => navigate("/m/sale")}
              style={{ background: `linear-gradient(135deg, ${C.brand}, #0369a1)`, color: "#fff", border: "none", padding: "14px 10px", borderRadius: 12, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", boxShadow: "0 2px 8px rgba(3,76,157,0.25)" }}>
              <FiShoppingCart size={16} /> Quick Sale
            </button>
            <button onClick={() => navigate("/m/inventory")}
              style={{ background: `linear-gradient(135deg, ${C.green}, #15803d)`, color: "#fff", border: "none", padding: "14px 10px", borderRadius: 12, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", boxShadow: "0 2px 8px rgba(22,163,74,0.25)" }}>
              <FiPackage size={16} /> Inventory
            </button>
          </div>

          {/* ── Sales & Purchase ── */}
          <Section title="Sales & Purchase" icon={<FiTrendingUp size={14} />} color={C.brand} bg={C.brandLight}>
            <div style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Stat label="Sales Bills" value={sales.count} color={C.brand} icon={<FiShoppingCart size={16} />} bg={C.brandLight} />
              <Stat label="Sales Amt" value={fmtINR(sales.total)} color={C.brand} icon={<FiTrendingUp size={16} />} bg={C.brandLight} />
              <Stat label="Purchase Bills" value={purchase.count} color={C.orange} icon={<FiTruck size={16} />} bg={C.orangeLight} />
              <Stat label="Purchase Amt" value={fmtINR(purchase.total)} color={C.orange} icon={<FiTrendingDown size={16} />} bg={C.orangeLight} />
            </div>
          </Section>

          {/* ── Payment Modes ── */}
          <Section title={`Payments (${period})`} icon={<FiDollarSign size={14} />} color={C.green} bg={C.greenLight}>
            <div style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              <Stat label="Cash" value={fmtINR(cashTotal)} sub={sales.total ? `${((cashTotal / sales.total) * 100).toFixed(1)}%` : "0%"}
                color={C.green} icon={<BsCash size={16} />} bg={C.greenLight} />
              <Stat label="UPI" value={fmtINR(upiTotal)} sub={sales.total ? `${((upiTotal / sales.total) * 100).toFixed(1)}%` : "0%"}
                color="#7c3aed" icon={<FiSmartphone size={16} />} bg="#f5f3ff" />
              <Stat label="Card" value={fmtINR(cardTotal)} sub={sales.total ? `${((cardTotal / sales.total) * 100).toFixed(1)}%` : "0%"}
                color="#0891b2" icon={<FiCreditCard size={16} />} bg="#ecfeff" />
            </div>
          </Section>

          {/* ── Inventory value ── */}
          <Section title="Inventory Value" icon={<FiPackage size={14} />} color={C.green} bg={C.greenLight} defaultOpen={false}>
            <div style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Stat label="Stock (PTR)" value={fmtINR(inv.stock_by_ptr || 0)} color={C.green} icon={<FiPackage size={16} />} bg={C.greenLight} />
              <Stat label="Stock (MRP)" value={fmtINR(inv.stock_by_mrp || 0)} color={C.green} icon={<FiPackage size={16} />} bg={C.greenLight} />
              <Stat label="Expired (PTR)" value={fmtINR(inv.expired_by_ptr || 0)} color={C.red} icon={<FiAlertTriangle size={16} />} bg={C.redLight} />
              <Stat label="Expired (MRP)" value={fmtINR(inv.expired_by_mrp || 0)} color={C.red} icon={<FiAlertTriangle size={16} />} bg={C.redLight} />
            </div>
          </Section>

          {/* ── Expiring soon ── */}
          <Section title="Expiring Soon (90d)" icon={<FiClock size={14} />} color={C.yellow} bg="#fffbeb" count={expiring.length} defaultOpen={false}>
            {expiring.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", color: C.textLight, fontSize: 12 }}>No items expiring soon</div>
            ) : (
              <div>
                {expiring.slice(0, 10).map((r, i) => {
                  const daysLeft = Math.ceil((new Date(r.exp_date) - new Date(today)) / 86400000);
                  return (
                    <div key={i} style={{ padding: "10px 12px", borderBottom: i < Math.min(expiring.length, 10) - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.item_name}</div>
                        <div style={{ fontSize: 11, color: C.textSub }}>{r.batch_no || "—"} · Qty {r.current_qty}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: daysLeft <= 30 ? C.red : C.yellow }}>{fmtDate(r.exp_date)}</div>
                        <div style={{ fontSize: 10, color: C.textLight }}>{daysLeft}d left</div>
                      </div>
                    </div>
                  );
                })}
                {expiring.length > 10 && <div style={{ padding: 8, textAlign: "center", fontSize: 11, color: C.textSub }}>+{expiring.length - 10} more</div>}
              </div>
            )}
          </Section>

          {/* ── Expired ── */}
          <Section title="Expired (in stock)" icon={<FiAlertTriangle size={14} />} color={C.red} bg="#fff5f5" count={expired.length} defaultOpen={false}>
            {expired.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", color: C.textLight, fontSize: 12 }}>No expired stock</div>
            ) : (
              <div>
                {expired.slice(0, 10).map((r, i) => (
                  <div key={i} style={{ padding: "10px 12px", borderBottom: i < Math.min(expired.length, 10) - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.item_name}</div>
                      <div style={{ fontSize: 11, color: C.textSub }}>{r.batch_no || "—"} · Qty {r.current_qty}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.red }}>{fmtDate(r.exp_date)}</div>
                  </div>
                ))}
                {expired.length > 10 && <div style={{ padding: 8, textAlign: "center", fontSize: 11, color: C.textSub }}>+{expired.length - 10} more</div>}
              </div>
            )}
          </Section>

          {/* ── Low Stock ── */}
          {lowStock.length > 0 && (
            <Section title={`Low Stock (≤ ${lowStockLimit})`} icon={<FiPackage size={14} />} color={C.orange} bg="#fff7ed" count={lowStock.length} defaultOpen={false}>
              <div>
                {lowStock.slice(0, 10).map((r, i) => (
                  <div key={i} style={{ padding: "10px 12px", borderBottom: i < Math.min(lowStock.length, 10) - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.item_name}</div>
                      <div style={{ fontSize: 11, color: C.textSub }}>{r.item_code}</div>
                    </div>
                    <span style={{
                      fontWeight: 800, fontSize: 12,
                      color: asN(r.total_qty) <= 2 ? C.red : C.orange,
                      background: asN(r.total_qty) <= 2 ? C.redLight : C.orangeLight,
                      padding: "2px 10px", borderRadius: 6, alignSelf: "center",
                    }}>{r.total_qty}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Need to pay ── */}
          <Section title="Need to Pay" icon={<FiTruck size={14} />} color={C.orange} bg="#fff7ed"
            count={fmtINR(data?.need_to_pay_total || 0)} defaultOpen={false}>
            {needPay.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", color: C.textLight, fontSize: 12 }}>All payments cleared</div>
            ) : (
              <div>
                {needPay.slice(0, 10).map((r, i) => {
                  const overdue = r.earliest_due && r.earliest_due < today;
                  return (
                    <div key={i} style={{ padding: "10px 12px", borderBottom: i < Math.min(needPay.length, 10) - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.distributor_name}</div>
                        <div style={{ fontSize: 11, color: overdue ? C.red : C.textSub }}>
                          {r.bill_count} bills {r.earliest_due ? `· due ${fmtDate(r.earliest_due)}` : ""} {overdue && "· OVERDUE"}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.orange, alignSelf: "center" }}>₹{asN(r.balance).toFixed(0)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* ── Need to collect ── */}
          <Section title="Need to Collect" icon={<FiDollarSign size={14} />} color={C.green} bg="#f0fdf4"
            count={fmtINR(data?.need_to_collect_total || 0)} defaultOpen={false}>
            {needColl.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", color: C.textLight, fontSize: 12 }}>All payments collected</div>
            ) : (
              <div>
                {needColl.slice(0, 10).map((r, i) => (
                  <div key={i} style={{ padding: "10px 12px", borderBottom: i < Math.min(needColl.length, 10) - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.customer_name}</div>
                      <div style={{ fontSize: 11, color: C.textSub }}>{r.invoice_count} invoices</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.green, alignSelf: "center" }}>₹{asN(r.balance).toFixed(0)}</div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      <style>{`@keyframes mdspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
