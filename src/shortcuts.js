// ─── Global Keyboard Shortcuts ───

/* The walk-in customer. A bill needs a name and a 10-digit phone, and most
   counter sales have neither, so these stand in for them. */
export const WALK_IN = { name: "Unknown", phone: "9675474716" };

export const SHORTCUTS = [
  { key: "ctrl+s",       display: "Ctrl + S",   label: "Save invoice / purchase bill",  action: "save" },
  { key: "f9",           display: "F9",         label: `Save sale as ${WALK_IN.name} (${WALK_IN.phone})`, action: "quick-save" },
  { key: "ctrl+p",       display: "Ctrl + P",   label: "New Purchase Bill",             action: "navigate", path: "/addpurchase" },
  // Opens in its own tab so a half-finished bill on screen is not thrown away.
  { key: "ctrl+shift+s", display: "Ctrl + Shift + S", label: "New Sale Invoice (new tab)", action: "navigate", path: "/addsales", newTab: true },
  { key: "ctrl+shift+p", display: "Ctrl + Shift + P", label: "Purchase Bills List",     action: "navigate", path: "/purchase" },
  { key: "ctrl+shift+l", display: "Ctrl + Shift + L", label: "Sales List",              action: "navigate", path: "/sales" },
  { key: "ctrl+i",       display: "Ctrl + I",   label: "Inventory",                     action: "navigate", path: "/inventory" },
  { key: "ctrl+d",       display: "Ctrl + D",   label: "Dashboard",                     action: "navigate", path: "/" },
  { key: "ctrl+r",       display: "Ctrl + R",   label: "Reports",                       action: "navigate", path: "/reports" },
  { key: "ctrl+/",       display: "Ctrl + /",   label: "Show Shortcuts",                action: "shortcuts" },
];

export function matchShortcut(e) {
  const key = [
    e.ctrlKey || e.metaKey ? "ctrl" : "",
    e.shiftKey ? "shift" : "",
    e.altKey ? "alt" : "",
    e.key.toLowerCase(),
  ].filter(Boolean).join("+");

  return SHORTCUTS.find((s) => s.key === key) || null;
}
