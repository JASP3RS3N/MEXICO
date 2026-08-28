import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PackagePlus,
  Search,
  AlertTriangle,
  Clock,
  CloudOff,
  History,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import {
  Badge,
  Btn,
  Card,
  CardHead,
  EmptyState,
  Field,
  Input,
  PageLoader,
  Select,
  Textarea,
} from "@/components/kit";
import { fmtDateTime } from "@/lib/format";
import {
  DEFAULT_WMS_CONFIG,
  WMS_STATUS_COLORS,
  WMS_STATUS_LABELS,
  alertLevel,
  clearDraft,
  elapsedMinutes,
  formatMinutes,
  formatQty,
  isOpen,
  loadDraft,
  saveDraft,
} from "@/lib/wms";

const EMPTY_FORM = {
  part_number: "",
  description: "",
  quantity_requested: "",
  unit_of_measure: "",
  priority: "normal",
  notes: "",
};

const SEARCH_DEBOUNCE_MS = 250;

export default function Solicitudes() {
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState("");
  // El borrador se restaura al montar: si el backend se cayó o la tablet se
  // recargó a media captura, lo escrito sigue ahí.
  const [form, setForm] = useState(() => loadDraft("request_form", EMPTY_FORM));
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(false);
  const [tick, setTick] = useState(0);
  const searchTimer = useRef(null);

  const config = DEFAULT_WMS_CONFIG;

  // Reloj de 30 s: mantiene vivos los contadores de "hace cuánto la pedí".
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    saveDraft("request_form", form);
  }, [form]);

  const loadRequests = useCallback(async () => {
    try {
      const { data } = await api.get("/wms/requests/mine");
      setRequests(data);
      setOffline(false);
    } catch {
      // Sin conexión no se vacía la lista: se conserva lo último que llegó.
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api
      .get("/wms/locations")
      .then(({ data }) => {
        setLocations(data);
        if (data.length) setLocationId((current) => current || data[0].id);
      })
      .catch(() => toast.error("No se pudieron cargar las locaciones"));
    loadRequests();
    const timer = setInterval(loadRequests, 15000);
    return () => clearInterval(timer);
  }, [loadRequests]);

  // Autocompletado por número de parte o descripción contra el snapshot de SAP.
  useEffect(() => {
    const term = form.part_number.trim();
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!locationId || term.length < 2) {
      setResults([]);
      return undefined;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get(`/inventory/by-location/${locationId}`, {
          params: { q: term, limit: 8 },
        });
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(searchTimer.current);
  }, [form.part_number, locationId]);

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  const pickPart = (item) => {
    setForm((f) => ({
      ...f,
      part_number: item.part_number,
      description: item.description || "",
      unit_of_measure: item.unit_of_measure || "",
    }));
    setResults([]);
  };

  // Parte exacta ya elegida: se usa para avisar del stock antes de mandar.
  const selectedPart = useMemo(
    () => results.find((item) => item.part_number === form.part_number.trim().toUpperCase()),
    [results, form.part_number]
  );

  const quantity = Number(form.quantity_requested || 0);
  const stockWarning =
    selectedPart && quantity > 0 && Number(selectedPart.available_quantity) < quantity;

  const submit = async (event) => {
    event.preventDefault();
    if (!form.part_number.trim()) return toast.error("Indica el número de parte");
    if (!(quantity > 0)) return toast.error("La cantidad debe ser mayor a cero");

    setSaving(true);
    try {
      const { data } = await api.post("/wms/requests", {
        part_number: form.part_number.trim(),
        description: form.description.trim(),
        quantity_requested: quantity,
        unit_of_measure: form.unit_of_measure.trim(),
        location_id: locationId || undefined,
        priority: form.priority,
        notes: form.notes.trim(),
      });
      toast.success(`Solicitud ${data.folio} enviada a almacén`);
      // El borrador solo se limpia cuando el backend confirmó.
      clearDraft("request_form");
      setForm(EMPTY_FORM);
      setResults([]);
      loadRequests();
    } catch (err) {
      toast.error(
        err?.response?.data?.detail ||
          "No se pudo enviar la solicitud. Lo que escribiste quedó guardado, intenta de nuevo."
      );
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (request) => {
    try {
      await api.post(`/wms/requests/${request.id}/cancel`, { reason: "" });
      toast.success(`${request.folio} cancelada`);
      loadRequests();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo cancelar");
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Solicitar material"
        subtitle="Pide material a almacén y sigue el estatus de tus solicitudes"
        actions={
          offline ? (
            <Badge color="red">
              <CloudOff className="h-3.5 w-3.5" /> Sin conexión
            </Badge>
          ) : (
            <Badge color="green">{requests.filter(isOpen).length} abiertas</Badge>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* --- Formulario --- */}
        <Card className="lg:col-span-2 h-fit">
          <CardHead title="Nueva solicitud" subtitle="El stock de SAP es referencia, no bloquea" />
          <form onSubmit={submit} className="p-5 space-y-4">
            {locations.length > 1 && (
              <Field label="Locación / planta">
                <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code})
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <div className="relative">
              <Field label="Número de parte" hint="Escribe o escanea; la descripción se completa sola">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-textDim pointer-events-none" />
                  <Input
                    value={form.part_number}
                    onChange={set("part_number")}
                    placeholder="MAT-1001"
                    autoComplete="off"
                    className="pl-9 uppercase font-mono"
                  />
                </div>
              </Field>

              {results.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-surface border border-border rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                  {results.map((item) => (
                    <button
                      key={item.part_number}
                      type="button"
                      onClick={() => pickPart(item)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-surface2 border-b border-border last:border-0"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-sm text-textBright">{item.part_number}</span>
                        <span
                          className={`text-xs font-mono shrink-0 ${
                            Number(item.available_quantity) > 0 ? "text-cyan" : "text-red-400"
                          }`}
                        >
                          {formatQty(item.available_quantity, item.unit_of_measure)}
                        </span>
                      </div>
                      <p className="text-xs text-textDim truncate">{item.description}</p>
                    </button>
                  ))}
                </div>
              )}
              {searching && <p className="text-xs text-textDim mt-1">Buscando…</p>}
            </div>

            <Field label="Descripción">
              <Input value={form.description} onChange={set("description")} placeholder="Se completa al elegir la parte" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad">
                <Input
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  value={form.quantity_requested}
                  onChange={set("quantity_requested")}
                  placeholder="0"
                  className="font-mono"
                />
              </Field>
              <Field label="Unidad">
                <Input value={form.unit_of_measure} onChange={set("unit_of_measure")} placeholder="PZA" className="uppercase" />
              </Field>
            </div>

            {selectedPart && (
              <div
                className={`rounded-xl px-3.5 py-2.5 text-sm border ${
                  stockWarning
                    ? "bg-red-500/10 border-red-500/40 text-red-300"
                    : "bg-cyan-dim border-cyan/30 text-cyan"
                }`}
              >
                {stockWarning ? (
                  <span className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      SAP reporta{" "}
                      <b>{formatQty(selectedPart.available_quantity, selectedPart.unit_of_measure)}</b> en esta
                      locación, menos de lo que pides. Puedes enviarla igual: almacén decidirá si surte parcial.
                    </span>
                  </span>
                ) : (
                  <span>
                    Disponible en SAP:{" "}
                    <b>{formatQty(selectedPart.available_quantity, selectedPart.unit_of_measure)}</b>
                  </span>
                )}
              </div>
            )}

            <Field label="Prioridad">
              <Select value={form.priority} onChange={set("priority")}>
                <option value="normal">Normal</option>
                <option value="urgente">Urgente — se va al inicio de la cola</option>
              </Select>
            </Field>

            <Field label="Notas" hint="Opcional: línea, número de orden, referencia…">
              <Textarea value={form.notes} onChange={set("notes")} placeholder="" />
            </Field>

            <Btn type="submit" className="w-full" size="lg" loading={saving}>
              <PackagePlus className="h-5 w-5" /> Enviar a almacén
            </Btn>
          </form>
        </Card>

        {/* --- Historial propio --- */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <History className="h-4 w-4 text-textDim" />
            <h2 className="font-semibold text-textBright">Mis solicitudes</h2>
            <span className="text-textDim text-sm font-mono">({requests.length})</span>
          </div>

          {requests.length === 0 ? (
            <EmptyState
              icon={PackagePlus}
              title="Todavía no has pedido material"
              subtitle="Llena el formulario de la izquierda y tu solicitud aparecerá aquí y en el tablero de almacén."
            />
          ) : (
            requests.map((request) => {
              const level = alertLevel(request, config);
              const minutes = elapsedMinutes(request);
              return (
                <Card key={request.id} className="p-4" data-tick={tick}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-textBright">{request.folio}</span>
                        <Badge color={WMS_STATUS_COLORS[request.status]}>
                          {WMS_STATUS_LABELS[request.status]}
                        </Badge>
                        {request.priority === "urgente" && (
                          <Badge color="red">
                            <Zap className="h-3 w-3" /> Urgente
                          </Badge>
                        )}
                        {request.stock_risk && <Badge color="amber">Riesgo de quiebre</Badge>}
                      </div>
                      <p className="text-textBright mt-1.5">
                        <span className="font-mono">{request.part_number}</span>
                        {request.description ? ` · ${request.description}` : ""}
                      </p>
                      <p className="text-sm text-textDim mt-0.5">
                        Pedí {formatQty(request.quantity_requested, request.unit_of_measure)}
                        {request.quantity_fulfilled_total > 0 &&
                          ` · surtido ${formatQty(request.quantity_fulfilled_total, request.unit_of_measure)}`}
                        {request.claimed_by_name && ` · atiende ${request.claimed_by_name}`}
                      </p>
                      <p className="text-xs text-textDim mt-1">{fmtDateTime(request.requested_at)}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div
                        className={`flex items-center gap-1.5 font-mono text-sm ${
                          level === "red"
                            ? "text-red-400 font-bold"
                            : level === "yellow"
                            ? "text-amber-300"
                            : "text-textDim"
                        }`}
                      >
                        <Clock className="h-4 w-4" /> {formatMinutes(minutes)}
                      </div>
                      {isOpen(request) && (
                        <Btn variant="ghost" size="sm" onClick={() => cancel(request)} title="Cancelar solicitud">
                          <X className="h-4 w-4" />
                        </Btn>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
