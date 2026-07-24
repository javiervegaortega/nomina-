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
  await addColumnIfMissing('billing_run_lines', 'centroCosto', {
    type: sequelize.Sequelize.STRING,
    allowNull: true
  });
  await addColumnIfMissing('billing_run_lines', 'subtotalAmount', {
    type: sequelize.Sequelize.DECIMAL(15, 4),
    allowNull: false,
    defaultValue: 0
  });
  await addColumnIfMissing('billing_run_lines', 'applyIva', {
    type: sequelize.Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true
  });
  await addColumnIfMissing('billing_run_lines', 'ivaRate', {
    type: sequelize.Sequelize.DECIMAL(5, 4),
    allowNull: false,
    defaultValue: 0.12
  });

  try {
    const indexes = await qi.showIndex('billing_runs');
    const hasPayrollVersionUnique = indexes.some(
      (index) => index.name === 'billing_runs_payroll_version_unique'
    );
    if (!hasPayrollVersionUnique) {
      await qi.addIndex('billing_runs', ['payrollId', 'version'], {
        unique: true,
        name: 'billing_runs_payroll_version_unique'
      });
      console.log('[billing] Índice único payrollId/version agregado.');
    }
  } catch (err) {
    console.warn('[billing] índice único payrollId/version:', err.message);
  }

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
      `SELECT id, fromCompany, toCompany, fromCompanyId, toCompanyId, isActive,
              marginPercentage, applyIva, ivaRate, concept
       FROM billing_rules
       ORDER BY id ASC`
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

    // Rutas observadas en los Excel. Proquima/Unhesa no llevan margen;
    // Econacional lleva 4%, y Econacional → Cleartec no lleva IVA.
    const ROUTE_DEFAULTS = [
      { fromId: 1, toId: 2, margin: 0, applyIva: 1, ivaRate: 0.12 },
      { fromId: 1, toId: 3, margin: 0, applyIva: 1, ivaRate: 0.12 },
      { fromId: 2, toId: 1, margin: 0, applyIva: 1, ivaRate: 0.12 },
      { fromId: 2, toId: 3, margin: 0, applyIva: 1, ivaRate: 0.12 },
      { fromId: 3, toId: 1, margin: 4, applyIva: 1, ivaRate: 0.12 },
      { fromId: 3, toId: 2, margin: 4, applyIva: 1, ivaRate: 0.12 },
      { fromId: 3, toId: 4, margin: 4, applyIva: 0, ivaRate: 0 }
    ];
    const ROUTES_BY_KEY = new Map(
      ROUTE_DEFAULTS.map((route) => [`${route.fromId}->${route.toId}`, route])
    );
    let aligned = 0;
    let deactivated = 0;
    const seenAllowedRoutes = new Set();
    for (const rule of rules) {
      const fromId = Number(rule.fromCompanyId)
        || nameToId[String(rule.fromCompany || '').trim().toUpperCase()]
        || 0;
      const toId = Number(rule.toCompanyId)
        || nameToId[String(rule.toCompany || '').trim().toUpperCase()]
        || 0;
      const route = ROUTES_BY_KEY.get(`${fromId}->${toId}`);

      if (route) {
        const routeKey = `${route.fromId}->${route.toId}`;
        if (seenAllowedRoutes.has(routeKey)) {
          if (Number(rule.isActive) !== 0) {
            await sequelize.query(
              'UPDATE billing_rules SET isActive = 0, updatedAt = NOW() WHERE id = ?',
              { replacements: [rule.id] }
            );
            deactivated += 1;
          }
          continue;
        }
        seenAllowedRoutes.add(routeKey);

        const needsAlignment = Number(rule.fromCompanyId) !== route.fromId
          || Number(rule.toCompanyId) !== route.toId
          || Number(rule.marginPercentage) !== route.margin
          || Number(rule.applyIva) !== route.applyIva
          || Number(rule.ivaRate) !== route.ivaRate
          || Number(rule.isActive) !== 1
          || !String(rule.fromCompany || '').trim()
          || !String(rule.toCompany || '').trim();

        if (needsAlignment) {
          await sequelize.query(
            `UPDATE billing_rules
             SET fromCompanyId = ?,
                 toCompanyId = ?,
                 fromCompany = COALESCE(NULLIF(TRIM(fromCompany), ''), ?),
                 toCompany = COALESCE(NULLIF(TRIM(toCompany), ''), ?),
                 marginPercentage = ?,
                 applyIva = ?,
                 ivaRate = ?,
                 isActive = 1,
                 updatedAt = NOW()
             WHERE id = ?`,
            {
              replacements: [
                route.fromId,
                route.toId,
                idToName[route.fromId],
                idToName[route.toId],
                route.margin,
                route.applyIva,
                route.ivaRate,
                rule.id
              ]
            }
          );
          aligned += 1;
        }
      } else if (Number(rule.isActive) !== 0) {
        await sequelize.query(
          'UPDATE billing_rules SET isActive = 0, updatedAt = NOW() WHERE id = ?',
          { replacements: [rule.id] }
        );
        deactivated += 1;
      }
    }
    if (aligned > 0) {
      console.log(`[billing] Reglas existentes alineadas con los Excel: ${aligned}`);
    }
    if (deactivated > 0) {
      console.log(`[billing] Reglas fuera de las rutas de Excel desactivadas: ${deactivated}`);
    }

    const [freshRules] = await sequelize.query(
      'SELECT fromCompanyId, toCompanyId, isActive FROM billing_rules'
    );
    const existingPairs = new Set(
      freshRules
        .filter((r) => r.fromCompanyId && r.toCompanyId)
        .map((r) => `${r.fromCompanyId}->${r.toCompanyId}`)
    );

    let created = 0;

    for (const route of ROUTE_DEFAULTS) {
      const { fromId, toId, margin, applyIva, ivaRate } = route;
      if (!idToName[fromId] || !idToName[toId]) continue;
      const key = `${fromId}->${toId}`;
      if (existingPairs.has(key)) continue;

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
    if (created > 0) {
      console.log(`[billing] Reglas iniciales según Excel creadas: ${created}`);
    }
  } catch (err) {
    console.warn('[billing] migrate rule IDs / rutas Excel:', err.message);
  }
}

module.exports = { ensureBillingSchema };
