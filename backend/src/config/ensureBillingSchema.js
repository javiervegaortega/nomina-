/**
 * Migración idempotente para Phase 6 — facturación intercompañía.
 */
async function ensureBillingSchema(sequelize) {
  const qi = sequelize.getQueryInterface();

  const addColumnIfMissing = async (table, column, definition) => {
    try {
      const desc = await qi.describeTable(table);
      if (!desc[column]) {
        await qi.addColumn(table, column, definition);
        console.log(`[billing] Columna ${table}.${column} agregada.`);
      }
    } catch (err) {
      if (!String(err.message).includes('Duplicate column')) {
        console.warn(`[billing] ${table}.${column}:`, err.message);
      }
    }
  };

  await addColumnIfMissing('billing_rules', 'fromCompanyId', {
    type: sequelize.Sequelize.INTEGER,
    allowNull: true
  });
  await addColumnIfMissing('billing_rules', 'toCompanyId', {
    type: sequelize.Sequelize.INTEGER,
    allowNull: true
  });
  await addColumnIfMissing('billing_rules', 'ivaRate', {
    type: sequelize.Sequelize.DECIMAL(5, 4),
    allowNull: false,
    defaultValue: 0.12
  });

  try {
    await qi.changeColumn('billing_rules', 'fromCompany', {
      type: sequelize.Sequelize.STRING,
      allowNull: true
    });
    await qi.changeColumn('billing_rules', 'toCompany', {
      type: sequelize.Sequelize.STRING,
      allowNull: true
    });
  } catch (err) {
    console.warn('[billing] alter nullable fromCompany/toCompany:', err.message);
  }

  try {
    const [rules] = await sequelize.query(
      'SELECT id, fromCompany, toCompany, fromCompanyId, toCompanyId FROM billing_rules'
    );
    const [companies] = await sequelize.query(
      'SELECT id, nombre_comercial, razon_social FROM empresa'
    );
    const nameToId = {};
    companies.forEach((c) => {
      if (c.nombre_comercial) nameToId[String(c.nombre_comercial).trim().toUpperCase()] = c.id;
      if (c.razon_social) nameToId[String(c.razon_social).trim().toUpperCase()] = c.id;
    });
    for (const rule of rules) {
      const fromId = rule.fromCompanyId || nameToId[String(rule.fromCompany || '').trim().toUpperCase()] || null;
      const toId = rule.toCompanyId || nameToId[String(rule.toCompany || '').trim().toUpperCase()] || null;
      if ((fromId && !rule.fromCompanyId) || (toId && !rule.toCompanyId)) {
        await sequelize.query(
          'UPDATE billing_rules SET fromCompanyId = ?, toCompanyId = ? WHERE id = ?',
          { replacements: [fromId, toId, rule.id] }
        );
      }
    }
  } catch (err) {
    console.warn('[billing] migrate rule IDs:', err.message);
  }
}

module.exports = { ensureBillingSchema };
