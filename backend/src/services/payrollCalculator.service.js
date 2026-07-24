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
 * El Excel mantiene cuota patronal / IRTRA-INTECAP normal para jubilados.
 */
const isIgssExempt = (e) => !!(e && (e.igss_exempt === true || e.igss_exempt === 1));
const skipsIgssPatronal = (e) => isIgssExempt(e);

/**
 * Los Excel cobran la mitad de las deducciones mensuales cuando días <= 15
 * y el total mensual cuando días > 15 (no usan días/30 para estos descuentos).
 */
const getRecurringDeductionFactor = (daysWorked) => {
  const days = new Decimal(
    daysWorked === undefined || daysWorked === null || daysWorked === '' ? 30 : daysWorked
  );
  return days.lte(15) ? new Decimal('0.5') : new Decimal(1);
};

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

const parseLocalPayrollDate = (dateValue) => {
  if (!dateValue) return new Date();
  const dateText = String(dateValue);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateText);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(dateValue);
};

/**
 * Rango de fechas de una quincena a partir de una fecha de referencia.
 * 1ra = días 1–15; 2da = 16–último día del mes.
 */
const getQuincenaDateRange = (draftDateStr, periodType) => {
  const d = parseLocalPayrollDate(draftDateStr);
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
  const rawDays = e.days;
  const days = new Decimal(
    rawDays === undefined || rawDays === null || rawDays === '' ? 30 : rawDays
  );
  if (days.lt(0) || days.gt(30)) {
    throw new Error('Los días laborados deben estar entre 0 y 30.');
  }
  const baseFactor = days.dividedBy(30);
  const recurringDeductionFactor = getRecurringDeductionFactor(days);

  const sueldoOrd = new Decimal(e.sueldo_ordinario || 0);
  const bonInc = new Decimal(e.bon_incentivo || 0);
  const bonDec = new Decimal(e.bon_dec_37_2001 || 0);
  const roundMoney = (value) => new Decimal(value || 0)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // El Excel redondea cada columna monetaria antes de totalizar el devengado.
  const baseSalary = roundMoney(sueldoOrd.times(baseFactor));
  const bonusLey = roundMoney(bonInc.times(baseFactor));
  const bonusDec = roundMoney(bonDec.times(baseFactor));

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

  const extrasBonos = roundMoney(extrasObj.bonos);
  const extrasSimples = roundMoney(extrasObj.simplesVal);
  const extrasDobles = roundMoney(extrasObj.doblesVal);
  const comisiones = roundMoney(extrasObj.comisiones);
  const otrosIngresos = roundMoney(extrasObj.otrosIngresos);
  const vacacionesVal = roundMoney(extrasObj.vacacionesVal);
  const ventasEconomicas = roundMoney(extrasObj.ventasEconomicas);

  const extrasTotal = extrasSimples
    .plus(extrasDobles)
    .plus(comisiones)
    .plus(otrosIngresos)
    .plus(vacacionesVal)
    .plus(ventasEconomicas);

  const appliedBonusesValues = Object.values(e.appliedBonuses || {});
  let bonusesSum = new Decimal(0);
  for (const val of appliedBonusesValues) {
    bonusesSum = bonusesSum.plus(roundMoney(val));
  }

  const gross = baseSalary.plus(bonusLey).plus(bonusDec).plus(extrasBonos).plus(extrasTotal).plus(bonusesSum);

  // Los Excel acumulan los bonos en lo devengado, pero los excluyen de IGSS.
  const igssBase = baseSalary.plus(extrasTotal);

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
  // En la 2ª quincena el Excel calcula el neto mensual completo y después resta
  // el anticipo neto de la 1ª. Por eso aquí se descuenta el ISR mensual completo
  // (o la mitad si los días son <= 15), sin volver a restar el ISR de la 1ª.
  const { calculateMonthlyISR } = require('./isr.service');
  const hasMasterIsr = e.isr !== undefined && e.isr !== null && e.isr !== '';
  const monthlyIsr = hasMasterIsr
    ? (Number(e.isr) || 0)
    : calculateMonthlyISR(
      sueldoOrd.toNumber(),
      bonDec.toNumber(),
      laboralRate.toNumber()
    );

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
    isrValue = Decimal.max(0, totalIsr.times(recurringDeductionFactor))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  } else {
    isrValue = new Decimal(monthlyIsr)
      .times(recurringDeductionFactor)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  const currentDeductions = { ...(e.deductions || {}) };
  currentDeductions.igss = igssValue.toNumber();
  currentDeductions.isr = isrValue.toNumber();

  // Backfill Bantrab/bancos/préstamo/otros desde maestro (borradores antiguos sin cablear)
  const backfillPeriodDeduction = (key, monthlyAmount) => {
    const master = new Decimal(monthlyAmount || 0);
    const hasPeriodValue = Object.prototype.hasOwnProperty.call(currentDeductions, key)
      && currentDeductions[key] !== null
      && currentDeductions[key] !== '';
    if (master.gt(0) && !hasPeriodValue) {
      currentDeductions[key] = master
        .times(recurringDeductionFactor)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();
    }
  };

  backfillPeriodDeduction(
    'bancos',
    new Decimal(e.bantrab || 0).plus(e.bancos || 0)
  );
  backfillPeriodDeduction('prestamo_empresa', e.prestamo_empresa);
  backfillPeriodDeduction('judiciales', e.judiciales);
  backfillPeriodDeduction('seguro', e.seguro);
  backfillPeriodDeduction('parqueo', e.parqueo);
  backfillPeriodDeduction('boleto_de_ornato', e.boleto_de_ornato);
  backfillPeriodDeduction(
    'otros_egresos',
    new Decimal(e.otros_egresos || 0).plus(e.otro_descuentos || 0)
  );

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
    igssBase: igssBase.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
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
  getRecurringDeductionFactor,
  getCuotaLaboralRate,
  parseLocalPayrollDate,
  getQuincenaDateRange,
  isDateInQuincena,
  CUOTA_PATRONAL_RATE,
  CUOTA_LABORAL_RATE,
  CUOTA_LABORAL_JUBILADO_RATE,
  IRTRA_INTECAP_RATE,
  IVA_RATE
};
