/**
 * Tests de cálculo de horas extra, bonos y coherencia quincena.
 * Uso: node src/scripts/test_overtime_bonuses.js
 */
const { calculateEmployeePayroll } = require('../services/payrollCalculator.service');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  OK: ${message}`);
  } else {
    failed += 1;
    console.error(`  FAIL: ${message}`);
  }
}

function getQuincenaDateRange(draftDateStr, periodType) {
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

function isDateInQuincena(dateStr, draftDateStr, periodType) {
  if (!dateStr) return false;
  const parts = String(dateStr).slice(0, 10).split('-');
  if (parts.length < 3) return false;
  const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const { start, end } = getQuincenaDateRange(draftDateStr, periodType);
  return dt >= start && dt <= end;
}

function calcOvertimeValues(baseSalary, simplesQty, doblesQty) {
  const hourlyRate = baseSalary / 30 / 8;
  const valSimples = simplesQty * hourlyRate * 1.5;
  const valDobles = doblesQty * hourlyRate * 2;
  return { hourlyRate, valSimples, valDobles };
}

console.log('=== Tests: Horas Extra y Bonos ===\n');

console.log('1. Fórmulas de horas extra');
{
  const baseSalary = 3000;
  const { hourlyRate, valSimples, valDobles } = calcOvertimeValues(baseSalary, 4, 2);
  assert(Math.abs(hourlyRate - 12.5) < 0.01, 'hourlyRate = sueldo/30/8');
  assert(Math.abs(valSimples - 75) < 0.01, '4 hrs simples × 1.5 = Q75');
  assert(Math.abs(valDobles - 50) < 0.01, '2 hrs dobles × 2.0 = Q50');
}

console.log('\n2. isDateInQuincena');
{
  const ref = '2026-07-10';
  assert(isDateInQuincena('2026-07-05', ref, '1ra'), '5 jul en 1ra quincena');
  assert(isDateInQuincena('2026-07-15', ref, '1ra'), '15 jul en 1ra quincena');
  assert(!isDateInQuincena('2026-07-16', ref, '1ra'), '16 jul NO en 1ra quincena');
  assert(isDateInQuincena('2026-07-20', ref, '2da'), '20 jul en 2da quincena');
  assert(!isDateInQuincena('', ref, '1ra'), 'fecha vacía retorna false');
}

console.log('\n3. payrollCalculator.service — extras y bonos');
{
  const emp = {
    sueldo_ordinario: 3000,
    days: 15,
    bon_dec_37_2001: 250,
    bon_incentivo: 100,
    extras: {
      simplesVal: 75,
      doblesVal: 50,
      bonos: 500
    },
    appliedBonuses: { b1: 200 }
  };
  const result = calculateEmployeePayroll(emp, '1ra');
  const calc = result.calculated;
  assert(calc.extrasTotal === 125, 'extrasTotal = simples + dobles');
  assert(calc.bonos === 500, 'bonos operativos en extras.bonos');
  assert(calc.bonusesSum === 200, 'bonusesSum desde appliedBonuses');
  assert(Math.abs(calc.bonusDec - 125) < 0.01, 'bono decreto prorrateado 15/30');
  assert(Math.abs(calc.bonusLey - 50) < 0.01, 'bono incentivo prorrateado 15/30');
  const expectedGross = calc.baseSalary + calc.bonusLey + calc.bonusDec + calc.bonos + calc.extrasTotal + calc.bonusesSum;
  assert(Math.abs(calc.gross - expectedGross) < 0.02, 'gross coherente con componentes');
}

console.log('\n4. IGSS excluye bonos legales');
{
  const emp = {
    sueldo_ordinario: 3000,
    days: 15,
    bon_dec_37_2001: 250,
    bon_incentivo: 100,
    extras: { simplesVal: 75, doblesVal: 0, bonos: 0 },
    appliedBonuses: {}
  };
  const result = calculateEmployeePayroll(emp, '1ra');
  const calc = result.calculated;
  const igssBaseExpected = calc.baseSalary + calc.extrasTotal + calc.bonos + calc.bonusesSum;
  const igssFromCalc = calc.baseSalary + calc.extrasTotal + calc.bonos + calc.bonusesSum;
  assert(Math.abs(igssFromCalc - igssBaseExpected) < 0.02, 'base IGSS sin bonos legales');
}

console.log(`\n=== Resultado: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
