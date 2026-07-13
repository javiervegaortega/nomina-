const Decimal = require('decimal.js');

const CUOTA_PATRONAL_RATE = new Decimal('0.1067');
const CUOTA_LABORAL_RATE = new Decimal('0.0483');

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

  // Calculate IGSS correctly
  const igssValue = baseSalary.times(CUOTA_LABORAL_RATE).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const currentDeductions = { ...(e.deductions || {}) };
  
  // IGSS is already calculated on the prorated baseSalary, so we set it
  currentDeductions.igss = igssValue.toNumber();

  // Create a separate prorated deductions object for the UI to display the actual applied amounts
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

  const net = gross.minus(totalDeductions);
  const patronal = baseSalary.times(CUOTA_PATRONAL_RATE).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // Build a clean calculated object
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
    patronal: patronal.toNumber(),
    hourlyRate: baseSalary.dividedBy(30).dividedBy(8).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
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
  CUOTA_PATRONAL_RATE,
  CUOTA_LABORAL_RATE
};
