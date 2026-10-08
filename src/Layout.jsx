import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Header from "./comps/Header.jsx";
import { matchShortcut } from "./shortcuts.js";

export default function Layout() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => {
      const sc = matchShortcut(e);
      if (!sc) return;

      // Don't intercept when typing in inputs — except the two save shortcuts,
      // which are pressed with the cursor still in the item or qty box.
      const tag = (e.target.tagName || "").toLowerCase();
      const isInput = tag === "input" || tag === "textarea" || tag === "select";
      const isSave = sc.action === "save" || sc.action === "quick-save";
      if (isInput && !isSave) return;

      e.preventDefault();
      e.stopPropagation();

      if (sc.action === "navigate") {
        navigate(sc.path);
      } else if (sc.action === "save") {
        // Dispatch custom event — AddSales / AddPurchase listen for this
        window.dispatchEvent(new CustomEvent("shortcut-save"));
      } else if (sc.action === "quick-save") {
        window.dispatchEvent(new CustomEvent("shortcut-quick-save"));
      } else if (sc.action === "shortcuts") {
        window.dispatchEvent(new CustomEvent("open-shortcuts"));
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  return (
    <div style={{ flex: 1 }}>
      <Header />
      <Outlet />
    </div>
  );
}
