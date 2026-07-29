const { PayrollHistory, BillingRule, sequelize } = require('../models');
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

const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`OK: ${message}`);
};

const verifyBillingConfiguration = async () => {
  const expectedRoutes = [
    { from: 1, to: 2, margin: 0, iva: true, ivaRate: 0.12, adjustment: 0, totalFor100: 112 },
    { from: 1, to: 3, margin: 0, iva: true, ivaRate: 0.12, adjustment: 0, totalFor100: 112 },
    { from: 2, to: 1, margin: 0, iva: true, ivaRate: 0.12, adjustment: 0, totalFor100: 112 },
    { from: 2, to: 3, margin: 0, iva: true, ivaRate: 0.12, adjustment: 0, totalFor100: 112 },
    { from: 3, to: 1, margin: 4, iva: true, ivaRate: 0.12, adjustment: 0, totalFor100: 116.48 },
    { from: 3, to: 2, margin: 4, iva: true, ivaRate: 0.12, adjustment: 0, totalFor100: 116.48 },
    { from: 3, to: 4, margin: 4, iva: false, ivaRate: 0, adjustment: 0, totalFor100: 104 }
  ];
  const activeRules = await BillingRule.findAll({ where: { isActive: true } });

  expectedRoutes.forEach((expected) => {
    const rule = activeRules.find((candidate) => (
      Number(candidate.fromCompanyId) === expected.from
      && Number(candidate.toCompanyId) === expected.to
    ));
    assert(!!rule, `ruta ${expected.from}→${expected.to} activa`);
    assert(
      Number(rule.marginPercentage) === expected.margin,
      `margen ${expected.margin}% en ${expected.from}→${expected.to}`
    );
    assert(
      Boolean(rule.applyIva) === expected.iva,
      `IVA ${expected.iva ? 'activo' : 'inactivo'} en ${expected.from}→${expected.to}`
    );
    assert(
      Number(rule.ivaRate) === expected.ivaRate,
      `tasa IVA ${(expected.ivaRate * 100).toFixed(0)}% en ${expected.from}→${expected.to}`
    );

    assert(
      Number(rule.baseAdjustment || 0) === expected.adjustment,
      `ajuste base Q${expected.adjustment.toFixed(2)} en ${expected.from}→${expected.to}`
    );

    const base = 100;
    const margin = base * Number(rule.marginPercentage) / 100;
    const total = base + margin + (rule.applyIva ? (base + margin) * Number(rule.ivaRate) : 0);
    assert(
      Math.abs(total - expected.totalFor100) < 0.0001,
      `total de control Q${expected.totalFor100.toFixed(2)} en ${expected.from}→${expected.to}`
    );
  });

  const allowed = new Set(expectedRoutes.map((route) => `${route.from}->${route.to}`));
  assert(activeRules.length === expectedRoutes.length, 'existe una sola regla activa por ruta Excel');
  const unexpectedActive = activeRules.filter((rule) => (
    !allowed.has(`${Number(rule.fromCompanyId)}->${Number(rule.toCompanyId)}`)
  ));
  assert(unexpectedActive.length === 0, 'no existen rutas activas fuera de la matriz Excel');

  const indexes = await sequelize.getQueryInterface().showIndex('billing_runs');
  assert(
    indexes.some((index) => index.name === 'billing_runs_payroll_version_unique' && index.unique),
    'índice único billing_runs(payrollId, version)'
  );
  const lineColumns = await sequelize.getQueryInterface().describeTable('billing_run_lines');
  ['centroCosto', 'subtotalAmount', 'applyIva', 'ivaRate'].forEach((column) => {
    assert(!!lineColumns[column], `columna persistida billing_run_lines.${column}`);
  });
};

async function test() {
  let totalWarnings = 0;
  let criticalFailures = 0;

  console.log('Verificando configuración intercompany...\n');
  await verifyBillingConfiguration();
  console.log('');

  const payrolls = await PayrollHistory.findAll({
    where: { status: 'cerrada', periodType: '2da' },
    order: [['closedAt', 'DESC']],
    limit: 5
  });

  if (!payrolls.length) {
    console.log('No hay nóminas cerradas de 2ª quincena para verificar.');
    process.exit(0);
  }

  console.log(`Verificando ${payrolls.length} nómina(s) cerrada(s) de 2ª quincena...\n`);

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
      console.log(`\nVista previa billing: ${preview.details.length} detalles, ${preview.lines.length} líneas por centro de costo`);
      const blockingErrors = preview.blockingErrors || [];
      console.log(`Bloqueos de confirmación (${blockingErrors.length}):`);
      blockingErrors.forEach((message) => console.log(`  ! ${message}`));
      console.log(`Advertencias (${preview.warnings.length}):`);
      preview.warnings.forEach((w) => console.log(`  * ${w}`));
      totalWarnings += preview.warnings.length;

      if ((preview.lines || []).length > 0) {
        const missingCc = preview.lines.filter((l) => !l.centroCosto);
        if (missingCc.length) {
          criticalFailures += missingCc.length;
          console.error(`  CRÍTICAS: ${missingCc.length} líneas sin centro de costo`);
        } else {
          const ccs = new Set(preview.lines.map((l) => l.centroCosto));
          console.log(`Centros de costo en facturas: ${ccs.size}`);
        }
      }

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
