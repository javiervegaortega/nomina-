/**
 * Tests de cálculo de horas extra, bonos y coherencia quincena.
 * Uso: node src/scripts/test_overtime_bonuses.js
 */
const { calculateEmployeePayroll } = require('../services/payrollCalculator.service');
const { applyScheduledBonusesToEmployees } = require('../services/payrollBonuses.service');

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

function calcOvertimeValues(baseSalary, simplesQty, nocturnasQty) {
  const simpleHourlyRate = baseSalary / 30 / 8;
  const nocturnalHourlyRate = baseSalary / 30 / 6;
  const valSimples = simplesQty * simpleHourlyRate * 1.5;
  const valNocturnas = nocturnasQty * nocturnalHourlyRate * 1.5;
  return { simpleHourlyRate, nocturnalHourlyRate, valSimples, valNocturnas };
}

console.log('=== Tests: Horas Extra y Bonos ===\n');

console.log('1. Fórmulas de horas extra');
{
  const baseSalary = 3000;
  const { simpleHourlyRate, nocturnalHourlyRate, valSimples, valNocturnas } = calcOvertimeValues(baseSalary, 4, 2);
  assert(Math.abs(simpleHourlyRate - 12.5) < 0.01, 'hora simple = sueldo/30/8');
  assert(Math.abs(nocturnalHourlyRate - 16.6666666667) < 0.01, 'hora nocturna = sueldo/30/6');
  assert(Math.abs(valSimples - 75) < 0.01, '4 hrs simples × 1.5 = Q75');
  assert(Math.abs(valNocturnas - 50) < 0.01, '2 hrs nocturnas /6 × 1.5 = Q50');
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
  assert(calc.extrasTotal === 125, 'extrasTotal = simples + nocturnas');
  assert(calc.bonos === 500, 'bonos operativos en extras.bonos');
  assert(calc.bonusesSum === 200, 'bonusesSum desde appliedBonuses');
  assert(Math.abs(calc.bonusDec - 125) < 0.01, 'bono decreto prorrateado 15/30');
  assert(Math.abs(calc.bonusLey - 50) < 0.01, 'bono incentivo prorrateado 15/30');
  const expectedGross = calc.baseSalary + calc.bonusLey + calc.bonusDec + calc.bonos + calc.extrasTotal + calc.bonusesSum;
  assert(Math.abs(calc.gross - expectedGross) < 0.02, 'gross coherente con componentes');
  assert(calc.igssBase === 1625, 'base IGSS = sueldo + horas extra, sin ningún bono');
  assert(calc.proratedDeductions.igss === 78.49, 'IGSS laboral 4.83% sobre base afecta');
  assert(calc.patronal === 173.39, 'cuota patronal 10.67% sobre base afecta');
  assert(calc.irtraIntecap === 32.5, 'IRTRA + INTECAP 2% sobre base afecta');
}

console.log('\n4. IGSS excluye bonos legales, operativos y de catálogo');
{
  const base = {
    sueldo_ordinario: 3000,
    days: 15,
    bon_dec_37_2001: 250,
    bon_incentivo: 100,
    extras: { simplesVal: 75, doblesVal: 0, bonos: 0 },
    appliedBonuses: {}
  };
  const withoutExtraBonuses = calculateEmployeePayroll(base, '1ra').calculated;
  const withExtraBonuses = calculateEmployeePayroll({
    ...base,
    extras: { ...base.extras, bonos: 500 },
    appliedBonuses: { b1: 200 }
  }, '1ra').calculated;

  assert(withExtraBonuses.gross - withoutExtraBonuses.gross === 700, 'bonos sí aumentan el bruto');
  assert(withExtraBonuses.igssBase === withoutExtraBonuses.igssBase, 'bonos no aumentan la base IGSS');
  assert(
    withExtraBonuses.proratedDeductions.igss === withoutExtraBonuses.proratedDeductions.igss,
    'bonos no aumentan IGSS laboral'
  );
  assert(withExtraBonuses.patronal === withoutExtraBonuses.patronal, 'bonos no aumentan cuota patronal');
}

console.log('\n5. Días cero y deducciones maestras');
{
  const zeroDays = calculateEmployeePayroll({
    sueldo_ordinario: 3000,
    bon_incentivo: 250,
    days: 0,
    deductions: {}
  }, '1ra').calculated;
  assert(zeroDays.baseSalary === 0, '0 días no se convierte en 30 días');
  assert(zeroDays.gross === 0, '0 días sin extras produce bruto Q0');

  const withMasterDeductions = calculateEmployeePayroll({
    sueldo_ordinario: 3000,
    days: 15,
    bantrab: 200,
    bancos: 100,
    prestamo_empresa: 80,
    deductions: {}
  }, '1ra').calculated.proratedDeductions;
  assert(withMasterDeductions.bancos === 150, 'Bantrab/bancos mensual se prorratea a la quincena');
  assert(withMasterDeductions.prestamo_empresa === 40, 'préstamo mensual se prorratea a la quincena');

  const suspendedMasterDeduction = calculateEmployeePayroll({
    sueldo_ordinario: 3000,
    days: 15,
    bantrab: 200,
    bancos: 100,
    deductions: { bancos: 0 }
  }, '1ra').calculated.proratedDeductions;
  assert(suspendedMasterDeduction.bancos === 0, 'un Q0 explícito suspende el descuento maestro del período');

  let invalidDaysRejected = false;
  try {
    calculateEmployeePayroll({ sueldo_ordinario: 3000, days: 31 }, '1ra');
  } catch {
    invalidDaysRejected = true;
  }
  assert(invalidDaysRejected, 'se rechazan días fuera del rango 0–30');
}

