import { calculateMonthlyISR } from '../data/mockData';

export const CUOTA_PATRONAL_RATE = 0.1067;
export const CUOTA_LABORAL_RATE = 0.0483;
export const CUOTA_LABORAL_JUBILADO_RATE = 0.03;
export const IRTRA_INTECAP_RATE = 0.02;

// Redondeo monetario equivalente a Excel ROUND(..., 2), incluidos los casos
// de medio centavo (100.005) que Math.round(valor * 100) pierde por binario.
const round2 = (n) => {
  const value = Number(n);
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  // Las multiplicaciones previas pueden dejar 100.005 como
  // 100.00499999999998. La tolerancia relativa corrige solo ese ruido de
  // representación, no valores monetarios materialmente distintos.
  const rawAbsolute = Math.abs(value);
  const absolute = rawAbsolute
    + (Number.EPSILON * Math.max(1, rawAbsolute) * 4);
  const [coefficient, exponent = '0'] = String(absolute).split('e');
  const shifted = Number(`${coefficient}e${Number(exponent) + 2}`);
  const rounded = Math.round(shifted);
  const [roundedCoefficient, roundedExponent = '0'] = String(rounded).split('e');
  return sign * Number(
    `${roundedCoefficient}e${Number(roundedExponent) - 2}`
  );
};

export const isJubilado = (e) => !!(e && (e.jubilacion === true || e.jubilacion === 1));
/** Exento total de IGSS (flag explícito). Jubilados cotizan 3% laboral. */
export const isIgssExempt = (e) => !!(e && (e.igss_exempt === true || e.igss_exempt === 1));
export const skipsIgssPatronal = (e) => isIgssExempt(e);

/** Mitad de deducciones mensuales con 0–15 días; total mensual con 16–30. */
export const getRecurringDeductionFactor = (daysWorked) => {
  const days = Number(
    daysWorked === undefined || daysWorked === null || daysWorked === '' ? 30 : daysWorked
  );
  return days <= 15 ? 0.5 : 1;
};

/** Tasa laboral: 0 (exento), 3% (jubilado) o 4.83% (normal). */
export const getCuotaLaboralRate = (e) => {
  if (isIgssExempt(e)) return 0;
  if (isJubilado(e)) return CUOTA_LABORAL_JUBILADO_RATE;
  return CUOTA_LABORAL_RATE;
};

export const getCompanyCost = (calculated) => {
  if (!calculated) return 0;
  return round2(
    (Number(calculated.gross) || 0)
    + (Number(calculated.patronal) || 0)
    + (Number(calculated.irtraIntecap) || 0)
  );
};

/**
 * Mirrors backend calculateEmployeePayroll for draft/distribution previews.
 */
