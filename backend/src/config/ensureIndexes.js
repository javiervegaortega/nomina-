/**
 * Crea índices de rendimiento de forma idempotente (sin alterar el schema funcional).
 * Compatible con MariaDB 10.4 (sin CREATE INDEX IF NOT EXISTS).
 */
async function ensurePerformanceIndexes(sequelize) {
  const indexes = [
    { table: 'employee', name: 'idx_emp_empresa_principal', columns: 'empresa_principal' },
    { table: 'employee', name: 'idx_emp_estado', columns: 'estado' },
    { table: 'employee', name: 'idx_emp_department', columns: 'departmentId' },
    { table: 'employee_records', name: 'idx_emp_records_employee', columns: 'employeeId' },
    { table: 'employee_incidences', name: 'idx_emp_incidences_employee', columns: 'employeeId' },
    { table: 'payroll_draft_employees', name: 'idx_draft_emps_draft', columns: 'draftId' },
    { table: 'operation_logs', name: 'idx_oplogs_employee', columns: 'employeeId' },
    { table: 'operation_logs', name: 'idx_oplogs_batch', columns: 'batchId' },
    { table: 'operation_logs', name: 'idx_oplogs_status', columns: 'status' },
    { table: 'operation_logs', name: 'idx_oplogs_company', columns: 'companyId' },
    { table: 'operation_logs', name: 'idx_oplogs_requester', columns: 'requesterId' },
    { table: 'operation_log_reviews', name: 'idx_opreviews_log', columns: 'operationLogId' },
    { table: 'operation_batches', name: 'idx_opbatches_user', columns: 'userId' },
    { table: 'operation_batches', name: 'idx_opbatches_status', columns: 'status' },
    { table: 'operation_batches', name: 'uq_opbatches_monthly_capture', columns: 'purpose, companyId, periodMonth', unique: true },
  ];

  for (const idx of indexes) {
    try {
      const [rows] = await sequelize.query(
        `SELECT 1 AS ok FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
         LIMIT 1`,
        { replacements: [idx.table, idx.name] }
      );
      if (rows.length > 0) continue;

      await sequelize.query(
        `CREATE ${idx.unique ? 'UNIQUE ' : ''}INDEX \`${idx.name}\` ON \`${idx.table}\` (${idx.columns})`
      );
    } catch (err) {
      // Columna/tabla ausente o índice ya existente: no bloquear el arranque
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[indexes] ${idx.name}: ${err.message}`);
      }
    }
  }
}

module.exports = { ensurePerformanceIndexes };
