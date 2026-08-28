// Helpers del módulo WMS Producción ↔ Almacén.
//
// El semáforo se recalcula en el cliente cada segundo a partir de
// `requested_at`: el backend manda el nivel al momento de responder, pero una
// solicitud que se pinta amarilla no debe esperar al siguiente polling para
// ponerse roja.

export const WMS_STATUS_LABELS = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  surtido_parcial: "Surtido parcial",
  surtido_completo: "Surtido completo",
  cancelado: "Cancelado",
};

export const WMS_STATUS_COLORS = {
  pendiente: "blue",
  en_proceso: "amber",
  surtido_parcial: "purple",
  surtido_completo: "green",
  cancelado: "gray",
};

export const OPEN_STATUSES = ["pendiente", "en_proceso"];

export const isOpen = (req) => OPEN_STATUSES.includes(req?.status);

// Minutos transcurridos con decimales (minsSince de lib/format redondea a
// entero, y aquí el umbral se cruza a mitad de minuto).
export const minutesSince = (iso) => {
  if (!iso) return 0;
  const parsed = new Date(iso).getTime();
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, (Date.now() - parsed) / 60000);
};

// Minutos vividos por una solicitud: los ya transcurridos si sigue abierta, o
// los que tardó en cerrarse si ya se surtió.
export const elapsedMinutes = (req) => {
  if (!req?.requested_at) return 0;
  if (isOpen(req)) return minutesSince(req.requested_at);
  if (!req.closed_at) return req.minutes_elapsed || 0;
  const span = new Date(req.closed_at).getTime() - new Date(req.requested_at).getTime();
  return Number.isNaN(span) ? 0 : Math.max(0, span / 60000);
};

export const DEFAULT_WMS_CONFIG = {
  green_max_minutes: 20,
  yellow_max_minutes: 60,
  sla_minutes: 30,
  sound_alert_enabled: true,
  poll_seconds: 8,
  sap_sync_stale_minutes: 90,
};

// Verde 0–20 · amarillo 20–60 · rojo >60 (umbrales configurables por el admin).
export const alertLevel = (req, config = DEFAULT_WMS_CONFIG) => {
  if (!isOpen(req)) return null;
  const minutes = elapsedMinutes(req);
  if (minutes <= config.green_max_minutes) return "green";
  if (minutes <= config.yellow_max_minutes) return "yellow";
  return "red";
};

// Estilos de la tarjeta por nivel. El rojo es deliberadamente de alto
// contraste — fondo saturado, texto blanco y pulso — para que sea imposible
// pasarlo por alto de reojo desde el piso.
export const LEVEL_STYLES = {
  green: {
    card: "bg-surface border-border",
    accent: "text-cyan",
    timer: "text-textDim",
    label: "A tiempo",
  },
  yellow: {
    card: "bg-amber-500/10 border-amber-500/50",
    accent: "text-amber-300",
    timer: "text-amber-300",
    label: "Por vencer",
  },
  red: {
    card: "bg-red-600 border-red-400 text-white shadow-lg shadow-red-900/50 animate-pulse-alert",
    accent: "text-white",
    timer: "text-white",
    label: "Atrasada",
  },
};

export const levelStyle = (level) => LEVEL_STYLES[level] || LEVEL_STYLES.green;

// "1h 25m" para tiempos largos, "8m" para los cortos.
export const formatMinutes = (minutes) => {
  const total = Math.max(0, Math.floor(minutes || 0));
  if (total < 60) return `${total}m`;
  return `${Math.floor(total / 60)}h ${total % 60}m`;
};

export const formatQty = (value, unit) => {
  const number = Number(value || 0);
  // Las cantidades de SAP traen hasta 3 decimales; se ocultan si son cero.
  const text = Number.isInteger(number) ? String(number) : String(Number(number.toFixed(3)));
  return unit ? `${text} ${unit}` : text;
};

// ---------------------------------------------------------------------------
// Borradores locales (modo offline-friendly)
// ---------------------------------------------------------------------------
// Si el backend se cae a media captura, lo que el operador escribió no se
// pierde: vive en localStorage hasta que la solicitud se manda con éxito.
const DRAFT_PREFIX = "wms_draft_";

export const loadDraft = (key, fallback) => {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
};

export const saveDraft = (key, value) => {
  try {
    localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(value));
  } catch {
    /* cuota llena o modo privado: el borrador es una comodidad, no un requisito */
  }
};

export const clearDraft = (key) => {
  try {
    localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    /* ídem */
  }
};
