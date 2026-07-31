const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { createRequire } = require('module');

const run = async () => {
  const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../../../frontend/src/utils/billingExport.js')
  ).href;
  const {
    buildBillingWorkbook,
    resolveBillingMonthYear,
    getBillingLegalBonusAmount
  } = await import(moduleUrl);
  const frontendRequire = createRequire(
    path.resolve(__dirname, '../../../frontend/package.json')
  );
  const ExcelJS = frontendRequire('exceljs');

  assert.strictEqual(
    resolveBillingMonthYear({ billingMonth: '2026-07', payrollTitle: '2da Quincena' }),
    'JULIO 2026'
  );
  assert.strictEqual(
    resolveBillingMonthYear({ payrollTitle: 'Nomina Agosto 2025 - 2da Quincena' }),
    'AGOSTO 2025'
  );
  assert.strictEqual(
    resolveBillingMonthYear({ payrollTitle: '2da Quincena' }),
    null
  );

  const workbook = buildBillingWorkbook({
    payrollTitle: '2da Quincena',
    billingMonth: '2026-07',
    details: [
      {
        employeeId: 1,
        employeeName: 'Empleado Test',
        toCompany: 'Empresa A',
        centroCosto: 'CC-A',
        periodType: '2da',
        sueldoOrdinario: 3000,
        bonoDecreto: 100,
        bonoIncentivo: 200,
        bonosExtras: 300,
        bonosAplicados: 999,
        asgSueldo: 750,
        asgBonoDecreto: 10,
        asgBonoIncentivo: 20,
        asgBonosExtras: 30,
        asgBonosAplicados: 999,
        baseAmount: 900,
        percentage: 30
      },
      {
        employeeId: 1,
        employeeName: 'Empleado Test',
        toCompany: 'Empresa B',
        centroCosto: 'CC-B',
        periodType: '2da',
        sueldoOrdinario: 3000,
        bonoDecreto: 100,
        bonoIncentivo: 200,
        bonosExtras: 300,
        bonosAplicados: 999,
        asgSueldo: 1000,
        asgBonoDecreto: 40,
        asgBonoIncentivo: 50,
        asgBonosExtras: 60,
        asgBonosAplicados: 999,
        baseAmount: 1200,
        percentage: 40
      },
      {
        employeeId: 1,
        employeeName: 'Empleado Test',
        toCompany: 'Empresa C',
        centroCosto: 'CC-C',
        periodType: '2da',
        sueldoOrdinario: 3000,
        bonoDecreto: 100,
        bonoIncentivo: 200,
        bonosExtras: 300,
        bonosAplicados: 999,
        asgSueldo: 750,
        asgBonoDecreto: 70,
        asgBonoIncentivo: 80,
        asgBonosExtras: 90,
        asgBonosAplicados: 999,
        baseAmount: 900,
        percentage: 30
      }
    ]
  }, ExcelJS);
  const detail = workbook.getWorksheet('Detalle');
  assert(detail, 'debe existir la hoja Detalle');
  assert.strictEqual(detail.getRow(5).getCell(8).value, 'JULIO 2026');
  assert.notStrictEqual(detail.getRow(5).getCell(8).value, '2da Quincena');
  const headers = detail.getRow(4).values;
  assert(!headers.includes('Bonos Catálogo'), 'Detalle no debe incluir Bonos Catálogo');
  assert(!headers.includes('Asg. Bonos Catálogo'), 'Detalle no debe incluir Asg. Bonos Catálogo');
  assert(headers.includes('Bonificación decreto 37-2001 y 78-89'));
  assert(headers.includes('Asg. Bonificación decreto 37-2001 y 78-89'));
  assert(!headers.includes('Bono Decreto'));
  assert(!headers.includes('Bono Incentivo'));
  assert(!headers.includes('Bonos Extras'));
  assert.strictEqual(detail.getRow(4).cellCount, 27, 'Detalle debe tener 27 columnas');
  assert.strictEqual(
    getBillingLegalBonusAmount({
      bonoDecreto: 100,
      bonoIncentivo: 200,
      bonosExtras: 300,
      bonosAplicados: 999
    }),
    600,
    'el bono catálogo no entra en la bonificación legal'
  );
  assert.strictEqual(detail.getRow(5).getCell(2).value, 'Empleado Test');
  assert.match(detail.getRow(5).getCell(5).value, /Empresa A.*Empresa B.*Empresa C/);
  assert.strictEqual(detail.getRow(5).getCell(6).value, 100, 'los porcentajes se consolidan');
  assert.strictEqual(detail.getRow(5).getCell(9).value, 3000, 'el sueldo original no se triplica');
  assert.strictEqual(detail.getRow(5).getCell(10).value, 600, 'las tres bonificaciones se unifican');
  assert.strictEqual(detail.getRow(5).getCell(20).value, 2500, 'la asignación sí se suma');
  assert.strictEqual(
    detail.getRow(5).getCell(21).value,
    450,
    'las tres bonificaciones asignadas se consolidan y unifican'
  );
  assert.strictEqual(detail.getRow(5).getCell(27).value, 3000, 'el costo asignado sí se suma');
  assert.strictEqual(detail.getRow(6).getCell(2).value, 'TOTALES', 'solo hay una fila de empleado');

  console.log('OK facturacion: período, columnas y consolidación por empleado.');
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
