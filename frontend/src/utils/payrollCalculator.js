import { calculateMonthlyISR } from '../data/mockData';

export const CUOTA_PATRONAL_RATE = 0.1067;
export const CUOTA_LABORAL_RATE = 0.0483;
export const CUOTA_LABORAL_JUBILADO_RATE = 0.03;
export const IRTRA_INTECAP_RATE = 0.02;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const isJubilado = (e) => !!(e && (e.jubilacion === true || e.jubilacion === 1));
/** Exento total de IGSS (flag explícito). Jubilados cotizan 3% laboral. */
export const isIgssExempt = (e) => !!(e && (e.igss_exempt === true || e.igss_exempt === 1));
export const skipsIgssPatronal = (e) => isJubilado(e) || isIgssExempt(e);

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
  const days = Number(e.days || 30);
  const baseFactor = days / 30;

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

  const extrasBonos = Number(extrasObj.bonos) || 0;
  const extrasTotal = round2(
    (Number(extrasObj.simplesVal) || 0)
    + (Number(extrasObj.doblesVal) || 0)
    + (Number(extrasObj.comisiones) || 0)
    + (Number(extrasObj.otrosIngresos) || 0)
    + (Number(extrasObj.vacacionesVal) || 0)
    + (Number(extrasObj.ventasEconomicas) || 0)
  );

  const bonusesSum = round2(
    Object.values(e.appliedBonuses || {}).reduce((sum, val) => sum + (Number(val) || 0), 0)
  );

  const gross = round2(baseSalary + bonusLey + bonusDec + extrasBonos + extrasTotal + bonusesSum);

  const igssBase = baseSalary + extrasTotal + extrasBonos + bonusesSum;
  const laboralRate = getCuotaLaboralRate(e);
  const noPatronal = skipsIgssPatronal(e);
  const patronal = noPatronal ? 0 : round2(igssBase * CUOTA_PATRONAL_RATE);
  const irtraIntecap = noPatronal ? 0 : round2(igssBase * IRTRA_INTECAP_RATE);

  const hasMasterIsr = e.isr !== undefined && e.isr !== null && e.isr !== '';
  const monthlyIsr = hasMasterIsr
    ? (Number(e.isr) || 0)
    : calculateMonthlyISR(sueldoOrd, bonDec);

  // 2ª quincena: ISR periodo = Total ISR − ISR ya retenido en 1ª
  const isSecondQuincena = periodType === '2da'
    || e.totalIsr !== undefined
    || e.isr1ra !== undefined;
  let isrValue;
  if (isSecondQuincena) {
    const totalIsr = (e.totalIsr !== undefined && e.totalIsr !== null && e.totalIsr !== '')
      ? (Number(e.totalIsr) || 0)
      : monthlyIsr;
    const isr1ra = Number(e.isr1ra) || 0;
    isrValue = round2(Math.max(0, totalIsr - isr1ra));
  } else {
    isrValue = round2(monthlyIsr * baseFactor);
  }

  const deductions = { ...(e.deductions || {}) };
  deductions.igss = laboralRate === 0 ? 0 : round2(igssBase * laboralRate);
  deductions.isr = isrValue;

  const totalDeductions = round2(
    Object.values(deductions).reduce((sum, val) => sum + (Number(val) || 0), 0)
  );
  const anticipo1ra = Number(e.anticipo1ra) || 0;
  const net = round2(gross - totalDeductions);

  const calculated = {
    baseSalary,
    bonusLey,
    bonusDec,
    bonos: round2(extrasBonos),
    extrasTotal,
    bonusesSum,
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
    periodType: periodType || null
  };

  return { ...e, extras: extrasObj, calculated };
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
