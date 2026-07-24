/**
 * Migración idempotente para el control optimista de los borradores de nómina.
 */
async function ensurePayrollDraftSchema(sequelize) {
  const qi = sequelize.getQueryInterface();
  const definition = {
    type: sequelize.Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0
  };

  try {
    const desc = await qi.describeTable('payroll_drafts');
    if (!desc.revision) {
      await qi.addColumn('payroll_drafts', 'revision', definition);
      console.log('[payroll] Columna payroll_drafts.revision agregada.');
      return;
    }

    const defaultValue = Number(desc.revision.defaultValue);
    const isInteger = /INT/i.test(String(desc.revision.type || ''));
    if (
      desc.revision.allowNull !== false
      || defaultValue !== 0
      || !isInteger
    ) {
      if (desc.revision.allowNull !== false) {
        await sequelize.query(
          'UPDATE payroll_drafts SET revision = 0 WHERE revision IS NULL'
        );
      }
      await qi.changeColumn('payroll_drafts', 'revision', definition);
      console.log('[payroll] Columna payroll_drafts.revision alineada.');
    }
  } catch (err) {
    if (!String(err.message).includes('Duplicate column')) {
      throw err;
    }
  }
}

module.exports = { ensurePayrollDraftSchema };
