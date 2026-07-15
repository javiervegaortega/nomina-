const Decimal = require('decimal.js');
const { CUOTA_LABORAL_RATE } = require('./payrollCalculator.service');

/** Gastos personales deducibles anuales (régimen asalariados GT) */
const PERSONAL_EXPENSES = new Decimal('48000');
/** Tope del primer tramo anual */
const BRACKET_1_LIMIT = new Decimal('300000');
const BRACKET_1_RATE = new Decimal('0.05');
const BRACKET_2_RATE = new Decimal('0.07');
/** ISR del primer tramo completo: 300000 * 5% = 15000 */
const BRACKET_1_TAX = new Decimal('15000');

/**
 * Calcula ISR mensual según régimen sobre rentas de trabajo (Guatemala).
 * Base anual = (sueldo ordinario + bono decreto/mes) * 12
 * Renta imponible = ingreso anual - IGSS anual - Q48,000
 * Tramo 1: hasta Q300,000 → 5%
 * Tramo 2: exceso → 15,000 + exceso * 7%
 * @param {number} baseMonthly - sueldo ordinario mensual
 * @param {number} bonusMonthly - bonificación decreto (default 250)
 * @returns {number} ISR mensual redondeado a 2 decimales
 */
const calculateMonthlyISR = (baseMonthly, bonusMonthly = 250) => {
  const base = new Decimal(baseMonthly || 0);
  const bonus = new Decimal(bonusMonthly || 0);

  const annualIncome = base.plus(bonus).times(12);
  const annualIgss = base.times(CUOTA_LABORAL_RATE).times(12);
  const taxableIncome = annualIncome.minus(annualIgss).minus(PERSONAL_EXPENSES);

  if (taxableIncome.lte(0)) {
    return 0;
  }

  let annualIsr;
  if (taxableIncome.lte(BRACKET_1_LIMIT)) {
    annualIsr = taxableIncome.times(BRACKET_1_RATE);
  } else {
    annualIsr = BRACKET_1_TAX.plus(taxableIncome.minus(BRACKET_1_LIMIT).times(BRACKET_2_RATE));
  }

  return annualIsr.dividedBy(12).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
};

module.exports = {
  calculateMonthlyISR,
  PERSONAL_EXPENSES,
  BRACKET_1_LIMIT,
  BRACKET_1_RATE,
  BRACKET_2_RATE
};
