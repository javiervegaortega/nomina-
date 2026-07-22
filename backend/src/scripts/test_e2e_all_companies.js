/**
 * E2E multi-empresa: ciclo completo por empresa (1ra + 2da + billing + reactivación).
 * Requiere backend corriendo.
 *
 * Uso:
 *   node src/scripts/test_e2e_all_companies.js
 *   node src/scripts/test_e2e_all_companies.js --company=1
 *   node src/scripts/test_e2e_all_companies.js --keep-data
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const {
  sequelize,
  Employee,
  Company,
  PayrollDraft,
  PayrollHistory
} = require('../models');
const { Op } = require('sequelize');
const {
  createAssert,
  getTokenForRole,
  api,
  checkServer,
  buildDraftEmployee,
  getFirstQuincenaPayouts
} = require('./lib/testHelpers');

const keepData = process.argv.includes('--keep-data');
const companyFilter = process.argv.find((a) => a.startsWith('--company='))?.split('=')[1];

const state = { passed: 0, failed: 0 };
const assert = createAssert(state);
const companyReports = [];

const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const opDate1ra = `${year}-${month}-10`;
const opDate2da = `${year}-${month}-20`;
const draftRefDate1ra = `${year}-${month}-10T12:00:00.000Z`;
const draftRefDate2da = `${year}-${month}-20T12:00:00.000Z`;
const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const currentMonth = monthNames[now.getMonth()];

function companyName(c) {
  return c.nombre_comercial || c.razon_social || String(c.id);
}

async function closeDraftToHistory(token, draft, status, isApproved, prefix, periodType) {
  const employees = draft.employees || [];
  const payrollId = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const effectivePeriod = periodType || draft.periodType || '1ra';
  const payload = {
    id: payrollId,
    title: draft.title,
    companies: draft.companies,
    periodType: effectivePeriod,
    status,
    isApproved: !!isApproved,
    employeesCount: employees.length,
    closedAt: new Date().toISOString(),
    data: employees,
    notes: draft.notes || null
  };

  const res = await api('/api/payrolls', {
    method: 'POST',
    body: JSON.stringify(payload)
  }, token);
  assert(res.status === 201, `[${draft.companies?.[0]}] POST /api/payrolls (${status}, ${effectivePeriod}) → ${res.status}`);
  if (res.status === 201 && draft.id) {
    await api(`/api/payroll-drafts/${draft.id}`, { method: 'DELETE' }, token).catch(() => {});
  }
  return payrollId;
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

async function buildDraftEmployees(payrollEmployees, ctx) {
  const { periodType, draftRefDate, operationLogs, bonuses, commissions, anticipoMap } = ctx;
  return payrollEmployees.map((emp) => {
    const built = buildDraftEmployee(emp.toJSON ? emp.toJSON() : emp, {
      periodType,
      draftRefDate,
      operationLogs,
      bonuses,
      commissions
    });
    if (periodType === '2da' && anticipoMap) {
      built.anticipo1ra = anticipoMap[emp.id] || anticipoMap[String(emp.id)] || 0;
    }
    return built;
  });
}

async function createAndClosePayroll(token, {
  company,
  payrollEmployees,
  testEmployee,
  periodType,
  draftRefDate,
  opDate,
  approvedLogs,
  bonuses,
  commissions,
  anticipoMap,
  skipAuditReject,
  prefix
}) {
  const cName = companyName(company);
  let draftEmployees = await buildDraftEmployees(payrollEmployees, {
    periodType,
    draftRefDate,
    operationLogs: approvedLogs,
    bonuses,
    commissions,
    anticipoMap
  });

  assert(
    draftEmployees.length === payrollEmployees.length,
    `[${cName}] Borrador ${periodType} incluye todos los empleados (${draftEmployees.length}/${payrollEmployees.length})`
  );

  if (periodType === '2da' && anticipoMap) {
    const withAnticipo = draftEmployees.filter((e) => Number(e.anticipo1ra) > 0).length;
    assert(withAnticipo > 0, `[${cName}] 2da quincena: al menos 1 empleado con anticipo1ra (got ${withAnticipo})`);
  }

  const draftId = `draft-e2e-${company.id}-${periodType}-${Date.now()}`;
  const createDraft = await api('/api/payroll-drafts', {
    method: 'POST',
    body: JSON.stringify({
      id: draftId,
      title: `Nómina E2E ${cName} ${periodType}`,
      companies: [cName],
      periodType,
      createdAt: draftRefDate,
      employees: draftEmployees
    })
  }, token);
  assert(createDraft.status === 201, `[${cName}] POST payroll-drafts ${periodType} → ${createDraft.status}`);

  const getDraft = await api('/api/payroll-drafts', {}, token);
  const draft = Array.isArray(getDraft.body) ? getDraft.body.find((d) => d.id === draftId) : null;
  draftEmployees = draft?.employees || draftEmployees;

  const focusEmp = draftEmployees.find((e) => String(e.id) === String(testEmployee.id));
  if (focusEmp?.calculated) {
    assert(!!focusEmp.calculated.gross, `[${cName}] Empleado focal tiene calculated.gross (${periodType})`);
    if (periodType === '2da') {
      assert(
        Number(focusEmp.calculated.anticipo1ra || focusEmp.anticipo1ra || 0) >= 0,
        `[${cName}] anticipo1ra presente en cálculo 2da`
      );
    }
  }

  let auditPayrollId = await closeDraftToHistory(token, {
    id: draftId,
    title: `Nómina E2E ${cName} ${periodType} Auditoría`,
    companies: [cName],
    periodType,
    employees: draftEmployees
  }, 'auditoria', false, prefix, periodType);

  if (!skipAuditReject && periodType === '1ra') {
    const reject = await api(`/api/payrolls/${auditPayrollId}/auditor-reject`, {
      method: 'POST',
      body: JSON.stringify({ note: 'Corrección E2E de prueba' })
    }, token);
    assert(reject.status === 200, `[${cName}] auditor-reject → ${reject.status}`);

    const draftsRes = await api('/api/payroll-drafts', {}, token);
    const rejectedDraft = findDraftForCompany(draftsRes.body, cName);
    assert(!!rejectedDraft, `[${cName}] Borrador recreado tras auditor-reject`);

    auditPayrollId = await closeDraftToHistory(token, {
      id: rejectedDraft.id,
      title: `Nómina E2E ${cName} ${periodType} Re-auditoría`,
      companies: [cName],
      periodType,
      employees: rejectedDraft.employees || draftEmployees
    }, 'auditoria', false, prefix, periodType);
  }

  const approve = await api(`/api/payrolls/${auditPayrollId}/auditor-approve`, {
    method: 'POST',
    body: JSON.stringify({})
  }, token);
  assert(approve.status === 200, `[${cName}] auditor-approve ${periodType} → ${approve.status}`);

  const draftsRes = await api('/api/payroll-drafts', {}, token);
  let approvedDraft = findDraftForCompany(draftsRes.body, cName);
  assert(!!approvedDraft, `[${cName}] Borrador aprobado recreado (${periodType})`);

  const draftDb = await PayrollDraft.findByPk(approvedDraft.id);
  assert(draftDb?.isApproved === true || draftDb?.isApproved === 1, `[${cName}] isApproved en BD (${periodType})`);

  const fixDraft = await api(`/api/payroll-drafts/${approvedDraft.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      ...approvedDraft,
      companies: [cName],
      periodType,
      employees: approvedDraft.employees
    })
  }, token);
  approvedDraft = fixDraft.body || { ...approvedDraft, companies: [cName], periodType };

  const closedPayrollId = await closeDraftToHistory(token, approvedDraft, 'cerrada', true, prefix, periodType);
  const histAll = await PayrollHistory.findByPk(closedPayrollId);
  assert(histAll?.status === 'cerrada', `[${cName}] Nómina ${periodType} cerrada en BD`);
  assert(histAll?.periodType === periodType, `[${cName}] periodType ${periodType} en historial`);

  return { closedPayrollId, draftEmployees: approvedDraft.employees || draftEmployees };
}

async function runBilling(token, company, closedPayrollId, employeeCount) {
  const cName = companyName(company);
  const preview = await api('/api/billing/preview', {
    method: 'POST',
    body: JSON.stringify({ payrollId: closedPayrollId })
  }, token);
  assert(preview.status === 200, `[${cName}] billing/preview → ${preview.status}`);

  const warnings = preview.body?.warnings || [];
  const critical = warnings.filter((w) =>
    /no coincide|appliedBonuses|operation_logs|extras\.bonos/i.test(String(w))
  );
  assert(critical.length === 0, `[${cName}] 0 warnings críticos billing (total: ${warnings.length})`);

  if ((preview.body?.lines || []).length > 0) {
    assert(
      Number(preview.body?.employeeCount) === employeeCount,
      `[${cName}] Billing employeeCount (${preview.body?.employeeCount}/${employeeCount})`
    );
    assert(
      (preview.body.lines || []).every((l) => l.centroCosto),
      `[${cName}] Todas las líneas de factura tienen centro de costo`
    );
    const confirm = await api('/api/billing/runs', {
      method: 'POST',
      body: JSON.stringify({ payrollId: closedPayrollId, notes: `E2E ${cName}` })
    }, token);
    assert(confirm.status === 201, `[${cName}] billing/runs → ${confirm.status}`);
    return confirm.body?.id;
  }
  console.log(`  WARN [${cName}]: billing preview sin líneas (sin reglas/dist?) — skip confirm`);
  return null;
}

async function runCompanyCycle(token, company) {
  const cName = companyName(company);
  const report = {
    company: cName,
    companyId: company.id,
    employees: 0,
    q1: 'SKIP',
    q2: 'SKIP',
    billing1: 'SKIP',
    billing2: 'SKIP',
    reactivation: 'SKIP',
    gross1: 0,
    gross2: 0
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`EMPRESA: ${cName} (id=${company.id})`);
  console.log('='.repeat(60));

  const payrollEmployees = await Employee.findAll({
    where: { empresa_principal: company.id, sueldo_ordinario: { [Op.gt]: 0 } }
  });

  if (payrollEmployees.length === 0) {
    console.log(`  SKIP: sin empleados con empresa_principal=${company.id} y sueldo > 0`);
    console.log(`  → Asigne empleados a "${cName}" (NIT: ${company.nit || 'N/A'}) en el maestro de empleados.`);
    report.q1 = 'SKIP (sin empleados)';
    companyReports.push(report);
    return report;
  }

  report.employees = payrollEmployees.length;
  const testEmployee = payrollEmployees.find((e) => String(e.estado || '').toLowerCase().includes('activo'))
    || payrollEmployees[0];
  console.log(`  Empleados: ${payrollEmployees.length} | Focal: ${testEmployee.id}`);

  const prefix = `e2e-c${company.id}`;
  const tracked = { bonusIds: [], commissionIds: [], batchId: null, logIds: [] };

  const bonusId = `e2e-bonus-${company.id}-${Date.now()}`;
  const bonusRes = await api('/api/bonuses', {
    method: 'POST',
    body: JSON.stringify({
      id: bonusId,
      name: `Bono E2E ${cName}`,
      type: 'fijo',
      date: opDate1ra,
      assignments: { [testEmployee.id]: 200 }
    })
  }, token);
  if (bonusRes.status === 201) tracked.bonusIds.push(bonusId);

  const commRes = await api('/api/commissions', {
    method: 'POST',
    body: JSON.stringify({
      employee_id: testEmployee.id,
      empresa_id: company.id,
      mes: currentMonth,
      fecha: opDate1ra,
      horas: 0,
      tipo_hora: 'D',
      monto_bono: 50,
      tarea_realizada: `Comisión E2E ${cName}`,
      estado: 'Pendiente'
    })
  }, token);
  if (commRes.status === 201 && commRes.body?.id) tracked.commissionIds.push(commRes.body.id);

  const batchRes = await api('/api/operation-batches', {
    method: 'POST',
    body: JSON.stringify({ title: `Lote E2E ${cName} ${Date.now()}` })
  }, token);
  tracked.batchId = batchRes.body?.id;

  for (const [type, extra] of [
    ['HORA_EXTRA', { hoursQty: 4, hourType: 'SIMPLE', taskDescription: 'HE E2E' }],
    ['BONO', { bonusAmount: 500, taskDescription: 'Bono operativo E2E' }]
  ]) {
    const logRes = await api('/api/operation-logs', {
      method: 'POST',
      body: JSON.stringify({
        type,
        employeeId: testEmployee.id,
        companyId: company.id,
        date: opDate1ra,
        batchId: tracked.batchId,
        ...extra
      })
    }, token);
    if (logRes.body?.id) tracked.logIds.push(logRes.body.id);
  }

  const badHe = await api('/api/operation-logs', {
    method: 'POST',
    body: JSON.stringify({
      type: 'HORA_EXTRA', hoursQty: 0, hourType: 'SIMPLE',
      employeeId: testEmployee.id, date: opDate1ra, taskDescription: 'x'
    })
  }, token);
  assert(badHe.status === 400, `[${cName}] HE inválida → 400`);

  await api(`/api/operation-batches/${tracked.batchId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'APPROVED_MANAGER' })
  }, token);

  const logsRes = await api('/api/operation-logs', {}, token);
  const approvedLogs = (Array.isArray(logsRes.body) ? logsRes.body : [])
    .filter((l) => tracked.logIds.includes(l.id));
  const bonusesRes = await api('/api/bonuses', {}, token);
  const bonuses = Array.isArray(bonusesRes.body) ? bonusesRes.body : [];
  const allCommRes = await api('/api/commissions', {}, token);
  const allCommissions = Array.isArray(allCommRes.body) ? allCommRes.body : [];

  const q1Result = await createAndClosePayroll(token, {
    company,
    payrollEmployees,
    testEmployee,
    periodType: '1ra',
    draftRefDate: draftRefDate1ra,
    opDate: opDate1ra,
    approvedLogs,
    bonuses,
    commissions: allCommissions,
    skipAuditReject: false,
    prefix
  });
  report.q1 = state.failed === 0 ? 'OK' : 'FAIL';
  report.gross1 = (q1Result.draftEmployees || []).reduce(
    (s, e) => s + (Number(e.calculated?.gross) || 0), 0
  );

  for (const logId of tracked.logIds) {
    await api(`/api/operation-logs/${logId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'PROCESSED_PAYROLL', periodAssigned: q1Result.closedPayrollId })
    }, token);
  }

  // Facturación solo en 2ª quincena (una vez al mes por empresa)
  console.log(`  [${cName}] Billing 1ra omitido (solo 2ª quincena)`);
  report.billing1 = 'SKIP';

  const anticipoMap = getFirstQuincenaPayouts(q1Result.draftEmployees);
  const q2Result = await createAndClosePayroll(token, {
    company,
    payrollEmployees,
    testEmployee,
    periodType: '2da',
    draftRefDate: draftRefDate2da,
    opDate: opDate2da,
    approvedLogs: [],
    bonuses: [],
    commissions: [],
    anticipoMap,
    skipAuditReject: true,
    prefix
  });
  report.q2 = 'OK';
  report.gross2 = (q2Result.draftEmployees || []).reduce(
    (s, e) => s + (Number(e.calculated?.gross) || 0), 0
  );

  const billing2Id = await runBilling(token, company, q2Result.closedPayrollId, payrollEmployees.length);
  report.billing2 = billing2Id ? 'OK' : 'WARN';

  const reactivationRes = await api('/api/payrolls/request-reactivation', {
    method: 'POST',
    body: JSON.stringify({ payrollIds: [q2Result.closedPayrollId], concepto: `E2E reactivación ${cName}` })
  }, token);

  if (reactivationRes.status === 200) {
    const reactivateToken = jwt.sign(
      { payrollIds: [q2Result.closedPayrollId] },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '24h' }
    );
    const reactRes = await api('/api/payrolls/reactivate', {
      method: 'POST',
      body: JSON.stringify({ token: reactivateToken })
    }, token);
    assert(reactRes.status === 200, `[${cName}] reactivate → ${reactRes.status}`);

    const draftsAfter = await api('/api/payroll-drafts', {}, token);
    const hasDraft = Array.isArray(draftsAfter.body) && draftsAfter.body.length > 0;
    assert(hasDraft, `[${cName}] Borrador visible tras reactivación`);
    report.reactivation = reactRes.status === 200 && hasDraft ? 'OK' : 'FAIL';

    const reactivatedDraft = findDraftForCompany(draftsAfter.body, cName);
    if (reactivatedDraft?.id) {
      await api(`/api/payroll-drafts/${reactivatedDraft.id}`, { method: 'DELETE' }, token).catch(() => {});
    }
  } else if (reactivationRes.status === 400 && /GERENTE GENERAL/i.test(reactivationRes.body?.error || '')) {
    console.log(`  WARN [${cName}]: sin GERENTE GENERAL — reactivación vía token directo`);
    const reactivateToken = jwt.sign(
      { payrollIds: [q2Result.closedPayrollId] },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '24h' }
    );
    const reactRes = await api('/api/payrolls/reactivate', {
      method: 'POST',
      body: JSON.stringify({ token: reactivateToken })
    }, token);
    report.reactivation = reactRes.status === 200 ? 'OK (token)' : 'FAIL';
  } else {
    assert(false, `[${cName}] request-reactivation → ${reactivationRes.status}`);
    report.reactivation = 'FAIL';
  }

  if (!keepData) {
    for (const id of tracked.commissionIds) {
      await api(`/api/commissions/${id}`, { method: 'DELETE' }, token).catch(() => {});
    }
    for (const id of tracked.bonusIds) {
      await api(`/api/bonuses/${id}`, { method: 'DELETE' }, token).catch(() => {});
    }
  }

  companyReports.push(report);
  return report;
}

async function main() {
  const t0 = Date.now();
  console.log('=== E2E Multi-Empresa: Ciclo completo de nómina ===\n');

  assert(await checkServer(), 'Backend accesible');
  const { token } = await getTokenForRole('ADMIN');
  assert(!!token, 'Token JWT generado');

  let companies = await Company.findAll({ order: [['id', 'ASC']] });
  if (companyFilter) {
    companies = companies.filter((c) => String(c.id) === String(companyFilter));
    assert(companies.length > 0, `Empresa id=${companyFilter} encontrada`);
  }

  console.log(`Directorio de empresas (${companies.length}):`);
  for (const c of companies) {
    const count = await Employee.count({
      where: { empresa_principal: c.id, sueldo_ordinario: { [Op.gt]: 0 } }
    });
    console.log(`  [${c.id}] ${companyName(c)} | NIT: ${c.nit || 'N/A'} | Empleados nómina: ${count}`);
  }
  console.log('');

  for (const company of companies) {
    await runCompanyCycle(token, company);
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log('RESUMEN POR EMPRESA');
  console.log('='.repeat(60));
  for (const r of companyReports) {
    console.log(
      `${r.company} | Empleados: ${r.employees} | 1ra: ${r.q1} | 2da: ${r.q2} | Billing1: ${r.billing1} | Billing2: ${r.billing2} | Reactivación: ${r.reactivation}`
    );
  }
  console.log(`\nAssertions: ${state.passed} passed, ${state.failed} failed`);
  console.log(`Empresas procesadas: ${companyReports.length}`);
  console.log(`Tiempo total: ${elapsed}s`);

  await sequelize.close();
  process.exit(state.failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Error fatal E2E multi-empresa:', err);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
