import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  DollarSign,
  Receipt,
  TrendingUp,
  Boxes,
  AlertTriangle,
  ShoppingBag,
  Wallet,
  Percent,
} from "lucide-react";
import api from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Card, CardHead, Stat, PageLoader, Badge } from "@/components/kit";
import { money, num, pct, dayRange, monthRange } from "@/lib/format";

const PALETTE = ["#f59e0b", "#00e5a0", "#0ea5e9", "#a855f7", "#f97316", "#ef4444", "#eab308"];

const PERIODS = [
  { key: "today", label: "Hoy" },
  { key: "7d", label: "7 días" },
  { key: "month", label: "Este mes" },
  { key: "lastMonth", label: "Mes pasado" },
];

function rangeFor(key) {
  const now = new Date();
  if (key === "today") return dayRange(now);
  if (key === "7d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start: start.toISOString(), end: now.toISOString() };
  }
  if (key === "lastMonth") return monthRange(new Date(now.getFullYear(), now.getMonth() - 1, 15));
  return monthRange(now);
}

const tooltipStyle = {
  contentStyle: {
    background: "#0d1420",
    border: "1px solid #1e3050",
    borderRadius: 12,
    color: "#e8edf2",
  },
  labelStyle: { color: "#5a6d82" },
};

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [daily, setDaily] = useState(null);
  const [period, setPeriod] = useState("month");
  const [currency, setCurrency] = useState("MXN");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/settings").then(({ data }) => data?.currency && setCurrency(data.currency)).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const range = rangeFor(period);
    Promise.all([
      api.get("/finance/dashboard"),
      api.get("/finance/pnl", { params: range }),
      api.get("/finance/daily", { params: dayRange(new Date()) }),
    ])
      .then(([s, p, d]) => {
        if (!alive) return;
        setSummary(s.data);
        setPnl(p.data);
        setDaily(d.data);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [period]);

  const paymentData = useMemo(
    () => (daily?.by_payment_method || []).map((m) => ({ name: m.method, value: m.total })),
    [daily]
  );

  if (loading && !pnl) return <PageLoader />;

  const m = summary?.month || {};
  const t = summary?.today || {};

  return (
    <div>
      <PageHeader
        title="Dashboard financiero"
        subtitle="Solo visible para el dueño · ventas, P&L e inventario"
        actions={
          <div className="flex gap-1.5 bg-surface2 border border-border rounded-xl p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  period === p.key ? "bg-amber-500/20 text-amber-300" : "text-textMain hover:text-textBright"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Venta de hoy" value={money(t.gross_sales, currency)} sub={`${num(t.orders)} órdenes`} icon={DollarSign} accent="green" />
        <Stat label="Ticket promedio hoy" value={money(t.avg_ticket, currency)} icon={Receipt} accent="blue" />
        <Stat label="Utilidad neta (mes)" value={money(m.net_profit, currency)} sub={`Margen ${pct(m.net_margin || 0)}`} icon={TrendingUp} accent="amber" />
        <Stat label="Valor de inventario" value={money(summary?.inventory_value, currency)} icon={Boxes} accent="purple" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Órdenes activas" value={num(summary?.active_orders)} icon={ShoppingBag} accent="blue" />
        <Stat label="Materias en bajo stock" value={num(summary?.low_stock_count)} icon={AlertTriangle} accent={summary?.low_stock_count ? "red" : "green"} />
        <Stat label="OC abiertas" value={num(summary?.open_purchase_orders)} icon={Wallet} accent="amber" />
        <Stat label="Margen bruto (mes)" value={pct(pnl?.gross_margin || 0)} icon={Percent} accent="green" />
      </div>

      {/* P&L + sales chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHead title="Ventas del periodo" subtitle="Venta neta y costo por día" />
          <div className="p-5 h-72">
            {pnl?.series?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pnl.series}>
                  <defs>
                    <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00e5a0" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#00e5a0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3050" />
                  <XAxis dataKey="date" stroke="#5a6d82" fontSize={11} tickFormatter={(d) => d.slice(5)} />
                  <YAxis stroke="#5a6d82" fontSize={11} tickFormatter={(v) => `$${num(v / 1000)}k`} />
                  <Tooltip {...tooltipStyle} formatter={(v) => money(v, currency)} />
                  <Area type="monotone" dataKey="net_sales" name="Venta neta" stroke="#00e5a0" strokeWidth={2} fill="url(#gNet)" />
                  <Area type="monotone" dataKey="cogs" name="Costo" stroke="#ef4444" strokeWidth={2} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </div>
        </Card>

        <Card>
          <CardHead title="Estado de resultados (P&L)" subtitle="Periodo seleccionado" />
          <div className="p-5 space-y-2.5">
            <PnLRow label="Ingresos (neto)" value={money(pnl?.revenue, currency)} strong />
            <PnLRow label="(–) Costo de ventas" value={`- ${money(pnl?.cogs, currency)}`} sub />
            <div className="border-t border-border pt-2.5">
              <PnLRow label="Utilidad bruta" value={money(pnl?.gross_profit, currency)} strong accent="green" />
              <p className="text-xs text-textDim text-right">Margen {pct(pnl?.gross_margin || 0)}</p>
            </div>
            <PnLRow label="(–) Gastos operativos" value={`- ${money(pnl?.operating_expenses, currency)}`} sub />
            {pnl?.payroll > 0 && (
              <p className="text-xs text-textDim text-right -mt-1">incluye nómina {money(pnl.payroll, currency)}</p>
            )}
            <div className="border-t border-border pt-2.5">
              <PnLRow
                label="Utilidad neta"
                value={money(pnl?.net_profit, currency)}
                strong
                accent={pnl?.net_profit >= 0 ? "green" : "red"}
              />
              <p className="text-xs text-textDim text-right">Margen neto {pct(pnl?.net_margin || 0)}</p>
            </div>
            <div className="flex justify-between pt-2 text-xs text-textDim">
              <span>IVA cobrado</span>
              <span className="font-mono">{money(pnl?.tax_collected, currency)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Breakdown row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHead title="Ventas por categoría" />
          <div className="p-5 h-64">
            {pnl?.sales_by_category?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pnl.sales_by_category} dataKey="revenue" nameKey="category" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {pnl.sales_by_category.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="#0d1420" />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v) => money(v, currency)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
            <div className="space-y-1 mt-2">
              {(pnl?.sales_by_category || []).slice(0, 5).map((c, i) => (
                <div key={c.category} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-textMain">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                    {c.category}
                  </span>
                  <span className="font-mono text-textDim">{money(c.revenue, currency)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="Venta por hora (hoy)" />
          <div className="p-5 h-64">
            {daily?.by_hour?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily.by_hour}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3050" vertical={false} />
                  <XAxis dataKey="hour" stroke="#5a6d82" fontSize={11} />
                  <YAxis stroke="#5a6d82" fontSize={11} tickFormatter={(v) => `$${num(v / 1000)}k`} />
                  <Tooltip {...tooltipStyle} formatter={(v) => money(v, currency)} cursor={{ fill: "#ffffff08" }} />
                  <Bar dataKey="total" name="Venta" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart text="Aún no hay ventas hoy" />
            )}
          </div>
        </Card>

        <Card>
          <CardHead title="Métodos de pago (hoy)" />
          <div className="p-5">
            {paymentData.length ? (
              <div className="space-y-3">
                {daily.by_payment_method.map((mth, i) => {
                  const total = daily.by_payment_method.reduce((s, x) => s + x.total, 0) || 1;
                  const p = (mth.total / total) * 100;
                  return (
                    <div key={mth.method}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-textMain capitalize">{mth.method}</span>
                        <span className="font-mono text-textBright">{money(mth.total, currency)}</span>
                      </div>
                      <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${p}%`, background: PALETTE[i % PALETTE.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyChart text="Sin cobros hoy" />
            )}
          </div>
        </Card>
      </div>

      {/* Top products */}
      <Card>
        <CardHead title="Productos más vendidos" subtitle="En el periodo seleccionado" />
        <div className="p-5">
          {pnl?.top_products?.length ? (
            <div className="space-y-2">
              {pnl.top_products.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="w-6 text-center text-textDim font-mono text-sm">{i + 1}</span>
                  <span className="flex-1 text-textBright text-sm truncate">{p.name}</span>
                  <Badge color="gray">{num(p.qty)} vendidos</Badge>
                  <span className="w-24 text-right font-mono text-money text-sm">{money(p.revenue, currency)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyChart text="Sin ventas en el periodo" />
          )}
        </div>
      </Card>
    </div>
  );
}

const PnLRow = ({ label, value, strong, sub, accent }) => {
  const color = accent === "green" ? "text-money" : accent === "red" ? "text-red-400" : "text-textBright";
  return (
    <div className="flex justify-between items-baseline">
      <span className={sub ? "text-textDim text-sm" : "text-textMain text-sm"}>{label}</span>
      <span className={`font-mono ${strong ? `font-bold ${color}` : "text-textMain"}`}>{value}</span>
    </div>
  );
};

const EmptyChart = ({ text = "Sin datos" }) => (
  <div className="h-full flex items-center justify-center text-textDim text-sm">{text}</div>
);
