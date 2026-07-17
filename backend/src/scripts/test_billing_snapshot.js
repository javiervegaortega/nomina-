const { PayrollHistory } = require('../models');
const BillingService = require('../services/billing.service');
require('dotenv').config();

const parseEmployees = (data) => {
  let employees = data;
  if (typeof employees === 'string') {
    try { employees = JSON.parse(employees); } catch { employees = []; }
  }
  if (employees && !Array.isArray(employees) && Array.isArray(employees.employees)) {
    employees = employees.employees;
  }
  return Array.isArray(employees) ? employees : [];
};

const summarizeEmployee = (employee) => {
  const extras = employee.extras || {};
  const appliedBonuses = Object.values(employee.appliedBonuses || {})
    .reduce((sum, val) => sum + (Number(val) || 0), 0);
  return {
    id: employee.id,
    nombre: employee.nombre || [employee.primer_nombre, employee.primer_apellido].filter(Boolean).join(' '),
    extrasBonos: Number(extras.bonos) || 0,
    horasExtra: (Number(extras.simplesVal) || 0) + (Number(extras.doblesVal) || 0),
    appliedBonuses: appliedBonuses,
    calculatedGross: Number(employee.calculated?.gross) || 0,
    calculatedBonusesSum: Number(employee.calculated?.bonusesSum) || 0,
    calculatedExtrasTotal: Number(employee.calculated?.extrasTotal) || 0,
    companyCost: Number(employee.calculated?.companyCost) || 0
  };
};

async function test() {
  let totalWarnings = 0;
  let criticalFailures = 0;

  const payrolls = await PayrollHistory.findAll({
    where: { status: 'cerrada' },
    order: [['closedAt', 'DESC']],
    limit: 5
  });

  if (!payrolls.length) {
    console.log('No hay nóminas cerradas para verificar.');
    process.exit(0);
  }

  console.log(`Verificando ${payrolls.length} nómina(s) cerrada(s)...\n`);

  for (const payroll of payrolls) {
    console.log('='.repeat(72));
    console.log(`Nómina: ${payroll.title} (id=${payroll.id})`);

    const employees = parseEmployees(payroll.data);
    console.log(`Empleados en snapshot: ${employees.length}`);

    const withConcepts = employees.filter((e) => {
      const extras = e.extras || {};
      const applied = Object.values(e.appliedBonuses || {}).some((v) => Number(v) > 0);
      const overtime = (Number(extras.simplesVal) || 0) > 0 || (Number(extras.doblesVal) || 0) > 0;
      const bonos = (Number(extras.bonos) || 0) > 0;
      return applied || overtime || bonos;
    });

    console.log(`Empleados con bonos/horas extra en snapshot: ${withConcepts.length}`);
    withConcepts.slice(0, 3).forEach((e) => {
      console.log('  -', JSON.stringify(summarizeEmployee(e)));
    });

    try {
      const preview = await BillingService.buildPreview(payroll.id);
      console.log(`\nVista previa billing: ${preview.details.length} filas, ${preview.lines.length} facturas`);
      console.log(`Advertencias (${preview.warnings.length}):`);
      preview.warnings.forEach((w) => console.log(`  * ${w}`));
      totalWarnings += preview.warnings.length;

      const critical = preview.warnings.filter((w) =>
        /no coincide|appliedBonuses|operation_logs|extras\.bonos/i.test(w)
      );
      if (critical.length) {
        criticalFailures += critical.length;
        console.error(`  CRÍTICAS (${critical.length}):`);
        critical.forEach((w) => console.error(`    ! ${w}`));
      }

      const detailWithBonos = (preview.details || []).find((d) =>
        (Number(d.bonosExtras) || 0) > 0
        || (Number(d.bonosAplicados) || 0) > 0
        || (Number(d.horasExtrasOtros) || 0) > 0
      );
      if (detailWithBonos) {
        console.log('\nEjemplo detalle con conceptos variables:');
        console.log(JSON.stringify({
          empleado: detailWithBonos.employeeName,
          bonosExtras: detailWithBonos.bonosExtras,
          bonosAplicados: detailWithBonos.bonosAplicados,
          horasExtrasOtros: detailWithBonos.horasExtrasOtros,
          bruto: detailWithBonos.bruto,
          asgBonosAplicados: detailWithBonos.asgBonosAplicados,
          baseAmount: detailWithBonos.baseAmount
        }, null, 2));
      }
    } catch (err) {
      console.error(`Error en buildPreview: ${err.message}`);
    }

    console.log('');
  }

  console.log('='.repeat(72));
  console.log(`Total advertencias: ${totalWarnings}, críticas: ${criticalFailures}`);
  process.exit(criticalFailures > 0 ? 1 : 0);
}

test().catch((err) => {
  console.error(err);
  process.exit(1);
});
