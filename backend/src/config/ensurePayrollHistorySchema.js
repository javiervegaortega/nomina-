/**
 * Migración idempotente: columna summary en payrollhistories.
 */
async function ensurePayrollHistorySchema(sequelize) {
  const qi = sequelize.getQueryInterface();

  try {
    const desc = await qi.describeTable('payrollhistories');
    if (!desc.summary) {
      await qi.addColumn('payrollhistories', 'summary', {
        type: sequelize.Sequelize.JSON,
        allowNull: true
      });
      console.log('[payroll] Columna payrollhistories.summary agregada.');
    }
  } catch (err) {
    if (!String(err.message).includes('Duplicate column')) {
      console.warn('[payroll] payrollhistories.summary:', err.message);
    }
  }

  if (process.env.RUN_PAYROLL_SUMMARY_BACKFILL === '1') {
    try {
      const { PayrollHistory } = require('../models');
      const { backfillPayrollSummaries } = require('../services/payrollSummary.service');
      await backfillPayrollSummaries(PayrollHistory);
    } catch (err) {
      console.warn('[payroll] backfill summary:', err.message);
    }
  }
}

module.exports = { ensurePayrollHistorySchema };
