/**
 * Utilidades de periodos de quincena (alineadas con backend payrollCalculator).
 */

export const CUOTA_PATRONAL_RATE = 0.1067;
export const CUOTA_LABORAL_RATE = 0.0483;
export const CUOTA_LABORAL_JUBILADO_RATE = 0.03;

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) {
    return Number.isNaN(dateStr.getTime()) ? new Date() : dateStr;
  }
  const parts = String(dateStr).slice(0, 10).split('-');
  if (parts.length >= 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  return new Date(dateStr);
}

/** YYYY-MM-DD en calendario local (evita el desfase UTC de toISOString().slice). */
export function formatLocalDateKey(dateOrStr) {
  const d = dateOrStr instanceof Date && !Number.isNaN(dateOrStr.getTime())
    ? dateOrStr
    : parseLocalDate(dateOrStr);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Convierte YYYY-MM-DD (o ISO) a timestamp ISO preservando el día local.
 * Usa mediodía local para que la conversión a UTC no cambie el calendario
 * en zonas como America/Guatemala (UTC−6).
 */
export function toPayrollDateISO(dateStr) {
  if (!dateStr) {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    return now.toISOString();
  }
  const d = parseLocalDate(dateStr);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

/** Fecha de periodo para UI (día local, no UTC). */
export function formatPayrollDisplayDate(dateStr, locale) {
  if (!dateStr) return '';
  return parseLocalDate(dateStr).toLocaleDateString(locale);
}

/** Infere '1ra' o '2da' según el día del mes (1–15 → 1ra, 16–fin → 2da). */
export function inferPeriodTypeFromDate(dateStr) {
  const d = parseLocalDate(dateStr);
  return d.getDate() <= 15 ? '1ra' : '2da';
}

/** Normaliza companies del draft (array, JSON string u objeto) a un array. */
export function normalizeDraftCompanies(draftCompanies) {
  if (Array.isArray(draftCompanies)) return draftCompanies;
  if (typeof draftCompanies === 'string') {
    try {
      const parsed = JSON.parse(draftCompanies);
      return Array.isArray(parsed) ? parsed : (parsed != null ? [parsed] : []);
    } catch {
      return draftCompanies.trim() ? [draftCompanies] : [];
    }
  }
  if (draftCompanies != null && typeof draftCompanies === 'object') {
    return Object.values(draftCompanies);
  }
  return [];
}

/** Etiqueta corta: "1ra · Julio 2026" / "2da · Julio 2026". */
export function formatQuincenaLabel(dateStr) {
  if (!dateStr) return '';
  const d = parseLocalDate(dateStr);
  const period = inferPeriodTypeFromDate(dateStr);
  const monthName = MONTH_NAMES_ES[d.getMonth()] || '';
  return `${period} · ${monthName} ${d.getFullYear()}`;
}

/**
 * Busca un draft activo que coincida con empresa + quincena de la fecha.
 * companiesList: catálogo de empresas para resolver nombre/NIT → id.
 */
export function findMatchingActiveDraft(activePayrolls, dateStr, companyId, companiesList = []) {
  if (!dateStr || !companyId) return null;
  const drafts = Array.isArray(activePayrolls) ? activePayrolls : [];
  return drafts.find((draft) => {
    const draftRefDate = draft.createdAt || draft.draftDate || new Date().toISOString();
    const periodType = draft.periodType || '1ra';
    if (!isDateInQuincena(dateStr, draftRefDate, periodType)) return false;
    const draftCompanies = normalizeDraftCompanies(draft.companies);
    if (draftCompanies.length === 0) return false;
    return draftCompanies.some((c) => {
      const strC = String(c);
      if (strC === String(companyId)) return true;
      const compByName = companiesList.find(
        (comp) => comp.nombre_comercial === strC || comp.nit === strC || String(comp.id) === strC
      );
      return compByName && String(compByName.id) === String(companyId);
    });
  }) || null;
}

/** Título editable sugerido: "Segunda Quincena del mes de Julio 2026 - ECONACIONAL,S.A.". */
export function buildPayrollDraftTitle(dateStr, periodType, companyLabel = '') {
  const d = parseLocalDate(dateStr);
  const periodLabel = periodType === '2da' ? 'Segunda' : 'Primera';
  const monthName = MONTH_NAMES_ES[d.getMonth()] || '';
  const base = `${periodLabel} Quincena del mes de ${monthName} ${d.getFullYear()}`;
  const company = String(companyLabel || '').trim();
  return company ? `${base} - ${company}` : base;
}

export function getQuincenaDateRange(draftDateStr, periodType) {
  const d = parseLocalDate(draftDateStr);
  const year = d.getFullYear();
  const month = d.getMonth();
  if (periodType === '2da') {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return {
      start: new Date(year, month, 16),
      end: new Date(year, month, lastDay, 23, 59, 59)
    };
  }
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month, 15, 23, 59, 59)
  };
}

export function isDateInQuincena(dateStr, draftDateStr, periodType) {
  if (!dateStr) return false;
  const parts = String(dateStr).slice(0, 10).split('-');
  if (parts.length < 3) return false;
  const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const { start, end } = getQuincenaDateRange(draftDateStr, periodType);
  return dt >= start && dt <= end;
}

/** Líquido a pagar: neto del periodo menos anticipo de 1ra (si aplica). */
export function getNetPayable(emp, periodType) {
  const net = Number(emp?.calculated?.net ?? emp?.netTotal ?? 0);
  const anticipo = periodType === '2da' ? (Number(emp?.anticipo1ra) || Number(emp?.calculated?.anticipo1ra) || 0) : 0;
  if (emp?.calculated?.netPayable != null && periodType === '2da') {
    return Number(emp.calculated.netPayable);
  }
  return net - anticipo;
}

/**
 * Días calendario entre dos fechas (inclusive), opcionalmente intersectando con quincena.
 * remove7thDay: resta 1 por cada domingo en el rango efectivo.
 */
export function calcSuspensionDays({ startDate, endDate, draftDateStr, periodType, remove7thDay = false }) {
  if (!startDate || !endDate) return { daysTotal: 0, daysQuincena: 0 };

  const parse = (s) => {
    const p = String(s).slice(0, 10).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  };

  let start = parse(startDate);
  let end = parse(endDate);
  if (end < start) [start, end] = [end, start];

  const daysInclusive = (a, b) => Math.floor((b - a) / 86400000) + 1;

  const countSundays = (a, b) => {
    let n = 0;
    const cur = new Date(a);
    while (cur <= b) {
      if (cur.getDay() === 0) n += 1;
      cur.setDate(cur.getDate() + 1);
    }
    return n;
  };

  let daysTotal = daysInclusive(start, end);
  if (remove7thDay) daysTotal = Math.max(0, daysTotal - countSundays(start, end));

  let daysQuincena = daysTotal;
  if (draftDateStr && periodType) {
    const { start: qStart, end: qEnd } = getQuincenaDateRange(draftDateStr, periodType);
    const iStart = start > qStart ? start : qStart;
    const iEnd = end < qEnd ? end : qEnd;
    if (iStart > iEnd) {
      daysQuincena = 0;
    } else {
      daysQuincena = daysInclusive(iStart, iEnd);
      if (remove7thDay) daysQuincena = Math.max(0, daysQuincena - countSundays(iStart, iEnd));
    }
  }

  return { daysTotal, daysQuincena };
}
