import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiShoppingCart, FiTruck, FiPackage, FiAlertTriangle,
  FiClock, FiDollarSign, FiRefreshCw, FiTrendingUp, FiTrendingDown,
  FiCreditCard, FiSmartphone, FiLogOut,
} from "react-icons/fi";
import { BsCash } from "react-icons/bs";
import { API, fmtINR, todayISO, fmtDate } from "../ui.jsx";
import { getShopSettings } from "../thermalPrint.js";
import DateInput from "../comps/DateInput.jsx";
import usePageMeta from "../usePageMeta.js";

const C = {
  brand:       "#16a34a",  // header / primary green
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
  border: "#e2e8f0", borderLight: "#f1f5f9",
};

const asN = (x) => { const n = Number(x); return isFinite(n) ? n : 0; };
const PERIODS = ["Today", "Yesterday", "7 Days", "30 Days", "Custom"];

/* ── Tile for the 2x2 Sales & Purchase grid and similar grids ── */
function Tile({ label, value, color, bg, icon }) {
  return (
    <div style={{
      background: bg, borderRadius: 10, padding: "14px 14px",
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      minHeight: 78, position: "relative",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: 0.04 }}>{label}</span>
        {icon && <span style={{ color, opacity: 0.85 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: C.text, marginTop: 8, letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
    </div>
  );
}

/* ── Card wrapper with title ── */
function Card({ title, children, style }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "14px 14px", marginBottom: 12, ...style }}>
      {title && (
        <div style={{ fontSize: 12, fontWeight: 800, color: C.text, textTransform: "uppercase", letterSpacing: 0.06, marginBottom: 10 }}>
          {title}
        </div>
      )}
      {children}
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
        padding: "14px 16px 16px",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.01em", lineHeight: 1.1 }}>
              {(shop.name || "Dashboard").toUpperCase()}
            </div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
              Hi, {user?.name || "Admin"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => period === "Custom" ? load(customFrom, customTo) : load()}
              disabled={loading}
              style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: 36, height: 36, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FiRefreshCw size={16} style={{ animation: loading ? "mdspin 1s linear infinite" : "none" }} />
            </button>
            <button onClick={logout} title="Logout"
              style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: 36, height: 36, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FiLogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div style={{ padding: 12 }}>
        {/* ── Big action buttons ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <button onClick={() => navigate("/m/sale")}
            style={{ background: C.green, color: "#fff", border: "none", padding: "22px 12px", borderRadius: 14, fontSize: 17, fontWeight: 800, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", boxShadow: "0 2px 6px rgba(22,163,74,0.18)" }}>
            <FiShoppingCart size={26} />
            New Sale
          </button>
          <button onClick={() => navigate("/m/inventory")}
            style={{ background: C.orange, color: "#fff", border: "none", padding: "22px 12px", borderRadius: 14, fontSize: 17, fontWeight: 800, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", boxShadow: "0 2px 6px rgba(234,88,12,0.18)" }}>
            <FiPackage size={26} />
            Inventory
          </button>
        </div>

        {/* ── Period tabs ── */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 6, marginBottom: 12, display: "flex", gap: 4, overflowX: "auto" }}>
          {PERIODS.map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{
                flex: 1, flexShrink: 0, padding: "10px 8px", fontSize: 13, fontWeight: 700,
                borderRadius: 10, border: "none", cursor: "pointer", whiteSpace: "nowrap",
                background: period === p ? C.brand : "transparent",
                color: period === p ? "#fff" : C.textSub,
                transition: "background 0.15s",
              }}>{p}</button>
          ))}
        </div>

        {/* Custom date range */}
        {period === "Custom" && (
          <Card>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <DateInput value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                className="g-inp" style={{ flex: 1, fontSize: 13, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.textSub }}>to</span>
              <DateInput value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                className="g-inp" style={{ flex: 1, fontSize: 13, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8 }} />
            </div>
          </Card>
        )}

        {loading && !data ? (
          <div style={{ textAlign: "center", padding: 50, color: C.textSub, fontSize: 14 }}>Loading…</div>
        ) : (
          <>
            {/* ── Sales & Purchase ── */}
            <Card title="Sales & Purchase">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Tile label="SALES" value={fmtINR(sales.total)} color={C.green} bg={C.greenLight}
                  icon={<FiTrendingUp size={18} />} />
                <Tile label="PURCHASE" value={fmtINR(purchase.total)} color={C.orange} bg={C.orangeLight}
                  icon={<FiTrendingDown size={18} />} />
                <Tile label="BILLS (SALE)" value={sales.count} color={C.textSub} bg="#f1f5f9"
                  icon={<FiShoppingCart size={18} />} />
                <Tile label="BILLS (BUY)" value={purchase.count} color={C.textSub} bg="#f1f5f9"
                  icon={<FiTruck size={18} />} />
              </div>
            </Card>

            {/* ── Payment Mode ── */}
            <Card title={`Payment Mode (${period})`}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <Tile label="CASH" value={fmtINR(cashTotal)} color={C.green} bg={C.greenLight} />
                <Tile label="UPI"  value={fmtINR(upiTotal)}  color={C.blue}  bg={C.blueLight} />
                <Tile label="CARD" value={fmtINR(cardTotal)} color={C.yellow} bg={C.yellowLight} />
              </div>
            </Card>

            {/* ── Inventory ── */}
            <Card title="Inventory">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Tile label="STOCK VALUE (MRP)" value={fmtINR(inv.stock_by_mrp || 0)} color={C.green} bg={C.greenLight}
                  icon={<FiPackage size={18} />} />
                <Tile label="EXPIRED STOCK" value={fmtINR(inv.expired_by_mrp || 0)} color={C.red} bg={C.redLight}
                  icon={<FiAlertTriangle size={18} />} />
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: C.textSub, display: "flex", gap: 14, flexWrap: "wrap" }}>
                <span>Low stock: <strong style={{ color: C.orange }}>{lowStock.length}</strong></span>
                <span>Expiring: <strong style={{ color: C.yellow }}>{expiring.length}</strong></span>
                <span>Expired: <strong style={{ color: C.red }}>{expired.length}</strong></span>
              </div>
            </Card>

            {/* ── Need to Collect (single line, like screenshot) ── */}
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.green, textTransform: "uppercase", letterSpacing: 0.06 }}>Need to Collect</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: C.green }}>{fmtINR(data?.need_to_collect_total || 0)}</span>
              </div>
              {needColl.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: C.textSub }}>
                  From {needColl.length} customer{needColl.length === 1 ? "" : "s"}
                </div>
              )}
            </Card>

            {/* ── Need to Pay (similar) ── */}
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.orange, textTransform: "uppercase", letterSpacing: 0.06 }}>Need to Pay</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: C.orange }}>{fmtINR(data?.need_to_pay_total || 0)}</span>
              </div>
              {needPay.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: C.textSub }}>
                  To {needPay.length} distributor{needPay.length === 1 ? "" : "s"}
                  {needPay.some((p) => p.earliest_due && p.earliest_due < today) && (
                    <span style={{ color: C.red, fontWeight: 700, marginLeft: 8 }}>· some overdue</span>
                  )}
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      <style>{`@keyframes mdspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
