import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
    const isLoggedIn = localStorage.getItem("auth");

    return isLoggedIn ? children : <Navigate to="/login" replace />;
}
