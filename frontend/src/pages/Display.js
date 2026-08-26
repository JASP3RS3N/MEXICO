import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Flame, ChefHat, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";

const DEFAULTS = { bg: "#080c14", text: "#e8edf2", prep: "#f59e0b", ready: "#00e5a0", name: "Smokehouse" };

const rgba = (hex, a) => {
  const m = (hex || "").replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return `rgba(0,0,0,${a})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// Public customer-facing status board (no auth, no prices). Meant for a TV.
export default function Display() {
  const { tenantSlug } = useParams();
  const [orders, setOrders] = useState([]);
  const [clock, setClock] = useState(new Date());
  const [theme, setTheme] = useState(DEFAULTS);
  const [error, setError] = useState(null); // null | "missing" | "notfound"

  const load = async () => {
    try {
      const { data } = await api.get(`/display?tenant=${tenantSlug}`);
      setOrders(data);
    } catch (err) {
      if (err?.response?.status === 404) setError("notfound");
      /* ignore transient errors on the board */
    }
  };

  const loadTheme = async () => {
    try {
      const { data } = await api.get(`/display/theme?tenant=${tenantSlug}`);
      setTheme({
        bg: data.display_bg || DEFAULTS.bg,
        text: data.display_text || DEFAULTS.text,
        prep: data.display_prep || DEFAULTS.prep,
        ready: data.display_ready || DEFAULTS.ready,
        name: data.restaurant_name || DEFAULTS.name,
      });
    } catch (err) {
      if (err?.response?.status === 404) setError("notfound");
      /* keep defaults */
    }
  };

  useEffect(() => {
    if (!tenantSlug) {
      setError("missing");
      return undefined;
    }
    load();
    loadTheme();
    const poll = setInterval(load, 5000);
    const themePoll = setInterval(loadTheme, 60000);
    const tick = setInterval(() => setClock(new Date()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(themePoll);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  if (error) {
    const message =
      error === "missing"
        ? "Falta el identificador del restaurante en la URL"
        : "Restaurante no encontrado";
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6 text-center"
        style={{ backgroundColor: DEFAULTS.bg, color: DEFAULTS.text }}
      >
        <p className="text-2xl font-semibold">{message}</p>
      </div>
    );
  }

  const preparing = orders.filter((o) => o.status === "pending" || o.status === "preparing");
  const ready = orders.filter((o) => o.status === "ready");

  const Column = ({ title, icon: Icon, items, accent, empty }) => (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-3 px-6 py-4 rounded-t-2xl border" style={{ background: rgba(accent, 0.15), borderColor: rgba(accent, 0.35), color: accent }}>
        <Icon className="h-7 w-7" />
        <h2 className="text-2xl font-bold tracking-wide">{title}</h2>
        <span className="ml-auto text-xl font-mono opacity-80">{items.length}</span>
      </div>
      <div className="flex-1 p-6 rounded-b-2xl border-x border-b overflow-y-auto" style={{ background: rgba(accent, 0.04), borderColor: rgba(accent, 0.2) }}>
        {items.length === 0 ? (
          <p className="text-center text-xl mt-10" style={{ color: rgba(theme.text, 0.5) }}>{empty}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {items.map((o) => (
              <div
                key={o.order_number}
                className={`aspect-square rounded-2xl flex flex-col items-center justify-center border ${o.status === "ready" ? "animate-pulse" : ""}`}
                style={{ background: rgba(accent, 0.12), borderColor: rgba(accent, 0.35), color: accent }}
              >
                <span className="text-5xl md:text-6xl font-black font-mono leading-none">{o.order_number}</span>
                {o.customer_name && <span className="mt-2 text-sm opacity-80 truncate max-w-full px-2">{o.customer_name}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col p-6" style={{ backgroundColor: theme.bg, color: theme.text }}>
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Flame className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black">{theme.name}</h1>
            <p style={{ color: rgba(theme.text, 0.6) }}>Sigue el número de tu comanda</p>
          </div>
        </div>
        <p className="text-4xl font-mono font-bold">
          {clock.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        <Column title="En preparación" icon={ChefHat} items={preparing} empty="Sin órdenes en cocina" accent={theme.prep} />
        <Column title="¡Listo para recoger!" icon={CheckCircle2} items={ready} empty="Nada listo aún" accent={theme.ready} />
      </div>
    </div>
  );
}
