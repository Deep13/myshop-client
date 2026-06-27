import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { FiAward, FiCheck, FiSearch, FiPlus, FiRefreshCw, FiCornerUpLeft, FiAlertCircle, FiClock, FiChevronDown, FiChevronRight, FiTrash2, FiX } from "react-icons/fi";
import { C, GLOBAL_CSS, API, Modal, fmt2, fmtDate } from "../ui.jsx";
import usePageMeta from "../usePageMeta.js";
import toast from "../toast.js";

const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();
const isAdmin = user?.role === "admin";

/* ── Card visual: the 5-stamp wheel + ₹100 OFF badge ── */
function LoyaltyCardVisual({ card, onClickCircle, onClickFilled, onClickRedeem, busy }) {
  const stamps = card?.stamps || [];
  const stampedBy = new Map(stamps.map((s) => [Number(s.stamp_no), s]));
  const count = stamps.length;
  const isComplete = card?.status === "completed";
  const isRedeemed = card?.status === "redeemed";

  return (
    <div style={{
      background: "linear-gradient(135deg, #0b0b14 0%, #1a1a2e 50%, #0b0b14 100%)",
      borderRadius: 18,
      padding: "26px 28px 30px",
      color: "#fff",
      boxShadow: "0 14px 40px rgba(0,0,0,0.25)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Decorative wave */}
      <div style={{
        position: "absolute", top: 0, left: 0, width: "65%", height: 90,
        background: "radial-gradient(circle at top left, rgba(212,175,55,0.18), transparent 70%)",
      }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, position: "relative" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "0.04em" }}>GANGA INSTAMART</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>547, West Chowbaga, Kolkata-700105</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>+91-7204909749, +91-9123099027</div>
        </div>
        {card && (
          <div style={{ textAlign: "right", fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
            <div>Card #{card.card_number}</div>
            <div>{fmtDate(card.issued_at)}</div>
            <div style={{ marginTop: 4, display: "inline-block", padding: "3px 10px", borderRadius: 12, fontSize: 10, fontWeight: 800,
              background: isRedeemed ? "rgba(34,197,94,0.18)" : isComplete ? "rgba(212,175,55,0.20)" : "rgba(99,102,241,0.20)",
              color: isRedeemed ? "#86efac" : isComplete ? "#fbbf24" : "#a5b4fc",
              border: `1px solid ${isRedeemed ? "rgba(34,197,94,0.35)" : isComplete ? "rgba(212,175,55,0.4)" : "rgba(165,180,252,0.35)"}`,
            }}>{isRedeemed ? "REDEEMED" : isComplete ? "COMPLETED" : "ACTIVE"}</div>
          </div>
        )}
      </div>

      <div style={{ fontFamily: "'Cinzel', 'Times New Roman', serif", textAlign: "center", fontSize: 30, fontWeight: 800,
        letterSpacing: "0.18em", color: "#d4af37", margin: "18px 0 22px",
        textShadow: "0 0 22px rgba(212,175,55,0.35)",
      }}>LOYALTY CARD</div>

      {/* 5 circles + ₹100 OFF */}
      <div style={{ display: "flex", justifyContent: "center", gap: 12, alignItems: "center", marginBottom: 18 }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const s = stampedBy.get(n);
          const filled = !!s;
          // Empty circle: stampable when card is still active.
          // Filled circle: unsignable when not redeemed (admin or not — confirmation gates it).
          const clickStamp  = !filled && !isComplete && !isRedeemed && !busy;
          const clickUnsign = filled  && !isRedeemed && !busy;
          const clickable   = clickStamp || clickUnsign;
          return (
            <button key={n}
              onClick={() => {
                if (clickStamp)  onClickCircle?.(n);
                if (clickUnsign) onClickFilled?.(n);
              }}
              disabled={!clickable}
              title={filled
                ? `Stamped ${fmtDate(s.stamped_at)} by ${s.stamped_by_name || "—"}${s.invoice_no ? ` · Invoice ${s.invoice_no}` : ""}${clickUnsign ? " · Click to remove" : ""}`
                : clickStamp ? `Click to stamp circle ${n}` : ""}
              style={{
                width: 56, height: 56, borderRadius: "50%",
                background: filled ? "radial-gradient(circle at 30% 30%, #fff8e1, #d4af37 70%, #8a6c1d)" : "#f4f4f4",
                border: filled ? "3px solid #d4af37" : "3px solid rgba(212,175,55,0.55)",
                cursor: clickable ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#3d2e0a",
                transition: "all 0.15s",
                boxShadow: filled ? "0 0 18px rgba(212,175,55,0.45)" : "none",
              }}
              onMouseEnter={(e) => { if (clickable) { e.currentTarget.style.background = "#e9e4d0"; e.currentTarget.style.borderColor = "#d4af37"; } }}
              onMouseLeave={(e) => { if (clickable) { e.currentTarget.style.background = "#f4f4f4"; e.currentTarget.style.borderColor = "rgba(212,175,55,0.55)"; } }}>
              {filled
                ? <FiCheck size={26} strokeWidth={3} />
                : <span style={{ fontSize: 18, fontWeight: 800, color: "rgba(0,0,0,0.25)" }}>{n}</span>}
            </button>
          );
        })}
        {/* ₹100 OFF badge */}
        <button onClick={() => isComplete && !isRedeemed && onClickRedeem?.()}
          disabled={!isComplete || isRedeemed || busy}
          title={isRedeemed ? "Already redeemed" : isComplete ? "Click to redeem ₹100 OFF" : "Available after 5 stamps"}
          style={{
            width: 64, height: 64, borderRadius: "50%",
            background: isComplete && !isRedeemed
              ? "radial-gradient(circle at 30% 30%, #fff8e1, #d4af37 60%, #8a6c1d)"
              : isRedeemed
                ? "radial-gradient(circle at 30% 30%, #d1fae5, #10b981 70%)"
                : "rgba(212,175,55,0.18)",
            border: isComplete || isRedeemed ? "3px solid #d4af37" : "3px solid rgba(212,175,55,0.45)",
            cursor: isComplete && !isRedeemed && !busy ? "pointer" : "default",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            color: isComplete || isRedeemed ? "#3d2e0a" : "rgba(255,255,255,0.5)",
            transition: "all 0.15s",
            marginLeft: 6,
            boxShadow: isComplete || isRedeemed ? "0 0 22px rgba(212,175,55,0.5)" : "none",
            animation: isComplete && !isRedeemed ? "pulse 1.6s infinite" : "none",
          }}>
          <span style={{ fontSize: 14, fontWeight: 900, lineHeight: 1 }}>₹100</span>
          <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.08em", marginTop: 2 }}>OFF</span>
        </button>
      </div>

      <div style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 8 }}>
        {isRedeemed
          ? <>₹100 OFF redeemed{card.redeemed_invoice_no ? ` on invoice ${card.redeemed_invoice_no}` : ""} · {fmtDate(card.redeemed_at)}</>
          : isComplete
            ? <>All 5 stamps collected — click the ₹100 OFF badge to redeem.</>
            : <>{count} of 5 stamps · Complete all 5 to unlock ₹100 OFF</>}
      </div>

      <style>{`@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }`}</style>
    </div>
  );
}

