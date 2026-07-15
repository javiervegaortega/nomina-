const Decimal = require('decimal.js');

/** Tasas oficiales IGSS Guatemala (fuente única) */
const CUOTA_PATRONAL_RATE = new Decimal('0.1067');
const CUOTA_LABORAL_RATE = new Decimal('0.0483');
const IVA_RATE = new Decimal('0.12');

/**
 * Indica si el empleado está exento de IGSS (jubilado u otro flag).
 * Jubilados no cotizan laboral ni generan cuota patronal sobre esa base.
 */
const isIgssExempt = (e) => !!(e && (e.jubilacion === true || e.jubilacion === 1 || e.igss_exempt === true));

/**
 * Costo empresa para facturación / reportes = bruto + cuota patronal.
 */
const getCompanyCost = (calculated) => {
  if (!calculated) return 0;
  const gross = new Decimal(calculated.gross || 0);
  const patronal = new Decimal(calculated.patronal || 0);
  return gross.plus(patronal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
};

/**
 * Rango de fechas de una quincena a partir de una fecha de referencia.
 * 1ra = días 1–15; 2da = 16–último día del mes.
 */
const getQuincenaDateRange = (draftDateStr, periodType) => {
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
};

/**
 * True si dateStr (YYYY-MM-DD) cae dentro del rango de la quincena.
 */
const isDateInQuincena = (dateStr, draftDateStr, periodType) => {
  if (!dateStr) return false;
  const parts = String(dateStr).slice(0, 10).split('-');
  if (parts.length < 3) return false;
  const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const { start, end } = getQuincenaDateRange(draftDateStr, periodType);
  return dt >= start && dt <= end;
};

/**
 * Calculates payroll details for a single employee based on exact decimals.
 * @param {Object} e - Employee object containing salaries, days, extras, deductions.
 * @param {string} periodType - e.g., '1ra', '2da', 'mensual'
 * @returns {Object} - The employee object updated with precise 'calculated' fields.
 */
const calculateEmployeePayroll = (e, periodType) => {
  const days = new Decimal(e.days || 30);
  const baseFactor = days.dividedBy(30);

  const sueldoOrd = new Decimal(e.sueldo_ordinario || 0);
  const bonInc = new Decimal(e.bon_incentivo || 0);
  const bonDec = new Decimal(e.bon_dec_37_2001 || 0);

  const baseSalary = sueldoOrd.times(baseFactor);
  const bonusLey = bonInc.times(baseFactor);
  const bonusDec = bonDec.times(baseFactor);

  const extrasBonos = new Decimal((e.extras && e.extras.bonos) || 0);
  const extrasSimples = new Decimal((e.extras && e.extras.simplesVal) || 0);
  const extrasDobles = new Decimal((e.extras && e.extras.doblesVal) || 0);
  const comisiones = new Decimal((e.extras && e.extras.comisiones) || 0);
  const otrosIngresos = new Decimal((e.extras && e.extras.otrosIngresos) || 0);

  const extrasTotal = extrasSimples.plus(extrasDobles).plus(comisiones).plus(otrosIngresos);

  const appliedBonusesValues = Object.values(e.appliedBonuses || {});
  let bonusesSum = new Decimal(0);
  for (const val of appliedBonusesValues) {
    bonusesSum = bonusesSum.plus(new Decimal(val || 0));
  }

  const gross = baseSalary.plus(bonusLey).plus(bonusDec).plus(extrasBonos).plus(extrasTotal).plus(bonusesSum);

  const exempt = isIgssExempt(e);
  // IGSS laboral y patronal = 0 para jubilados / exentos
  const igssValue = exempt
    ? new Decimal(0)
    : baseSalary.times(CUOTA_LABORAL_RATE).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const patronal = exempt
    ? new Decimal(0)
    : baseSalary.times(CUOTA_PATRONAL_RATE).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const currentDeductions = { ...(e.deductions || {}) };
  currentDeductions.igss = igssValue.toNumber();

  const proratedDeductions = { ...currentDeductions };
  for (const key in proratedDeductions) {
    if (key !== 'igss' && proratedDeductions[key]) {
      proratedDeductions[key] = new Decimal(proratedDeductions[key]).times(baseFactor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
    }
  }

  const deductionsValues = Object.values(proratedDeductions);
  let totalDeductions = new Decimal(0);
  for (const val of deductionsValues) {
    totalDeductions = totalDeductions.plus(new Decimal(val || 0));
  }

  // Anticipo 1ra (solo aplica en 2da; no prorratear)
  const anticipo1ra = new Decimal(e.anticipo1ra || 0);
  const net = gross.minus(totalDeductions);
  const netPayable = net.minus(anticipo1ra);

  const calculated = {
    proratedDeductions,
    baseSalary: baseSalary.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    bonusLey: bonusLey.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    bonusDec: bonusDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    bonos: extrasBonos.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    extrasTotal: extrasTotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    bonusesSum: bonusesSum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    gross: gross.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    ded: totalDeductions.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    net: net.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    anticipo1ra: anticipo1ra.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    netPayable: netPayable.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    patronal: patronal.toNumber(),
    companyCost: getCompanyCost({
      gross: gross.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      patronal: patronal.toNumber()
    }),
    igssExempt: exempt,
    hourlyRate: baseSalary.dividedBy(30).dividedBy(8).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    periodType: periodType || null
  };

  return {
    ...e,
    deductions: currentDeductions,
    calculated
  };
};

/**
 * Recalculates an entire array of employees
 */
const calculatePayrollBatch = (employees, periodType) => {
  return employees.map(emp => calculateEmployeePayroll(emp, periodType));
};

module.exports = {
  calculateEmployeePayroll,
  calculatePayrollBatch,
  getCompanyCost,
  isIgssExempt,
  getQuincenaDateRange,
  isDateInQuincena,
  CUOTA_PATRONAL_RATE,
  CUOTA_LABORAL_RATE,
  IVA_RATE
};
