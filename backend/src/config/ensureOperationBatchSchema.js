/**
 * Columnas para lotes de bonos de 2ª quincena (idempotente).
 */
const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

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
  await addColumnIfMissing('periodMonth', {
    type: sequelize.Sequelize.STRING(7),
    allowNull: true
  });
  await addColumnIfMissing('captureState', {
    type: sequelize.Sequelize.STRING(16),
    allowNull: false,
    defaultValue: 'OPEN'
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

  // Inferir el mes de los lotes automáticos existentes sin tocar registros ya procesados.
  await sequelize.query(
    `UPDATE operation_batches AS batches
     INNER JOIN (
       SELECT batchId, DATE_FORMAT(MIN(date), '%Y-%m') AS periodMonth
       FROM operation_logs
       WHERE batchId IS NOT NULL
       GROUP BY batchId
     ) AS logs ON logs.batchId = batches.id
     SET batches.periodMonth = logs.periodMonth
     WHERE batches.purpose = 'BONOS_2DA'
       AND (batches.periodMonth IS NULL OR batches.periodMonth = '')`
  );
  await sequelize.query(
    `UPDATE operation_batches AS batches
     INNER JOIN payroll_drafts AS drafts ON drafts.id = batches.payrollDraftId
     SET batches.periodMonth = DATE_FORMAT(drafts.createdAt, '%Y-%m')
     WHERE batches.purpose = 'BONOS_2DA'
       AND (batches.periodMonth IS NULL OR batches.periodMonth = '')`
  );

  const [untitledMonthBatches] = await sequelize.query(
    `SELECT id, title
     FROM operation_batches
     WHERE purpose = 'BONOS_2DA'
       AND (periodMonth IS NULL OR periodMonth = '')`
  );
  const monthNumbers = {
    enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
    julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12'
  };
  for (const batch of untitledMonthBatches) {
    const normalized = String(batch.title || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const match = normalized.match(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{4})\b/);
    if (!match) continue;
    await sequelize.query(
      `UPDATE operation_batches SET periodMonth = ? WHERE id = ?`,
      { replacements: [`${match[2]}-${monthNumbers[match[1]]}`, batch.id] }
    );
  }
  await sequelize.query(
    `UPDATE operation_batches
     SET captureState = 'OPEN'
     WHERE captureState IS NULL OR captureState = ''`
  );

  // Instalaciones que ya tenían una quincena abierta reciben el lote mensual
  // sin obligar a recrear la nómina. Solo se consideran borradores editables;
  // las nóminas históricas procesadas no se reabren.
  const [activeDrafts] = await sequelize.query(
    `SELECT id, companies, createdAt, periodType
     FROM payroll_drafts
     WHERE isApproved = 0 AND periodType IN ('1ra', '2da')
     ORDER BY CASE WHEN periodType = '2da' THEN 0 ELSE 1 END, createdAt DESC`
  );
  const [companyRows] = await sequelize.query(
    `SELECT id, nombre_comercial, nit FROM empresa`
  );
  for (const draft of activeDrafts) {
    let draftCompanies = [];
    try {
      draftCompanies = Array.isArray(draft.companies)
        ? draft.companies
        : JSON.parse(draft.companies || '[]');
    } catch {
      draftCompanies = [draft.companies];
    }
    if (!Array.isArray(draftCompanies) || draftCompanies.length !== 1) continue;
    const rawCompany = String(draftCompanies[0] ?? '');
    const company = companyRows.find((row) => (
      String(row.id) === rawCompany
      || row.nombre_comercial === rawCompany
      || row.nit === rawCompany
    ));
    const created = new Date(draft.createdAt);
    if (!company || Number.isNaN(created.getTime())) continue;
    const periodMonth = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
    const [existing] = await sequelize.query(
      `SELECT id FROM operation_batches
       WHERE purpose = 'BONOS_2DA' AND companyId = ? AND periodMonth = ? LIMIT 1`,
      { replacements: [company.id, periodMonth] }
    );
    if (existing.length > 0) continue;
    const title = `Operaciones mensuales — ${company.nombre_comercial || 'Empresa'} — ${MONTH_NAMES_ES[created.getMonth()]} ${created.getFullYear()} (pago en 2ª quincena)`;
    await sequelize.query(
      `INSERT INTO operation_batches
       (title, status, companyId, payrollDraftId, periodMonth, captureState, purpose, createdAt, updatedAt)
       VALUES (?, 'DRAFT', ?, ?, ?, 'OPEN', 'BONOS_2DA', NOW(), NOW())`,
      { replacements: [title, company.id, String(draft.id), periodMonth] }
    );
  }

  // Unificar lotes legados repetidos por empresa y mes, preservando logs e historial.
  const [duplicates] = await sequelize.query(
    `SELECT companyId, periodMonth, MIN(id) AS canonicalId, GROUP_CONCAT(id ORDER BY id) AS ids
     FROM operation_batches
     WHERE purpose = 'BONOS_2DA'
       AND companyId IS NOT NULL
       AND periodMonth IS NOT NULL
       AND periodMonth <> ''
     GROUP BY companyId, periodMonth
     HAVING COUNT(*) > 1`
  );
  for (const duplicate of duplicates) {
    const ids = String(duplicate.ids).split(',').map(Number).filter(Number.isFinite);
    const canonicalId = Number(duplicate.canonicalId);
    const redundantIds = ids.filter((id) => id !== canonicalId);
    if (redundantIds.length === 0) continue;
    const placeholders = redundantIds.map(() => '?').join(', ');
    const allPlaceholders = ids.map(() => '?').join(', ');
    const [sourceBatches] = await sequelize.query(
      `SELECT id, captureState, payrollDraftId FROM operation_batches WHERE id IN (${allPlaceholders})`,
      { replacements: ids }
    );
    const states = new Set(sourceBatches.map((batch) => batch.captureState));
    const captureState = states.has('CLOSED') ? 'CLOSED' : states.has('FROZEN') ? 'FROZEN' : 'OPEN';
    const payrollDraftId = sourceBatches.find((batch) => batch.payrollDraftId)?.payrollDraftId || null;
    await sequelize.query(
      `UPDATE operation_batches SET captureState = ?, payrollDraftId = ? WHERE id = ?`,
      { replacements: [captureState, payrollDraftId, canonicalId] }
    );
    await sequelize.query(
      `UPDATE operation_logs SET batchId = ? WHERE batchId IN (${placeholders})`,
      { replacements: [canonicalId, ...redundantIds] }
    );
    await sequelize.query(
      `DELETE FROM operation_batches WHERE id IN (${placeholders})`,
      { replacements: redundantIds }
    );
  }
}

module.exports = { ensureOperationBatchSchema };
