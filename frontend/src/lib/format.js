// Formatting helpers (es-MX / MXN by default).

export const money = (n, currency = "MXN") =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(n || 0));

export const num = (n, digits = 0) =>
  new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(n || 0));

export const pct = (n) => `${num(n, 1)}%`;

export const fmtTime = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

export const fmtDate = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

export const fmtDateTime = (iso) =>
  iso ? `${fmtDate(iso)} ${fmtTime(iso)}` : "";

// Minutes elapsed since an ISO timestamp (for kitchen timers).
export const minsSince = (iso) => {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
};

// Local day boundaries as ISO strings, for finance queries.
export const dayRange = (date = new Date()) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
};

export const monthRange = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
  return { start: start.toISOString(), end: end.toISOString() };
};

export const todayInput = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};
