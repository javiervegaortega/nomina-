const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

const run = async () => {
  const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../../../frontend/src/utils/billingExport.js')
  ).href;
  const {
    buildBillingWorkbook,
    resolveBillingMonthYear
  } = await import(moduleUrl);

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
    details: [{
      employeeId: 1,
      employeeName: 'Empleado Test',
      periodType: '2da',
      baseAmount: 100,
      percentage: 100
    }]
  });
  const detail = workbook.getWorksheet('Detalle');
  assert(detail, 'debe existir la hoja Detalle');
  assert.strictEqual(detail.getRow(5).getCell(8).value, 'JULIO 2026');
  assert.notStrictEqual(detail.getRow(5).getCell(8).value, '2da Quincena');

  console.log('OK facturacion: Detalle usa mes y anio, con fallback historico seguro.');
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
