import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth, HOME_BY_ROLE } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import { PageLoader } from "@/components/kit";

import Login from "@/pages/Login";
import Display from "@/pages/Display";
import Dashboard from "@/pages/Dashboard";
import POS from "@/pages/POS";
import Orders from "@/pages/Orders";
import Kitchen from "@/pages/Kitchen";
import Menu from "@/pages/Menu";
import Inventory from "@/pages/Inventory";
import PurchaseOrders from "@/pages/PurchaseOrders";
import Expenses from "@/pages/Expenses";
import Users from "@/pages/Users";
import SettingsPage from "@/pages/Settings";

function RoleHome() {
  const { user } = useAuth();
  return <Navigate to={HOME_BY_ROLE[user?.role] || "/login"} replace />;
}

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background"><PageLoader /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <RoleHome />;
  return <Layout>{children}</Layout>;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background"><PageLoader /></div>;
  if (user) return <RoleHome />;
  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          {/* Public customer-facing status board */}
          <Route path="/pantalla" element={<Display />} />

          <Route path="/" element={<Protected><RoleHome /></Protected>} />
          <Route path="/dashboard" element={<Protected roles={["owner"]}><Dashboard /></Protected>} />
          <Route path="/pos" element={<Protected roles={["owner", "cashier"]}><POS /></Protected>} />
          <Route path="/ordenes" element={<Protected roles={["owner", "cashier"]}><Orders /></Protected>} />
          <Route path="/cocina" element={<Protected roles={["owner", "prep"]}><Kitchen /></Protected>} />
          <Route path="/menu" element={<Protected roles={["owner"]}><Menu /></Protected>} />
          <Route path="/inventario" element={<Protected roles={["owner"]}><Inventory /></Protected>} />
          <Route path="/compras" element={<Protected roles={["owner"]}><PurchaseOrders /></Protected>} />
          <Route path="/gastos" element={<Protected roles={["owner"]}><Expenses /></Protected>} />
          <Route path="/usuarios" element={<Protected roles={["owner"]}><Users /></Protected>} />
          <Route path="/ajustes" element={<Protected roles={["owner"]}><SettingsPage /></Protected>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster theme="dark" richColors position="top-right" />
    </AuthProvider>
  );
}
