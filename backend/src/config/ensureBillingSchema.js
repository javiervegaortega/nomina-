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
      'SELECT id, fromCompany, toCompany, fromCompanyId, toCompanyId, isActive, marginPercentage, applyIva, ivaRate, concept FROM billing_rules'
    );
    const [companies] = await sequelize.query(
      'SELECT id, nombre_comercial, razon_social FROM empresa'
    );
    const nameToId = {};
    const idToName = {};
    companies.forEach((c) => {
      const name = c.nombre_comercial || c.razon_social || `Empresa ${c.id}`;
      idToName[c.id] = name;
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

    // Facturación solo entre Proquima (1), Unhesa (2), Econacional (3).
    // Desactivar reglas que involucren otras empresas; asegurar pares del trío.
    const BILLABLE = new Set([1, 2, 3]);
    let deactivated = 0;
    for (const rule of rules) {
      const fromId = Number(rule.fromCompanyId)
        || nameToId[String(rule.fromCompany || '').trim().toUpperCase()]
        || 0;
      const toId = Number(rule.toCompanyId)
        || nameToId[String(rule.toCompany || '').trim().toUpperCase()]
        || 0;
      const shouldBeActive = BILLABLE.has(fromId) && BILLABLE.has(toId) && fromId !== toId;
      if (rule.isActive && !shouldBeActive) {
        await sequelize.query(
          'UPDATE billing_rules SET isActive = 0 WHERE id = ?',
          { replacements: [rule.id] }
        );
        deactivated += 1;
      }
    }
    if (deactivated > 0) {
      console.log(`[billing] Reglas fuera del trío desactivadas: ${deactivated}`);
    }

    const [freshRules] = await sequelize.query(
      'SELECT fromCompanyId, toCompanyId, isActive FROM billing_rules'
    );
    const activePairs = new Set(
      freshRules
        .filter((r) => r.isActive && r.fromCompanyId && r.toCompanyId)
        .map((r) => `${r.fromCompanyId}->${r.toCompanyId}`)
    );

    const template = rules.find((r) => {
      const fromId = Number(r.fromCompanyId) || 0;
      const toId = Number(r.toCompanyId) || 0;
      return BILLABLE.has(fromId) && BILLABLE.has(toId);
    }) || {};

    const margin = template.marginPercentage != null ? template.marginPercentage : 4;
    const applyIva = template.applyIva != null ? (template.applyIva ? 1 : 0) : 1;
    const ivaRate = template.ivaRate != null ? template.ivaRate : 0.12;
    const billableIds = [1, 2, 3].filter((id) => idToName[id]);
    let created = 0;

    for (const fromId of billableIds) {
      for (const toId of billableIds) {
        if (fromId === toId) continue;
        const key = `${fromId}->${toId}`;
        if (activePairs.has(key)) continue;

        const inactive = freshRules.find(
          (r) => Number(r.fromCompanyId) === fromId && Number(r.toCompanyId) === toId && !r.isActive
        );
        if (inactive) {
          await sequelize.query(
            'UPDATE billing_rules SET isActive = 1 WHERE fromCompanyId = ? AND toCompanyId = ?',
            { replacements: [fromId, toId] }
          );
          created += 1;
          continue;
        }

        await sequelize.query(
          `INSERT INTO billing_rules
            (fromCompanyId, toCompanyId, fromCompany, toCompany, concept, marginPercentage, applyIva, ivaRate, isActive, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
          {
            replacements: [
              fromId,
              toId,
              idToName[fromId],
              idToName[toId],
              'Servicios de RRHH',
              margin,
              applyIva,
              ivaRate
            ]
          }
        );
        created += 1;
      }
    }
    if (created > 0) {
      console.log(`[billing] Reglas del trío creadas/reactivadas: ${created}`);
    }
  } catch (err) {
    console.warn('[billing] migrate rule IDs / billable trio:', err.message);
  }
}

module.exports = { ensureBillingSchema };
