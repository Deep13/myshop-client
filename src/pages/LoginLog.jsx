import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiRefreshCw, FiCheck, FiX as FiXIcon, FiShield, FiLogOut, FiTrash2 } from "react-icons/fi";
import { C, API, GLOBAL_CSS, DATE_RANGES, applyDateRange, todayISO, Modal } from "../ui.jsx";
import DateInput from "../comps/DateInput.jsx";
import usePageMeta from "../usePageMeta.js";
import toast from "../toast.js";

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
  // Trimming the log: ask the server how many rows are old enough first, so the
  // confirmation shows a real number instead of asking the user to approve a guess.
  const [purge, setPurge] = useState(null);     // { matched, oldest } once previewed
  const [purging, setPurging] = useState(false);
  const KEEP_DAYS = 30;

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

  const askPurge = async () => {
    try {
      setPurging(true);
      const res = await fetch(`${API}/delete_login_log.php`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: KEEP_DAYS }),       // no confirm — counts only
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.status !== "success") throw new Error(j.message || "Could not check the log");
      if (!j.matched) { toast.success(`Nothing older than ${KEEP_DAYS} days`); return; }
      setPurge({ matched: j.matched, oldest: j.oldest });
    } catch (e) { toast.error(e.message || "Could not check the log"); }
    finally { setPurging(false); }
  };

  const doPurge = async () => {
    try {
      setPurging(true);
      const res = await fetch(`${API}/delete_login_log.php`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: KEEP_DAYS, confirm: true, deletedBy: user?.id || 0 }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.status !== "success") throw new Error(j.message || "Delete failed");
      toast.success(`${j.deleted} event${j.deleted === 1 ? "" : "s"} deleted · ${j.remaining} kept`);
      setPurge(null);
      load();
    } catch (e) { toast.error(e.message || "Delete failed"); }
    finally { setPurging(false); }
  };

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
        <button className="g-btn ghost sm" onClick={askPurge} disabled={purging}
          title={`Permanently delete sign-in events older than ${KEEP_DAYS} days`}
          style={{ color: C.red, borderColor: C.red }}>
          <FiTrash2 size={14} /> Clear older than {KEEP_DAYS} days
        </button>
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

      {/* Deleting audit history cannot be undone, so the count and the cut-off
          date are both shown before anything is removed. */}
      <Modal show={!!purge} title="Clear old login activity" onClose={() => setPurge(null)} width={460}>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: C.text }}>
          <p style={{ margin: 0 }}>
            This permanently deletes <b>{purge?.matched} sign-in event{purge?.matched === 1 ? "" : "s"}</b> older
            than {KEEP_DAYS} days, back to {purge?.oldest ? fmtDT(purge.oldest) : "the start of the log"}.
          </p>
          <p style={{ margin: "10px 0 0", color: C.textSub, fontSize: 13 }}>
            The last {KEEP_DAYS} days are kept. There is no undo.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          <button className="g-btn ghost sm" onClick={() => setPurge(null)} disabled={purging}>Cancel</button>
          <button className="g-btn sm" onClick={doPurge} disabled={purging}
            style={{ background: C.red, borderColor: C.red, color: "#fff" }}>
            {purging ? "Deleting…" : `Delete ${purge?.matched} event${purge?.matched === 1 ? "" : "s"}`}
          </button>
        </div>
      </Modal>
    </div>
  );
}
