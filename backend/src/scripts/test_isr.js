/**
 * Tests unitarios ISR (régimen asalariados GT).
 * Ejecutar: node src/scripts/test_isr.js
 */
const { calculateMonthlyISR } = require('../services/isr.service');

function assertClose(actual, expected, label, tol = 0.02) {
  if (Math.abs(actual - expected) > tol) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    process.exitCode = 1;
  } else {
    console.log(`OK   ${label}: ${actual}`);
  }
}

// Caso: renta imponible <= 0 → ISR 0
// Sueldo muy bajo: 1000 + 250 = 1250*12 = 15000; IGSS ~579.6; -48000 < 0
assertClose(calculateMonthlyISR(1000, 250), 0, 'renta imponible 0');

// Caso tramo 5%: sueldo que genera imponible bajo 300k
// base 5000 + 250 = 63000 anual; IGSS=5000*0.0483*12=2898; imponible=63000-2898-48000=12102
// anual ISR = 12102*0.05 = 605.1; mensual = 50.425 → 50.43
assertClose(calculateMonthlyISR(5000, 250), 50.43, 'tramo 5%');
assertClose(calculateMonthlyISR(5000, 250, 0.03), 55, 'tramo 5% jubilado con IGSS 3%');
assertClose(calculateMonthlyISR(5000, 250, 0), 62.5, 'tramo 5% exento de IGSS');

// Caso tramo 7%: sueldo alto
// base 30000 + 250 = 363000; IGSS=30000*0.0483*12=17388; imponible=363000-17388-48000=297612
// <= 300000 → solo 5%: 297612*0.05=14880.6 /12 = 1240.05
assertClose(calculateMonthlyISR(30000, 250), 1240.05, 'casi tope tramo 1');

// Tramo 2 claro: base 40000 + 250
// annualIncome = 483000; IGSS = 23184; imponible = 483000-23184-48000 = 411816
// ISR = 15000 + (411816-300000)*0.07 = 15000 + 7827.12 = 22827.12; /12 = 1902.26
assertClose(calculateMonthlyISR(40000, 250), 1902.26, 'tramo 7%');

if (!process.exitCode) console.log('\nTodos los tests ISR pasaron.');
