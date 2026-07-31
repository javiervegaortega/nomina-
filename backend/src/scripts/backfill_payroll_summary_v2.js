require('dotenv').config();
const { PayrollHistory, sequelize } = require('../models');
const {
  backfillPayrollSummaries,
  parsePayrollSummary
} = require('../services/payrollSummary.service');

async function main() {
  if (process.argv.includes('--apply') === false) {
    const rows = await PayrollHistory.findAll({ attributes: ['id', 'summary'] });
    const pending = rows.filter((row) => {
      const summary = parsePayrollSummary(row.summary);
      return !summary || summary.version < 2;
    });
    console.log(JSON.stringify({
      mode: 'dry-run',
      total: rows.length,
      pending: pending.length,
      ids: pending.map((row) => row.id)
    }, null, 2));
    console.log('Use --apply únicamente después de crear un respaldo de MySQL.');
    return;
  }
  const updated = await backfillPayrollSummaries(PayrollHistory);
  console.log(`Resumen v2 actualizado en ${updated} nómina(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
