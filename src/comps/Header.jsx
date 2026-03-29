import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { RiShutDownLine } from "react-icons/ri";
import { FiHome, FiShoppingCart, FiTruck, FiPackage, FiMoreHorizontal, FiUsers, FiBarChart2, FiCommand, FiSettings } from "react-icons/fi";
import { C, Modal, GLOBAL_CSS } from "../ui.jsx";
import { SHORTCUTS } from "../shortcuts.js";

const LINKS = [
  { to: "/",          label: "Home",      icon: <FiHome size={16} /> },
  { to: "/sales",     label: "Sales",     icon: <FiShoppingCart size={16} /> },
  { to: "/purchase",  label: "Purchase",  icon: <FiTruck size={16} /> },
  { to: "/inventory", label: "Inventory", icon: <FiPackage size={16} /> },
];

const MORE_ITEMS = [
  { to: "/customers",    label: "Customers",    icon: <FiUsers size={15} /> },
  { to: "/distributors", label: "Distributors",  icon: <FiTruck size={15} /> },
  { to: "/reports",      label: "Reports",       icon: <FiBarChart2 size={15} /> },
  { to: "/settings",     label: "Settings",       icon: <FiSettings size={15} /> },
  { key: "shortcuts",    label: "Shortcuts",     icon: <FiCommand size={15} /> },
];

export default function Header() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    if (!moreOpen) return;
    const fn = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [moreOpen]);

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

  const moreActive = ["/customers", "/distributors", "/reports", "/settings"].some((p) => pathname.startsWith(p));

  return (
    <>
      <header style={{
        background: "linear-gradient(135deg, #034C9D 0%, #0369a1 100%)",
        padding: "0 28px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        height: 60, position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 1px 0 rgba(255,255,255,0.1) inset, 0 4px 12px rgba(3,76,157,0.3)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "rgba(255,255,255,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(8px)",
          }}>
            <FiPackage size={18} color="#fff" />
          </div>
          <span style={{
            color: "#fff", fontWeight: 800, fontSize: 17,
            letterSpacing: "-0.02em",
          }}>
            Ganga Instamart
          </span>
        </div>

        {/* Navigation */}
        <nav style={{ display: "flex", gap: 2, alignItems: "center" }}>
          {LINKS.map(({ to, label, icon }) => {
            const active = pathname === to || (to !== "/" && pathname.startsWith(to));
            return (
              <Link key={to} to={to} style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "8px 18px", borderRadius: 9, textDecoration: "none",
                fontSize: 14, fontWeight: active ? 700 : 500,
                color: active ? "#fff" : "rgba(255,255,255,0.72)",
                background: active ? "rgba(255,255,255,0.15)" : "transparent",
                transition: "all 0.15s",
                backdropFilter: active ? "blur(4px)" : "none",
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                {icon}{label}
              </Link>
            );
          })}

          {/* More dropdown */}
          <div ref={moreRef} style={{ position: "relative" }}>
            <button onClick={() => setMoreOpen((p) => !p)} style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: moreActive ? 700 : 500,
              color: moreActive ? "#fff" : "rgba(255,255,255,0.72)",
              background: moreActive || moreOpen ? "rgba(255,255,255,0.15)" : "transparent",
              transition: "all 0.15s",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => { if (!moreActive && !moreOpen) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={(e) => { if (!moreActive && !moreOpen) e.currentTarget.style.background = "transparent"; }}>
              <FiMoreHorizontal size={16} /> More
            </button>
            {moreOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0,
                background: "#fff", borderRadius: 12,
                boxShadow: "0 12px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)",
                minWidth: 220, padding: "6px 0", zIndex: 200,
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
                      display: "flex", alignItems: "center", gap: 11, width: "100%",
                      padding: "11px 18px", border: "none", cursor: "pointer",
                      background: active ? C.brandLighter : "transparent",
                      color: active ? C.brand : C.text,
                      fontSize: 14, fontWeight: active ? 700 : 500,
                      fontFamily: "inherit", textAlign: "left",
                      transition: "background 0.1s",
                      borderLeft: active ? `3px solid ${C.brand}` : "3px solid transparent",
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                      <span style={{ color: active ? C.brand : C.textSub, display: "flex" }}>{item.icon}</span>
                      {item.label}
                      {item.key === "shortcuts" && (
                        <span style={{ marginLeft: "auto", fontSize: 11, color: C.textLight, fontFamily: "monospace", background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>Ctrl+/</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* New Sale quick button */}
          <button onClick={() => navigate("/addsales")} title="New Sale (Ctrl+Shift+S)"
            style={{
              background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)",
              cursor: "pointer", color: "#fff", height: 34, padding: "0 14px",
              borderRadius: 8, display: "flex", alignItems: "center", gap: 6,
              fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.25)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}>
            <FiShoppingCart size={14} /> + Sale
          </button>

          {/* Logout */}
          <button onClick={logout} title="Logout"
          style={{
            background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.8)", width: 38, height: 38, borderRadius: 9,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; }}>
          <RiShutDownLine size={17} />
        </button>
        </div>
      </header>

      {/* Shortcuts Modal */}
      <Modal show={showShortcuts} title="Keyboard Shortcuts" onClose={() => setShowShortcuts(false)} width={480}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {SHORTCUTS.map((s) => (
            <div key={s.key} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 6px", borderBottom: "1px solid #f1f5f9",
            }}>
              <span style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{s.label}</span>
              <kbd style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 10px", borderRadius: 7,
                background: "#f1f5f9", border: "1px solid #e2e8f0",
                fontSize: 12, fontWeight: 600, fontFamily: "monospace", color: C.textSub,
              }}>{s.display}</kbd>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
