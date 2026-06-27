import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiRefreshCw, FiCheck, FiX as FiXIcon, FiShield, FiLogOut } from "react-icons/fi";
import { C, API, GLOBAL_CSS, DATE_RANGES, applyDateRange, todayISO } from "../ui.jsx";
import DateInput from "../comps/DateInput.jsx";
import usePageMeta from "../usePageMeta.js";

export default function LoginLog() {
  usePageMeta("Login Activity", "Track user sign-in attempts");
  const navigate = useNavigate();
  const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState("Today");
  const [from, setFrom] = useState(todayISO());
  const [to, setTo]     = useState(todayISO());
  const [status, setStatus] = useState("");

  // Admin-only route
  useEffect(() => {
    if (!user || user.role !== "admin") navigate("/");
  }, []);

  useEffect(() => {
    const r = applyDateRange(dateRange);
    if (r) { setFrom(r.from); setTo(r.to); }
  }, [dateRange]);

  const load = async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to)   qs.set("to", to);
      if (status) qs.set("status", status);
      const res = await fetch(`${API}/get_login_log.php?${qs}`);
      const j = await res.json();
      if (j.status === "success") setRows(j.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (from && to) load(); }, [from, to, status]);

  const fmtDT = (s) => {
    if (!s) return "";
    const d = new Date(s.replace(" ", "T"));
    if (isNaN(d.getTime())) return s;
    return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const succCount   = rows.filter((r) => r.status === "success").length;
  const failCount   = rows.filter((r) => r.status === "failure").length;
  const logoutCount = rows.filter((r) => r.status === "logout").length;

  return (
    <div id="g-root" style={{ padding: "24px 28px", background: C.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
            <FiShield size={20} style={{ color: C.brand }} /> Login Activity
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textSub }}>
            {rows.length} events · <span style={{ color: C.green, fontWeight: 700 }}>{succCount} login</span> · <span style={{ color: C.brand, fontWeight: 700 }}>{logoutCount} logout</span> · <span style={{ color: C.red, fontWeight: 700 }}>{failCount} failed</span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 18, flexWrap: "nowrap" }}>
        <select className="g-sel sm" style={{ width: 140 }} value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
          {DATE_RANGES.map((r) => <option key={r}>{r}</option>)}
        </select>
        <DateInput className="g-inp sm" style={{ width: 130 }} value={from} onChange={(e) => { setFrom(e.target.value); setDateRange("Custom"); }} />
        <DateInput className="g-inp sm" style={{ width: 130 }} value={to}   onChange={(e) => { setTo(e.target.value);   setDateRange("Custom"); }} />
        <select className="g-sel sm" style={{ width: 130 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All status</option>
          <option value="success">Login</option>
          <option value="failure">Failed</option>
          <option value="logout">Logout</option>
        </select>
        <button className="g-btn ghost sm" onClick={load} disabled={loading}>
          <FiRefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      {/* Table */}
      <div className="g-card">
        <div style={{ overflowX: "auto" }}>
          <table className="g-table">
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>IP</th>
                <th>Browser</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: C.textSub }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: C.textSub }}>No login events in this range</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{fmtDT(r.logged_at)}</td>
                  <td style={{ fontWeight: 600 }}>{r.user_name || "—"}</td>
                  <td>
                    {r.role && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: r.role === "admin" ? "#fef3c7" : "#e0e7ff", color: r.role === "admin" ? "#92400e" : "#3730a3" }}>{r.role}</span>}
                  </td>
                  <td>
                    {r.status === "success" ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: C.green, background: C.greenLight, padding: "2px 8px", borderRadius: 5 }}>
                        <FiCheck size={11} /> Login
                      </span>
                    ) : r.status === "logout" ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: C.brand, background: C.brandLighter, padding: "2px 8px", borderRadius: 5 }}>
                        <FiLogOut size={11} /> Logout
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: C.red, background: C.redLight, padding: "2px 8px", borderRadius: 5 }}>
                        <FiXIcon size={11} /> Failed
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: C.textSub, fontFamily: "monospace" }}>{r.ip || "—"}</td>
                  <td style={{ fontSize: 11, color: C.textSub, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.user_agent || ""}>{r.user_agent || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
