/**
 * Asegura columnas que Sequelize sync no siempre agrega en tablas existentes.
 */
async function ensureEmployeeColumns(sequelize) {
  const alters = [
    { table: 'employee', column: 'observaciones', ddl: 'TEXT NULL' },
  ];

  for (const a of alters) {
    try {
      const [rows] = await sequelize.query(
        `SELECT 1 AS ok FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
         LIMIT 1`,
        { replacements: [a.table, a.column] }
      );
      if (rows.length > 0) continue;
      await sequelize.query(`ALTER TABLE \`${a.table}\` ADD COLUMN \`${a.column}\` ${a.ddl}`);
      console.log(`[schema] added ${a.table}.${a.column}`);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[schema] ${a.table}.${a.column}: ${err.message}`);
      }
    }
  }
}

module.exports = { ensureEmployeeColumns };
