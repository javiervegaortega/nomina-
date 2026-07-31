/**
 * Índices aditivos e idempotentes. La equivalencia se decide por columnas y
 * unicidad, no por el nombre que haya recibido el índice en otra instalación.
 */
const INDEX_SPECS = [
  { table: 'employee', name: 'idx_emp_status_company', columns: ['estado', 'empresa_principal'] },
  { table: 'employee', name: 'idx_emp_department', columns: ['departmentId'] },
  { table: 'employee', name: 'idx_emp_area', columns: ['areaId'] },
  { table: 'employee', name: 'idx_emp_division', columns: ['divisionId'] },
  { table: 'employee', name: 'idx_emp_subdivision', columns: ['subdivisionId'] },
  { table: 'employee_records', name: 'idx_emp_records_employee', columns: ['employeeId'] },
  { table: 'employee_incidences', name: 'idx_emp_incidences_employee', columns: ['employeeId'] },
  {
    table: 'payroll_draft_employees',
    name: 'uq_draft_employee',
    columns: ['draftId', 'employeeId'],
    unique: true
  },
  {
    table: 'operation_logs',
    name: 'idx_oplogs_company_status_date',
    columns: ['companyId', 'status', 'date']
  },
  { table: 'operation_logs', name: 'idx_oplogs_employee', columns: ['employeeId'] },
  { table: 'operation_logs', name: 'idx_oplogs_batch', columns: ['batchId'] },
  { table: 'operation_logs', name: 'idx_oplogs_requester', columns: ['requesterId'] },
  { table: 'operation_log_reviews', name: 'idx_opreviews_log', columns: ['operationLogId'] },
  { table: 'operation_batches', name: 'idx_opbatches_user', columns: ['userId'] },
  { table: 'operation_batches', name: 'idx_opbatches_status', columns: ['status'] },
  {
    table: 'operation_batches',
    name: 'uq_opbatches_monthly_capture',
    columns: ['purpose', 'companyId', 'periodMonth'],
    unique: true
  },
  {
    table: 'PayrollHistories',
    name: 'idx_payrollhistory_status_period_created',
    columns: ['status', 'periodType', 'createdAt']
  },
  {
    table: 'Commissions',
    name: 'idx_commissions_status_company_date',
    columns: ['estado', 'empresa_id', 'fecha']
  },
  {
    table: 'billing_runs',
    name: 'idx_billing_runs_status_created',
    columns: ['status', 'createdAt']
  }
];

const normalizedSignature = (columns) => columns
  .map((column) => String(column).toLowerCase())
  .join(',');

const readTableIndexes = async (sequelize, table) => {
  const [rows] = await sequelize.query(
    `SELECT index_name, non_unique, seq_in_index, column_name
       FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND LOWER(table_name) = LOWER(?)
      ORDER BY index_name, seq_in_index`,
    { replacements: [table] }
  );
  const grouped = new Map();
  rows.forEach((row) => {
    const name = row.index_name;
    const index = grouped.get(name) || {
      name,
      unique: Number(row.non_unique) === 0,
      columns: []
    };
    index.columns.push(row.column_name);
    grouped.set(name, index);
  });
  return [...grouped.values()];
};

const quoteIdentifier = (value) => `\`${String(value).replace(/`/g, '``')}\``;

async function ensurePerformanceIndexes(sequelize) {
  const report = { created: [], existing: [], duplicates: [], errors: [] };
  const tableCache = new Map();

  for (const spec of INDEX_SPECS) {
    try {
      const existing = tableCache.get(spec.table)
        || await readTableIndexes(sequelize, spec.table);
      tableCache.set(spec.table, existing);
      const signature = normalizedSignature(spec.columns);
      const equivalent = existing.find((index) => (
        normalizedSignature(index.columns) === signature
        && (!spec.unique || index.unique)
      ));
      if (equivalent) {
        report.existing.push({ requested: spec.name, existing: equivalent.name });
        continue;
      }

      await sequelize.query(
        `CREATE ${spec.unique ? 'UNIQUE ' : ''}INDEX ${quoteIdentifier(spec.name)}
           ON ${quoteIdentifier(spec.table)}
           (${spec.columns.map(quoteIdentifier).join(', ')})`
      );
      report.created.push(spec.name);
      tableCache.set(spec.table, await readTableIndexes(sequelize, spec.table));
    } catch (error) {
      report.errors.push({ index: spec.name, error: error.message });
      console.warn(`[indexes] ${spec.name}: ${error.message}`);
    }
  }

  for (const [table, indexes] of tableCache.entries()) {
    const bySignature = new Map();
    indexes
      .filter((index) => index.name !== 'PRIMARY')
      .forEach((index) => {
        const signature = `${index.unique ? 'unique' : 'normal'}:${normalizedSignature(index.columns)}`;
        const matches = bySignature.get(signature) || [];
        matches.push(index.name);
        bySignature.set(signature, matches);
      });
    for (const [signature, names] of bySignature.entries()) {
      if (names.length < 2) continue;
      const duplicate = { table, signature, indexes: names };
      report.duplicates.push(duplicate);
      // La limpieza requiere respaldo confirmado y activación explícita.
      if (process.env.CLEAN_DUPLICATE_INDEXES === '1') {
        for (const duplicateName of names.slice(1)) {
          await sequelize.query(
            `DROP INDEX ${quoteIdentifier(duplicateName)} ON ${quoteIdentifier(table)}`
          );
        }
      }
    }
  }

  console.log(`[indexes] ${JSON.stringify(report)}`);
  return report;
}

module.exports = {
  INDEX_SPECS,
  ensurePerformanceIndexes,
  normalizedSignature,
  readTableIndexes
};
