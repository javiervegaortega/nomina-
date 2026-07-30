/**
 * Columnas para lotes de bonos de 2ª quincena (idempotente).
 */
async function ensureOperationBatchSchema(sequelize) {
  const qi = sequelize.getQueryInterface();
  const table = 'operation_batches';
  const logsTable = 'operation_logs';

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

  const logsDescription = await qi.describeTable(logsTable);
  if (!logsDescription.requesterId) {
    await qi.addColumn(logsTable, 'requesterId', {
      type: sequelize.Sequelize.INTEGER,
      allowNull: true
    });
    console.log(`[operations] Columna ${logsTable}.requesterId agregada.`);
  }

  // Los registros historicos de lotes generales pertenecen al creador del lote.
  await sequelize.query(
    `UPDATE operation_logs AS logs
     INNER JOIN operation_batches AS batches ON batches.id = logs.batchId
     SET logs.requesterId = batches.userId
     WHERE logs.requesterId IS NULL`
  );

  // Preservar los registros legados antes de retirar DOBLE del enum.
  await sequelize.query(
    `UPDATE operation_logs
     SET hourType = 'NOCTURNA'
     WHERE hourType = 'DOBLE'`
  );
  await qi.changeColumn(logsTable, 'hourType', {
    type: sequelize.Sequelize.ENUM('SIMPLE', 'NOCTURNA'),
    allowNull: true
  });
}

module.exports = { ensureOperationBatchSchema };
