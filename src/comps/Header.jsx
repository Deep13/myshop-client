import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { RiShutDownLine } from "react-icons/ri";
import { FiHome, FiShoppingCart, FiTruck, FiPackage, FiMoreHorizontal, FiUsers, FiBarChart2, FiCommand } from "react-icons/fi";
import { C, Modal, GLOBAL_CSS } from "../ui.jsx";
import { SHORTCUTS } from "../shortcuts.js";

const LINKS = [
  { to: "/",          label: "Home",      icon: <FiHome size={15} /> },
  { to: "/sales",     label: "Sales",     icon: <FiShoppingCart size={15} /> },
  { to: "/purchase",  label: "Purchase",  icon: <FiTruck size={15} /> },
  { to: "/inventory", label: "Inventory", icon: <FiPackage size={15} /> },
];

const MORE_ITEMS = [
  { to: "/customers",    label: "Customers",    icon: <FiUsers size={14} /> },
  { to: "/distributors", label: "Distributors",  icon: <FiTruck size={14} /> },
  { to: "/reports",      label: "Reports",       icon: <FiBarChart2 size={14} /> },
  { key: "shortcuts",    label: "Shortcuts",     icon: <FiCommand size={14} /> },
];

export default function Header() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const moreRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!moreOpen) return;
    const fn = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [moreOpen]);

  // Listen for custom event to open shortcuts modal (from keyboard shortcut)
  useEffect(() => {
    const fn = () => setShowShortcuts(true);
    window.addEventListener("open-shortcuts", fn);
    return () => window.removeEventListener("open-shortcuts", fn);
  }, []);

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("auth");
    window.location.href = "/login";
  };

  const moreActive = ["/customers", "/distributors", "/reports"].some((p) => pathname.startsWith(p));

  return (
    <>
      <header style={{ background: "#034C9D", padding: "0 22px", display: "flex", justifyContent: "space-between", alignItems: "center", height: 52, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 8px rgba(3,76,157,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <FiPackage size={20} color="#fff" style={{ marginRight: 6 }} />
          <span style={{ color: "#fff", fontWeight: 900, fontSize: 16, letterSpacing: "-0.02em", fontFamily: "'Noto Sans', sans-serif" }}>Ganga Instamart</span>
        </div>
        <nav style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {LINKS.map(({ to, label, icon }) => {
            const active = pathname === to || (to !== "/" && pathname.startsWith(to));
            return (
              <Link key={to} to={to} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 8, textDecoration: "none",
                fontSize: 14, fontWeight: active ? 700 : 500,
                color: active ? "#fff" : "rgba(255,255,255,0.75)",
                background: active ? "rgba(255,255,255,0.18)" : "transparent",
                transition: "all 0.15s",
                fontFamily: "'Noto Sans', sans-serif",
              }}>
                {icon}{label}
              </Link>
            );
          })}

          {/* More dropdown */}
          <div ref={moreRef} style={{ position: "relative" }}>
            <button onClick={() => setMoreOpen((p) => !p)} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: moreActive ? 700 : 500,
              color: moreActive ? "#fff" : "rgba(255,255,255,0.75)",
              background: moreActive || moreOpen ? "rgba(255,255,255,0.18)" : "transparent",
              transition: "all 0.15s",
              fontFamily: "'Noto Sans', sans-serif",
            }}>
              <FiMoreHorizontal size={15} /> More
            </button>
            {moreOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0,
                background: "#fff", borderRadius: 10, boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
                border: "1.5px solid #e5e7eb", minWidth: 190, padding: "6px 0", zIndex: 200,
              }}>
                {MORE_ITEMS.map((item) => {
                  const isLink = !!item.to;
                  const active = isLink && pathname.startsWith(item.to);
                  return (
                    <button key={item.label} onClick={() => {
                      setMoreOpen(false);
                      if (item.key === "shortcuts") setShowShortcuts(true);
                      else if (item.to) navigate(item.to);
                    }} style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%",
                      padding: "9px 16px", border: "none", cursor: "pointer",
                      background: active ? C.brandLighter : "transparent",
                      color: active ? C.brand : C.text,
                      fontSize: 14, fontWeight: active ? 700 : 500,
                      fontFamily: "'Noto Sans', sans-serif", textAlign: "left",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                      <span style={{ color: active ? C.brand : C.textSub }}>{item.icon}</span>
                      {item.label}
                      {item.key === "shortcuts" && (
                        <span style={{ marginLeft: "auto", fontSize: 11, color: C.textLight, fontFamily: "monospace" }}>Ctrl+/</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>
        <button onClick={logout} title="Logout"
          style={{ background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", color: "#fff", width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.25)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}>
          <RiShutDownLine size={18} />
        </button>
      </header>

      {/* Shortcuts Modal */}
      <Modal show={showShortcuts} title="Keyboard Shortcuts" onClose={() => setShowShortcuts(false)} width={480}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {SHORTCUTS.map((s) => (
            <div key={s.key} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 4px", borderBottom: "1px solid #f3f4f6",
            }}>
              <span style={{ fontSize: 14, color: C.text }}>{s.label}</span>
              <kbd style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "3px 10px", borderRadius: 6,
                background: "#f1f5f9", border: "1.5px solid #d1d5db",
                fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: C.textSub,
              }}>{s.display}</kbd>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
