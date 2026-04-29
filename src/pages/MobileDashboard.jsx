import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiShoppingCart, FiTruck, FiPackage, FiAlertTriangle,
  FiClock, FiDollarSign, FiRefreshCw, FiTrendingUp, FiTrendingDown,
  FiCreditCard, FiSmartphone, FiLogOut, FiChevronDown, FiChevronUp,
  FiUsers, FiBarChart2, FiPlusCircle, FiSettings, FiShield,
} from "react-icons/fi";
import { BsCash } from "react-icons/bs";
import { API, fmtINR, todayISO, fmtDate } from "../ui.jsx";
import { getShopSettings } from "../thermalPrint.js";
import DateInput from "../comps/DateInput.jsx";
import usePageMeta from "../usePageMeta.js";

const C = {
  brand:       "#16a34a",
  brandDark:   "#15803d",
  green:       "#16a34a", greenLight: "#dcfce7",
  blue:        "#2563eb", blueLight:  "#dbeafe",
  red:         "#dc2626", redLight:   "#fee2e2",
  orange:      "#ea580c", orangeLight:"#ffedd5",
  yellow:      "#ca8a04", yellowLight:"#fef9c3",
  purple:      "#7c3aed", purpleLight:"#f5f3ff",
  cyan:        "#0891b2", cyanLight:  "#ecfeff",
  bg: "#f1f5f9", card: "#fff",
  text: "#0f172a", textSub: "#64748b", textLight: "#94a3b8",
  border: "#e2e8f0",
};

const asN = (x) => { const n = Number(x); return isFinite(n) ? n : 0; };
const PERIODS = ["Today", "Yesterday", "7 Days", "30 Days", "Custom"];

