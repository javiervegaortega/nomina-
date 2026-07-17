/**
 * Limpia datos transaccionales de nómina (conserva maestros).
 * Uso:
 *   node src/scripts/cleanup_payroll_data.js --dry-run
 *   node src/scripts/cleanup_payroll_data.js --confirm
 */
require('dotenv').config();
const {
  sequelize,
  BillingRunLine,
  BillingRun,
  BillingDistribution,
  PayrollDraftEmployee,
  PayrollDraft,
  PayrollHistory,
  OperationLog,
  OperationBatch,
  Commission
} = require('../models');

const isDryRun = process.argv.includes('--dry-run');
const isConfirm = process.argv.includes('--confirm');

const TABLES = [
  { name: 'billing_run_lines', model: BillingRunLine },
  { name: 'billing_runs', model: BillingRun },
  { name: 'billing_distributions', model: BillingDistribution },
  { name: 'payroll_draft_employees', model: PayrollDraftEmployee },
  { name: 'payroll_drafts', model: PayrollDraft },
  { name: 'payrollhistories', model: PayrollHistory },
  { name: 'operation_logs', model: OperationLog },
  { name: 'operation_batches', model: OperationBatch },
  { name: 'commissions', model: Commission }
];

async function countAll() {
  const counts = {};
  for (const { name, model } of TABLES) {
    try {
      counts[name] = await model.count();
    } catch (err) {
      counts[name] = `error: ${err.message}`;
    }
  }
  return counts;
}

async function main() {
  if (!isDryRun && !isConfirm) {
    console.error('Debe usar --dry-run (solo conteos) o --confirm (borrar datos).');
    process.exit(1);
  }

  console.log(`=== Limpieza de datos de nómina ${isDryRun ? '(DRY RUN)' : '(CONFIRMADO)'} ===\n`);

  const before = await countAll();
  console.log('Conteos actuales:');
  Object.entries(before).forEach(([t, c]) => console.log(`  ${t}: ${c}`));

  if (isDryRun) {
    console.log('\nDry run: no se eliminó nada.');
    await sequelize.close();
    process.exit(0);
  }

  const deleted = {};
  for (const { name, model } of TABLES) {
    try {
      const n = await model.destroy({ where: {}, truncate: false });
      deleted[name] = n;
      console.log(`  Eliminados ${n} de ${name}`);
    } catch (err) {
      try {
        const n = await model.destroy({ where: {} });
        deleted[name] = n;
        console.log(`  Eliminados ${n} de ${name} (destroy)`);
      } catch (err2) {
        console.error(`  ERROR en ${name}: ${err2.message}`);
        deleted[name] = `error: ${err2.message}`;
      }
    }
  }

  const after = await countAll();
  console.log('\nConteos post-limpieza:');
  Object.entries(after).forEach(([t, c]) => console.log(`  ${t}: ${c}`));

  await sequelize.close();
  console.log('\nLimpieza completada.');
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