console.log('\n6. Redondeo por columna como Excel');
{
  const partialDays = calculateEmployeePayroll({
    sueldo_ordinario: 4387.55,
    bon_incentivo: 1112.45,
    days: 10,
    deductions: {}
  }, '1ra').calculated;
  assert(partialDays.baseSalary === 1462.52, 'sueldo de 10 días redondea por columna a Q1462.52');
  assert(partialDays.bonusLey === 370.82, 'bono de 10 días redondea por columna a Q370.82');
  assert(partialDays.gross === 1833.34, 'bruto suma columnas redondeadas: Q1833.34');

  const rawOvertime = calculateEmployeePayroll({
    sueldo_ordinario: 4100,
    bon_incentivo: 350,
    days: 30,
    extras: { simplesVal: 691.875 },
    deductions: {}
  }, '2da').calculated;
  assert(rawOvertime.extrasTotal === 691.88, 'hora extra interna Q691.875 paga Q691.88');
  assert(rawOvertime.gross === 5141.88, 'bruto visible usa la hora extra redondeada');
}

console.log('\n7. ISR y deducciones acumuladas como Excel');
{
  const first = calculateEmployeePayroll({
    sueldo_ordinario: 3000,
    days: 15,
    isr: 100,
    bancos: 300,
    deductions: {}
  }, '1ra').calculated;
  assert(first.proratedDeductions.isr === 50, '1ª descuenta la mitad del ISR mensual');
  assert(first.proratedDeductions.bancos === 150, '1ª descuenta la mitad de bancos');

  const second = calculateEmployeePayroll({
    sueldo_ordinario: 3000,
    days: 30,
    isr: 100,
    totalIsr: 100,
    isr1ra: 50,
    anticipo1ra: 1200,
    bancos: 300,
    deductions: {}
  }, '2da').calculated;
  assert(second.proratedDeductions.isr === 100, '2ª acumulada usa ISR mensual completo');
  assert(second.proratedDeductions.bancos === 300, '2ª acumulada usa bancos mensual completo');
  assert(second.netPayable === second.net - 1200, 'anticipo neto 1ª se descuenta una sola vez al final');

  const partialSecond = calculateEmployeePayroll({
    sueldo_ordinario: 3000,
    days: 10,
    totalIsr: 100,
    isr1ra: 50,
    bancos: 300,
    deductions: {}
  }, '2da').calculated;
  assert(partialSecond.proratedDeductions.isr === 50, 'con <=15 días el ISR mensual se divide entre dos');
  assert(partialSecond.proratedDeductions.bancos === 150, 'con <=15 días bancos se divide entre dos');
}

console.log('\n8. Jubilado: 3% laboral y patronal completa');
{
  const jubilado = calculateEmployeePayroll({
    sueldo_ordinario: 3000,
    days: 30,
    jubilacion: true,
    deductions: {}
  }, '2da').calculated;
  assert(jubilado.proratedDeductions.igss === 90, 'jubilado aporta 3% laboral');
  assert(jubilado.patronal === 320.1, 'jubilado conserva cuota patronal 10.67%');
  assert(jubilado.irtraIntecap === 60, 'jubilado conserva IRTRA + INTECAP 2%');
}

console.log('\n9. Bonos de catálogo se aplican por empleado y quincena');
{
  const employees = [{ id: 10, carriedAppliedBonuses: { anterior: 25 } }, { id: 11 }];
  const bonusRows = [
    { id: 'b1', date: '2026-07-10', assignments: { 10: 100, 11: 50 } },
    { id: 'b2', date: '2026-07-20', assignments: JSON.stringify({ 10: 200 }) }
  ];
  const first = applyScheduledBonusesToEmployees(
    employees,
    bonusRows,
    '2026-07-15',
    '1ra'
  );
  assert(first[0].appliedBonuses.anterior === 25, 'conserva bonos ya acumulados');
  assert(first[0].appliedBonuses.b1 === 100, '1ª aplica bono fechado del 1 al 15');
  assert(first[0].appliedBonuses.b2 === undefined, '1ª no aplica bono de la 2ª');

  const second = applyScheduledBonusesToEmployees(
    first.map((employee) => ({
      ...employee,
      carriedAppliedBonuses: employee.appliedBonuses
    })),
    bonusRows,
    '2026-07-31',
    '2da'
  );
  assert(second[0].appliedBonuses.b1 === 100, '2ª conserva bono aplicado en 1ª');
  assert(second[0].appliedBonuses.b2 === 200, '2ª agrega bono fechado del 16 al cierre');

  const removed = applyScheduledBonusesToEmployees(
    [{ id: 10, appliedBonuses: { eliminado: 999 } }],
    [],
    '2026-07-15',
    '1ra'
  );
  assert(
    removed[0].appliedBonuses.eliminado === undefined,
    'bono eliminado/desasignado sale del borrador editable'
  );

  const monthBoundary = applyScheduledBonusesToEmployees(
    [{ id: 10 }],
    bonusRows,
    '2026-07-01',
    '1ra'
  );
  assert(
    monthBoundary[0].appliedBonuses.b1 === 100,
    'fecha de referencia YYYY-MM-DD en día 1 conserva el mes local correcto'
  );
}

console.log(`\n=== Resultado: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
