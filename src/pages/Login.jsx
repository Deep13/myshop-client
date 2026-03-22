import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import storeImg from "../assets/store.png";

export default function Login() {
  const navigate = useNavigate();
  const isLoggedIn = localStorage.getItem("auth");
  const userRef = useRef(null);
  const [name, setname] = useState("");
  const [password, setPassword] = useState("");
  const [responseMsg, setResponseMsg] = useState("");
  const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

  // If already logged in → redirect
  useEffect(() => {
    if (isLoggedIn) {
      navigate(isMobile ? "/m/sale" : "/");
    }
    userRef.current.focus();
  }, []);

  const handleLogin = async () => {
    console.log(name, password);
    try {
      const res = await fetch("http://localhost/myshop-backend/login.php", {
        method: "POST",
        body: JSON.stringify({ name, password }),
      });

      const data = await res.json();

      if (data.status === "success") {
        console.log("User:", data.user);
        // Save in localStorage
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("auth", "true");
        // redirect — mobile goes to /m/sale, desktop goes to /
        window.location.href = isMobile ? "/m/sale" : "/";
      } else {
        setResponseMsg(data.message);
      }
    } catch (err) {
      console.log(err);
      setResponseMsg("Server not responding. Please try again later.", err);
    }
  };
  const showPass = (e) => {
    const passInput = e.target.previousSibling;
    if (passInput.type === "password") {
      passInput.type = "text";
      e.target.innerText = "Hide";
    } else {
      passInput.type = "password";
      e.target.innerText = "Show";
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        flex: 1,
      }}
    >
      <div style={{ flex: 1, backgroundImage: `url(${storeImg})`, backgroundPosition: "center", backgroundSize: "cover" }}></div>
      <div style={{ width: 500, background: "white", display: "flex", flexDirection: "column", justifyContent: "flex-start", alignItems: "center" }}>
        <h1 style={{ color: "#044b9b" }}>
          GANGA <br />
          INSTAMART
        </h1>
        <div style={{ padding: "0px 80px 35px", textAlign: "left", width: "100%" }}>
          <h1 className="heading">Login</h1>
          <div className="login-box">
            <label className="label-ele">Username</label>
            <input value={name} onInput={(event) => setname(event.target.value)} ref={userRef} className="input-ele" type="text" placeholder="" style={{}} />
          </div>
          <div className="login-box" style={{ position: "relative" }}>
            <label className="label-ele">Password</label>
            <input value={password} onInput={(event) => setPassword(event.target.value)} className="input-ele" type="password" placeholder="" style={{}} />
            <div className="show-pass" onClick={showPass}>
              Show
            </div>
          </div>
          <button className="submit-btn" onClick={handleLogin}>
            Login
          </button>
          <span>{responseMsg}</span>
        </div>
      </div>
    </div>
  );
}
