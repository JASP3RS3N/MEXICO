import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  PackageX,
  RefreshCw,
  Timer,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import api, { getToken } from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Badge, Btn, Card, CardHead, PageLoader, Select, Stat } from "@/components/kit";
import { fmtDateTime, num } from "@/lib/format";
import { formatMinutes } from "@/lib/wms";

const tooltipStyle = {
  contentStyle: {
    background: "#0d1420",
    border: "1px solid #1e3050",
    borderRadius: 12,
    color: "#e8edf2",
  },
  labelStyle: { color: "#5a6d82" },
};

const PERIODS = [
  { key: "7d", label: "7 días", days: 7 },
  { key: "30d", label: "30 días", days: 30 },
  { key: "90d", label: "90 días", days: 90 },
];

function rangeFor(days) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

const isoDate = (iso) => (iso || "").slice(0, 10);

function SyncHealthCard({ health, onSync, syncing }) {
  if (!health) return null;
  const tone =
    health.status === "ok"
      ? { color: "green", label: "Sincronizando bien", icon: CheckCircle2 }
      : health.status === "stale"
      ? { color: "red", label: "Desactualizado", icon: AlertTriangle }
      : health.status === "never"
      ? { color: "gray", label: "Nunca ha corrido", icon: AlertTriangle }
      : { color: "amber", label: "Con errores", icon: AlertTriangle };
  const Icon = tone.icon;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon
              className={`h-5 w-5 ${
                tone.color === "green" ? "text-cyan" : tone.color === "red" ? "text-red-400" : "text-amber-400"
              }`}
            />
            <h3 className="text-textBright font-semibold">Ingesta de inventario SAP</h3>
            <Badge color={tone.color}>{tone.label}</Badge>
          </div>
          <p className="text-sm text-textDim mt-2">
            {health.minutes_since_last_success === null
              ? "Todavía no hay una sincronización exitosa. Revisa que el script de SAP esté dejando el archivo en la carpeta configurada."
              : `Última sincronización exitosa hace ${formatMinutes(
                  health.minutes_since_last_success
                )} · se considera caída después de ${formatMinutes(health.stale_after_minutes)}.`}
          </p>
          <p className="text-xs text-textDim mt-1 font-mono truncate">{health.export_path}</p>
          {health.last_run && (
            <p className="text-xs text-textDim mt-1">
              Última corrida: {fmtDateTime(health.last_run.started_at)} · {health.last_run.status}
              {health.last_run.source_file ? ` · ${health.last_run.source_file}` : ""}
              {health.last_run.error ? ` · ${health.last_run.error}` : ""}
            </p>
          )}
          <p className="text-xs text-textDim mt-1">{num(health.parts_tracked)} partes con existencia registrada.</p>
        </div>
        <Btn variant="secondary" size="sm" loading={syncing} onClick={onSync} className="shrink-0">
          <RefreshCw className="h-4 w-4" /> Sincronizar
        </Btn>
      </div>
    </Card>
  );
}

