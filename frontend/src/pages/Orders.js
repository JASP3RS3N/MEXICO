import React, { useCallback, useEffect, useState } from "react";
import { Receipt, CreditCard, XCircle, Package, Banknote, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/Layout";
import { Btn, Badge, Modal, Field, Input, EmptyState, PageLoader } from "@/components/kit";
import { money, fmtTime } from "@/lib/format";

export const STATUS_META = {
  pending: { label: "Pendiente", color: "blue" },
  preparing: { label: "En preparación", color: "amber" },
  ready: { label: "Lista", color: "green" },
  delivered: { label: "Entregada", color: "gray" },
  paid: { label: "Pagada", color: "green" },
  cancelled: { label: "Cancelada", color: "red" },
};

const FILTERS = [
  { key: "active", label: "Activas" },
  { key: "unpaid", label: "Por cobrar" },
  { key: "ready", label: "Listas" },
  { key: "paid", label: "Pagadas" },
  { key: "cancelled", label: "Canceladas" },
  { key: "all", label: "Todas" },
];
// Cashiers only take orders and charge — no access to completed sales.
const CASHIER_FILTERS = [
  { key: "active", label: "Por cobrar" },
  { key: "ready", label: "Listas" },
];

const METHODS = [
  { key: "efectivo", label: "Efectivo", icon: Banknote },
  { key: "tarjeta", label: "Tarjeta", icon: CreditCard },
  { key: "transferencia", label: "Transferencia", icon: ArrowRightLeft },
];

// Informational-only grouping: when several items carry a diner_name, cluster
// them by person with a per-person subtotal. Doesn't touch totals or payment.
function groupItemsByDiner(items) {
  const withDiner = items.filter((it) => it.diner_name);
  if (withDiner.length < 2) return null;
  const groups = {};
  const order = [];
  items.forEach((it) => {
    const label = it.diner_name || "Sin asignar";
    if (!groups[label]) {
      groups[label] = { diner: label, items: [], subtotal: 0 };
      order.push(label);
    }
    groups[label].items.push(it);
    groups[label].subtotal += it.line_total || 0;
  });
  // Keep assignment order, but push the "unassigned" bucket to the end.
  order.sort((a, b) => (a === "Sin asignar" ? 1 : b === "Sin asignar" ? -1 : 0));
  return order.map((k) => groups[k]);
}

export default function Orders() {
  const { user } = useAuth();
  const isCashier = user?.role === "cashier";
  const filters = isCashier ? CASHIER_FILTERS : FILTERS;
  const [filter, setFilter] = useState("active");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("MXN");

  const [payOrder, setPayOrder] = useState(null);
  const [method, setMethod] = useState("efectivo");
  const [received, setReceived] = useState("");
  const [tip, setTip] = useState("");
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    try {
      const params =
        filter === "active" ? { active: true }
        : filter === "all" ? {}
        : filter === "paid" ? { paid: true }
        : filter === "unpaid" ? { paid: false }
        : { status: filter };
      const { data } = await api.get("/orders", { params });
      setOrders(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    api.get("/settings").then(({ data }) => data?.currency && setCurrency(data.currency)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const action = async (id, verb) => {
    try {
      await api.post(`/orders/${id}/${verb}`);
      toast.success("Orden actualizada");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo actualizar");
    }
  };

  const openPay = (o) => {
    setPayOrder(o);
    setMethod("efectivo");
    setReceived("");
    setTip("");
  };

  const tipNum = tip !== "" ? Math.max(0, Number(tip) || 0) : 0;
  const totalDue = (payOrder?.total || 0) + tipNum;
  const change = method === "efectivo" && received !== "" ? Math.max(0, Number(received) - totalDue) : 0;

  const confirmPay = async () => {
    if (!payOrder) return;
    setPaying(true);
    try {
      const body = { method, tip_amount: tipNum };
      if (method === "efectivo" && received !== "") body.amount_received = Number(received);
      const { data } = await api.post(`/orders/${payOrder.id}/pay`, body);
      toast.success(`Cobrado${data.change ? ` · Cambio ${money(data.change, currency)}` : ""}`);
      setPayOrder(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo cobrar");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div>
      <PageHeader title="Órdenes" subtitle={isCashier ? "Cobra y entrega las comandas pendientes" : "Cobra, entrega o cancela comandas"} />

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm border transition ${
              filter === f.key
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                : "bg-surface2 border-border text-textMain hover:text-textBright"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <PageLoader />
      ) : orders.length === 0 ? (
        <EmptyState icon={Receipt} title="Sin órdenes" subtitle="No hay comandas para este filtro." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orders.map((o) => {
            const meta = STATUS_META[o.status] || { label: o.status, color: "gray" };
            const dinerGroups = groupItemsByDiner(o.items);
            return (
              <div key={o.id} className="bg-surface border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="text-lg font-black font-mono text-textBright">#{o.order_number}</span>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <Badge color={meta.color}>{meta.label}</Badge>
                    {o.status !== "cancelled" && (o.paid ? <Badge color="green">Pagada</Badge> : <Badge color="amber">Por cobrar</Badge>)}
                  </div>
                </div>
                <div className="text-sm text-textDim space-y-0.5 mb-3">
                  {o.customer_name && <p className="text-textMain">{o.customer_name}</p>}
                  <p>
                    {fmtTime(o.created_at)} · {o.items.reduce((s, i) => s + i.qty, 0)} art.
                    {o.paid && o.payment_method ? ` · ${o.payment_method}` : ""}
                  </p>
                </div>
                {dinerGroups ? (
                  <div className="text-sm mb-3 max-h-32 overflow-y-auto space-y-2">
                    {dinerGroups.map((g) => (
                      <div key={g.diner}>
                        <p className="flex items-center justify-between gap-2 text-xs font-semibold text-amber-300">
                          <span className="truncate">{g.diner}</span>
                          <span className="font-mono text-textDim shrink-0">{money(g.subtotal, currency)}</span>
                        </p>
                        <ul className="text-textMain space-y-0.5 mt-0.5">
                          {g.items.map((it, i) => (
                            <li key={i} className="flex justify-between gap-2 pl-2">
                              <span className="truncate">
                                {it.qty}× {it.name}
                              </span>
                              {it.line_total != null && (
                                <span className="font-mono text-textDim shrink-0">{money(it.line_total, currency)}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className="text-sm text-textMain space-y-0.5 mb-3 max-h-24 overflow-y-auto">
                    {o.items.map((it, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="truncate">
                          {it.qty}× {it.name}
                        </span>
                        {it.line_total != null && (
                          <span className="font-mono text-textDim shrink-0">{money(it.line_total, currency)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="font-bold font-mono text-money">{money(o.total, currency)}</span>
                  <div className="flex gap-2">
                    {o.status === "ready" && (
                      <Btn size="sm" variant="secondary" onClick={() => action(o.id, "deliver")}>
                        <Package className="h-3.5 w-3.5" /> Entregar
                      </Btn>
                    )}
                    {!o.paid && o.status !== "cancelled" && (
                      <>
                        <Btn size="sm" variant="ghost" onClick={() => action(o.id, "cancel")}>
                          <XCircle className="h-3.5 w-3.5" />
                        </Btn>
                        <Btn size="sm" variant="success" onClick={() => openPay(o)}>
                          <CreditCard className="h-3.5 w-3.5" /> Cobrar
                        </Btn>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!payOrder}
        onClose={() => !paying && setPayOrder(null)}
        title={`Cobrar comanda #${payOrder?.order_number ?? ""}`}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setPayOrder(null)} disabled={paying}>
              Cancelar
            </Btn>
            <Btn variant="success" loading={paying} onClick={confirmPay}>
              Confirmar cobro
            </Btn>
          </>
        }
      >
        <div className="space-y-4">
          <div className="text-center py-2">
            <p className="text-textDim text-sm">Total a cobrar</p>
            <p className="text-4xl font-black font-mono text-money">{money(totalDue, currency)}</p>
            {tipNum > 0 && (
              <p className="text-xs text-textDim mt-1">Incluye propina de {money(tipNum, currency)}</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMethod(m.key)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition ${
                  method === m.key
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                    : "bg-surface2 border-border text-textMain hover:text-textBright"
                }`}
              >
                <m.icon className="h-5 w-5" />
                <span className="text-xs">{m.label}</span>
              </button>
            ))}
          </div>
          <Field label="Propina">
            <Input type="number" value={tip} onChange={(e) => setTip(e.target.value)} placeholder="0.00" />
          </Field>
          {method === "efectivo" && (
            <Field label="Efectivo recibido">
              <Input type="number" value={received} onChange={(e) => setReceived(e.target.value)} placeholder={String(totalDue)} />
              {received !== "" && (
                <div className="flex justify-between mt-2 text-sm">
                  <span className="text-textMain">Cambio</span>
                  <span className={`font-mono font-bold ${change >= 0 ? "text-money" : "text-red-400"}`}>{money(change, currency)}</span>
                </div>
              )}
            </Field>
          )}
        </div>
      </Modal>
    </div>
  );
}
