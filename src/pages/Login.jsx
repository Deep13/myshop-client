import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { FiPackage, FiUser, FiLock, FiEye, FiEyeOff, FiLogIn } from "react-icons/fi";
import storeImg from "../assets/store.png";

const C = {
  brand: "#034C9D",
  brandLight: "#e0ecfa",
  text: "#1e293b",
  textSub: "#64748b",
  border: "#e2e8f0",
  bg: "#f1f5f9",
  red: "#ef4444",
};

export default function Login() {
  const navigate = useNavigate();
  const isLoggedIn = localStorage.getItem("auth");
  const userRef = useRef(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [responseMsg, setResponseMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

  useEffect(() => {
    if (isLoggedIn) {
      navigate(isMobile ? "/m/sale" : "/");
    }
    userRef.current?.focus();
  }, []);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!name.trim() || !password.trim()) {
      setResponseMsg("Please enter username and password");
      return;
    }
    try {
      setLoading(true);
      setResponseMsg("");
      const res = await fetch("http://localhost/myshop-backend/login.php", {
        method: "POST",
        body: JSON.stringify({ name, password }),
      });
      const data = await res.json();
      if (data.status === "success") {
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("auth", "true");
        window.location.href = isMobile ? "/m/sale" : "/";
      } else {
        setResponseMsg(data.message || "Invalid credentials");
      }
    } catch {
      setResponseMsg("Server not responding. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans', 'Inter', system-ui, sans-serif" }}>
      {/* Left side — image */}
      <div style={{
        flex: 1,
        backgroundImage: `url(${storeImg})`,
        backgroundPosition: "center",
        backgroundSize: "cover",
        position: "relative",
        display: isMobile ? "none" : "block",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(135deg, rgba(3,76,157,0.85) 0%, rgba(3,76,157,0.55) 100%)",
          display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "60px 50px",
        }}>
          <h1 style={{ color: "#fff", fontSize: 38, fontWeight: 900, margin: "0 0 10px", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
            Manage your shop,<br />the smart way.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 16, margin: 0, maxWidth: 400, lineHeight: 1.6 }}>
            Sales, purchases, inventory, and reports — all in one place.
          </p>
        </div>
      </div>

      {/* Right side — login form */}
      <div style={{
        width: isMobile ? "100%" : 480,
        minWidth: isMobile ? "auto" : 480,
        background: "#fff",
        display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
        padding: isMobile ? "40px 28px" : "40px 60px",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: `linear-gradient(135deg, ${C.brand} 0%, #0369a1 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 18px", boxShadow: "0 8px 24px rgba(3,76,157,0.3)",
          }}>
            <FiPackage size={30} color="#fff" />
          </div>
          <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 900, color: C.brand, letterSpacing: "-0.02em" }}>
            GANGA INSTAMART
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: C.textSub }}>Sign in to your account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ width: "100%", maxWidth: 340 }}>
          {/* Username */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 7 }}>Username</label>
            <div style={{ position: "relative" }}>
              <FiUser size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.textSub, pointerEvents: "none" }} />
              <input
                ref={userRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                type="text"
                placeholder="Enter your username"
                autoComplete="username"
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "12px 14px 12px 42px",
                  border: `1.5px solid ${C.border}`, borderRadius: 10,
                  fontSize: 15, fontFamily: "inherit", color: C.text,
                  outline: "none", transition: "border-color 0.15s, box-shadow 0.15s",
                  background: "#fafbfc",
                }}
                onFocus={(e) => { e.target.style.borderColor = C.brand; e.target.style.boxShadow = `0 0 0 3px ${C.brandLight}`; e.target.style.background = "#fff"; }}
                onBlur={(e) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = "none"; e.target.style.background = "#fafbfc"; }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 7 }}>Password</label>
            <div style={{ position: "relative" }}>
              <FiLock size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.textSub, pointerEvents: "none" }} />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPass ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "12px 46px 12px 42px",
                  border: `1.5px solid ${C.border}`, borderRadius: 10,
                  fontSize: 15, fontFamily: "inherit", color: C.text,
                  outline: "none", transition: "border-color 0.15s, box-shadow 0.15s",
                  background: "#fafbfc",
                }}
                onFocus={(e) => { e.target.style.borderColor = C.brand; e.target.style.boxShadow = `0 0 0 3px ${C.brandLight}`; e.target.style.background = "#fff"; }}
                onBlur={(e) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = "none"; e.target.style.background = "#fafbfc"; }}
              />
              <button
                type="button"
                onClick={() => setShowPass((p) => !p)}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: C.textSub, padding: 4, display: "flex", borderRadius: 4,
                }}
              >
                {showPass ? <FiEyeOff size={17} /> : <FiEye size={17} />}
              </button>
            </div>
          </div>

          {/* Error message */}
          {responseMsg && (
            <div style={{
              marginBottom: 18, padding: "10px 14px", borderRadius: 9,
              background: "#fef2f2", border: "1.5px solid #fecaca",
              fontSize: 13, fontWeight: 600, color: C.red,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>!</span> {responseMsg}
            </div>
          )}

          {/* Login button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "13px 0",
              background: loading ? "#6b9fd4" : `linear-gradient(135deg, ${C.brand} 0%, #0369a1 100%)`,
              color: "#fff", border: "none", borderRadius: 10,
              fontSize: 16, fontWeight: 800, fontFamily: "inherit",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 4px 14px rgba(3,76,157,0.3)",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.boxShadow = "0 6px 20px rgba(3,76,157,0.4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 4px 14px rgba(3,76,157,0.3)"; }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                Signing in...
              </span>
            ) : (
              <><FiLogIn size={18} /> Sign In</>
            )}
          </button>
        </form>

        {/* Footer */}
        <div style={{ marginTop: 48, textAlign: "center", fontSize: 12, color: C.textSub }}>
          Ganga Instamart &copy; {new Date().getFullYear()}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
