import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AddSales from './pages/AddSales.jsx'
import Sales from './pages/Sales.jsx'
import Login from './pages/Login.jsx'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import ProtectedRoute from "./ProtectedRoute.jsx";
createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      {/* Public Route */}
      <Route path="/login" element={<Login />} />

      {/* Protected Routes */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<App />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/addsales" element={<AddSales />} />
      </Route>
    </Routes>
  </BrowserRouter>
)
