/**
 * Crea nóminas 1ª + 2ª de julio 2026 para Proquima, Unhesa y Econacional,
 * asigna un bono de catálogo a todos los empleados activos en 2ª,
 * asegura que no haya ajustes fijos en Econacional → Unhesa, y muestra preview de
 * facturación de Econacional para verificar el cuadre.
 *
 * Uso:
 *   node scripts/create_payrolls_with_bonuses.js
 *   node scripts/create_payrolls_with_bonuses.js --bonus=225
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Op } = require('sequelize');
const {
  sequelize,
  Employee,
  Company,
  Bonus,
  BillingRule,
  PayrollDraft,
  PayrollHistory
} = require('../src/models');
const {
  getTokenForRole,
  api,
  checkServer,
  buildDraftEmployee
} = require('../src/scripts/lib/testHelpers');

const BONUS_AMOUNT = Number(
  process.argv.find((a) => a.startsWith('--bonus='))?.split('=')[1] || 225
);

const YEAR = 2026;
const MONTH = 7; // Julio (mes actual del entorno)
const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const MONTH_NAME = monthNames[MONTH - 1];
const draftRefDate1ra = `${YEAR}-${String(MONTH).padStart(2, '0')}-10T12:00:00.000Z`;
const draftRefDate2da = `${YEAR}-${String(MONTH).padStart(2, '0')}-20T12:00:00.000Z`;
const bonusDate = `${YEAR}-${String(MONTH).padStart(2, '0')}-20`;

const PAYROLL_COMPANY_IDS = [1, 2, 3];

function companyName(c) {
  return c.nombre_comercial || c.razon_social || String(c.id);
}

function findDraftForCompany(drafts, cName) {
  if (!Array.isArray(drafts)) return null;
  return drafts.find((d) => {
    let comps = d.companies;
    if (typeof comps === 'string') {
      try { comps = JSON.parse(comps); } catch { comps = []; }
    }
    if (!Array.isArray(comps)) comps = [];
    return comps.some((c) => String(c).trim() === String(cName).trim())
      || String(d.title || '').includes(cName);
  }) || null;
}

async function ensureBillingRule() {
  const [updated] = await BillingRule.update(
    {
      baseAdjustment: 0,
      marginPercentage: 4,
      applyIva: true,
      ivaRate: 0.12,
      isActive: true
    },
    { where: { fromCompanyId: 3, toCompanyId: 2 } }
  );
  const rule = await BillingRule.findOne({ where: { fromCompanyId: 3, toCompanyId: 2 } });
  console.log(
    `Regla Econacional→Unhesa: baseAdjustment=Q${Number(rule?.baseAdjustment || 0).toFixed(2)} `
    + `(filas actualizadas: ${updated})`
  );
  if (!rule || Number(rule.baseAdjustment) !== 0) {
    throw new Error('No se pudo dejar en cero el ajuste Econacional → Unhesa');
  }
}

async function ensureCatalogBonusForAll(employees) {
  const bonusId = `bonus-julio-${YEAR}-${MONTH}-all`;
  const assignments = {};
  employees.forEach((emp) => {
    assignments[String(emp.id)] = BONUS_AMOUNT;
  });

  const existing = await Bonus.findByPk(bonusId);
  if (existing) {
    await existing.update({
      name: `Bono operativo ${MONTH_NAME} ${YEAR}`,
      type: 'operativo',
      amount: BONUS_AMOUNT,
      date: bonusDate,
      assignments
    });
  } else {
    await Bonus.create({
      id: bonusId,
      name: `Bono operativo ${MONTH_NAME} ${YEAR}`,
      type: 'operativo',
      amount: BONUS_AMOUNT,
      date: bonusDate,
      assignments
    });
  }
  console.log(
    `Bono de catálogo listo: ${bonusId} → Q${BONUS_AMOUNT.toFixed(2)} `
    + `a ${employees.length} empleados (fecha ${bonusDate})`
  );
  return bonusId;
}

async function closeDraftToHistory(token, draft, expectedStatus) {
  const res = await api('/api/payrolls', {
    method: 'POST',
    body: JSON.stringify({ draftId: draft.id })
  }, token);
  if (res.status !== 201) {
    throw new Error(
      `POST /api/payrolls falló (${res.status}): ${JSON.stringify(res.body)?.slice(0, 300)}`
    );
  }
  if (res.body?.status !== expectedStatus) {
    throw new Error(
      `Se esperaba status=${expectedStatus}, llegó ${res.body?.status}`
    );
  }
  return res.body?.id || draft.id;
}

async function createPeriodPayroll(token, {
  company,
  payrollEmployees,
  periodType,
  draftRefDate,
  bonuses,
  anticipoMap
}) {
  const cName = companyName(company);
  let draftEmployees = payrollEmployees.map((emp) => {
    const built = buildDraftEmployee(emp.toJSON ? emp.toJSON() : emp, {
      periodType,
      draftRefDate,
      operationLogs: [],
      bonuses,
      commissions: []
    });
    if (periodType === '2da' && anticipoMap) {
      built.anticipo1ra = anticipoMap[emp.id] || anticipoMap[String(emp.id)] || 0;
    }
    return built;
  });

  const draftId = `draft-${company.id}-${periodType}-${Date.now()}`;
  const title = `Nómina ${cName} ${MONTH_NAME} ${YEAR} ${periodType === '2da' ? '2ª' : '1ª'}`;
  const createDraft = await api('/api/payroll-drafts', {
    method: 'POST',
    body: JSON.stringify({
      id: draftId,
      title,
      companies: [cName],
      periodType,
      createdAt: draftRefDate,
      employees: draftEmployees
    })
  }, token);
  if (createDraft.status !== 201) {
    throw new Error(
      `[${cName}] crear borrador ${periodType} → ${createDraft.status}: `
      + `${JSON.stringify(createDraft.body)?.slice(0, 400)}`
    );
  }

  const getDraft = await api('/api/payroll-drafts', {}, token);
  const draft = Array.isArray(getDraft.body)
    ? getDraft.body.find((d) => d.id === draftId)
    : null;
  draftEmployees = draft?.employees || draftEmployees;

  if (periodType === '2da') {
    const withBonus = draftEmployees.filter((e) => {
      const applied = e.appliedBonuses || {};
      return Object.values(applied).some((v) => Number(v) > 0)
        || Number(e.extras?.bonos || 0) > 0
        || Number(e.bon_dec_37_2001 || 0) > 0;
    }).length;
    console.log(`  [${cName}] 2ª: ${withBonus}/${draftEmployees.length} con bono decreto y/o catálogo`);
  }

  let auditId = await closeDraftToHistory(token, {
    id: draftId,
    title,
    companies: [cName],
    periodType,
    employees: draftEmployees
  }, 'auditoria');

  const approve = await api(`/api/payrolls/${auditId}/auditor-approve`, {
    method: 'POST',
    body: JSON.stringify({})
  }, token);
  if (approve.status !== 200) {
    throw new Error(`[${cName}] auditor-approve ${periodType} → ${approve.status}`);
  }

  const draftsRes = await api('/api/payroll-drafts', {}, token);
  const approvedDraft = findDraftForCompany(draftsRes.body, cName);
  if (!approvedDraft) {
    throw new Error(`[${cName}] no se recreó borrador aprobado (${periodType})`);
  }

  const closedId = await closeDraftToHistory(token, approvedDraft, 'cerrada');
  const hist = await PayrollHistory.findByPk(closedId);
  if (!hist || hist.status !== 'cerrada') {
    throw new Error(`[${cName}] nómina ${periodType} no quedó cerrada`);
  }

  console.log(`  [${cName}] ${periodType} cerrada → ${closedId} (${draftEmployees.length} empleados)`);
  return {
    closedPayrollId: closedId,
    draftEmployees: approvedDraft.employees || draftEmployees
  };
}

function buildAnticipoMap(employees) {
  const map = {};
  (employees || []).forEach((e) => {
    const net = Number(e.calculated?.netPayable ?? e.calculated?.net ?? e.netPayable ?? 0);
    map[e.id] = net;
    map[String(e.id)] = net;
  });
  return map;
}

async function previewEconacionalBilling(token, payrollId) {
  const preview = await api('/api/billing/preview', {
    method: 'POST',
    body: JSON.stringify({ payrollId })
  }, token);
  if (preview.status !== 200) {
    console.log('  WARN billing preview:', preview.status, JSON.stringify(preview.body)?.slice(0, 400));
    return;
  }

  const lines = preview.body?.lines || [];
  const unhesaLine = lines.find((l) =>
    Number(l.fromCompanyId) === 3 && Number(l.toCompanyId) === 2
  );
  console.log(`\nFacturación Econacional preview: ${lines.length} línea(s)`);
  if (unhesaLine) {
    console.log('  Econacional → Unhesa:');
    console.log(`    baseAdjustment: Q${Number(unhesaLine.baseAdjustment || 0).toFixed(2)}`);
    console.log(`    baseAmount:     Q${Number(unhesaLine.baseAmount || 0).toFixed(2)}`);
    console.log(`    marginAmount:   Q${Number(unhesaLine.marginAmount || 0).toFixed(2)}`);
    console.log(`    ivaAmount:      Q${Number(unhesaLine.ivaAmount || 0).toFixed(2)}`);
    console.log(`    totalAmount:    Q${Number(unhesaLine.totalAmount || 0).toFixed(2)}`);
    if (Number(unhesaLine.baseAdjustment || 0) === 0) {
      console.log('  OK: la factura usa la base calculada sin ajuste fijo.');
    } else {
      console.log('  FAIL: la línea Unhesa todavía tiene un ajuste fijo.');
    }
  } else {
    console.log('  WARN: no hubo línea neta Econacional→Unhesa (quizá el neteo la anuló).');
    lines.slice(0, 8).forEach((l) => {
      console.log(
        `    ${l.fromCompany} → ${l.toCompany}: base Q${Number(l.baseAmount || 0).toFixed(2)} `
        + `(adj Q${Number(l.baseAdjustment || 0).toFixed(2)}) total Q${Number(l.totalAmount || 0).toFixed(2)}`
      );
    });
  }
  if (preview.body?.blockingErrors?.length) {
    console.log('  Bloqueos:', preview.body.blockingErrors);
  }
}

async function main() {
  console.log('=== Crear nóminas + bonos + facturación calculada ===\n');

  if (!(await checkServer())) {
    throw new Error('Backend no responde en localhost:3000. Inícialo primero.');
  }

  await ensureBillingRule();

  const companies = await Company.findAll({
    where: { id: { [Op.in]: PAYROLL_COMPANY_IDS } },
    order: [['id', 'ASC']]
  });
  const allEmployees = await Employee.findAll({
    where: {
      empresa_principal: { [Op.in]: PAYROLL_COMPANY_IDS },
      sueldo_ordinario: { [Op.gt]: 0 },
      estado: { [Op.or]: ['ACTIVO', 'Activo', 'activo'] }
    }
  });
  if (allEmployees.length === 0) {
    // fallback sin filtro de estado estricto
    const fallback = await Employee.findAll({
      where: {
        empresa_principal: { [Op.in]: PAYROLL_COMPANY_IDS },
        sueldo_ordinario: { [Op.gt]: 0 }
      }
    });
    allEmployees.push(...fallback.filter((e) =>
      String(e.estado || '').toUpperCase() === 'ACTIVO'
    ));
  }

  await ensureCatalogBonusForAll(allEmployees);
  const bonuses = await Bonus.findAll();

  const { token } = await getTokenForRole('ADMIN');
  let econacional2daId = null;

  for (const company of companies) {
    const cName = companyName(company);
    console.log(`\n${'='.repeat(60)}\nEMPRESA: ${cName} (id=${company.id})\n${'='.repeat(60)}`);

    const payrollEmployees = allEmployees.filter(
      (e) => Number(e.empresa_principal) === Number(company.id)
    );
    if (payrollEmployees.length === 0) {
      console.log('  SKIP: sin empleados activos');
      continue;
    }

    const q1 = await createPeriodPayroll(token, {
      company,
      payrollEmployees,
      periodType: '1ra',
      draftRefDate: draftRefDate1ra,
      bonuses: [],
      anticipoMap: null
    });

    const anticipoMap = buildAnticipoMap(q1.draftEmployees);
    const q2 = await createPeriodPayroll(token, {
      company,
      payrollEmployees,
      periodType: '2da',
      draftRefDate: draftRefDate2da,
      bonuses,
      anticipoMap
    });

    if (Number(company.id) === 3) {
      econacional2daId = q2.closedPayrollId;
    }
  }

  if (econacional2daId) {
    await previewEconacionalBilling(token, econacional2daId);
  }

  console.log('\nListo.');
  await sequelize.close();
}

main().catch(async (err) => {
  console.error('\nERROR:', err.message || err);
  try { await sequelize.close(); } catch (_) { /* ignore */ }
  process.exit(1);
});
