import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  Clock,
  CloudOff,
  Hand,
  PackageCheck,
  Undo2,
  Warehouse,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Badge, Btn, Field, Input, Modal, PageLoader, Select, Textarea } from "@/components/kit";
import { fmtTime } from "@/lib/format";
import useTabAlert from "@/hooks/useTabAlert";
import {
  DEFAULT_WMS_CONFIG,
  alertLevel,
  elapsedMinutes,
  formatMinutes,
  formatQty,
  levelStyle,
} from "@/lib/wms";

const SOUND_KEY = "wms_sound_enabled";
// No se repite el tono más seguido que esto aunque sigan llegando atrasadas.
const SOUND_COOLDOWN_MS = 60000;

/** Tono corto con WebAudio: no hace falta cargar ni servir un archivo de audio. */
function playAlertTone() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.45);
    oscillator.onended = () => ctx.close();
  } catch {
    /* el navegador puede bloquear audio sin interacción previa: no es crítico */
  }
}

function RequestCard({ request, config, onClaim, onRelease, onFulfill, busy }) {
  const level = alertLevel(request, config);
  const style = levelStyle(level);
  const minutes = elapsedMinutes(request);
  const isRed = level === "red";
  const claimed = request.status === "en_proceso";

  return (
    <div className={`rounded-2xl border overflow-hidden ${style.card}`}>
      <div
        className={`flex items-center justify-between px-4 py-2.5 border-b ${
          isRed ? "border-red-400/60 bg-red-700/40" : "border-border bg-surface2"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`font-mono font-bold text-sm truncate ${isRed ? "text-white" : "text-textBright"}`}>
            {request.folio}
          </span>
          {request.priority === "urgente" && (
            <span
              className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                isRed ? "bg-white text-red-700" : "bg-red-500/20 text-red-300 border border-red-500/40"
              }`}
            >
              <Zap className="h-3 w-3" /> URGENTE
            </span>
          )}
        </div>
        <div className={`flex items-center gap-1.5 font-mono text-sm font-bold shrink-0 ${style.timer}`}>
          {isRed && <AlertTriangle className="h-4 w-4" />}
          <Clock className="h-4 w-4" /> {formatMinutes(minutes)}
        </div>
      </div>

      <div className="p-4 space-y-2">
        <p className={`font-mono font-semibold ${isRed ? "text-white" : "text-textBright"}`}>
          {request.part_number}
        </p>
        {request.description && (
          <p className={`text-sm ${isRed ? "text-red-100" : "text-textMain"}`}>{request.description}</p>
        )}

        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold font-mono ${isRed ? "text-white" : "text-amber-400"}`}>
            {formatQty(request.quantity_pending || request.quantity_requested, request.unit_of_measure)}
          </span>
          {request.quantity_fulfilled_total > 0 && (
            <span className={`text-xs ${isRed ? "text-red-100" : "text-textDim"}`}>
              (ya surtido {formatQty(request.quantity_fulfilled_total, request.unit_of_measure)} de{" "}
              {formatQty(request.quantity_requested, request.unit_of_measure)})
            </span>
          )}
        </div>

        {request.stock_risk && (
          <div
            className={`flex items-start gap-2 text-xs rounded-lg px-2.5 py-2 ${
              isRed ? "bg-red-800/60 text-white" : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Riesgo de quiebre: al pedirla, SAP reportaba{" "}
              {formatQty(request.available_stock_at_request, request.unit_of_measure)}.
            </span>
          </div>
        )}

        <p className={`text-xs ${isRed ? "text-red-100" : "text-textDim"}`}>
          Pidió {request.requested_by_name} · {fmtTime(request.requested_at)}
          {claimed && request.claimed_by_name && ` · tomó ${request.claimed_by_name}`}
        </p>
        {request.notes && (
          <p className={`text-xs italic ${isRed ? "text-red-100" : "text-textDim"}`}>Nota: {request.notes}</p>
        )}
      </div>

      <div className={`p-3 border-t flex gap-2 ${isRed ? "border-red-400/60" : "border-border"}`}>
        {!claimed ? (
          <Btn variant="primary" className="flex-1" loading={busy} onClick={() => onClaim(request)}>
            <Hand className="h-4 w-4" /> Tomar
          </Btn>
        ) : (
          <>
            <Btn variant="success" className="flex-1" onClick={() => onFulfill(request)}>
              <PackageCheck className="h-4 w-4" /> Surtir
            </Btn>
            <Btn variant="secondary" loading={busy} onClick={() => onRelease(request)} title="Regresar a la cola">
              <Undo2 className="h-4 w-4" />
            </Btn>
          </>
        )}
      </div>
    </div>
  );
}