/* ── Compact card chip for history (expandable) ── */
function MiniCard({ card, onDelete }) {
  const [open, setOpen] = useState(false);
  const stamps  = card.stamps || [];
  const filled  = new Set(stamps.map((s) => Number(s.stamp_no)));
  const totals  = card.totals || { revenue: 0, cost: 0, profit: 0 };
  const linked  = stamps.filter((s) => s.invoice_no).length;
  const hasData = totals.revenue > 0 || totals.cost > 0;

  // Redeemed invoice id (if backend resolved one)
  const redeemedInvoiceId = card.redeemed_invoice_id || null;

  return (
    <div style={{ borderBottom: "1px solid #f1f5f9" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 14px", background: open ? "#fafbfd" : "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ color: C.textSub, display: "inline-flex" }}>
            {open ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
          </span>
          <div style={{ fontWeight: 700, color: C.text, minWidth: 50, fontSize: 13 }}>#{card.card_number}</div>
          <div style={{ display: "flex", gap: 3 }}>
            {[1,2,3,4,5].map((n) => (
              <div key={n} style={{
                width: 16, height: 16, borderRadius: "50%",
                background: filled.has(n) ? "#d4af37" : "#e5e7eb",
                border: filled.has(n) ? "1.5px solid #b8941c" : "1.5px solid #d1d5db",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#3d2e0a",
              }}>{filled.has(n) && <FiCheck size={9} strokeWidth={3} />}</div>
            ))}
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
            background: card.status === "redeemed" ? "#dcfce7" : card.status === "completed" ? "#fef3c7" : "#e0e7ff",
            color:      card.status === "redeemed" ? "#166534" : card.status === "completed" ? "#92400e" : "#3730a3",
          }}>{card.status}</span>
          <div style={{ marginLeft: "auto", fontSize: 10, color: C.textSub, textAlign: "right" }}>
            <div>Issued {fmtDate(card.issued_at)}</div>
            {card.status === "redeemed" && <div>Redeemed {fmtDate(card.redeemed_at)}{card.redeemed_invoice_no ? ` · ${card.redeemed_invoice_no}` : ""}</div>}
          </div>
          {isAdmin && onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(card); }}
              title="Delete this card"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: C.red, padding: 6, borderRadius: 6, display: "inline-flex",
                marginLeft: 4,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.redLight)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <FiTrash2 size={14} />
            </button>
          )}
        </div>
        {/* Profit summary row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, paddingLeft: 78, fontSize: 11, color: C.textSub, flexWrap: "wrap" }}>
          {hasData ? (
            <>
              <span>Sale <b style={{ color: C.text }}>₹{fmt2(totals.revenue)}</b></span>
              <span>Cost <b style={{ color: C.text }}>₹{fmt2(totals.cost)}</b></span>
              <span>Profit <b style={{ color: totals.profit >= 0 ? C.green : C.red }}>₹{fmt2(totals.profit)}</b></span>
              {card.status === "redeemed" && (
                <span>Net (after ₹100 off) <b style={{ color: (totals.profit - 100) >= 0 ? C.green : C.red }}>₹{fmt2(totals.profit - 100)}</b></span>
              )}
              <span style={{ marginLeft: "auto" }}>{linked} of {stamps.length} stamps linked</span>
            </>
          ) : (
            <span>No invoice nos linked to stamps — profit unavailable</span>
          )}
        </div>
      </button>

      {/* Expanded: per-stamp breakdown with clickable invoice numbers */}
      {open && (
        <div style={{ padding: "8px 14px 14px 78px", background: "#fafbfd" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ color: C.textSub, fontWeight: 700 }}>
                <th style={{ textAlign: "left",  padding: "4px 8px 4px 0" }}>#</th>
                <th style={{ textAlign: "left",  padding: "4px 8px" }}>Invoice</th>
                <th style={{ textAlign: "right", padding: "4px 8px" }}>Total ₹</th>
                <th style={{ textAlign: "left",  padding: "4px 8px" }}>Date</th>
                <th style={{ textAlign: "left",  padding: "4px 8px" }}>Stamped by</th>
                <th style={{ textAlign: "left",  padding: "4px 8px" }}>Stamped at</th>
              </tr>
            </thead>
            <tbody>
              {stamps.map((s) => {
                const invId = s.resolved_invoice_id ? Number(s.resolved_invoice_id) : 0;
                return (
                  <tr key={s.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "6px 8px 6px 0", color: C.textSub, fontWeight: 700 }}>{s.stamp_no}</td>
                    <td style={{ padding: "6px 8px" }}>
                      {s.invoice_no ? (
                        invId > 0
                          ? <Link to={`/addsales?id=${invId}`} style={{ color: C.brand, fontWeight: 600, textDecoration: "none" }}>{s.invoice_no}</Link>
                          : <span style={{ color: C.textSub }} title="No matching invoice found">{s.invoice_no}</span>
                      ) : <span style={{ color: C.textLight }}>—</span>}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      {s.invoice_total ? `₹${fmt2(s.invoice_total)}` : "—"}
                    </td>
                    <td style={{ padding: "6px 8px", color: C.textSub }}>{s.invoice_date ? fmtDate(s.invoice_date) : "—"}</td>
                    <td style={{ padding: "6px 8px" }}>{s.stamped_by_name || "—"}</td>
                    <td style={{ padding: "6px 8px", color: C.textSub }}>{s.stamped_at ? fmtDate(s.stamped_at) : "—"}</td>
                  </tr>
                );
              })}
              {card.status === "redeemed" && card.redeemed_invoice_no && (
                <tr style={{ borderTop: "2px solid #e5e7eb", background: "#fefce8" }}>
                  <td style={{ padding: "6px 8px 6px 0", color: "#92400e", fontWeight: 800 }} title="₹100 OFF redemption">₹</td>
                  <td style={{ padding: "6px 8px" }}>
                    {redeemedInvoiceId > 0
                      ? <Link to={`/addsales?id=${redeemedInvoiceId}`} style={{ color: "#92400e", fontWeight: 600, textDecoration: "none" }}>{card.redeemed_invoice_no}</Link>
                      : <span style={{ color: "#92400e", fontWeight: 600 }}>{card.redeemed_invoice_no}</span>}
                    <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#92400e" }}>(₹100 OFF redeemed)</span>
                  </td>
                  <td colSpan={4} style={{ padding: "6px 8px", color: C.textSub }}>{fmtDate(card.redeemed_at)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Loyalty() {
  usePageMeta("Loyalty", "Track loyalty cards and stamps");
  const [sp, setSp] = useSearchParams();
  const initialPhone = sp.get("phone") || "";

  const [customers, setCustomers] = useState([]);
  const [loyaltyCustomers, setLoyaltyCustomers] = useState([]);
  const [loyaltyListLoading, setLoyaltyListLoading] = useState(false);
  const [q, setQ] = useState("");
  const [showSug, setShowSug] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);

  const [selPhone, setSelPhone] = useState(initialPhone);
  const [selName,  setSelName]  = useState("");
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [busy,     setBusy]     = useState(false);

  // Stamp modal
  const [stampNo, setStampNo]     = useState(0);
  const [stampInvNo, setStampInvNo] = useState(""); // chosen from the eligible list
  // Unsign modal
  const [unsignNo, setUnsignNo]     = useState(0);
  // Redeem modal
  const [showRedeem, setShowRedeem]       = useState(false);
  const [redeemInvNo, setRedeemInvNo]     = useState("");
  // New card confirm
  const [showNewCard, setShowNewCard]     = useState(false);
  // Digitize existing physical card
  const [showDigitize, setShowDigitize]   = useState(false);
  const [digitizeCount, setDigitizeCount] = useState(1);
  // Delete-card confirm
  const [deleteCard, setDeleteCard]       = useState(null);

  const searchRef = useRef(null);

  /* Load customers once (cheap autocomplete) */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/get_customers.php`);
        const j = await r.json();
        if (j.status === "success") setCustomers(j.data || []);
      } catch {}
    })();
  }, []);

  /* Load loyalty customers list whenever there's no current selection */
  const loadLoyaltyCustomers = async () => {
    try {
      setLoyaltyListLoading(true);
      const r = await fetch(`${API}/get_loyalty_customers.php`);
      const j = await r.json();
      if (j.status === "success") setLoyaltyCustomers(j.data || []);
    } catch {} finally { setLoyaltyListLoading(false); }
  };
  useEffect(() => { if (!selPhone) loadLoyaltyCustomers(); }, [selPhone]);

  /* If phone is set, load loyalty data */
  const loadLoyalty = async (phone) => {
    if (!phone) return;
    try {
      setLoading(true);
      const r = await fetch(`${API}/get_loyalty.php?phone=${encodeURIComponent(phone)}`);
      const j = await r.json();
      if (j.status === "success") setData(j);
    } catch (e) { toast(e.message || "Failed to load", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (selPhone) loadLoyalty(selPhone); }, [selPhone]);

  const sug = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return [];
    return customers.filter((c) =>
      String(c.name || "").toLowerCase().includes(qq) ||
      String(c.phone || "").includes(qq)
    ).slice(0, 8);
  }, [q, customers]);

  const pickCustomer = (c) => {
    setQ(`${c.name} · ${c.phone}`);
    setSelName(c.name || "");
    setSelPhone(c.phone || "");
    setShowSug(false);
    setHighlightIdx(-1);
    setSp({ phone: c.phone || "" });
  };

  const onKey = (e) => {
    if (!showSug || !sug.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIdx((p) => Math.min(p + 1, sug.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIdx((p) => Math.max(p - 1, 0)); }
    else if (e.key === "Enter" && highlightIdx >= 0) { e.preventDefault(); pickCustomer(sug[highlightIdx]); }
    else if (e.key === "Escape") setShowSug(false);
  };

  /* Issue new card (optionally pre-filled when digitizing an existing physical card) */
  const issueNewCard = async (preFilledStamps = 0) => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/add_loyalty_card.php`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: selPhone, customerName: selName, createdBy: user?.id || 0, preFilledStamps }),
      });
      const j = await r.json();
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Failed");
      toast(preFilledStamps > 0
        ? `Card #${j.card_number} digitized with ${preFilledStamps} stamp${preFilledStamps === 1 ? "" : "s"}`
        : `Card #${j.card_number} issued`, "success");
      setShowNewCard(false);
      setShowDigitize(false);
      setDigitizeCount(1);
      loadLoyalty(selPhone);
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  };

  /* Stamp */
  const confirmStamp = async () => {
    if (!data?.current) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/add_loyalty_stamp.php`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: data.current.id,
          stampedBy: user?.id || 0,
          invoiceNo: stampInvNo.trim() || "",
        }),
      });
      const j = await r.json();
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Failed");
      toast(`Stamp ${j.stampNo}/5 added${j.complete ? " — card complete!" : ""}`, "success");
      setStampNo(0);
      setStampInvNo("");
      loadLoyalty(selPhone);
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  };

  /* Redeem */
  const confirmRedeem = async () => {
    if (!data?.current) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/redeem_loyalty.php`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: data.current.id,
          updatedBy: user?.id || 0,
          invoiceNo: redeemInvNo.trim() || "",
        }),
      });
      const j = await r.json();
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Failed");
      toast("₹100 OFF redeemed", "success");
      setShowRedeem(false);
      setRedeemInvNo("");
      loadLoyalty(selPhone);
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  };

  /* Delete entire card (with confirmation modal) */
  const confirmDeleteCard = async () => {
    if (!deleteCard) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/delete_loyalty_card.php`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: deleteCard.id }),
      });
      const j = await r.json();
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Failed");
      toast(`Card #${deleteCard.card_number} deleted (${j.stampsRemoved} stamp${j.stampsRemoved === 1 ? "" : "s"})`, "success");
      setDeleteCard(null);
      loadLoyalty(selPhone);
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  };

  /* Remove stamps from N onwards (with confirmation modal) */
  const confirmUnsign = async () => {
    if (!data?.current || unsignNo <= 0) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/remove_loyalty_stamp.php`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: data.current.id, fromStampNo: unsignNo, updatedBy: user?.id || 0 }),
      });
      const j = await r.json();
      if (!r.ok || j.status !== "success") throw new Error(j.message || "Failed");
      toast(`Removed ${j.removedCount} stamp${j.removedCount === 1 ? "" : "s"}`, "success");
      setUnsignNo(0);
      loadLoyalty(selPhone);
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  };

  const current = data?.current;
  const history = (data?.cards || []).filter((c) => !current || c.id !== current.id);

  return (
    <div id="g-root" style={{ padding: "24px 28px", background: C.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>
      <style>{`#g-root .g-inp.with-icon { padding-left: 38px !important; }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
            <FiAward size={20} style={{ color: "#d4af37" }} /> Loyalty Cards
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textSub }}>
            5 stamps (₹200+ per stamp) earns ₹100 OFF on the next eligible bill.
          </p>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 18, maxWidth: 500 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <FiSearch size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textSub }} />
            <input
              ref={searchRef}
              className="g-inp with-icon"
              style={{ width: "100%" }}
              value={q}
              onChange={(e) => { setQ(e.target.value); setShowSug(true); setHighlightIdx(-1); }}
              onFocus={() => setShowSug(true)}
              onBlur={() => setTimeout(() => setShowSug(false), 200)}
              onKeyDown={onKey}
              placeholder="Search customer by name or phone…"
            />
          </div>
          <button className="g-btn ghost sm" onClick={() => selPhone && loadLoyalty(selPhone)} disabled={!selPhone || loading} title="Refresh">
            <FiRefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
          {selPhone && (
            <button className="g-btn ghost sm" title="Clear selection — back to customer list"
              onClick={() => {
                setSelPhone(""); setSelName(""); setQ(""); setData(null);
                setSp({});
              }}>
              <FiX size={14} /> Clear
            </button>
          )}
        </div>
        {showSug && sug.length > 0 && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10,
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)", zIndex: 30, maxHeight: 280, overflowY: "auto",
          }}>
            {sug.map((c, i) => (
              <button key={c.phone + i}
                onMouseDown={() => pickCustomer(c)}
                onMouseEnter={() => setHighlightIdx(i)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "10px 14px", border: "none",
                  background: highlightIdx === i ? "#f1f5f9" : "transparent",
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{c.name}</div>
                <div style={{ fontSize: 11, color: C.textSub }}>{c.phone}{c.invoice_count ? ` · ${c.invoice_count} bills` : ""}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {!selPhone && (
        <div className="g-card">
          <div style={{ padding: "12px 18px", borderBottom: "1.5px solid #e5e7eb", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FiAward size={14} style={{ color: "#d4af37" }} />
              <span style={{ fontWeight: 800, fontSize: 14, color: C.text }}>
                Customers with loyalty cards{loyaltyCustomers.length ? ` (${loyaltyCustomers.length})` : ""}
              </span>
            </div>
            <button className="g-btn ghost sm" onClick={loadLoyaltyCustomers} disabled={loyaltyListLoading} title="Refresh">
              <FiRefreshCw size={13} style={{ animation: loyaltyListLoading ? "spin 1s linear infinite" : "none" }} />
            </button>
          </div>
          {loyaltyListLoading && loyaltyCustomers.length === 0 ? (
            <div style={{ padding: 36, textAlign: "center", color: C.textSub, fontSize: 13 }}>Loading…</div>
          ) : loyaltyCustomers.length === 0 ? (
            <div style={{ padding: 36, textAlign: "center", color: C.textSub }}>
              <FiAward size={28} style={{ color: "#d4af37", marginBottom: 6 }} />
              <div style={{ fontSize: 14 }}>No customers have loyalty cards yet.</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Search a customer above and issue them a card.</div>
            </div>
          ) : (
            <div>
              {loyaltyCustomers.map((c) => {
                const stamps = Number(c.active_stamps || 0);
                const isComplete = c.active_status === "completed";
                const noActive   = c.active_card_id == null;
                return (
                  <button key={c.phone}
                    onClick={() => {
                      setSelName(c.customer_name || "");
                      setSelPhone(c.phone);
                      setQ(`${c.customer_name || ""} · ${c.phone}`);
                      setSp({ phone: c.phone });
                    }}
                    style={{
                      display: "flex", width: "100%", alignItems: "center", gap: 14,
                      padding: "12px 18px", border: "none", borderBottom: "1px solid #f1f5f9",
                      background: "transparent", cursor: "pointer", fontFamily: "inherit",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#fafbfd")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.customer_name || "—"}</div>
                      <div style={{ fontSize: 11, color: C.textSub }}>{c.phone}</div>
                    </div>
                    {/* Cards taken */}
                    <div style={{ textAlign: "center", minWidth: 80 }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: C.brand, lineHeight: 1 }}>{c.cards_taken}</div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: C.textSub, textTransform: "uppercase", marginTop: 3 }}>cards taken</div>
                    </div>
                    {/* Active card mini view */}
                    <div style={{ minWidth: 200, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                      {noActive ? (
                        <span style={{ fontSize: 11, color: C.textSub }}>No active card</span>
                      ) : (
                        <>
                          <div style={{ display: "flex", gap: 4 }}>
                            {[1,2,3,4,5].map((n) => {
                              const filled = n <= stamps;
                              return (
                                <div key={n} style={{
                                  width: 16, height: 16, borderRadius: "50%",
                                  background: filled ? "#d4af37" : "#e5e7eb",
                                  border: filled ? "1.5px solid #b8941c" : "1.5px solid #d1d5db",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  color: "#3d2e0a",
                                }}>{filled && <FiCheck size={9} strokeWidth={3} />}</div>
                              );
                            })}
                          </div>
                          <div style={{ fontSize: 10, color: C.textSub }}>
                            Card #{c.active_card_number} · {stamps}/5 {isComplete && <span style={{ color: "#92400e", fontWeight: 800 }}>· ready for ₹100 OFF</span>}
                          </div>
                        </>
                      )}
                    </div>
                    <FiChevronRight size={16} style={{ color: C.textLight }} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selPhone && loading && !data && (
        <div className="g-card" style={{ padding: 36, textAlign: "center", color: C.textSub }}>Loading…</div>
      )}

      {selPhone && data && (
        <>
          {/* Stats strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 18 }}>
            <div className="g-card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>Customer</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginTop: 2 }}>{selName || "—"}</div>
              <div style={{ fontSize: 12, color: C.textSub }}>{selPhone}</div>
            </div>
            <div className="g-card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>Cards Taken</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.brand, marginTop: 2 }}>{data.cards_taken}</div>
            </div>
            <div className="g-card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>This Card</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#d4af37", marginTop: 2 }}>{(current?.stamps?.length || 0)}/5</div>
            </div>
            <div className="g-card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>Total Earned by Customer</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: (data.total_earned ?? 0) >= 0 ? C.green : C.red, marginTop: 2 }}>₹{fmt2(data.total_earned ?? 0)}</div>
              <div style={{ fontSize: 10, color: C.textSub }}>Profit across linked invoices</div>
            </div>
            <div className="g-card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>Total Saved by Customer</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.orange, marginTop: 2 }}>₹{fmt2(data.total_saved)}</div>
              <div style={{ fontSize: 10, color: C.textSub }}>₹100 × redeemed cards</div>
            </div>
            <div className="g-card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>Net Earned by Customer</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: (data.total_net ?? 0) >= 0 ? C.green : C.red, marginTop: 2 }}>₹{fmt2(data.total_net ?? 0)}</div>
              <div style={{ fontSize: 10, color: C.textSub }}>Earned − Saved</div>
            </div>
          </div>

          {/* Two-column layout: history left, current card right */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
            {/* LEFT — History */}
            <div>
              {history.length > 0 ? (
                <div className="g-card">
                  <div style={{ padding: "12px 18px", borderBottom: "1.5px solid #e5e7eb", background: "#f8fafc", display: "flex", alignItems: "center", gap: 8 }}>
                    <FiClock size={14} style={{ color: C.textSub }} />
                    <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>History ({history.length})</span>
                  </div>
                  <div>
                    {history.map((c) => <MiniCard key={c.id} card={c} onDelete={setDeleteCard} />)}
                  </div>
                </div>
              ) : (
                <div className="g-card" style={{ padding: 28, textAlign: "center", color: C.textSub, fontSize: 13 }}>
                  <FiClock size={22} style={{ color: C.textLight, marginBottom: 6 }} />
                  <div>No previous cards for this customer yet.</div>
                </div>
              )}
            </div>

            {/* RIGHT — Current / new card */}
            <div>
              {current ? (
                <LoyaltyCardVisual
                  card={current}
                  busy={busy}
                  onClickCircle={(n) => setStampNo(n)}
                  onClickFilled={(n) => setUnsignNo(n)}
                  onClickRedeem={() => setShowRedeem(true)}
                />
              ) : (
                <div className="g-card" style={{ padding: 32, textAlign: "center" }}>
                  <FiAward size={28} style={{ color: "#d4af37", marginBottom: 6 }} />
                  <div style={{ fontSize: 14, color: C.textSub, marginBottom: 14 }}>No active card. Issue a fresh one or digitize a physical card already given to the customer.</div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    <button className="g-btn primary" onClick={() => setShowNewCard(true)}>
                      <FiPlus size={14} /> Issue new card
                    </button>
                    <button className="g-btn ghost" onClick={() => { setDigitizeCount(1); setShowDigitize(true); }}>
                      Digitize existing card
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Confirm-stamp modal — pick an invoice from today's eligible bills */}
      <Modal show={stampNo > 0} title={`Add stamp #${stampNo}`} onClose={() => { setStampNo(0); setStampInvNo(""); }} width={460}
        footer={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="g-btn ghost" onClick={() => { setStampNo(0); setStampInvNo(""); }} disabled={busy}>Cancel</button>
            <button className="g-btn primary" onClick={confirmStamp} disabled={busy || !stampInvNo}>
              <FiCheck size={13} /> Stamp on #{stampInvNo || "—"}
            </button>
          </div>
        }>
        <div style={{ padding: "10px 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "10px 12px", background: "#fefce8", borderRadius: 8, border: "1px solid #fde68a" }}>
            <FiAlertCircle size={18} style={{ color: "#92400e" }} />
            <span style={{ fontSize: 12, color: "#78350f" }}>Pick today's bill (₹200+) to attach the stamp. Already-stamped bills and the last redemption are hidden.</span>
          </div>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>Eligible invoices today</label>
          <div style={{ marginTop: 8, maxHeight: 320, overflowY: "auto", border: "1.5px solid #e5e7eb", borderRadius: 8 }}>
            {(data?.eligible_invoices || []).length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: C.textSub, fontSize: 13 }}>
                No eligible invoices today.<br />
                <span style={{ fontSize: 11 }}>Need a bill ≥ ₹200 from today that hasn't been used.</span>
              </div>
            ) : (
              (data?.eligible_invoices || []).map((inv) => {
                const selected = stampInvNo === inv.invoice_no;
                return (
                  <button key={inv.id}
                    onClick={() => setStampInvNo(inv.invoice_no)}
                    style={{
                      display: "flex", width: "100%", alignItems: "center", gap: 10,
                      padding: "10px 14px", border: "none",
                      borderBottom: "1px solid #f1f5f9",
                      background: selected ? C.brandLighter : "transparent",
                      cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%",
                      border: `2px solid ${selected ? C.brand : "#cbd5e1"}`,
                      background: selected ? C.brand : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {selected && <FiCheck size={10} color="#fff" strokeWidth={3} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>#{inv.invoice_no}</div>
                      <div style={{ fontSize: 11, color: C.textSub }}>{inv.created_at ? new Date(inv.created_at.replace(" ", "T")).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: C.green, fontSize: 14 }}>₹{fmt2(inv.total)}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {/* Confirm-delete-card modal */}
      <Modal show={!!deleteCard} title={`Delete card #${deleteCard?.card_number || ""}?`} onClose={() => setDeleteCard(null)} width={460}
        footer={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="g-btn ghost" onClick={() => setDeleteCard(null)} disabled={busy}>Cancel</button>
            <button className="g-btn" style={{ background: C.red, color: "#fff", border: "1.5px solid " + C.red }} onClick={confirmDeleteCard} disabled={busy} autoFocus>
              <FiTrash2 size={13} /> Delete card
            </button>
          </div>
        }>
        <div style={{ padding: "10px 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "10px 12px", background: "#fef2f2", borderRadius: 8, border: "1px solid #fecaca" }}>
            <FiAlertCircle size={18} style={{ color: C.red }} />
            <span style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.5 }}>
              {deleteCard
                ? <>
                    Card <b>#{deleteCard.card_number}</b> with <b>{deleteCard.stamps?.length || 0} stamp{(deleteCard.stamps?.length || 0) === 1 ? "" : "s"}</b> will be permanently deleted.
                    {deleteCard.status === "redeemed" && <> The ₹100 redemption record will also be removed.</>}
                    <br />This can't be undone.
                  </>
                : ""}
            </span>
          </div>
        </div>
      </Modal>

      {/* Confirm-unsign modal */}
      {(() => {
        const stampsCnt = data?.current?.stamps?.length || 0;
        const cascade   = unsignNo > 0 ? stampsCnt - unsignNo + 1 : 0;
        return (
          <Modal show={unsignNo > 0} title="Remove stamp?" onClose={() => setUnsignNo(0)} width={440}
            footer={
              <div style={{ display: "flex", gap: 8 }}>
                <button className="g-btn ghost" onClick={() => setUnsignNo(0)} disabled={busy}>Cancel</button>
                <button className="g-btn" style={{ background: C.red, color: "#fff", border: "1.5px solid " + C.red }} onClick={confirmUnsign} disabled={busy} autoFocus>
                  <FiCornerUpLeft size={13} /> {cascade > 1 ? `Remove ${cascade} stamps` : "Remove"}
                </button>
              </div>
            }>
            <div style={{ padding: "10px 4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "10px 12px", background: "#fef2f2", borderRadius: 8, border: "1px solid #fecaca" }}>
                <FiAlertCircle size={18} style={{ color: C.red }} />
                <span style={{ fontSize: 13, color: "#7f1d1d" }}>
                  {cascade > 1
                    ? <>Stamp #{unsignNo} and every stamp after it will be removed (<b>{cascade} stamps total</b>). Stamps are sequential, so the later ones can't stay without #{unsignNo}.</>
                    : <>Remove stamp #{unsignNo}? This can't be undone.</>}
                </span>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Confirm-redeem modal */}
      <Modal show={showRedeem} title="Redeem ₹100 OFF" onClose={() => setShowRedeem(false)} width={420}
        footer={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="g-btn ghost" onClick={() => setShowRedeem(false)} disabled={busy}>Cancel</button>
            <button className="g-btn primary" onClick={confirmRedeem} disabled={busy} autoFocus>
              <FiCheck size={13} /> Redeem
            </button>
          </div>
        }>
        <div style={{ padding: "10px 4px" }}>
          <div style={{ marginBottom: 12, fontSize: 13, color: C.text }}>
            This will close the card and record the ₹100 discount. Make sure the discount was applied on the bill before confirming.
          </div>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.textSub, textTransform: "uppercase" }}>Invoice no (optional)</label>
          <input className="g-inp" style={{ marginTop: 6, width: "100%" }} value={redeemInvNo} onChange={(e) => setRedeemInvNo(e.target.value)} placeholder="e.g. 8810" autoFocus />
        </div>
      </Modal>

      {/* Issue new card confirm */}
      <Modal show={showNewCard} title="Issue new loyalty card" onClose={() => setShowNewCard(false)} width={420}
        footer={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="g-btn ghost" onClick={() => setShowNewCard(false)} disabled={busy}>Cancel</button>
            <button className="g-btn primary" onClick={() => issueNewCard(0)} disabled={busy} autoFocus>
              <FiPlus size={13} /> Issue
            </button>
          </div>
        }>
        <div style={{ padding: "10px 4px", fontSize: 13, color: C.text }}>
          Issue a new card for <b>{selName || selPhone}</b>?
          {data && data.cards_taken > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: C.textSub }}>
              This will be card #{data.cards_taken + 1} for this customer.
            </div>
          )}
        </div>
      </Modal>

      {/* Digitize existing physical card */}
      <Modal show={showDigitize} title="Digitize existing card" onClose={() => setShowDigitize(false)} width={460}
        footer={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="g-btn ghost" onClick={() => setShowDigitize(false)} disabled={busy}>Cancel</button>
            <button className="g-btn primary" onClick={() => issueNewCard(digitizeCount)} disabled={busy} autoFocus>
              <FiPlus size={13} /> Digitize with {digitizeCount} stamp{digitizeCount === 1 ? "" : "s"}
            </button>
          </div>
        }>
        <div style={{ padding: "10px 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "10px 12px", background: "#fefce8", borderRadius: 8, border: "1px solid #fde68a" }}>
            <FiAlertCircle size={18} style={{ color: "#92400e" }} />
            <span style={{ fontSize: 12, color: "#78350f", lineHeight: 1.5 }}>
              One-time digitization for customers who already have a physical card with stamps. Pre-filled stamps have <b>no invoice attached</b> — only use this for genuine prior stamps.
            </span>
          </div>
          <div style={{ fontSize: 13, color: C.text, marginBottom: 12 }}>
            For <b>{selName || selPhone}</b> — how many stamps were already on the physical card?
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {[1,2,3,4,5].map((n) => (
              <button key={n}
                onClick={() => setDigitizeCount(n)}
                style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: digitizeCount === n
                    ? "radial-gradient(circle at 30% 30%, #fff8e1, #d4af37 70%, #8a6c1d)"
                    : "#f4f4f4",
                  border: digitizeCount === n ? "3px solid #d4af37" : "2px solid #cbd5e1",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#3d2e0a", fontWeight: 800, fontSize: 18, fontFamily: "inherit",
                }}>
                {n}
              </button>
            ))}
          </div>
          {digitizeCount === 5 && (
            <div style={{ marginTop: 14, padding: "10px 12px", background: "#fff7ed", borderRadius: 8, border: "1px solid #fdba74", fontSize: 12, color: "#7c2d12" }}>
              All 5 stamps preselected — the card will start as <b>completed</b> and immediately be eligible for ₹100 OFF redemption.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