export const calculateEmployeePayroll = (e, periodType) => {
  const days = Number(
    e.days === undefined || e.days === null || e.days === '' ? 30 : e.days
  );
  if (!Number.isFinite(days) || days < 0 || days > 30) {
    throw new Error('Los días laborados deben estar entre 0 y 30.');
  }
  const baseFactor = days / 30;
  const recurringDeductionFactor = getRecurringDeductionFactor(days);

  const sueldoOrd = Number(e.sueldo_ordinario) || 0;
  const bonInc = Number(e.bon_incentivo) || 0;
  const bonDec = Number(e.bon_dec_37_2001) || 0;

  const baseSalary = round2(sueldoOrd * baseFactor);
  const bonusLey = round2(bonInc * baseFactor);
  const bonusDec = round2(bonDec * baseFactor);

  const extrasObj = { ...(e.extras || {}) };
  if (extrasObj.vacacionesVal == null && Number(e.vacaciones || 0) > 0) {
    extrasObj.vacacionesVal = round2(Number(e.vacaciones) * baseFactor);
  }
  if (extrasObj.ventasEconomicas == null && Number(e.ventas_economicas || 0) > 0) {
    extrasObj.ventasEconomicas = round2(Number(e.ventas_economicas) * baseFactor);
  }

  const extrasBonos = round2(extrasObj.bonos);
  const extrasTotal = round2(
    round2(extrasObj.simplesVal)
    + round2(extrasObj.doblesVal)
    + round2(extrasObj.comisiones)
    + round2(extrasObj.otrosIngresos)
    + round2(extrasObj.vacacionesVal)
    + round2(extrasObj.ventasEconomicas)
  );

  const bonusesSum = round2(
    Object.values(e.appliedBonuses || {}).reduce((sum, val) => sum + round2(val), 0)
  );

  const gross = round2(baseSalary + bonusLey + bonusDec + extrasBonos + extrasTotal + bonusesSum);

  // Los Excel acumulan los bonos en lo devengado, pero los excluyen de IGSS.
  const igssBase = round2(baseSalary + extrasTotal);
  const laboralRate = getCuotaLaboralRate(e);
  const noPatronal = skipsIgssPatronal(e);
  const patronal = noPatronal ? 0 : round2(igssBase * CUOTA_PATRONAL_RATE);
  const irtraIntecap = noPatronal ? 0 : round2(igssBase * IRTRA_INTECAP_RATE);

  const hasMasterIsr = e.isr !== undefined && e.isr !== null && e.isr !== '';
  const monthlyIsr = hasMasterIsr
    ? (Number(e.isr) || 0)
    : calculateMonthlyISR(sueldoOrd, bonDec, laboralRate);

  // La 2ª quincena es acumulada: ISR mensual completo y luego anticipo neto 1ª.
  const isSecondQuincena = periodType === '2da'
    || e.totalIsr !== undefined
    || e.isr1ra !== undefined;
  let isrValue;
  if (isSecondQuincena) {
    const totalIsr = (e.totalIsr !== undefined && e.totalIsr !== null && e.totalIsr !== '')
      ? (Number(e.totalIsr) || 0)
      : monthlyIsr;
    isrValue = round2(Math.max(0, totalIsr * recurringDeductionFactor));
  } else {
    isrValue = round2(monthlyIsr * recurringDeductionFactor);
  }

  const deductions = { ...(e.deductions || {}) };
  deductions.igss = laboralRate === 0 ? 0 : round2(igssBase * laboralRate);
  deductions.isr = isrValue;

  const backfillPeriodDeduction = (key, monthlyAmount) => {
    const master = Number(monthlyAmount) || 0;
    const hasPeriodValue = Object.prototype.hasOwnProperty.call(deductions, key)
      && deductions[key] !== null
      && deductions[key] !== '';
    if (master > 0 && !hasPeriodValue) {
      deductions[key] = round2(master * recurringDeductionFactor);
    }
  };

  backfillPeriodDeduction('bancos', (Number(e.bantrab) || 0) + (Number(e.bancos) || 0));
  backfillPeriodDeduction('prestamo_empresa', e.prestamo_empresa);
  backfillPeriodDeduction('judiciales', e.judiciales);
  backfillPeriodDeduction('seguro', e.seguro);
  backfillPeriodDeduction('parqueo', e.parqueo);
  backfillPeriodDeduction('boleto_de_ornato', e.boleto_de_ornato);
  backfillPeriodDeduction(
    'otros_egresos',
    (Number(e.otros_egresos) || 0) + (Number(e.otro_descuentos) || 0)
  );

  const proratedDeductions = Object.fromEntries(
    Object.entries(deductions).map(([key, value]) => [key, round2(value)])
  );

  const totalDeductions = round2(
    Object.values(proratedDeductions).reduce((sum, val) => sum + (Number(val) || 0), 0)
  );
  const anticipo1ra = Number(e.anticipo1ra) || 0;
  const net = round2(gross - totalDeductions);

  const calculated = {
    proratedDeductions,
    baseSalary,
    bonusLey,
    bonusDec,
    bonos: round2(extrasBonos),
    extrasTotal,
    bonusesSum,
    igssBase,
    gross,
    ded: totalDeductions,
    net,
    anticipo1ra: round2(anticipo1ra),
    netPayable: round2(net - anticipo1ra),
    patronal,
    irtraIntecap,
    companyCost: getCompanyCost({ gross, patronal, irtraIntecap }),
    igssExempt: isIgssExempt(e),
    jubilacion: isJubilado(e),
    hourlyRate: round2(sueldoOrd / 30 / 8),
    vacacionesVal: round2(extrasObj.vacacionesVal),
    ventasEconomicas: round2(extrasObj.ventasEconomicas),
    periodType: periodType || null
  };

  return { ...e, extras: extrasObj, deductions, calculated };
};

/**
 * Same shape as billing.service getEmployeePayrollSnapshot.
 */