function DoneCard({ request }) {
  const complete = request.status === "surtido_completo";
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 opacity-80">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-bold text-sm text-textBright truncate">{request.folio}</span>
        <Badge color={complete ? "green" : "purple"}>{complete ? "Completo" : "Parcial"}</Badge>
      </div>
      <p className="font-mono text-sm text-textMain mt-1.5">{request.part_number}</p>
      <p className="text-xs text-textDim mt-1">
        {formatQty(request.quantity_fulfilled_total, request.unit_of_measure)} de{" "}
        {formatQty(request.quantity_requested, request.unit_of_measure)} · {formatMinutes(request.minutes_elapsed)}
      </p>
      <p className="text-xs text-textDim mt-0.5">
        {request.claimed_by_name || "—"} · {fmtTime(request.closed_at)}
      </p>
    </div>
  );
}

export default function Almacen() {
  const [board, setBoard] = useState(null);
  const [config, setConfig] = useState(DEFAULT_WMS_CONFIG);
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [, setTick] = useState(0);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem(SOUND_KEY) !== "false");

  const [fulfillTarget, setFulfillTarget] = useState(null);
  const [fulfillQty, setFulfillQty] = useState("");
  const [fulfillNotes, setFulfillNotes] = useState("");
  const [fulfillClose, setFulfillClose] = useState(true);
  const [releaseTarget, setReleaseTarget] = useState(null);
  const [releaseReason, setReleaseReason] = useState("");
  const [stockDetail, setStockDetail] = useState(null);

  const lastSoundRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/wms/board", {
        params: locationId ? { location_id: locationId } : {},
      });
      setBoard(data);
      setConfig(data.config);
      setOffline(false);
    } catch {
      // Se conserva el último tablero conocido: mejor datos de hace 10 s que
      // una pantalla en blanco en medio del turno.
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    api.get("/wms/locations").then(({ data }) => setLocations(data)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, (config.poll_seconds || 8) * 1000);
    return () => clearInterval(timer);
  }, [load, config.poll_seconds]);

  // Reloj de 15 s: los cronómetros y el semáforo avanzan aunque el polling no
  // haya vuelto todavía.
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(timer);
  }, []);

  const openRequests = useMemo(() => {
    if (!board) return [];
    return [...board.columns.pendiente, ...board.columns.en_proceso];
  }, [board]);

  // El conteo de rojas se recalcula en el cliente para que una que acaba de
  // cruzar el umbral cuente sin esperar al siguiente polling.
  const redCount = useMemo(
    () => openRequests.filter((request) => alertLevel(request, config) === "red").length,
    [openRequests, config]
  );

  useTabAlert(redCount, "Almacén · Smokehouse OS");

  useEffect(() => {
    if (!soundOn || redCount === 0) return;
    const now = Date.now();
    if (now - lastSoundRef.current < SOUND_COOLDOWN_MS) return;
    lastSoundRef.current = now;
    playAlertTone();
  }, [redCount, soundOn]);

  const toggleSound = () => {
    setSoundOn((on) => {
      localStorage.setItem(SOUND_KEY, String(!on));
      return !on;
    });
  };

  const claim = async (request) => {
    setBusyId(request.id);
    try {
      await api.post(`/wms/requests/${request.id}/claim`);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo tomar la solicitud");
      load();
    } finally {
      setBusyId(null);
    }
  };

  const openFulfill = (request) => {
    setFulfillTarget(request);
    setFulfillQty(String(request.quantity_pending || request.quantity_requested));
    setFulfillNotes("");
    setFulfillClose(true);
    // Best-effort: si SAP no reporta la parte, el modal funciona igual.
    setStockDetail(null);
    api
      .get(`/inventory/part/${request.location_id}/${encodeURIComponent(request.part_number)}`)
      .then(({ data }) => setStockDetail(data))
      .catch(() => {});
  };

  const confirmFulfill = async () => {
    const quantity = Number(fulfillQty);
    if (!(quantity > 0)) return toast.error("La cantidad debe ser mayor a cero");
    setBusyId(fulfillTarget.id);
    try {
      const { data } = await api.post(`/wms/requests/${fulfillTarget.id}/fulfill`, {
        quantity_fulfilled: quantity,
        close_request: fulfillClose,
        notes: fulfillNotes.trim(),
      });
      toast.success(
        data.status === "surtido_completo"
          ? `${data.folio} surtida completa`
          : data.status === "surtido_parcial"
          ? `${data.folio} cerrada como surtido parcial`
          : `Entrega registrada en ${data.folio}`
      );
      setFulfillTarget(null);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo registrar el surtido");
    } finally {
      setBusyId(null);
    }
  };

  const confirmRelease = async () => {
    setBusyId(releaseTarget.id);
    try {
      await api.post(`/wms/requests/${releaseTarget.id}/release`, { reason: releaseReason.trim() });
      toast.success(`${releaseTarget.folio} regresó a la cola`);
      setReleaseTarget(null);
      setReleaseReason("");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo liberar");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <PageLoader />;
  if (!board) {
    return (
      <div>
        <PageHeader title="Almacén" />
        <p className="text-textDim">No se pudo cargar el tablero. Reintentando…</p>
      </div>
    );
  }

  const columns = [
    { key: "pendiente", title: "Pendiente", color: "text-blue", items: board.columns.pendiente },
    { key: "en_proceso", title: "En proceso", color: "text-amber-400", items: board.columns.en_proceso },
    { key: "surtido", title: "Surtido (12 h)", color: "text-cyan", items: board.columns.surtido },
  ];

  return (
    <div>
      <PageHeader
        title="Almacén"
        subtitle={`Cola de surtido · se actualiza cada ${config.poll_seconds}s · urgentes y más viejas primero`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {offline && (
              <Badge color="red">
                <CloudOff className="h-3.5 w-3.5" /> Sin conexión
              </Badge>
            )}
            {redCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-sm font-bold animate-pulse-alert">
                <AlertTriangle className="h-4 w-4" /> {redCount} atrasada{redCount > 1 ? "s" : ""}
              </span>
            )}
            {board.counts.stock_risk > 0 && (
              <Badge color="amber">{board.counts.stock_risk} con riesgo de quiebre</Badge>
            )}
            {locations.length > 1 && (
              <Select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-auto min-w-[180px]"
              >
                <option value="">Todas las locaciones</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </Select>
            )}
            <Btn
              variant={soundOn ? "secondary" : "ghost"}
              size="icon"
              onClick={toggleSound}
              title={soundOn ? "Silenciar alerta sonora" : "Activar alerta sonora"}
            >
              {soundOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </Btn>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {columns.map((column) => (
          <div key={column.key}>
            <div className="flex items-center gap-2 mb-3">
              {column.key === "surtido" ? (
                <CheckCircle2 className={`h-4 w-4 ${column.color}`} />
              ) : (
                <Warehouse className={`h-4 w-4 ${column.color}`} />
              )}
              <h2 className={`font-semibold ${column.color}`}>{column.title}</h2>
              <span className="text-textDim text-sm font-mono">({column.items.length})</span>
            </div>

            <div className="space-y-4">
              {column.items.map((request) =>
                column.key === "surtido" ? (
                  <DoneCard key={request.id} request={request} />
                ) : (
                  <RequestCard
                    key={request.id}
                    request={request}
                    config={config}
                    busy={busyId === request.id}
                    onClaim={claim}
                    onFulfill={openFulfill}
                    onRelease={setReleaseTarget}
                  />
                )
              )}
              {column.items.length === 0 && (
                <div className="text-center text-textDim text-sm py-8 border border-dashed border-border rounded-xl">
                  Vacío
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* --- Surtir (total o parcial) --- */}
      <Modal
        open={!!fulfillTarget}
        onClose={() => setFulfillTarget(null)}
        title={fulfillTarget ? `Surtir ${fulfillTarget.folio}` : ""}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setFulfillTarget(null)}>
              Cancelar
            </Btn>
            <Btn variant="success" loading={busyId === fulfillTarget?.id} onClick={confirmFulfill}>
              Registrar surtido
            </Btn>
          </>
        }
      >
        {fulfillTarget && (
          <div className="space-y-4">
            <div className="bg-surface2 rounded-xl p-3.5">
              <p className="font-mono text-textBright">{fulfillTarget.part_number}</p>
              <p className="text-sm text-textDim">{fulfillTarget.description}</p>
              <p className="text-sm text-textMain mt-1.5">
                Pidieron {formatQty(fulfillTarget.quantity_requested, fulfillTarget.unit_of_measure)}
                {fulfillTarget.quantity_fulfilled_total > 0 &&
                  ` · ya surtido ${formatQty(fulfillTarget.quantity_fulfilled_total, fulfillTarget.unit_of_measure)}`}
              </p>
              {/* Dónde está el material según el último export de SAP: evita
                  que el surtidor recorra el centro buscándolo. */}
              {stockDetail?.storage_locations?.length > 0 && (
                <p className="text-xs text-textDim mt-2">
                  Según SAP está en:{" "}
                  {stockDetail.storage_locations
                    .map((sl) => `almacén ${sl.code} (${formatQty(sl.quantity)})`)
                    .join(" · ")}
                </p>
              )}
            </div>

            <Field label="Cantidad entregada" hint="Puede ser menos de lo pedido (surtido parcial)">
              <Input
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                autoFocus
                value={fulfillQty}
                onChange={(e) => setFulfillQty(e.target.value)}
                className="text-2xl font-mono h-14"
              />
            </Field>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={fulfillClose}
                onChange={(e) => setFulfillClose(e.target.checked)}
                className="mt-1 h-4 w-4 accent-amber-500"
              />
              <span className="text-sm text-textMain">
                Cerrar la solicitud con esta entrega
                <span className="block text-xs text-textDim">
                  Desmarca si vas a completar el resto más tarde: la solicitud sigue en proceso a tu nombre.
                </span>
              </span>
            </label>

            <Field label="Notas" hint="Opcional: número de vale, quién recibió…">
              <Textarea value={fulfillNotes} onChange={(e) => setFulfillNotes(e.target.value)} />
            </Field>
          </div>
        )}
      </Modal>

      {/* --- Liberar de vuelta a la cola --- */}
      <Modal
        open={!!releaseTarget}
        onClose={() => setReleaseTarget(null)}
        title={releaseTarget ? `Regresar ${releaseTarget.folio} a la cola` : ""}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setReleaseTarget(null)}>
              Cancelar
            </Btn>
            <Btn variant="secondary" loading={busyId === releaseTarget?.id} onClick={confirmRelease}>
              Liberar
            </Btn>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-textMain">
            La solicitud vuelve a pendiente para que otra persona la tome. Queda registrado en la bitácora que tú
            la tenías, junto con lo que ya hubieras surtido.
          </p>
          <Field label="Motivo" hint="Opcional, pero ayuda a entender los atrasos">
            <Input
              value={releaseReason}
              onChange={(e) => setReleaseReason(e.target.value)}
              placeholder="Sin montacargas, material en otra ubicación…"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
