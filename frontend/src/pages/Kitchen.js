import React, { useCallback, useEffect, useState } from "react";
import { ChefHat, Clock, ArrowRight, Check, Package, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Btn, Badge, EmptyState } from "@/components/kit";
import { minsSince } from "@/lib/format";

const TYPE_LABEL = { comer_aqui: "Comer aquí", para_llevar: "Para llevar" };

function OrderCard({ order, onAction, busy }) {
  const mins = minsSince(order.created_at);
  const urgent = mins >= 15;
  const next =
    order.status === "pending"
      ? { label: "Aceptar", to: "accept", variant: "primary", icon: Check }
      : order.status === "preparing"
      ? { label: "Marcar lista", to: "ready", variant: "success", icon: ArrowRight }
      : { label: "Entregar", to: "deliver", variant: "secondary", icon: Package };

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface2">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black font-mono text-textBright">#{order.order_number}</span>
          {order.order_type === "para_llevar" && <Badge color="purple">Para llevar</Badge>}
          {order.paid && <Badge color="green">Pagada</Badge>}
        </div>
        <div
          className={`flex items-center gap-1 text-sm font-mono ${
            urgent ? "text-red-400" : "text-textDim"
          }`}
        >
          <Clock className="h-4 w-4" /> {mins}m
        </div>
      </div>

      <div className="p-4 flex-1 space-y-2">
        {order.customer_name && (
          <p className="text-sm text-textMain">
            <span className="text-textDim">Cliente:</span> {order.customer_name}
          </p>
        )}
        {order.table && (
          <p className="text-sm text-textMain">
            <span className="text-textDim">Mesa:</span> {order.table}
          </p>
        )}
        <ul className="space-y-1.5 pt-1">
          {order.items.map((it, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-amber-400 font-bold font-mono shrink-0">{it.qty}×</span>
              <div className="min-w-0">
                <span className="text-textBright">{it.name}</span>
                {it.notes && <p className="text-xs text-amber-300/80 italic">↳ {it.notes}</p>}
              </div>
            </li>
          ))}
        </ul>
        {order.notes && (
          <p className="text-xs text-textDim italic border-t border-border pt-2 mt-2">
            Nota: {order.notes}
          </p>
        )}
      </div>

      <div className="p-3 border-t border-border">
        <Btn variant={next.variant} className="w-full" loading={busy} onClick={() => onAction(order.id, next.to)}>
          <next.icon className="h-4 w-4" /> {next.label}
        </Btn>
      </div>
    </div>
  );
}

export default function Kitchen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/kitchen");
      setOrders(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  const doAction = async (id, action) => {
    setBusy(id);
    try {
      await api.post(`/orders/${id}/${action}`);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo actualizar");
    } finally {
      setBusy(null);
    }
  };

  const cols = [
    { key: "pending", title: "Nuevas", color: "text-blue", items: orders.filter((o) => o.status === "pending") },
    { key: "preparing", title: "En preparación", color: "text-amber-400", items: orders.filter((o) => o.status === "preparing") },
    { key: "ready", title: "Listas", color: "text-cyan", items: orders.filter((o) => o.status === "ready") },
  ];

  return (
    <div>
      <PageHeader
        title="Cocina"
        subtitle="Comandas en tiempo real · se actualiza automáticamente"
        actions={<Badge color="green">{orders.length} activas</Badge>}
      />

      {!loading && orders.length === 0 ? (
        <EmptyState icon={ChefHat} title="Sin comandas por ahora" subtitle="Las nuevas órdenes aparecerán aquí en cuanto la caja las levante." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {cols.map((col) => (
            <div key={col.key}>
              <div className="flex items-center gap-2 mb-3">
                <UtensilsCrossed className={`h-4 w-4 ${col.color}`} />
                <h2 className={`font-semibold ${col.color}`}>{col.title}</h2>
                <span className="text-textDim text-sm font-mono">({col.items.length})</span>
              </div>
              <div className="space-y-4">
                {col.items.map((o) => (
                  <OrderCard key={o.id} order={o} onAction={doAction} busy={busy === o.id} />
                ))}
                {col.items.length === 0 && (
                  <div className="text-center text-textDim text-sm py-8 border border-dashed border-border rounded-xl">
                    Vacío
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
