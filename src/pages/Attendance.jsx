import { useEffect, useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiCalendar, FiRefreshCw } from "react-icons/fi";
import { C, GLOBAL_CSS, API } from "../ui.jsx";
import usePageMeta from "../usePageMeta.js";
import toast from "../toast.js";

const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();
const isAdmin = user?.role === "admin";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const REF_MONDAY = Date.UTC(2024, 0, 1);
// Rotation config — anchor day + weekly step (mirrors the physical rota)
const ANCHOR = 0;   // Monday
const STEP = 2;

/* Status visual styles — platform palette */
const STYLES = {
  present:    { bg: "#ffffff", fg: C.text,    border: "1px solid #e5e7eb",  mark: "",         label: "Present" },
  off:        { bg: "#dbeafe", fg: "#1d4ed8", border: "1px solid #93c5fd",  mark: "off",      label: "Weekly off" },
  makeup:     { bg: "#dcfce7", fg: "#15803d", border: "1px solid #86efac",  mark: "worked",   label: "Worked on off day (earns a day)" },
  absent:     { bg: "#fee2e2", fg: "#b91c1c", border: "1px solid #fca5a5",  mark: "absent",   label: "Unplanned off (owes a day)" },
  half:       { bg: "#fef3c7", fg: "#92400e", border: "1px solid #fcd34d",  mark: "half",     label: "Half day (owes half)" },
  halfoff:    { bg: "#eff6ff", fg: "#1d4ed8", border: "1px dashed #93c5fd", mark: "½ off",    label: "Standing half-day off" },
  makeuphalf: { bg: "#dcfce7", fg: "#15803d", border: "1px solid #86efac",  mark: "full",     label: "Worked the half day too (½ credit)" },
  offhalf:    { bg: "#fee2e2", fg: "#b91c1c", border: "1px solid #fca5a5",  mark: "full off", label: "Took the whole day on a half-day (owes ½)" },
};

const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const weekIndex = (ms) => Math.floor((ms - REF_MONDAY) / 604800000);

