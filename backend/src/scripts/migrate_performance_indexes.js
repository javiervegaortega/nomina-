require('dotenv').config();
const sequelize = require('../config/db');
const {
  INDEX_SPECS,
  ensurePerformanceIndexes,
  normalizedSignature,
  readTableIndexes
} = require('../config/ensureIndexes');

const apply = process.argv.includes('--apply');

const inspect = async () => {
  const report = {
    mode: apply ? 'apply' : 'dry-run',
    missing: [],
    existing: [],
    duplicates: []
  };
  const inspectedTables = new Set();
  for (const spec of INDEX_SPECS) {
    try {
      const indexes = await readTableIndexes(sequelize, spec.table);
      if (!inspectedTables.has(spec.table)) {
        const bySignature = new Map();
        indexes
          .filter((index) => index.name !== 'PRIMARY')
          .forEach((index) => {
            const signature = `${index.unique ? 'unique' : 'normal'}:${normalizedSignature(index.columns)}`;
            const names = bySignature.get(signature) || [];
            names.push(index.name);
            bySignature.set(signature, names);
          });
        for (const [signature, names] of bySignature.entries()) {
          if (names.length > 1) {
            report.duplicates.push({ table: spec.table, signature, indexes: names });
          }
        }
        inspectedTables.add(spec.table);
      }
      const signature = normalizedSignature(spec.columns);
      const equivalent = indexes.find((index) => (
        normalizedSignature(index.columns) === signature
        && (!spec.unique || index.unique)
      ));
      if (equivalent) {
        report.existing.push({
          table: spec.table,
          requested: spec.name,
          existing: equivalent.name
        });
      } else {
        report.missing.push({
          table: spec.table,
          name: spec.name,
          columns: spec.columns,
          unique: !!spec.unique
        });
      }
    } catch (error) {
      report.missing.push({
        table: spec.table,
        name: spec.name,
        error: error.message
      });
    }
  }
  console.log(JSON.stringify(report, null, 2));
  if (apply) await ensurePerformanceIndexes(sequelize);
};

inspect()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
