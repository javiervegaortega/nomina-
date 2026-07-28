/**
 * Columnas para lotes de bonos de 2ª quincena (idempotente).
 */
async function ensureOperationBatchSchema(sequelize) {
  const qi = sequelize.getQueryInterface();
  const table = 'operation_batches';

  const addColumnIfMissing = async (column, definition) => {
    try {
      const desc = await qi.describeTable(table);
      if (desc[column]) return;
      await qi.addColumn(table, column, definition);
      console.log(`[operations] Columna ${table}.${column} agregada.`);
    } catch (err) {
      if (!String(err.message).includes('Duplicate column')) {
        throw err;
      }
    }
  };

  await addColumnIfMissing('companyId', {
    type: sequelize.Sequelize.INTEGER,
    allowNull: true
  });
  await addColumnIfMissing('payrollDraftId', {
    type: sequelize.Sequelize.STRING,
    allowNull: true
  });
  await addColumnIfMissing('purpose', {
    type: sequelize.Sequelize.STRING(32),
    allowNull: false,
    defaultValue: 'GENERAL'
  });
}

module.exports = { ensureOperationBatchSchema };
