/* ─── Session lifetime ───
   A login is good for the trading day it was made on and lapses at midnight.
   The shop shuts at 11pm, so nobody is ever cut off mid-bill; the point is that
   the first person to open the till the next morning has to sign in rather than
   inherit whoever was on the counter last night. Attendance and the login log
   then line up with who actually worked the day.

   The whole auth story is client-side (`localStorage.auth`), so this is too. */

import { API } from "./ui.jsx";

const DATE_KEY = "authDate";

/* Local date, not UTC — "after 12am" means midnight in Kolkata, and a UTC day
   boundary would fall at 5:30am, in the middle of the morning shift. */
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* Called on a successful login. */
export function stampSession() {
  try { localStorage.setItem(DATE_KEY, todayKey()); } catch { /* storage blocked */ }
}

export function sessionExpired() {
  if (!localStorage.getItem("auth")) return false;   // nobody logged in; nothing to expire
  const stamped = localStorage.getItem(DATE_KEY);
  // Sessions opened before this rule existed have no stamp. Adopting them into
  // today rather than expiring them means deploying at 3pm doesn't throw the
  // counter out mid-sale — they lapse at the coming midnight like everyone else.
  if (!stamped) { stampSession(); return false; }
  return stamped !== todayKey();
}

/* Mirrors the header's Logout button so the login log shows the session ended,
   rather than leaving it open for ever. */
export function endSession() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    const payload = JSON.stringify({ userId: user?.id || 0, userName: user?.name || "" });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${API}/log_logout.php`, new Blob([payload], { type: "application/json" }));
    } else {
      fetch(`${API}/log_logout.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true });
    }
  } catch { /* the logout still has to happen */ }
  localStorage.removeItem("user");
  localStorage.removeItem("auth");
  localStorage.removeItem(DATE_KEY);
}

/* Route guards call this; it returns true when it has just signed the user out
   and the caller should send them to /login. */
export function expireIfStale() {
  if (!sessionExpired()) return false;
  endSession();
  return true;
}

/* A till left open overnight has no page load to check on, so poll as well.
   visibilitychange catches a machine waking from sleep straight away. */
export function startSessionWatch() {
  const check = () => {
    if (expireIfStale()) window.location.href = "/login";
  };
  setInterval(check, 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  window.addEventListener("focus", check);
}