/* ── Compact tile for stat grids ── */
function Tile({ label, value, color, bg, icon }) {
  return (
    <div style={{
      background: bg, borderRadius: 9, padding: "9px 11px",
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      minHeight: 58,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: 0.04 }}>{label}</span>
        {icon && <span style={{ color, opacity: 0.85 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 16, fontWeight: 900, color: C.text, marginTop: 4, letterSpacing: "-0.01em", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

/* ── Card wrapper with optional title ── */
function Card({ title, children, style }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "11px 12px", marginBottom: 10, ...style }}>
      {title && (
        <div style={{ fontSize: 11, fontWeight: 800, color: C.text, textTransform: "uppercase", letterSpacing: 0.06, marginBottom: 8 }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── Collapsible section (used for the detail lists at the bottom) ── */
function Section({ title, color, bg, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
      <button onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", border: "none", cursor: "pointer",
          padding: "10px 12px", background: bg || "#f8fafc",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: open ? `1px solid ${C.border}` : "none",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 12, color, textTransform: "uppercase", letterSpacing: 0.04 }}>{title}</span>
          {count !== undefined && (
            <span style={{ fontSize: 11, fontWeight: 800, color, background: "#fff", padding: "1px 8px", borderRadius: 12 }}>{count}</span>
          )}
        </div>
        {open ? <FiChevronUp size={15} color={C.textSub} /> : <FiChevronDown size={15} color={C.textSub} />}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

/* ── Module nav button ── */
function ModBtn({ label, icon, color, bg, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        background: bg, color, border: "none", borderRadius: 10,
        padding: "12px 6px", display: "flex", flexDirection: "column",
        alignItems: "center", gap: 5, cursor: "pointer", fontSize: 11,
        fontWeight: 700,
      }}>
      {icon}
      {label}
    </button>
  );
}

export default function MobileDashboard() {
  usePageMeta("Admin Dashboard", "Mobile overview for admin");
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("Today");

  const t0 = todayISO();
  const sevenAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const [customFrom, setCustomFrom] = useState(sevenAgo);
  const [customTo, setCustomTo] = useState(t0);

  const lowStockLimit = getShopSettings().lowStockLimit || 5;
  const shop = getShopSettings();
  const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();

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
  const sales    = data?.sales?.[periodKey]    || { total: 0, count: 0 };
  const purchase = data?.purchase?.[periodKey] || { total: 0, count: 0 };
  const modes    = data?.sales_by_mode?.[periodKey] || {};
  const cashTotal = asN(modes.cash);
  const upiTotal  = asN(modes.upi);
  const cardTotal = asN(modes.card);
  const inv       = data?.inventory || {};
  const lowStock  = data?.low_stock_items || [];
  const expiring  = data?.expiring_items  || [];
  const expired   = data?.expired_items   || [];
  const needColl  = data?.need_to_collect || [];
  const needPay   = data?.need_to_pay     || [];
  const today     = todayISO();

  return (
    <div style={{ minHeight: "100vh", background: C.bg, paddingBottom: 30, fontFamily: "'Noto Sans', 'Inter', system-ui, sans-serif" }}>
      {/* ── Header ── */}
      <header style={{
        background: C.brand, color: "#fff",
        padding: "12px 14px 14px",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: "-0.01em", lineHeight: 1.1 }}>
              {(shop.name || "Dashboard").toUpperCase()}
            </div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
              Hi, {user?.name || "Admin"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => period === "Custom" ? load(customFrom, customTo) : load()}
              disabled={loading}
              style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FiRefreshCw size={14} style={{ animation: loading ? "mdspin 1s linear infinite" : "none" }} />
            </button>
            <button onClick={logout} title="Logout"
              style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FiLogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <div style={{ padding: 10 }}>
        {/* ── Two main action tiles ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <button onClick={() => navigate("/m/sale")}
            style={{ background: C.green, color: "#fff", border: "none", padding: "14px 8px", borderRadius: 11, fontSize: 14, fontWeight: 800, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer", boxShadow: "0 1px 4px rgba(22,163,74,0.18)" }}>
            <FiShoppingCart size={20} />
            New Sale
          </button>
          <button onClick={() => navigate("/m/inventory")}
            style={{ background: C.orange, color: "#fff", border: "none", padding: "14px 8px", borderRadius: 11, fontSize: 14, fontWeight: 800, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer", boxShadow: "0 1px 4px rgba(234,88,12,0.18)" }}>
            <FiPackage size={20} />
            Inventory
          </button>
        </div>

        {/* ── Period tabs ── */}
        <div style={{ background: "#fff", borderRadius: 11, padding: 4, marginBottom: 10, display: "flex", gap: 3, overflowX: "auto" }}>
          {PERIODS.map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{
                flex: 1, flexShrink: 0, padding: "8px 6px", fontSize: 12, fontWeight: 700,
                borderRadius: 8, border: "none", cursor: "pointer", whiteSpace: "nowrap",
                background: period === p ? C.brand : "transparent",
                color: period === p ? "#fff" : C.textSub,
              }}>{p}</button>
          ))}
        </div>

        {period === "Custom" && (
          <Card>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <DateInput value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                style={{ flex: 1, fontSize: 12, padding: "7px 9px", border: `1px solid ${C.border}`, borderRadius: 7 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textSub }}>to</span>
              <DateInput value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                style={{ flex: 1, fontSize: 12, padding: "7px 9px", border: `1px solid ${C.border}`, borderRadius: 7 }} />
            </div>
          </Card>
        )}

        {loading && !data ? (
          <div style={{ textAlign: "center", padding: 40, color: C.textSub, fontSize: 13 }}>Loading…</div>
        ) : (
          <>
            {/* ── Sales & Purchase ── */}
            <Card title="Sales & Purchase">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Tile label="SALES"        value={fmtINR(sales.total)}    color={C.green}   bg={C.greenLight}  icon={<FiTrendingUp size={14} />} />
                <Tile label="PURCHASE"     value={fmtINR(purchase.total)} color={C.orange}  bg={C.orangeLight} icon={<FiTrendingDown size={14} />} />
                <Tile label="BILLS (SALE)" value={sales.count}            color={C.textSub} bg="#f1f5f9"       icon={<FiShoppingCart size={14} />} />
                <Tile label="BILLS (BUY)"  value={purchase.count}         color={C.textSub} bg="#f1f5f9"       icon={<FiTruck size={14} />} />
              </div>
            </Card>

            {/* ── Payment Mode ── */}
            <Card title={`Payment Mode (${period})`}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <Tile label="CASH" value={fmtINR(cashTotal)} color={C.green}  bg={C.greenLight}  icon={<BsCash size={14} />} />
                <Tile label="UPI"  value={fmtINR(upiTotal)}  color={C.purple} bg={C.purpleLight} icon={<FiSmartphone size={14} />} />
                <Tile label="CARD" value={fmtINR(cardTotal)} color={C.cyan}   bg={C.cyanLight}   icon={<FiCreditCard size={14} />} />
              </div>
            </Card>

            {/* ── Inventory summary ── */}
            <Card title="Inventory">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Tile label="STOCK VALUE (MRP)" value={fmtINR(inv.stock_by_mrp || 0)}    color={C.green} bg={C.greenLight} icon={<FiPackage size={14} />} />
                <Tile label="EXPIRED STOCK"     value={fmtINR(inv.expired_by_mrp || 0)} color={C.red}   bg={C.redLight}   icon={<FiAlertTriangle size={14} />} />
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: C.textSub, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>Low stock: <strong style={{ color: C.orange }}>{lowStock.length}</strong></span>
                <span>Expiring: <strong style={{ color: C.yellow }}>{expiring.length}</strong></span>
                <span>Expired: <strong style={{ color: C.red }}>{expired.length}</strong></span>
              </div>
            </Card>

            {/* ── Modules (admin only — unlocked via DesktopRedirect) ── */}
            {user?.role === "admin" && (
              <Card title="Modules">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                  <ModBtn label="Sales"       icon={<FiShoppingCart size={18} />}  color={C.green}  bg={C.greenLight}  onClick={() => navigate("/sales")} />
                  <ModBtn label="Add Sale"    icon={<FiPlusCircle size={18} />}    color={C.green}  bg={C.greenLight}  onClick={() => navigate("/addsales")} />
                  <ModBtn label="Purchase"    icon={<FiTruck size={18} />}         color={C.orange} bg={C.orangeLight} onClick={() => navigate("/purchase")} />
                  <ModBtn label="Add Buy"     icon={<FiPlusCircle size={18} />}    color={C.orange} bg={C.orangeLight} onClick={() => navigate("/addpurchase")} />
                  <ModBtn label="Reports"     icon={<FiBarChart2 size={18} />}     color={C.blue}   bg={C.blueLight}   onClick={() => navigate("/reports")} />
                  <ModBtn label="Customers"   icon={<FiUsers size={18} />}         color={C.purple} bg={C.purpleLight} onClick={() => navigate("/customers")} />
                  <ModBtn label="Distributors" icon={<FiUsers size={18} />}        color={C.cyan}   bg={C.cyanLight}   onClick={() => navigate("/distributors")} />
                  <ModBtn label="Settings"    icon={<FiSettings size={18} />}      color={C.textSub} bg="#f1f5f9"      onClick={() => navigate("/settings")} />
                </div>
              </Card>
            )}

            {/* ── Expiring Soon (next 90 days) ── */}
            <Section title="Expiring Soon (90d)" color={C.yellow} bg="#fffbeb" count={expiring.length}>
              {expiring.length === 0 ? (
                <div style={{ padding: 14, textAlign: "center", color: C.textLight, fontSize: 12 }}>No items expiring soon</div>
              ) : (
                <div>
                  {expiring.slice(0, 10).map((r, i) => {
                    const daysLeft = Math.ceil((new Date(r.exp_date) - new Date(today)) / 86400000);
                    return (
                      <div key={i}
                        onClick={() => r.item_id && navigate(`/inventory/${r.item_id}`)}
                        style={{ padding: "9px 12px", borderBottom: i < Math.min(expiring.length, 10) - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", gap: 8, cursor: r.item_id ? "pointer" : "default" }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.item_name}</div>
                          <div style={{ fontSize: 10, color: C.textSub }}>{r.batch_no || "—"} · Qty {r.current_qty}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: daysLeft <= 30 ? C.red : C.yellow }}>{fmtDate(r.exp_date)}</div>
                          <div style={{ fontSize: 10, color: C.textLight }}>{daysLeft}d left</div>
                        </div>
                      </div>
                    );
                  })}
                  {expiring.length > 10 && <div style={{ padding: 6, textAlign: "center", fontSize: 11, color: C.textSub }}>+{expiring.length - 10} more</div>}
                </div>
              )}
            </Section>

            {/* ── Expired (in stock) ── */}
            <Section title="Expired (in stock)" color={C.red} bg="#fff5f5" count={expired.length}>
              {expired.length === 0 ? (
                <div style={{ padding: 14, textAlign: "center", color: C.textLight, fontSize: 12 }}>No expired stock</div>
              ) : (
                <div>
                  {expired.slice(0, 10).map((r, i) => (
                    <div key={i}
                      onClick={() => r.item_id && navigate(`/inventory/${r.item_id}`)}
                      style={{ padding: "9px 12px", borderBottom: i < Math.min(expired.length, 10) - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", gap: 8, cursor: r.item_id ? "pointer" : "default" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.item_name}</div>
                        <div style={{ fontSize: 10, color: C.textSub }}>{r.batch_no || "—"} · Qty {r.current_qty}</div>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: C.red }}>{fmtDate(r.exp_date)}</div>
                    </div>
                  ))}
                  {expired.length > 10 && <div style={{ padding: 6, textAlign: "center", fontSize: 11, color: C.textSub }}>+{expired.length - 10} more</div>}
                </div>
              )}
            </Section>

            {/* ── Low Stock ── */}
            {lowStock.length > 0 && (
              <Section title={`Low Stock (≤ ${lowStockLimit})`} color={C.orange} bg="#fff7ed" count={lowStock.length}>
                <div>
                  {lowStock.slice(0, 10).map((r, i) => (
                    <div key={i} style={{ padding: "9px 12px", borderBottom: i < Math.min(lowStock.length, 10) - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.item_name}</div>
                        <div style={{ fontSize: 10, color: C.textSub }}>{r.item_code}</div>
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 11,
                        color: asN(r.total_qty) <= 2 ? C.red : C.orange,
                        background: asN(r.total_qty) <= 2 ? C.redLight : C.orangeLight,
                        padding: "2px 9px", borderRadius: 6, alignSelf: "center" }}>{r.total_qty}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* ── Need to Pay ── */}
            <Section title="Need to Pay" color={C.orange} bg="#fff7ed"
              count={fmtINR(data?.need_to_pay_total || 0)}>
              {needPay.length === 0 ? (
                <div style={{ padding: 14, textAlign: "center", color: C.textLight, fontSize: 12 }}>All payments cleared</div>
              ) : (
                <div>
                  {needPay.slice(0, 10).map((r, i) => {
                    const overdue = r.earliest_due && r.earliest_due < today;
                    return (
                      <div key={i} style={{ padding: "9px 12px", borderBottom: i < Math.min(needPay.length, 10) - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.distributor_name}</div>
                          <div style={{ fontSize: 10, color: overdue ? C.red : C.textSub }}>
                            {r.bill_count} bills {r.earliest_due ? `· due ${fmtDate(r.earliest_due)}` : ""} {overdue && "· OVERDUE"}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: C.orange, alignSelf: "center" }}>₹{asN(r.balance).toFixed(0)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* ── Need to Collect ── */}
            <Section title="Need to Collect" color={C.green} bg="#f0fdf4"
              count={fmtINR(data?.need_to_collect_total || 0)}>
              {needColl.length === 0 ? (
                <div style={{ padding: 14, textAlign: "center", color: C.textLight, fontSize: 12 }}>All payments collected</div>
              ) : (
                <div>
                  {needColl.slice(0, 10).map((r, i) => (
                    <div key={i} style={{ padding: "9px 12px", borderBottom: i < Math.min(needColl.length, 10) - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.customer_name}</div>
                        <div style={{ fontSize: 10, color: C.textSub }}>{r.invoice_count} invoices</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.green, alignSelf: "center" }}>₹{asN(r.balance).toFixed(0)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}
      </div>

      <style>{`@keyframes mdspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