export default function Attendance() {
  usePageMeta("Attendance", "Team attendance, weekly offs and owed days");
  const now = new Date();
  const [y, setY] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth());
  const [users, setUsers] = useState([]);
  const [records, setRecords] = useState({}); // key `${userId}|${date}` -> status
  const [loading, setLoading] = useState(true);
  const [busyCell, setBusyCell] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const qs = isAdmin ? "" : `?user_id=${user?.id || 0}`;
      const r = await fetch(`${API}/get_attendance.php${qs}`);
      const j = await r.json();
      if (j.status !== "success") throw new Error(j.message || "Failed");
      setUsers(j.users || []);
      const map = {};
      (j.records || []).forEach((x) => { map[`${x.user_id}|${x.work_date}`] = x.status; });
      setRecords(map);
    } catch (e) { toast.error(e.message || "Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Rotation index = position among rotating users (stable, id-ordered)
  const rotIdx = useMemo(() => {
    const map = {};
    users.forEach((u, i) => { map[u.id] = i; });
    return map;
  }, [users]);

  const halfWdOf = (u) => (String(u.off_mode || "").startsWith("half:") ? Number(u.off_mode.split(":")[1]) : -1);
  const fullWdOf = (u) => (String(u.off_mode || "").startsWith("full:") ? Number(u.off_mode.split(":")[1]) : -1);
  const offDayOf = (u, wIdx) => {
    const fixed = fullWdOf(u);
    if (fixed >= 0) return fixed; // fixed weekly off — same day every week
    return (((wIdx + ANCHOR + (rotIdx[u.id] || 0) * STEP) % 7) + 7) % 7;
  };

  const statusOf = (u, key, ms) => {
    const stored = records[`${u.id}|${key}`] || null;
    const wd = ((new Date(ms).getUTCDay()) + 6) % 7;
    const halfWd = halfWdOf(u);
    if (halfWd >= 0) {
      if (wd === halfWd) return { kind: "halfday", status: stored === "makeup" ? "makeuphalf" : stored === "absent" ? "offhalf" : "halfoff" };
    } else if (offDayOf(u, weekIndex(ms)) === wd) {
      return { kind: "off", status: stored === "makeup" ? "makeup" : "off" };
    }
    if (stored === "absent" || stored === "half") return { kind: "normal", status: stored };
    return { kind: "normal", status: "present" };
  };

  const balance = (u) => {
    let owed = 0;
    const halfWd = halfWdOf(u);
    Object.entries(records).forEach(([k, v]) => {
      const [uid, date] = k.split("|");
      if (Number(uid) !== u.id || !v) return;
      const p = date.split("-").map(Number);
      const ms = Date.UTC(p[0], p[1] - 1, p[2]);
      const wd = ((new Date(ms).getUTCDay()) + 6) % 7;
      if (halfWd >= 0 && wd === halfWd) {
        if (v === "makeup") owed -= 0.5;
        if (v === "absent") owed += 0.5;
        return;
      }
      if (halfWd < 0 && offDayOf(u, weekIndex(ms)) === wd) {
        if (v === "makeup") owed -= 1;
        return;
      }
      if (v === "absent") owed += 1;
      if (v === "half") owed += 0.5;
    });
    return owed;
  };

  const setStatus = async (u, key, value) => {
    const mapKey = `${u.id}|${key}`;
    const prev = records[mapKey] || null;
    // optimistic
    setRecords((p) => {
      const n = { ...p };
      if (value) n[mapKey] = value; else delete n[mapKey];
      return n;
    });
    setBusyCell(mapKey);
    try {
      const r = await fetch(`${API}/set_attendance.php`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, date: key, status: value, updatedBy: user?.id || 0 }),
      });
      const j = await r.json();
      if (j.status !== "success") throw new Error(j.message || "Failed");
    } catch (e) {
      // rollback
      setRecords((p) => {
        const n = { ...p };
        if (prev) n[mapKey] = prev; else delete n[mapKey];
        return n;
      });
      toast.error(e.message || "Failed to save");
    } finally { setBusyCell(null); }
  };

  const cycle = (u, key, ms) => {
    if (!isAdmin || busyCell) return;
    const cur = statusOf(u, key, ms);
    if (cur.kind === "off") return setStatus(u, key, cur.status === "makeup" ? null : "makeup");
    if (cur.kind === "halfday") {
      const next = { halfoff: "makeup", makeuphalf: "absent", offhalf: null };
      return setStatus(u, key, next[cur.status]);
    }
    const order = { present: "absent", absent: "half", half: null };
    setStatus(u, key, order[cur.status]);
  };

  /* month grid */
  const todayKey = iso(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = weekIndex(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const firstWd = ((new Date(Date.UTC(y, m, 1)).getUTCDay()) + 6) % 7;
  const totalCells = Math.ceil((firstWd + daysInMonth) / 7) * 7;

  const visibleUsers = isAdmin ? users : users.filter((u) => u.id === user?.id);

  const legend = ["present", "off", "halfoff", "absent", "half", "makeup"];

  return (
    <div id="g-root" style={{ padding: "24px 28px", background: C.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 6 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
            <FiCalendar size={20} style={{ color: C.brand }} /> Attendance
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textSub }}>
            Weekly off rotates automatically. Days off outside the rotation are owed back.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 2, background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 999, padding: 3 }}>
            <button onClick={() => { setM(m === 0 ? 11 : m - 1); if (m === 0) setY(y - 1); }} aria-label="Previous month"
              style={{ width: 32, height: 32, border: 0, borderRadius: 999, background: "transparent", color: C.brand, cursor: "pointer", fontSize: 16 }}>
              <FiChevronLeft size={16} style={{ verticalAlign: "middle" }} />
            </button>
            <div style={{ minWidth: 140, textAlign: "center", fontSize: 14, fontWeight: 700, color: C.text }}>{MONTHS[m]} {y}</div>
            <button onClick={() => { setM(m === 11 ? 0 : m + 1); if (m === 11) setY(y + 1); }} aria-label="Next month"
              style={{ width: 32, height: 32, border: 0, borderRadius: 999, background: "transparent", color: C.brand, cursor: "pointer", fontSize: 16 }}>
              <FiChevronRight size={16} style={{ verticalAlign: "middle" }} />
            </button>
          </div>
          <button className="g-btn ghost sm" onClick={() => { setY(now.getFullYear()); setM(now.getMonth()); }}>Today</button>
          <button className="g-btn ghost sm" onClick={load} disabled={loading} title="Refresh">
            <FiRefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: C.textSub, marginBottom: 16 }}>
        {isAdmin
          ? "Click a day to cycle it. Regular day: present → absent (owes a day) → half day. Rotating off day: click to mark it worked. Standing half-day: ½ off → worked full → whole day off."
          : "View only — your attendance is managed by the admin. Off-day patterns are set in Admin Users."}
      </div>

      {loading && users.length === 0 ? (
        <div className="g-card" style={{ padding: 36, textAlign: "center", color: C.textSub }}>Loading…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, maxWidth: 1180 }}>
          {visibleUsers.map((u) => {
            const owed = balance(u);
            const pretty = String(Math.round(Math.abs(owed) * 2) / 2);
            const halfWd = halfWdOf(u);
            const cells = [];
            for (let c = 0; c < totalCells; c++) {
              const dayNum = c - firstWd + 1;
              if (dayNum < 1 || dayNum > daysInMonth) { cells.push(null); continue; }
              const key = iso(y, m, dayNum);
              const ms = Date.UTC(y, m, dayNum);
              const st = statusOf(u, key, ms);
              cells.push({ dayNum, key, ms, st, s: STYLES[st.status], isToday: key === todayKey });
            }
            return (
              <div key={u.id} className="g-card" style={{ borderTop: `4px solid ${C.brand}`, padding: "14px 14px 16px", marginBottom: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 2 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", padding: "3px 10px", borderRadius: 999,
                    background: owed > 0 ? "#fee2e2" : owed < 0 ? "#dcfce7" : C.brandLighter,
                    color:      owed > 0 ? "#b91c1c" : owed < 0 ? "#15803d" : C.brand }}>
                    {owed > 0 ? `owes ${pretty} day${owed === 1 ? "" : "s"}` : owed < 0 ? `${pretty} in credit` : "all settled"}
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: C.brand, background: C.brandLighter, border: `1px solid #bfdbfe`, borderRadius: 999, padding: "3px 10px", display: "inline-block", marginBottom: 12 }}>
                  {halfWd >= 0
                    ? `Half day every ${DAY_NAMES[halfWd]}`
                    : fullWdOf(u) >= 0
                      ? `Full day off every ${DAY_NAMES[fullWdOf(u)]}`
                      : `Rotating off · ${DAY_NAMES[offDayOf(u, thisWeek)]} this week`}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 5 }}>
                  {DOW.map((d) => (
                    <div key={d} style={{ textAlign: "center", fontSize: 10, letterSpacing: "0.08em", color: C.textLight, textTransform: "uppercase", fontWeight: 700 }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                  {cells.map((cell, i) => cell === null ? (
                    <div key={i} style={{ minHeight: 44 }} />
                  ) : (
                    <button key={i}
                      onClick={() => cycle(u, cell.key, cell.ms)}
                      disabled={!isAdmin}
                      title={`${DAY_NAMES[(((firstWd + cell.dayNum - 1) % 7) + 7) % 7]} ${cell.dayNum} — ${cell.s.label}`}
                      style={{
                        position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
                        minHeight: 44, padding: "3px 2px", borderRadius: 8,
                        cursor: isAdmin ? "pointer" : "default",
                        background: cell.s.bg, color: cell.s.fg, border: cell.s.border,
                        boxShadow: cell.isToday ? `inset 0 0 0 2px ${C.brand}` : "none",
                        fontFamily: "inherit",
                        opacity: busyCell === `${u.id}|${cell.key}` ? 0.5 : 1,
                      }}>
                      <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{cell.dayNum}</span>
                      {cell.s.mark && <span style={{ fontSize: 8, letterSpacing: "0.05em", textTransform: "uppercase", lineHeight: 1, opacity: 0.85, fontWeight: 700 }}>{cell.s.mark}</span>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", alignItems: "center", fontSize: 12, color: C.textSub, marginTop: 18, maxWidth: 1180 }}>
        {legend.map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, display: "inline-block", background: STYLES[k].bg, border: STYLES[k].border }} />
            <span>{STYLES[k].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
