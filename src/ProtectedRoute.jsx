import { Navigate } from "react-router-dom";
import { expireIfStale } from "./session.js";

export default function ProtectedRoute({ children }) {
    // Yesterday's login does not carry into today — see session.js.
    expireIfStale();
    const isLoggedIn = localStorage.getItem("auth");

    return isLoggedIn ? children : <Navigate to="/login" replace />;
}
