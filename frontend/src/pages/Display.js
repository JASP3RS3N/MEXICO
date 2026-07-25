import React, { useEffect, useState } from "react";
import { Flame, ChefHat, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";

// Public customer-facing status board (no auth, no prices). Meant for a TV.
export default function Display() {
  const [orders, setOrders] = useState([]);
  const [clock, setClock] = useState(new Date());

  const load = async () => {
    try {
      const { data } = await api.get("/display");
      setOrders(data);
    } catch {
      /* ignore transient errors on the board */
    }
  };

  useEffect(() => {
    load();
    const poll = setInterval(load, 5000);
    const tick = setInterval(() => setClock(new Date()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preparing = orders.filter((o) => o.status === "pending" || o.status === "preparing");
  const ready = orders.filter((o) => o.status === "ready");

  const Column = ({ title, icon: Icon, items, accent, empty }) => (
    <div className="flex-1 flex flex-col min-h-0">
      <div className={`flex items-center gap-3 px-6 py-4 rounded-t-2xl ${accent.head}`}>
        <Icon className="h-7 w-7" />
        <h2 className="text-2xl font-bold tracking-wide">{title}</h2>
        <span className="ml-auto text-xl font-mono opacity-80">{items.length}</span>
      </div>
      <div className={`flex-1 p-6 rounded-b-2xl border-x border-b ${accent.body} overflow-y-auto`}>
        {items.length === 0 ? (
          <p className="text-center text-textDim text-xl mt-10">{empty}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {items.map((o) => (
              <div
                key={o.order_number}
                className={`aspect-square rounded-2xl flex flex-col items-center justify-center ${accent.card} ${
                  o.status === "ready" ? "animate-pulse" : ""
                }`}
              >
                <span className="text-5xl md:text-6xl font-black font-mono leading-none">
                  {o.order_number}
                </span>
                {o.customer_name && (
                  <span className="mt-2 text-sm opacity-80 truncate max-w-full px-2">
                    {o.customer_name}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col p-6">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Flame className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-textBright">Estado de tu orden</h1>
            <p className="text-textDim">Sigue el número de tu comanda</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-4xl font-mono font-bold text-textBright">
            {clock.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        <Column
          title="En preparación"
          icon={ChefHat}
          items={preparing}
          empty="Sin órdenes en cocina"
          accent={{
            head: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
            body: "bg-surface/50 border-amber-500/20",
            card: "bg-amber-500/10 text-amber-200 border border-amber-500/20",
          }}
        />
        <Column
          title="¡Listo para recoger!"
          icon={CheckCircle2}
          items={ready}
          empty="Nada listo aún"
          accent={{
            head: "bg-cyan-dim text-cyan border border-cyan/40",
            body: "bg-surface/50 border-cyan/20",
            card: "bg-cyan-dim text-cyan border border-cyan/40",
          }}
        />
      </div>
    </div>
  );
}
