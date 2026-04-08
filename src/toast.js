/* Lightweight toast notifications — replaces window.alert() */

let container = null;

function ensureContainer() {
  if (container && document.body.contains(container)) return container;
  container = document.createElement("div");
  container.id = "g-toast-container";
  Object.assign(container.style, {
    position: "fixed", top: "20px", right: "20px", zIndex: "99999",
    display: "flex", flexDirection: "column", gap: "8px", pointerEvents: "none",
    maxWidth: "420px",
  });
  document.body.appendChild(container);
  return container;
}

const COLORS = {
  error:   { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", icon: "\u2716" },
  success: { bg: "#f0fdf4", border: "#86efac", text: "#166534", icon: "\u2714" },
  warn:    { bg: "#fffbeb", border: "#fde68a", text: "#92400e", icon: "\u26A0" },
  info:    { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af", icon: "\u2139" },
};

export default function toast(message, type = "info") {
  const c = ensureContainer();
  const s = COLORS[type] || COLORS.info;

  const el = document.createElement("div");
  Object.assign(el.style, {
    background: s.bg, border: `1.5px solid ${s.border}`, color: s.text,
    padding: "12px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: "600",
    boxShadow: "0 4px 16px rgba(0,0,0,0.10)", pointerEvents: "auto",
    display: "flex", alignItems: "flex-start", gap: "8px",
    animation: "g-toast-in 0.25s ease-out", cursor: "pointer",
    maxWidth: "100%", wordBreak: "break-word", lineHeight: "1.5",
  });
  el.innerHTML = `<span style="flex-shrink:0;font-size:15px">${s.icon}</span><span>${message}</span>`;
  el.onclick = () => dismiss(el);

  c.appendChild(el);

  const duration = type === "error" || message.length > 80 ? 5000 : 3000;
  setTimeout(() => dismiss(el), duration);
}

toast.error   = (msg) => toast(msg, "error");
toast.success = (msg) => toast(msg, "success");
toast.warn    = (msg) => toast(msg, "warn");
toast.info    = (msg) => toast(msg, "info");

function dismiss(el) {
  if (!el.parentNode) return;
  el.style.animation = "g-toast-out 0.2s ease-in forwards";
  setTimeout(() => el.remove(), 200);
}

/* inject keyframes once */
if (typeof document !== "undefined" && !document.getElementById("g-toast-css")) {
  const style = document.createElement("style");
  style.id = "g-toast-css";
  style.textContent = `
    @keyframes g-toast-in  { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:translateX(0); } }
    @keyframes g-toast-out { to { opacity:0; transform:translateX(40px); } }
  `;
  document.head.appendChild(style);
}
