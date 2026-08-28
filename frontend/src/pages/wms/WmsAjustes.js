import React, { useEffect, useState } from "react";
import { AlertTriangle, Building2, Check, Plus, RefreshCw, Save, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import {
  Badge,
  Btn,
  Card,
  CardHead,
  Field,
  Input,
  Modal,
  PageLoader,
  Toggle,
} from "@/components/kit";
import { fmtDateTime, num } from "@/lib/format";
import { DEFAULT_WMS_CONFIG, formatMinutes } from "@/lib/wms";

const SYNC_STATUS_LABELS = {
  success: { label: "Exitosa", color: "green" },
  partial: { label: "Parcial", color: "amber" },
  skipped: { label: "Sin cambios", color: "gray" },
  error: { label: "Error", color: "red" },
};

/** Vista previa del semáforo con los umbrales que el supervisor está editando. */
function ThresholdPreview({ config }) {
  const bands = [
    { label: "Verde · a tiempo", range: `0 – ${config.green_max_minutes} min`, className: "bg-cyan-dim text-cyan border-cyan/30" },
    {
      label: "Amarillo · por vencer",
      range: `${config.green_max_minutes} – ${config.yellow_max_minutes} min`,
      className: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    },
    {
      label: "Rojo · alto contraste",
      range: `más de ${config.yellow_max_minutes} min`,
      className: "bg-red-600 text-white border-red-400 animate-pulse-alert",
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {bands.map((band) => (
        <div key={band.label} className={`rounded-xl border px-3.5 py-3 ${band.className}`}>
          <p className="text-sm font-semibold">{band.label}</p>
          <p className="text-xs opacity-90 mt-0.5 font-mono">{band.range}</p>
        </div>
      ))}
    </div>
  );
}

export default function WmsAjustes() {
  const [config, setConfig] = useState(DEFAULT_WMS_CONFIG);
  const [locations, setLocations] = useState([]);
  const [logs, setLogs] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [newLocation, setNewLocation] = useState(null);

  const load = async () => {
    try {
      const [settings, locationRes, logRes, healthRes] = await Promise.all([
        api.get("/settings"),
        api.get("/wms/locations"),
        api.get("/inventory/sync-logs", { params: { limit: 15 } }),
        api.get("/inventory/sync-health"),
      ]);
      setConfig({ ...DEFAULT_WMS_CONFIG, ...(settings.data.wms_config || {}) });
      setLocations(locationRes.data);
      setLogs(logRes.data);
      setHealth(healthRes.data);
    } catch {
      toast.error("No se pudo cargar la configuración del WMS");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setNumber = (key) => (event) =>
    setConfig((c) => ({ ...c, [key]: Number(event.target.value || 0) }));

  const save = async () => {
    if (config.yellow_max_minutes <= config.green_max_minutes) {
      return toast.error("El umbral amarillo debe ser mayor al verde");
    }
    setSaving(true);
    try {
      await api.put("/settings", { wms_config: config });
      toast.success("Umbrales guardados. El tablero de almacén los toma en el siguiente refresco.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudieron guardar los umbrales");
    } finally {
      setSaving(false);
    }
  };

  const saveLocation = async () => {
    if (!newLocation.code.trim() || !newLocation.name.trim()) {
      return toast.error("El código y el nombre son obligatorios");
    }
    try {
      if (newLocation.id) {
        await api.put(`/wms/locations/${newLocation.id}`, {
          code: newLocation.code,
          name: newLocation.name,
          active: newLocation.active,
        });
      } else {
        await api.post("/wms/locations", newLocation);
      }
      setNewLocation(null);
      load();
      toast.success("Locación guardada");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo guardar la locación");
    }
  };

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
      toast.error(err?.response?.data?.detail || "No se pudo leer el export de SAP");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ajustes del WMS"
        subtitle="Umbrales del semáforo, locaciones y estado de la ingesta de SAP"
        actions={
          <Btn loading={saving} onClick={save}>
            <Save className="h-4 w-4" /> Guardar umbrales
          </Btn>
        }
      />

      {/* --- Umbrales --- */}
      <Card>
        <CardHead
          title="Semáforo y SLA"
          subtitle="Se aplican al tablero de almacén y a las alertas de solicitudes atrasadas"
          action={<SlidersHorizontal className="h-5 w-5 text-amber-400" />}
        />
        <div className="p-5 space-y-5">
          <ThresholdPreview config={config} />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Verde hasta (min)" hint="Todo lo que se surta antes va sin marcar">
              <Input
                type="number"
                min="1"
                value={config.green_max_minutes}
                onChange={setNumber("green_max_minutes")}
                className="font-mono"
              />
            </Field>
            <Field label="Amarillo hasta (min)" hint="Pasado esto se pinta rojo de alto contraste">
              <Input
                type="number"
                min="2"
                value={config.yellow_max_minutes}
                onChange={setNumber("yellow_max_minutes")}
                className="font-mono"
              />
            </Field>
            <Field label="Meta de SLA (min)" hint="Base del % de solicitudes dentro de SLA">
              <Input
                type="number"
                min="1"
                value={config.sla_minutes}
                onChange={setNumber("sla_minutes")}
                className="font-mono"
              />
            </Field>
            <Field label="Refresco del tablero (seg)" hint="Entre 3 y 120 segundos">
              <Input
                type="number"
                min="3"
                max="120"
                value={config.poll_seconds}
                onChange={setNumber("poll_seconds")}
                className="font-mono"
              />
            </Field>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-1">
            <Toggle
              checked={config.sound_alert_enabled}
              onChange={(value) => setConfig((c) => ({ ...c, sound_alert_enabled: value }))}
              label="Alerta sonora al haber solicitudes en rojo"
            />
            <Field label="" className="sm:ml-auto sm:w-64">
              <div className="flex items-center gap-2">
                <span className="text-sm text-textMain whitespace-nowrap">Ingesta SAP caída tras</span>
                <Input
                  type="number"
                  min="5"
                  value={config.sap_sync_stale_minutes}
                  onChange={setNumber("sap_sync_stale_minutes")}
                  className="font-mono w-24"
                />
                <span className="text-sm text-textDim">min</span>
              </div>
            </Field>
          </div>
          <p className="text-xs text-textDim">
            Cada operador de almacén puede silenciar el tono en su propia pantalla; este interruptor define el valor
            con el que arranca.
          </p>
        </div>
      </Card>

      {/* --- Locaciones --- */}
      <Card>
        <CardHead
          title="Locaciones / plantas"
          subtitle="La ingesta de SAP da de alta sola las que aparezcan en el export; aquí puedes renombrarlas"
          action={
            <Btn
              variant="secondary"
              size="sm"
              onClick={() => setNewLocation({ code: "", name: "", active: true })}
            >
              <Plus className="h-4 w-4" /> Nueva
            </Btn>
          }
        />
        <div className="p-5 space-y-2">
          {locations.length === 0 ? (
            <p className="text-textDim text-sm">
              Todavía no hay locaciones. Se crearán solas con la primera sincronización de SAP, o puedes agregarlas
              a mano.
            </p>
          ) : (
            locations.map((location) => (
              <div
                key={location.id}
                className="flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-textDim shrink-0" />
                    <span className="text-textBright font-medium truncate">{location.name}</span>
                    <span className="font-mono text-xs text-textDim">{location.code}</span>
                    {!location.active && <Badge color="gray">Inactiva</Badge>}
                    {location.source === "sap_import" && <Badge color="blue">Desde SAP</Badge>}
                  </div>
                </div>
                <Btn variant="ghost" size="sm" onClick={() => setNewLocation({ ...location })}>
                  Editar
                </Btn>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* --- Ingesta SAP --- */}
      <Card>
        <CardHead
          title="Ingesta de inventario SAP"
          subtitle="Solo lectura: la app lee el export de MB52 y nunca escribe hacia SAP"
          action={
            <Btn variant="secondary" size="sm" loading={syncing} onClick={runSync}>
              <RefreshCw className="h-4 w-4" /> Sincronizar ahora
            </Btn>
          }
        />
        <div className="p-5 space-y-4">
          {health && (
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                color={
                  health.status === "ok"
                    ? "green"
                    : health.status === "stale" || health.status === "never"
                    ? "red"
                    : "amber"
                }
              >
                {health.status === "ok" ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                {health.status === "ok"
                  ? "Al día"
                  : health.status === "stale"
                  ? "Desactualizada"
                  : health.status === "never"
                  ? "Nunca ha corrido"
                  : "Con errores"}
              </Badge>
              <span className="text-sm text-textDim">
                {health.minutes_since_last_success === null
                  ? "Sin sincronizaciones exitosas."
                  : `Última exitosa hace ${formatMinutes(health.minutes_since_last_success)}.`}
              </span>
              <span className="text-sm text-textDim">{num(health.parts_tracked)} partes registradas.</span>
              <span className="text-xs font-mono text-textDim truncate">{health.export_path}</span>
            </div>
          )}

          {logs.length === 0 ? (
            <p className="text-textDim text-sm">Todavía no hay corridas registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-textDim text-xs uppercase tracking-wider">
                    <th className="text-left pb-2 font-medium">Fecha</th>
                    <th className="text-left pb-2 font-medium">Archivo</th>
                    <th className="text-left pb-2 font-medium">Origen</th>
                    <th className="text-right pb-2 font-medium">Filas</th>
                    <th className="text-right pb-2 font-medium">Partes</th>
                    <th className="text-right pb-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const tone = SYNC_STATUS_LABELS[log.status] || SYNC_STATUS_LABELS.error;
                    return (
                      <tr key={log.id} className="border-t border-border">
                        <td className="py-2.5 text-textMain whitespace-nowrap">{fmtDateTime(log.started_at)}</td>
                        <td className="py-2.5 font-mono text-xs text-textDim truncate max-w-[200px]">
                          {log.source_file || "—"}
                        </td>
                        <td className="py-2.5 text-textDim text-xs">
                          {log.trigger === "manual" ? "Manual" : "Automática"}
                        </td>
                        <td className="py-2.5 text-right font-mono text-textMain">{num(log.rows_read)}</td>
                        <td className="py-2.5 text-right font-mono text-textMain">{num(log.rows_upserted)}</td>
                        <td className="py-2.5 text-right">
                          <Badge color={tone.color}>{tone.label}</Badge>
                          {log.error && (
                            <p className="text-xs text-red-400 mt-1 max-w-[260px] ml-auto text-right">{log.error}</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={!!newLocation}
        onClose={() => setNewLocation(null)}
        title={newLocation?.id ? "Editar locación" : "Nueva locación"}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setNewLocation(null)}>
              Cancelar
            </Btn>
            <Btn onClick={saveLocation}>Guardar</Btn>
          </>
        }
      >
        {newLocation && (
          <div className="space-y-4">
            <Field
              label="Código"
              hint="El centro de SAP (WERKS), o centro/almacén si usas SAP_LOCATION_MODE=plant_sloc"
            >
              <Input
                value={newLocation.code}
                onChange={(e) => setNewLocation((l) => ({ ...l, code: e.target.value }))}
                placeholder="1000/0001"
                className="font-mono uppercase"
              />
            </Field>
            <Field label="Nombre visible">
              <Input
                value={newLocation.name}
                onChange={(e) => setNewLocation((l) => ({ ...l, name: e.target.value }))}
                placeholder="Planta 1000 · Almacén 0001"
              />
            </Field>
            <Toggle
              checked={newLocation.active !== false}
              onChange={(value) => setNewLocation((l) => ({ ...l, active: value }))}
              label="Activa"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
