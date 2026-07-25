import React, { useEffect, useMemo, useState } from "react";
import { Plus, Minus, Trash2, ShoppingCart, Send, CreditCard, Search, Banknote, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Btn, Input, Select, Field, Modal, EmptyState } from "@/components/kit";
import { money } from "@/lib/format";

const METHODS = [
  { key: "efectivo", label: "Efectivo", icon: Banknote },
  { key: "tarjeta", label: "Tarjeta", icon: CreditCard },
  { key: "transferencia", label: "Transferencia", icon: ArrowRightLeft },
];

export default function POS() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState({ tax_rate: 0.16, tax_included: true, currency: "MXN" });
  const [cat, setCat] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState("");
  const [table, setTable] = useState("");
  const [orderType, setOrderType] = useState("comer_aqui");
  const [sending, setSending] = useState(false);

  // payment modal
  const [payOpen, setPayOpen] = useState(false);
  const [payOrder, setPayOrder] = useState(null);
  const [method, setMethod] = useState("efectivo");
  const [received, setReceived] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    Promise.all([api.get("/products"), api.get("/categories"), api.get("/settings")])
      .then(([p, c, s]) => {
        setProducts(p.data.filter((x) => x.active !== false));
        setCategories(c.data);
        if (s.data) setSettings(s.data);
      })
      .catch(() => toast.error("No se pudo cargar el menú"));
  }, []);

  const shown = useMemo(() => {
    return products.filter((p) => {
      const okCat = cat === "all" || p.category_id === cat;
      const okSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
      return okCat && okSearch;
    });
  }, [products, cat, search]);

  const addToCart = (p) => {
    setCart((prev) => {
      const found = prev.find((i) => i.product.id === p.id);
      if (found) return prev.map((i) => (i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { product: p, qty: 1, notes: "" }];
    });
  };
  const changeQty = (id, delta) =>
    setCart((prev) =>
      prev
        .map((i) => (i.product.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
        .filter((i) => i.qty > 0)
    );
  const setNote = (id, notes) =>
    setCart((prev) => prev.map((i) => (i.product.id === id ? { ...i, notes } : i)));
  const removeItem = (id) => setCart((prev) => prev.filter((i) => i.product.id !== id));
  const clearCart = () => {
    setCart([]);
    setCustomer("");
    setTable("");
    setOrderType("comer_aqui");
  };

  const gross = cart.reduce((s, i) => s + i.product.price * i.qty, 0);
  const rate = Number(settings.tax_rate || 0);
  const totals =
    rate <= 0
      ? { subtotal: gross, tax: 0, total: gross }
      : settings.tax_included
      ? { subtotal: gross - (gross - gross / (1 + rate)), tax: gross - gross / (1 + rate), total: gross }
      : { subtotal: gross, tax: gross * rate, total: gross + gross * rate };

  const buildPayload = () => ({
    items: cart.map((i) => ({ product_id: i.product.id, qty: i.qty, notes: i.notes })),
    customer_name: customer,
    table,
    order_type: orderType,
  });

  const sendToKitchen = async () => {
    if (!cart.length) return;
    setSending(true);
    try {
      const { data } = await api.post("/orders", buildPayload());
      toast.success(`Comanda #${data.order_number} enviada a cocina`);
      clearCart();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo enviar la orden");
    } finally {
      setSending(false);
    }
  };

  const startCharge = async () => {
    if (!cart.length) return;
    setSending(true);
    try {
      const { data } = await api.post("/orders", buildPayload());
      setPayOrder(data);
      setReceived("");
      setMethod("efectivo");
      setPayOpen(true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo crear la orden");
    } finally {
      setSending(false);
    }
  };

  const change =
    method === "efectivo" && received !== ""
      ? Math.max(0, Number(received) - (payOrder?.total || 0))
      : 0;

  const confirmPayment = async () => {
    if (!payOrder) return;
    setPaying(true);
    try {
      const body = { method };
      if (method === "efectivo" && received !== "") body.amount_received = Number(received);
      const { data } = await api.post(`/orders/${payOrder.id}/pay`, body);
      toast.success(
        `Cobrado ${money(payOrder.total, settings.currency)}` +
          (data.change ? ` · Cambio ${money(data.change, settings.currency)}` : "")
      );
      setPayOpen(false);
      setPayOrder(null);
      clearCart();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo cobrar");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div>
      <PageHeader title="Punto de Venta" subtitle="Levanta la orden y cóbrala" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        {/* Menu */}
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-textDim" />
              <Input
                className="pl-9"
                placeholder="Buscar producto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            <CatChip active={cat === "all"} onClick={() => setCat("all")}>
              Todos
            </CatChip>
            {categories.map((c) => (
              <CatChip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
                {c.name}
              </CatChip>
            ))}
          </div>

          {shown.length === 0 ? (
            <EmptyState icon={Search} title="Sin productos" subtitle="Ajusta la búsqueda o la categoría." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {shown.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="text-left bg-surface border border-border hover:border-amber-500/50 rounded-xl p-4 transition group"
                >
                  <p className="font-semibold text-textBright group-hover:text-amber-300 transition line-clamp-2">
                    {p.name}
                  </p>
                  {p.description && <p className="text-xs text-textDim mt-1 line-clamp-1">{p.description}</p>}
                  <p className="text-cyan font-bold font-mono mt-2">{money(p.price, settings.currency)}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="bg-surface border border-border rounded-2xl lg:sticky lg:top-6 flex flex-col max-h-[calc(100vh-3rem)]">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-amber-400" />
              <h3 className="font-semibold text-textBright">Orden actual</h3>
            </div>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs text-textDim hover:text-red-400">
                Limpiar
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[120px]">
            {cart.length === 0 ? (
              <p className="text-center text-textDim text-sm py-8">Toca un producto para agregarlo</p>
            ) : (
              cart.map((i) => (
                <div key={i.product.id} className="bg-surface2 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-textBright truncate">{i.product.name}</p>
                      <p className="text-xs text-cyan font-mono">{money(i.product.price, settings.currency)}</p>
                    </div>
                    <button onClick={() => removeItem(i.product.id)} className="text-textDim hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => changeQty(i.product.id, -1)}
                        className="h-7 w-7 rounded-lg bg-surface3 text-textBright flex items-center justify-center hover:bg-border"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center font-mono text-textBright">{i.qty}</span>
                      <button
                        onClick={() => changeQty(i.product.id, 1)}
                        className="h-7 w-7 rounded-lg bg-surface3 text-textBright flex items-center justify-center hover:bg-border"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="font-mono text-sm text-textBright">
                      {money(i.product.price * i.qty, settings.currency)}
                    </span>
                  </div>
                  <input
                    value={i.notes}
                    onChange={(e) => setNote(i.product.id, e.target.value)}
                    placeholder="Nota (sin cebolla, término…)"
                    className="mt-2 w-full bg-surface border border-border rounded-lg px-2 py-1 text-xs text-textBright placeholder:text-textDim focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-border space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Cliente" value={customer} onChange={(e) => setCustomer(e.target.value)} />
              <Input placeholder="Mesa" value={table} onChange={(e) => setTable(e.target.value)} />
            </div>
            <div className="flex gap-2">
              {[
                { k: "comer_aqui", l: "Comer aquí" },
                { k: "para_llevar", l: "Para llevar" },
              ].map((t) => (
                <button
                  key={t.k}
                  onClick={() => setOrderType(t.k)}
                  className={`flex-1 py-2 rounded-lg text-sm border transition ${
                    orderType === t.k
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                      : "bg-surface2 border-border text-textMain hover:text-textBright"
                  }`}
                >
                  {t.l}
                </button>
              ))}
            </div>

            <div className="space-y-1 text-sm pt-1">
              <Row label="Subtotal" value={money(totals.subtotal, settings.currency)} />
              {rate > 0 && <Row label={`IVA (${Math.round(rate * 100)}%)`} value={money(totals.tax, settings.currency)} />}
              <div className="flex justify-between pt-1 border-t border-border">
                <span className="text-textBright font-semibold">Total</span>
                <span className="text-cyan font-bold font-mono text-lg">{money(totals.total, settings.currency)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Btn variant="secondary" disabled={!cart.length} loading={sending} onClick={sendToKitchen}>
                <Send className="h-4 w-4" /> A cocina
              </Btn>
              <Btn variant="success" disabled={!cart.length} loading={sending} onClick={startCharge}>
                <CreditCard className="h-4 w-4" /> Cobrar
              </Btn>
            </div>
          </div>
        </div>
      </div>

      {/* Payment modal */}
      <Modal
        open={payOpen}
        onClose={() => !paying && setPayOpen(false)}
        title={`Cobrar comanda #${payOrder?.order_number ?? ""}`}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setPayOpen(false)} disabled={paying}>
              Cancelar
            </Btn>
            <Btn variant="success" loading={paying} onClick={confirmPayment}>
              Confirmar cobro
            </Btn>
          </>
        }
      >
        <div className="space-y-4">
          <div className="text-center py-2">
            <p className="text-textDim text-sm">Total a cobrar</p>
            <p className="text-4xl font-black font-mono text-cyan">
              {money(payOrder?.total || 0, settings.currency)}
            </p>
          </div>

          <div>
            <p className="text-sm text-textMain font-medium mb-2">Método de pago</p>
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
          </div>

          {method === "efectivo" && (
            <Field label="Efectivo recibido">
              <Input
                type="number"
                inputMode="decimal"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                placeholder={String(payOrder?.total || "")}
              />
              {received !== "" && (
                <div className="flex justify-between mt-2 text-sm">
                  <span className="text-textMain">Cambio</span>
                  <span className={`font-mono font-bold ${change >= 0 ? "text-cyan" : "text-red-400"}`}>
                    {money(change, settings.currency)}
                  </span>
                </div>
              )}
            </Field>
          )}
        </div>
      </Modal>
    </div>
  );
}

const CatChip = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`shrink-0 px-4 py-1.5 rounded-full text-sm border transition ${
      active
        ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
        : "bg-surface2 border-border text-textMain hover:text-textBright"
    }`}
  >
    {children}
  </button>
);

const Row = ({ label, value }) => (
  <div className="flex justify-between">
    <span className="text-textDim">{label}</span>
    <span className="text-textMain font-mono">{value}</span>
  </div>
);
