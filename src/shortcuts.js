// ─── Global Keyboard Shortcuts ───

export const SHORTCUTS = [
  { key: "ctrl+s",       display: "Ctrl + S",   label: "Save invoice / purchase bill",  action: "save" },
  { key: "ctrl+p",       display: "Ctrl + P",   label: "New Purchase Bill",             action: "navigate", path: "/addpurchase" },
  { key: "ctrl+shift+s", display: "Ctrl + Shift + S", label: "New Sale Invoice",        action: "navigate", path: "/addsales" },
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
