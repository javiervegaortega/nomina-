const Decimal = require('decimal.js');

/** Tasas oficiales IGSS Guatemala (fuente única) */
const CUOTA_PATRONAL_RATE = new Decimal('0.1067');
const CUOTA_LABORAL_RATE = new Decimal('0.0483');
/** Cuota laboral reducida para jubilados que siguen laborando */
const CUOTA_LABORAL_JUBILADO_RATE = new Decimal('0.03');
/** IRTRA 1% + INTECAP 1% — el Excel de nómina los incluye en la cuota patronal (12.67%) */
const IRTRA_INTECAP_RATE = new Decimal('0.02');
const IVA_RATE = new Decimal('0.12');

const isJubilado = (e) => !!(e && (e.jubilacion === true || e.jubilacion === 1));

/**
 * Exento total de IGSS (flag explícito). Los jubilados NO son exentos: cotizan 3% laboral.
 * Sin cuota patronal / IRTRA-INTECAP cuando es jubilado o exento.
 */
const isIgssExempt = (e) => !!(e && (e.igss_exempt === true || e.igss_exempt === 1));
const skipsIgssPatronal = (e) => isJubilado(e) || isIgssExempt(e);

/** Tasa laboral aplicable: 0 (exento), 3% (jubilado) o 4.83% (normal). */
const getCuotaLaboralRate = (e) => {
  if (isIgssExempt(e)) return new Decimal(0);
  if (isJubilado(e)) return CUOTA_LABORAL_JUBILADO_RATE;
  return CUOTA_LABORAL_RATE;
};

/**
 * Costo empresa para facturación / reportes = bruto + cuota patronal.
 */
