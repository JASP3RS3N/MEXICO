import React, { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ConciergeBell,
  Receipt,
  ChefHat,
  UtensilsCrossed,
  Boxes,
  Truck,
  Wallet,
  Users,
  Settings,
  Monitor,
  LogOut,
  Pause,
  Menu as MenuIcon,
  X,
  Flame,
  Bot,
  Handshake,
  Contact,
  Bell,
} from "lucide-react";
import { useAuth, ROLE_LABELS } from "@/context/AuthContext";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { Modal, Btn } from "@/components/kit";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["owner"] },
  { to: "/asistente", label: "Asistente IA", icon: Bot, roles: ["owner"] },
  { to: "/pos", label: "Punto de Venta", icon: ConciergeBell, roles: ["owner", "cashier"] },
  { to: "/ordenes", label: "Órdenes", icon: Receipt, roles: ["owner", "cashier"] },
  { to: "/cocina", label: "Cocina", icon: ChefHat, roles: ["owner", "prep"] },
  { to: "/menu", label: "Menú y Precios", icon: UtensilsCrossed, roles: ["owner"] },
  { to: "/inventario", label: "Inventario", icon: Boxes, roles: ["owner"] },
  { to: "/alertas", label: "Alertas", icon: Bell, roles: ["owner"], badge: "alerts" },
  { to: "/compras", label: "Órdenes de Compra", icon: Truck, roles: ["owner"] },
  { to: "/proveedores", label: "Proveedores", icon: Handshake, roles: ["owner"] },
  { to: "/gastos", label: "Gastos", icon: Wallet, roles: ["owner"] },
  { to: "/empleados", label: "Empleados", icon: Contact, roles: ["owner"] },
  { to: "/usuarios", label: "Usuarios", icon: Users, roles: ["owner"] },
  { to: "/ajustes", label: "Ajustes", icon: Settings, roles: ["owner"] },
];

export default function Layout({ children }) {
  const { user, logout, endShift, pauseSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState("Smokehouse");
  const [alertCount, setAlertCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  useEffect(() => {
    api
      .get("/settings")
      .then(({ data }) => data?.restaurant_name && setBrand(data.restaurant_name))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.role !== "owner") return;
    const load = () => api.get("/alerts/count").then(({ data }) => setAlertCount(data.unresolved || 0)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [user, location.pathname]);

  useEffect(() => setOpen(false), [location.pathname]);

  const items = NAV.filter((n) => n.roles.includes(user?.role));

  // Cashier/prep only end their shift (device stays activated for the next
  // PIN login). The owner has two separate actions instead (see the
  // dropdown below): pausing (same effect, different entry point) and a
  // full, confirmed logout that deactivates the device.
  const handleEndShift = () => {
    endShift();
    navigate("/pin");
  };

  const handlePauseSession = () => {
    setMenuOpen(false);
    pauseSession();
    navigate("/login");
  };

  const handleFullLogoutConfirmed = () => {
    setConfirmLogoutOpen(false);
    logout();
    navigate("/login");
  };

  const SidebarContent = (
    <div className="flex flex-col h-full w-full min-w-0">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border shrink-0">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-900/40">
          <Flame className="h-5 w-5 text-white" />
        </div>
        <div className="leading-tight min-w-0">
          <p className="text-textBright font-bold text-sm truncate">{brand}</p>
          <p className="text-textDim text-[11px] uppercase tracking-wider">Smokehouse OS</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-w-0",
                isActive
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                  : "text-textMain hover:text-textBright hover:bg-surface2 border border-transparent"
              )
            }
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate flex-1">{item.label}</span>
            {item.badge === "alerts" && alertCount > 0 && (
              <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                {alertCount}
              </span>
            )}
          </NavLink>
        ))}

        {user?.tenant_slug && (
          <a
            href={`/pantalla/${user.tenant_slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-textMain hover:text-textBright hover:bg-surface2 border border-transparent min-w-0"
          >
            <Monitor className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate flex-1">Pantalla Cliente</span>
          </a>
        )}
      </nav>

      <div className="p-3 border-t border-border shrink-0">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="h-9 w-9 rounded-full bg-surface3 flex items-center justify-center text-amber-300 font-semibold text-sm">
            {(user?.name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-textBright text-sm font-medium truncate">{user?.name}</p>
            <p className="text-textDim text-xs">{ROLE_LABELS[user?.role] || user?.role}</p>
          </div>
          {user?.role === "owner" ? (
            <div className="relative shrink-0">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                title="Sesión"
                className="text-textDim hover:text-textBright transition p-1.5"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute bottom-full right-0 mb-2 w-56 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-50">
                    <button
                      onClick={handlePauseSession}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-textMain hover:bg-surface2 hover:text-textBright transition"
                    >
                      <Pause className="h-4 w-4 shrink-0" />
                      <span>Pausar sesión</span>
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirmLogoutOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition border-t border-border"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                      <span>Cerrar sesión por completo</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={handleEndShift}
              title="Terminar turno"
              className="text-textDim hover:text-red-400 transition p-1.5 flex items-center gap-1.5 shrink-0"
            >
              <LogOut className="h-[18px] w-[18px]" />
              <span className="hidden lg:inline text-xs font-medium">Terminar turno</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-border bg-sidebar fixed inset-y-0 left-0 overflow-hidden">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-sidebar border-r border-border overflow-hidden">
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="flex-1 lg:ml-64 min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 h-14 bg-sidebar/95 backdrop-blur border-b border-border flex items-center gap-3 px-4">
          <button onClick={() => setOpen((v) => !v)} className="text-textBright">
            {open ? <X className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
          </button>
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-amber-400" />
            <span className="font-bold text-textBright text-sm truncate">{brand}</span>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">{children}</main>
      </div>

      <Modal
        open={confirmLogoutOpen}
        onClose={() => setConfirmLogoutOpen(false)}
        title="Cerrar sesión por completo"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setConfirmLogoutOpen(false)}>
              Cancelar
            </Btn>
            <Btn variant="danger" onClick={handleFullLogoutConfirmed}>
              Sí, cerrar sesión por completo
            </Btn>
          </>
        }
      >
        <p className="text-sm text-textMain">
          Esto desactivará este dispositivo por completo. Para volver a usarlo, tendrás que iniciar sesión de nuevo
          con tu usuario y contraseña. ¿Confirmas cerrar sesión por completo?
        </p>
      </Modal>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-textBright">{title}</h1>
        {subtitle && <p className="text-textDim mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