export const getEmployeePayrollSnapshot = (employee, periodType) => {
  const withCalc = employee.calculated
    ? employee
    : calculateEmployeePayroll(employee, periodType);
  const calc = withCalc.calculated || {};
  const proDed = calc.proratedDeductions || withCalc.deductions || employee.deductions || {};

  const igssLaboral = round2(proDed.igss ?? employee.igss_laboral);
  const isr = round2(proDed.isr ?? employee.isr);
  const otherDeductions = round2(
    Object.entries(proDed).reduce((sum, [key, val]) => {
      if (key === 'igss' || key === 'isr') return sum;
      return sum + (Number(val) || 0);
    }, 0)
  );
  const totalDeductions = round2(calc.ded ?? (igssLaboral + isr + otherDeductions));
  const gross = round2(calc.gross);
  const patronal = round2(calc.patronal);
  const irtraIntecap = round2(calc.irtraIntecap);

  return {
    days: Number(employee.days != null ? employee.days : (calc.periodType === 'mensual' ? 30 : 15)) || 0,
    periodType: periodType || calc.periodType || null,
    baseSalary: round2(calc.baseSalary),
    bonusDec: round2(calc.bonusDec),
    bonusLey: round2(calc.bonusLey),
    bonos: round2(calc.bonos),
    extrasTotal: round2(calc.extrasTotal),
    bonusesSum: round2(calc.bonusesSum),
    gross,
    igssLaboral,
    isr,
    otherDeductions,
    totalDeductions,
    net: round2(calc.net ?? (gross - totalDeductions)),
    patronal,
    irtraIntecap,
    companyCost: getCompanyCost(calc)
  };
};

/**
 * Costeo intercompany con la precisión interna del Excel. La nómina visible se
 * mantiene a centavos; el reparto se redondea únicamente al emitir la factura.
 */
export const getEmployeeBillingCostSnapshot = (employee, payrollSnapshot) => {
  const fallback = payrollSnapshot || getEmployeePayrollSnapshot(employee);
  const rawDays = employee.days;
  const days = Number(
    rawDays === undefined || rawDays === null || rawDays === ''
      ? (fallback.days ?? 30)
      : rawDays
  );
  const factor = days / 30;
  const hasValue = (obj, key) => (
    obj
    && Object.prototype.hasOwnProperty.call(obj, key)
    && obj[key] !== null
    && obj[key] !== ''
  );
  const proratedMaster = (key, value) => (
    hasValue(employee, key)
      ? (Number(employee[key]) || 0) * factor
      : (Number(value) || 0)
  );

  const baseSalary = proratedMaster('sueldo_ordinario', fallback.baseSalary);
  const bonusLey = proratedMaster('bon_incentivo', fallback.bonusLey);
  const bonusDec = proratedMaster('bon_dec_37_2001', fallback.bonusDec);
  const extras = employee.extras || {};
  const variableKeys = [
    'simplesVal',
    'doblesVal',
    'comisiones',
    'otrosIngresos',
    'vacacionesVal',
    'ventasEconomicas'
  ];
  const hasRawVariableExtras = variableKeys.some(key => hasValue(extras, key));
  const extrasTotal = hasRawVariableExtras
    ? variableKeys.reduce((sum, key) => sum + (Number(extras[key]) || 0), 0)
    : (Number(fallback.extrasTotal) || 0);
  const bonos = hasValue(extras, 'bonos')
    ? (Number(extras.bonos) || 0)
    : (Number(fallback.bonos) || 0);
  let appliedBonuses = employee.appliedBonuses;
  if (typeof appliedBonuses === 'string') {
    try { appliedBonuses = JSON.parse(appliedBonuses); } catch { appliedBonuses = null; }
  }
  const bonusesSum = appliedBonuses && typeof appliedBonuses === 'object' && !Array.isArray(appliedBonuses)
    ? Object.values(appliedBonuses).reduce((sum, value) => sum + (Number(value) || 0), 0)
    : (Number(fallback.bonusesSum) || 0);
  const igssBase = baseSalary + extrasTotal;
  const igssExempt = isIgssExempt(employee) || employee.calculated?.igssExempt === true;
  const patronal = igssExempt ? 0 : igssBase * CUOTA_PATRONAL_RATE;
  const irtraIntecap = igssExempt ? 0 : igssBase * IRTRA_INTECAP_RATE;
  const gross = baseSalary + bonusLey + bonusDec + bonos + extrasTotal + bonusesSum;

  return {
    days,
    baseSalary,
    bonusLey,
    bonusDec,
    bonos,
    extrasTotal,
    bonusesSum,
    igssBase,
    gross,
    patronal,
    irtraIntecap,
    companyCost: gross + patronal + irtraIntecap
  };
};