const getCompanyCost = (calculated) => {
  if (!calculated) return 0;
  const gross = new Decimal(calculated.gross || 0);
  const patronal = new Decimal(calculated.patronal || 0);
  const irtraIntecap = new Decimal(calculated.irtraIntecap || 0);
  return gross.plus(patronal).plus(irtraIntecap).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
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

  // Extras de período (+ backfill maestro para borradores antiguos)
  const extrasObj = { ...(e.extras || {}) };
  if (extrasObj.vacacionesVal == null && new Decimal(e.vacaciones || 0).gt(0)) {
    extrasObj.vacacionesVal = new Decimal(e.vacaciones).times(baseFactor)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }
  if (extrasObj.ventasEconomicas == null && new Decimal(e.ventas_economicas || 0).gt(0)) {
    extrasObj.ventasEconomicas = new Decimal(e.ventas_economicas).times(baseFactor)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  const extrasBonos = new Decimal(extrasObj.bonos || 0);
  const extrasSimples = new Decimal(extrasObj.simplesVal || 0);
  const extrasDobles = new Decimal(extrasObj.doblesVal || 0);
  const comisiones = new Decimal(extrasObj.comisiones || 0);
  const otrosIngresos = new Decimal(extrasObj.otrosIngresos || 0);
  const vacacionesVal = new Decimal(extrasObj.vacacionesVal || 0);
  const ventasEconomicas = new Decimal(extrasObj.ventasEconomicas || 0);

  const extrasTotal = extrasSimples
    .plus(extrasDobles)
    .plus(comisiones)
    .plus(otrosIngresos)
    .plus(vacacionesVal)
    .plus(ventasEconomicas);

  const appliedBonusesValues = Object.values(e.appliedBonuses || {});
  let bonusesSum = new Decimal(0);
  for (const val of appliedBonusesValues) {
    bonusesSum = bonusesSum.plus(new Decimal(val || 0));
  }

  const gross = baseSalary.plus(bonusLey).plus(bonusDec).plus(extrasBonos).plus(extrasTotal).plus(bonusesSum);

  // Base afecta al IGSS: todo lo devengado excepto bonificación decreto/incentivo
  // (igual que el Excel: sueldo + hrs extra + comisiones + otros)
  const igssBase = baseSalary.plus(extrasTotal).plus(extrasBonos).plus(bonusesSum);

  const laboralRate = getCuotaLaboralRate(e);
  const noPatronal = skipsIgssPatronal(e);
  const igssValue = laboralRate.isZero()
    ? new Decimal(0)
    : igssBase.times(laboralRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const patronal = noPatronal
    ? new Decimal(0)
    : igssBase.times(CUOTA_PATRONAL_RATE).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const irtraIntecap = noPatronal
    ? new Decimal(0)
    : igssBase.times(IRTRA_INTECAP_RATE).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // ISR: manda el valor del maestro del empleado (retención mensual definida por
  // contabilidad, como en el Excel). La fórmula 5%-7% es solo fallback/sugerencia.
  // En 2ª quincena: ISR periodo = Total ISR − ISR ya retenido en 1ª.
  const { calculateMonthlyISR } = require('./isr.service');
  const hasMasterIsr = e.isr !== undefined && e.isr !== null && e.isr !== '';
  const monthlyIsr = hasMasterIsr
    ? (Number(e.isr) || 0)
    : calculateMonthlyISR(sueldoOrd.toNumber(), bonDec.toNumber());

  const isSecondQuincena = periodType === '2da'
    || e.totalIsr !== undefined
    || e.isr1ra !== undefined;
  let isrValue;
  if (isSecondQuincena) {
    const totalIsr = new Decimal(
      e.totalIsr !== undefined && e.totalIsr !== null && e.totalIsr !== ''
        ? e.totalIsr
        : monthlyIsr
    );
    const isr1ra = new Decimal(e.isr1ra || 0);
    isrValue = Decimal.max(0, totalIsr.minus(isr1ra))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  } else {
    isrValue = new Decimal(monthlyIsr)
      .times(baseFactor)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  const currentDeductions = { ...(e.deductions || {}) };
  currentDeductions.igss = igssValue.toNumber();
  currentDeductions.isr = isrValue.toNumber();

  // Backfill Bantrab/bancos/préstamo/otros desde maestro (borradores antiguos sin cablear)
  const masterBancos = new Decimal(e.bantrab || 0).plus(e.bancos || 0);
  if (masterBancos.gt(0) && !(new Decimal(currentDeductions.bancos || 0).gt(0))) {
    currentDeductions.bancos = masterBancos
      .times(baseFactor)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();
  }
  if (!Object.prototype.hasOwnProperty.call(currentDeductions, 'prestamo_empresa')
      && new Decimal(e.prestamo_empresa || 0).gt(0)) {
    currentDeductions.prestamo_empresa = new Decimal(e.prestamo_empresa)
      .times(baseFactor)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();
  }
  const masterOtros = new Decimal(e.otros_egresos || 0).plus(e.otro_descuentos || 0);
  if (masterOtros.gt(0) && !(new Decimal(currentDeductions.otros_egresos || 0).gt(0))) {
    currentDeductions.otros_egresos = masterOtros
      .times(baseFactor)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();
  }

  // Deducciones ya son del período (semilla FE o edición); no re-prorratear
  const proratedDeductions = {};
  for (const key in currentDeductions) {
    const raw = currentDeductions[key];
    if (raw == null || raw === '') {
      proratedDeductions[key] = 0;
    } else {
      proratedDeductions[key] = new Decimal(raw).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
    }
  }

  const deductionsValues = Object.values(proratedDeductions);
  let totalDeductions = new Decimal(0);
  for (const val of deductionsValues) {
    totalDeductions = totalDeductions.plus(new Decimal(val || 0));
  }

  const anticipo1ra = new Decimal(e.anticipo1ra || 0);
  const net = gross.minus(totalDeductions);
  const netPayable = net.minus(anticipo1ra);
  const grossRounded = gross.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  const patronalNum = patronal.toNumber();
  const irtraIntecapNum = irtraIntecap.toNumber();

  const calculated = {
    proratedDeductions,
    baseSalary: baseSalary.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    bonusLey: bonusLey.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    bonusDec: bonusDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    bonos: extrasBonos.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    extrasTotal: extrasTotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    bonusesSum: bonusesSum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    gross: grossRounded,
    ded: totalDeductions.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    net: net.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    anticipo1ra: anticipo1ra.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    netPayable: netPayable.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    patronal: patronalNum,
    irtraIntecap: irtraIntecapNum,
    companyCost: getCompanyCost({ gross: grossRounded, patronal: patronalNum, irtraIntecap: irtraIntecapNum }),
    igssExempt: isIgssExempt(e),
    jubilacion: isJubilado(e),
    hourlyRate: sueldoOrd.dividedBy(30).dividedBy(8).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    vacacionesVal: vacacionesVal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    ventasEconomicas: ventasEconomicas.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    periodType: periodType || null
  };

  return {
    ...e,
    extras: extrasObj,
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
  isJubilado,
  skipsIgssPatronal,
  getCuotaLaboralRate,
  getQuincenaDateRange,
  isDateInQuincena,
  CUOTA_PATRONAL_RATE,
  CUOTA_LABORAL_RATE,
  CUOTA_LABORAL_JUBILADO_RATE,
  IRTRA_INTECAP_RATE,
  IVA_RATE
};
