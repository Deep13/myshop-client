import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import AddSales from "./pages/AddSales.jsx";
import Sales from "./pages/Sales.jsx";
import Login from "./pages/Login.jsx";
import AddPurchase from "./pages/AddPurchase.jsx";
import Purchase from "./pages/Purchase.jsx";
import Inventory from "./pages/Inventory.jsx";
import ItemDetail from "./pages/ItemDetail.jsx";
import Customers from "./pages/Customers.jsx";
import Distributors from "./pages/Distributors.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";
import MobileSale from "./pages/MobileSale.jsx";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./Layout";
import ProtectedRoute from "./ProtectedRoute.jsx";

/* Detect mobile device */
const isMobile = () => {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    || window.innerWidth <= 768;
};

/* Redirect desktop away from /m/*, redirect mobile away from desktop routes */
function MobileGuard({ children }) {
  const isLoggedIn = localStorage.getItem("auth");
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return children;
}

function DesktopRedirect({ children }) {
  if (isMobile() && localStorage.getItem("auth")) {
    return <Navigate to="/m/sale" replace />;
  }
  return children;
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Mobile route — no header, no layout */}
      <Route path="/m/sale" element={<MobileGuard><MobileSale /></MobileGuard>} />

      {/* Desktop routes — redirect mobile users to /m/sale */}
      <Route element={<ProtectedRoute><DesktopRedirect><Layout /></DesktopRedirect></ProtectedRoute>}>
        <Route path="/"                    element={<App />} />
        <Route path="/sales"               element={<Sales />} />
        <Route path="/addsales"            element={<AddSales />} />
        <Route path="/purchase"            element={<Purchase />} />
        <Route path="/addpurchase"         element={<AddPurchase />} />
        <Route path="/inventory"           element={<Inventory />} />
        <Route path="/inventory/:itemId"   element={<ItemDetail />} />
        <Route path="/customers"           element={<Customers />} />
        <Route path="/distributors"        element={<Distributors />} />
        <Route path="/reports"             element={<Reports />} />
        <Route path="/settings"            element={<Settings />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