export default function WmsDashboard() {
  const [period, setPeriod] = useState("30d");
  const [locationId, setLocationId] = useState("");
  const [locations, setLocations] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [requesters, setRequesters] = useState([]);
  const [partials, setPartials] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const range = useMemo(() => rangeFor(PERIODS.find((p) => p.key === period).days), [period]);

  const load = useCallback(async () => {
    const params = { start: range.start, end: range.end };
    if (locationId) params.location_id = locationId;
    try {
      const [kpiRes, leaderRes, requesterRes, partialRes, healthRes] = await Promise.all([
        api.get("/wms/kpis", { params }),
        api.get("/wms/leaderboard", { params }),
        api.get("/wms/requesters", { params }),
        api.get("/wms/partial-fulfillments", { params }),
        api.get("/inventory/sync-health"),
      ]);
      setKpis(kpiRes.data);
      setLeaderboard(leaderRes.data.rows);
      setRequesters(requesterRes.data.rows);
      setPartials(partialRes.data.rows);
      setHealth(healthRes.data);
    } catch {
      toast.error("No se pudieron cargar los indicadores");
    } finally {
      setLoading(false);
    }
  }, [range, locationId]);

  useEffect(() => {
    api.get("/wms/locations").then(({ data }) => setLocations(data)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runSync = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post("/inventory/sync");
      toast.success(
        data.status === "skipped"
          ? "El archivo no ha cambiado desde la última sincronización"
          : `${num(data.rows_upserted)} partes actualizadas desde ${data.source_file}`
      );
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo sincronizar con el export de SAP");
    } finally {
      setSyncing(false);
    }
  };

  // El .xlsx se baja con fetch (no con <a href>) porque la ruta va autenticada
  // con el Bearer token, que un enlace directo no puede mandar.
  const downloadExcel = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams({
        from: isoDate(range.start),
        to: isoDate(range.end),
      });
      if (locationId) params.set("location_id", locationId);

      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL || ""}/api/wms/export/excel?${params}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      if (!response.ok) throw new Error("export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `wms_${isoDate(range.start)}_${isoDate(range.end)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("No se pudo generar el archivo de Excel");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!kpis) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Desempeño de surtido"
        subtitle="Producción ↔ Almacén · tiempos, SLA y quiebres de stock"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {locations.length > 1 && (
              <Select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-auto min-w-[170px]"
              >
                <option value="">Todas las locaciones</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </Select>
            )}
            <div className="flex bg-surface2 border border-border rounded-lg p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    period === p.key ? "bg-amber-500/20 text-amber-300" : "text-textDim hover:text-textBright"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Btn variant="secondary" loading={downloading} onClick={downloadExcel}>
              <Download className="h-4 w-4" /> Excel
            </Btn>
          </div>
        }
      />

      {/* --- Tarjetas de resumen --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat
          label="Solicitudes"
          value={num(kpis.totals.requests)}
          sub={`${num(kpis.totals.closed)} surtidas · ${num(kpis.totals.open)} abiertas`}
          icon={Activity}
        />
        <Stat
          label="Tiempo mediano"
          value={formatMinutes(kpis.response_minutes.median)}
          sub={`promedio ${formatMinutes(kpis.response_minutes.avg)} · máx ${formatMinutes(
            kpis.response_minutes.max
          )}`}
          icon={Timer}
          accent="blue"
        />
        <Stat
          label={`Dentro de SLA (${kpis.sla.target_minutes} min)`}
          value={`${num(kpis.sla.pct_within, 1)}%`}
          sub={`${num(kpis.sla.within)} a tiempo · ${num(kpis.sla.outside)} fuera`}
          icon={CheckCircle2}
          accent={kpis.sla.pct_within >= 90 ? "green" : kpis.sla.pct_within >= 70 ? "amber" : "red"}
        />
        <Stat
          label="Surtido vs solicitado"
          value={`${num(kpis.quantities.fill_rate_pct, 1)}%`}
          sub={`${num(kpis.totals.partial)} parciales · ${num(kpis.totals.urgent)} urgentes`}
          icon={PackageX}
          accent={kpis.quantities.fill_rate_pct >= 95 ? "green" : "amber"}
        />
      </div>

      <SyncHealthCard health={health} onSync={runSync} syncing={syncing} />

      {/* --- Serie diaria --- */}
      <Card>
        <CardHead title="Volumen y tiempo de respuesta por día" subtitle="Solicitudes levantadas vs minutos promedio" />
        <div className="p-5 h-72">
          {kpis.series.length === 0 ? (
            <p className="text-textDim text-sm">Sin solicitudes en este periodo.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={kpis.series}>
                <defs>
                  <linearGradient id="wmsVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3050" />
                <XAxis dataKey="date" stroke="#5a6d82" fontSize={11} tickFormatter={(d) => d.slice(5)} />
                <YAxis stroke="#5a6d82" fontSize={11} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value, name) =>
                    name === "avg_minutes" ? [`${num(value, 1)} min`, "Minutos promedio"] : [num(value), "Solicitudes"]
                  }
                />
                <Area type="monotone" dataKey="requests" stroke="#f59e0b" fill="url(#wmsVolume)" strokeWidth={2} />
                <Area type="monotone" dataKey="avg_minutes" stroke="#0ea5e9" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* --- Leaderboard de almacén --- */}
        <Card>
          <CardHead
            title="Ranking de surtidores"
            subtitle="Ordenado por solicitudes atendidas; el tiempo de surtido no cuenta la espera en cola"
            action={<Trophy className="h-5 w-5 text-amber-400" />}
          />
          <div className="p-5 overflow-x-auto">
            {leaderboard.length === 0 ? (
              <p className="text-textDim text-sm">Sin surtidos en este periodo.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-textDim text-xs uppercase tracking-wider">
                    <th className="text-left pb-2 font-medium">Surtidor</th>
                    <th className="text-right pb-2 font-medium">Solicitudes</th>
                    <th className="text-right pb-2 font-medium">Cantidad</th>
                    <th className="text-right pb-2 font-medium">Mediana</th>
                    <th className="text-right pb-2 font-medium">Surtido</th>
                    <th className="text-right pb-2 font-medium">SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row, index) => (
                    <tr key={row.user_id} className="border-t border-border">
                      <td className="py-2.5 text-textBright">
                        <span className="text-textDim font-mono mr-2">{index + 1}.</span>
                        {row.name}
                      </td>
                      <td className="py-2.5 text-right font-mono text-textMain">{num(row.requests_served)}</td>
                      <td className="py-2.5 text-right font-mono text-textMain">{num(row.quantity_fulfilled, 1)}</td>
                      <td className="py-2.5 text-right font-mono text-textMain">
                        {formatMinutes(row.median_response_minutes)}
                      </td>
                      <td className="py-2.5 text-right font-mono text-textDim">
                        {formatMinutes(row.median_handling_minutes)}
                      </td>
                      <td className="py-2.5 text-right">
                        <span
                          className={`font-mono ${
                            row.pct_within_sla >= 90
                              ? "text-cyan"
                              : row.pct_within_sla >= 70
                              ? "text-amber-300"
                              : "text-red-400"
                          }`}
                        >
                          {num(row.pct_within_sla, 0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* --- Actividad de Producción --- */}
        <Card>
          <CardHead
            title="Quién solicita"
            subtitle="Una proporción alta de urgentes repetidas suele ser planeación de turno, no lentitud de almacén"
            action={<Users className="h-5 w-5 text-blue" />}
          />
          <div className="p-5 space-y-3">
            {requesters.length === 0 ? (
              <p className="text-textDim text-sm">Sin solicitudes en este periodo.</p>
            ) : (
              requesters.map((row) => (
                <div key={row.user_id} className="border-b border-border last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-textBright font-medium">{row.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-sm text-textMain">{num(row.requests)} solicitudes</span>
                      {row.pct_urgent >= 40 && <Badge color="red">{num(row.pct_urgent, 0)}% urgentes</Badge>}
                    </div>
                  </div>
                  <p className="text-xs text-textDim mt-1">
                    {num(row.requests_per_active_day, 1)} por día activo · espera promedio{" "}
                    {formatMinutes(row.avg_wait_minutes)}
                  </p>
                  {row.repeated_urgent_parts.length > 0 && (
                    <p className="text-xs text-amber-300/90 mt-1">
                      Urgentes repetidas:{" "}
                      {row.repeated_urgent_parts
                        .map((part) => `${part.part_number} (${part.urgent_count}×)`)
                        .join(", ")}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* --- Quiebres de stock --- */}
      <Card>
        <CardHead
          title="Surtidos parciales por número de parte"
          subtitle="Una parte que se surte parcial una y otra vez es un quiebre de stock, no un problema de la persona"
          action={<AlertTriangle className="h-5 w-5 text-amber-400" />}
        />
        <div className="p-5">
          {partials.length === 0 ? (
            <p className="text-textDim text-sm">
              Ninguna parte se surtió parcial en este periodo. 👍
            </p>
          ) : (
            <>
              <div className="h-56 mb-5">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={partials.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3050" />
                    <XAxis dataKey="part_number" stroke="#5a6d82" fontSize={10} interval={0} angle={-20} height={50} textAnchor="end" />
                    <YAxis stroke="#5a6d82" fontSize={11} />
                    <Tooltip
                      {...tooltipStyle}
                      cursor={{ fill: "#ffffff08" }}
                      formatter={(value) => [num(value, 1), "Faltante"]}
                    />
                    <Bar dataKey="shortfall" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-textDim text-xs uppercase tracking-wider">
                      <th className="text-left pb-2 font-medium">Parte</th>
                      <th className="text-left pb-2 font-medium">Descripción</th>
                      <th className="text-right pb-2 font-medium">Parciales</th>
                      <th className="text-right pb-2 font-medium">Solicitado</th>
                      <th className="text-right pb-2 font-medium">Surtido</th>
                      <th className="text-right pb-2 font-medium">Faltante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partials.map((row) => (
                      <tr key={row.part_number} className="border-t border-border">
                        <td className="py-2.5 font-mono text-textBright">{row.part_number}</td>
                        <td className="py-2.5 text-textDim truncate max-w-[220px]">{row.description}</td>
                        <td className="py-2.5 text-right font-mono text-amber-300">
                          {num(row.partial_count)} / {num(row.requests)}
                        </td>
                        <td className="py-2.5 text-right font-mono text-textMain">{num(row.quantity_requested, 1)}</td>
                        <td className="py-2.5 text-right font-mono text-textMain">{num(row.quantity_fulfilled, 1)}</td>
                        <td className="py-2.5 text-right font-mono text-red-400">{num(row.shortfall, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </Card>

      <p className="text-xs text-textDim flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        Periodo {isoDate(kpis.range.start)} → {isoDate(kpis.range.end)}. El inventario mostrado proviene del export de
        SAP y es solo de referencia: este sistema no escribe nada en SAP.
      </p>
    </div>
  );
}
