/**
 * Utilidades de periodos de quincena (alineadas con backend payrollCalculator).
 */

export const CUOTA_PATRONAL_RATE = 0.1067;
export const CUOTA_LABORAL_RATE = 0.0483;

export function getQuincenaDateRange(draftDateStr, periodType) {
  const d = draftDateStr ? new Date(draftDateStr) : new Date();
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
