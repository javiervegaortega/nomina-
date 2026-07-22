/**
 * Prueba E2E automatizada del ciclo completo de nómina vía API.
 * Requiere: backend corriendo, empleados y empresas en BD.
 *
 * Uso: node src/scripts/test_e2e_nomina.js [--keep-data]
 */
require('dotenv').config();
const {
  sequelize,
  Employee,
  Company,
  Bonus,
  Commission,
  OperationLog,
  OperationBatch,
  PayrollDraft,
  PayrollHistory
} = require('../models');
const { Op } = require('sequelize');
const {
  createAssert,
  getTokenForRole,
  api,
  checkServer,
  buildDraftEmployee
} = require('./lib/testHelpers');

const keepData = process.argv.includes('--keep-data');
const state = { passed: 0, failed: 0 };
const assert = createAssert(state);
const tracked = {
  bonusIds: [],
  commissionIds: [],
  batchId: null,
  logIds: [],
  draftIds: [],
  payrollIds: [],
  billingRunId: null
};

const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const opDate = `${year}-${month}-10`;
const draftRefDate = `${year}-${month}-10T12:00:00.000Z`;
const periodType = '1ra';
const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const currentMonth = monthNames[new Date(draftRefDate).getMonth()];

async function cleanupTracked(token) {
  if (keepData) return;
  for (const payrollId of tracked.payrollIds) {
    await api(`/api/payrolls/${payrollId}`, { method: 'DELETE' }, token).catch(() => {});
  }
  for (const draftId of tracked.draftIds) {
    await api(`/api/payroll-drafts/${draftId}`, { method: 'DELETE' }, token).catch(() => {});
  }
  for (const logId of tracked.logIds) {
    await api(`/api/operation-logs/${logId}`, { method: 'DELETE' }, token).catch(() => {});
  }
  if (tracked.batchId) {
    await api(`/api/operation-batches/${tracked.batchId}`, { method: 'DELETE' }, token).catch(() => {});
  }
  for (const id of tracked.commissionIds) {
    await api(`/api/commissions/${id}`, { method: 'DELETE' }, token).catch(() => {});
  }
  for (const id of tracked.bonusIds) {
    await api(`/api/bonuses/${id}`, { method: 'DELETE' }, token).catch(() => {});
  }
}

async function closeDraftToHistory(token, draft, status, isApproved) {
  const employees = draft.employees || [];
  const payrollId = `e2e-${Date.now()}`;
  const payload = {
    id: payrollId,
    title: draft.title,
    companies: draft.companies,
    periodType: draft.periodType || periodType,
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
  assert(res.status === 201, `POST /api/payrolls (${status}) → ${res.status}`);
  if (res.status === 201) {
    tracked.payrollIds.push(payrollId);
    await api(`/api/payroll-drafts/${draft.id}`, { method: 'DELETE' }, token);
    tracked.draftIds = tracked.draftIds.filter((id) => id !== draft.id);
  }
  return payrollId;
}

async function main() {
  const t0 = Date.now();
  console.log('=== E2E: Ciclo completo de nómina ===\n');

  let token;
  let adminUser;
  let testEmployee;
  let testCompany;
  let payrollEmployees;

  // Fase 1: Setup
  console.log('Fase 1: Setup');
  {
    const serverUp = await checkServer();
    assert(serverUp, 'Backend accesible en localhost');

    const auth = await getTokenForRole('admin');
    token = auth.token;
    adminUser = auth.user;
    assert(!!token, 'Token JWT generado');

    testCompany = await Company.findOne();
    assert(!!testCompany, 'Hay al menos una empresa en BD');

    payrollEmployees = await Employee.findAll({
      where: {
        empresa_principal: testCompany.id,
        sueldo_ordinario: { [Op.gt]: 0 }
      }
    });
    assert(payrollEmployees.length > 0, `Hay empleados con sueldo en ${testCompany.nombre_comercial || testCompany.id}`);

    testEmployee = payrollEmployees.find((e) => String(e.estado || '').toLowerCase() === 'activo')
      || payrollEmployees[0];
    assert(Number(testEmployee.sueldo_ordinario) > 0, `Empleado ${testEmployee.id} tiene sueldo > 0`);

    console.log(`  Empresa: ${testCompany.nombre_comercial || testCompany.id} | Empleados en nómina: ${payrollEmployees.length} | Empleado HE/bonos: ${testEmployee.id}`);
  }

  // Fase 2: Catálogo bonos
  console.log('\nFase 2: Catálogo de bonos');
  const bonusId = `e2e-bonus-${Date.now()}`;
  {
    const create = await api('/api/bonuses', {
      method: 'POST',
      body: JSON.stringify({
        id: bonusId,
        name: 'Bono E2E Test',
        type: 'fijo',
        date: opDate,
        assignments: { [testEmployee.id]: 200 }
      })
    }, token);
    assert(create.status === 201, 'POST /api/bonuses');
    if (create.status === 201) tracked.bonusIds.push(bonusId);

    const list = await api('/api/bonuses', {}, token);
    assert(list.status === 200 && list.body.some((b) => b.id === bonusId), 'Bono en listado');
  }

  // Fase 3: Comisiones (solo monto_bono, sin horas para evitar doble conteo)
  console.log('\nFase 3: Comisiones');
  {
    const res = await api('/api/commissions', {
      method: 'POST',
      body: JSON.stringify({
        employee_id: testEmployee.id,
        empresa_id: testCompany.id,
        mes: currentMonth,
        fecha: opDate,
        horas: 0,
        tipo_hora: 'D',
        monto_bono: 50,
        tarea_realizada: 'Comisión E2E',
        estado: 'Pendiente'
      })
    }, token);
    assert(res.status === 201, `POST /api/commissions → ${res.status}`);
    if (res.status === 201 && res.body?.id) tracked.commissionIds.push(res.body.id);
  }

  // Fase 4: Operaciones
  console.log('\nFase 4: Reporte operativo');
  {
    const batchRes = await api('/api/operation-batches', {
      method: 'POST',
      body: JSON.stringify({ title: `Lote E2E ${Date.now()}` })
    }, token);
    assert(batchRes.status === 201, `POST operation-batches → ${batchRes.status}`);
    tracked.batchId = batchRes.body?.id;

    const heRes = await api('/api/operation-logs', {
      method: 'POST',
      body: JSON.stringify({
        type: 'HORA_EXTRA',
        hoursQty: 4,
        hourType: 'SIMPLE',
        employeeId: testEmployee.id,
        companyId: testCompany.id,
        date: opDate,
        taskDescription: 'HE E2E test',
        batchId: tracked.batchId
      })
    }, token);
    assert(heRes.status === 201, `POST HE → ${heRes.status}`);
    if (heRes.body?.id) tracked.logIds.push(heRes.body.id);

    const bonoRes = await api('/api/operation-logs', {
      method: 'POST',
      body: JSON.stringify({
        type: 'BONO',
        bonusAmount: 500,
        employeeId: testEmployee.id,
        companyId: testCompany.id,
        date: opDate,
        taskDescription: 'Bono operativo E2E',
        batchId: tracked.batchId
      })
    }, token);
    assert(bonoRes.status === 201, `POST BONO → ${bonoRes.status}`);
    if (bonoRes.body?.id) tracked.logIds.push(bonoRes.body.id);
  }

  // Fase 5: Validación negativa
  console.log('\nFase 5: Validación negativa');
  {
    const badHe = await api('/api/operation-logs', {
      method: 'POST',
      body: JSON.stringify({
        type: 'HORA_EXTRA', hoursQty: 0, hourType: 'SIMPLE',
        employeeId: testEmployee.id, date: opDate, taskDescription: 'x'
      })
    }, token);
    assert(badHe.status === 400, 'HE inválida → 400');

    const badBono = await api('/api/operation-logs', {
      method: 'POST',
      body: JSON.stringify({
        type: 'BONO', bonusAmount: 0,
        employeeId: testEmployee.id, date: opDate, taskDescription: 'x'
      })
    }, token);
    assert(badBono.status === 400, 'BONO inválido → 400');
  }

  // Fase 6: Aprobación lote
  console.log('\nFase 6: Aprobación gerente');
  {
    const approve = await api(`/api/operation-batches/${tracked.batchId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'APPROVED_MANAGER' })
    }, token);
    assert(approve.status === 200, `PATCH batch APPROVED_MANAGER → ${approve.status}`);
  }

  // Fase 7-8: Borrador y cálculo
  console.log('\nFase 7-8: Borrador de nómina y cálculo');
  let draftId;
  let draftEmployees;
  {
    const logsRes = await api('/api/operation-logs', {}, token);
    const opLogs = Array.isArray(logsRes.body) ? logsRes.body : [];
    const approvedLogs = opLogs.filter((l) => tracked.logIds.includes(l.id));

    const bonusesRes = await api('/api/bonuses', {}, token);
    const bonuses = Array.isArray(bonusesRes.body) ? bonusesRes.body : [];

    const commRes = await api('/api/commissions', {}, token);
    const allCommissions = Array.isArray(commRes.body) ? commRes.body : [];

    const empJson = testEmployee.toJSON();
    draftEmployees = payrollEmployees.map((emp) => buildDraftEmployee(emp.toJSON(), {
      periodType,
      draftRefDate,
      operationLogs: approvedLogs,
      bonuses,
      commissions: allCommissions
    }));

    const focusDraftEmp = draftEmployees.find((e) => String(e.id) === String(testEmployee.id));
    assert(!!focusDraftEmp, 'Empleado focal incluido en borrador completo');
    assert(draftEmployees.length === payrollEmployees.length,
      `Borrador incluye todos los empleados (${draftEmployees.length}/${payrollEmployees.length})`);

    const hourlyRate = Number(testEmployee.sueldo_ordinario) / 30 / 8;
    const masterSimples = Number(testEmployee.horas_extras_simples) || 0;
    const expectedSimplesVal = (masterSimples + 4) * hourlyRate * 1.5;
    assert(Math.abs(focusDraftEmp.extras.simplesVal - expectedSimplesVal) < 0.1,
      `HE simples ≈ Q${expectedSimplesVal.toFixed(2)} (got Q${Number(focusDraftEmp.extras.simplesVal).toFixed(2)})`);
    const opBonos = Number(focusDraftEmp.extras.bonos) || 0;
    assert(opBonos >= 50, `Bonos en extras ≥ Q50 (got Q${opBonos}, incluye comisión y/o operativo)`);

    draftId = `draft-e2e-${Date.now()}`;
    const companyName = testCompany.nombre_comercial || String(testCompany.id);
    const createDraft = await api('/api/payroll-drafts', {
      method: 'POST',
      body: JSON.stringify({
        id: draftId,
        title: `Nómina E2E ${companyName}`,
        companies: [companyName],
        periodType,
        createdAt: draftRefDate,
        employees: draftEmployees
      })
    }, token);
    assert(createDraft.status === 201, `POST payroll-drafts → ${createDraft.status}`);
    tracked.draftIds.push(draftId);

    const getDraft = await api('/api/payroll-drafts', {}, token);
    const draft = Array.isArray(getDraft.body) ? getDraft.body.find((d) => d.id === draftId) : null;
    assert(!!draft, 'Borrador recuperado en GET');
    const emp = draft?.employees?.find((e) => String(e.id) === String(testEmployee.id));
    assert(!!emp?.calculated?.gross, 'Empleado tiene calculated.gross');
    if (emp?.calculated) {
      const gross = Number(emp.calculated.gross);
      const components = Number(emp.calculated.baseSalary || 0)
        + Number(emp.calculated.bonusLey || 0)
        + Number(emp.calculated.bonusDec || 0)
        + Number(emp.calculated.bonos || 0)
        + Number(emp.calculated.extrasTotal || 0)
        + Number(emp.calculated.bonusesSum || 0);
      assert(Math.abs(gross - components) < 0.05, 'Gross coherente con componentes');
    }
    draftEmployees = draft?.employees || draftEmployees;
  }

  // Fase 9: Enviar a auditoría
  console.log('\nFase 9: Enviar a auditoría');
  let auditPayrollId;
  {
    auditPayrollId = await closeDraftToHistory(token, {
      id: draftId,
      title: `Nómina E2E Auditoría`,
      companies: [testCompany.nombre_comercial || String(testCompany.id)],
      periodType,
      employees: draftEmployees
    }, 'auditoria', false);

    const hist = await api('/api/payrolls', {}, token);
    const found = Array.isArray(hist.body) && hist.body.some((p) => p.id === auditPayrollId);
    assert(found, 'Nómina en historial con status auditoria');
  }

  // Fase 10: Aprobar auditoría y cerrar
  console.log('\nFase 10: Aprobación auditoría y cierre');
  let closedPayrollId;
  {
    const approve = await api(`/api/payrolls/${auditPayrollId}/auditor-approve`, {
      method: 'POST',
      body: JSON.stringify({})
    }, token);
    assert(approve.status === 200, `auditor-approve → ${approve.status}`);
    tracked.payrollIds = tracked.payrollIds.filter((id) => id !== auditPayrollId);

    const draftsRes = await api('/api/payroll-drafts', {}, token);
    let approvedDraft = Array.isArray(draftsRes.body) ? draftsRes.body[0] : null;
    assert(!!approvedDraft, 'Borrador recreado tras auditor-approve');

    const draftDb = await PayrollDraft.findByPk(approvedDraft.id);
    assert(draftDb?.isApproved === true || draftDb?.isApproved === 1, 'Borrador isApproved en BD');

    const companyName = testCompany.nombre_comercial || String(testCompany.id);
    const fixDraft = await api(`/api/payroll-drafts/${approvedDraft.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...approvedDraft,
        companies: [companyName],
        employees: approvedDraft.employees
      })
    }, token);
    assert(fixDraft.status === 200, 'PUT borrador con companies');
    approvedDraft = fixDraft.body || { ...approvedDraft, companies: [companyName] };
    tracked.draftIds.push(approvedDraft.id);

    closedPayrollId = await closeDraftToHistory(token, approvedDraft, 'cerrada', true);

    const patch = await api(`/api/payrolls/${closedPayrollId}`, {}, token);
    const closed = Array.isArray(patch.body)
      ? patch.body.find((p) => p.id === closedPayrollId)
      : null;
    const histAll = await PayrollHistory.findByPk(closedPayrollId);
    assert(histAll?.status === 'cerrada', 'Nómina cerrada en BD');
  }

  // Fase 11: Operation logs procesados
  console.log('\nFase 11: Logs operativos procesados');
  {
    for (const logId of tracked.logIds) {
      await api(`/api/operation-logs/${logId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'PROCESSED_PAYROLL', periodAssigned: closedPayrollId })
      }, token);
    }
    const logsRes = await api('/api/operation-logs', {}, token);
    const logs = Array.isArray(logsRes.body) ? logsRes.body : [];
    const processed = logs.filter((l) => tracked.logIds.includes(l.id));
    const allProcessed = processed.every((l) => l.status === 'PROCESSED_PAYROLL');
    assert(allProcessed, 'Logs operativos en PROCESSED_PAYROLL');
  }

  // Fase 12: Facturación (solo 2ª quincena — este E2E corre en 1ra)
  console.log('\nFase 12: Facturación (requiere 2ª — se valida el rechazo en 1ra)');
  {
    const preview = await api('/api/billing/preview', {
      method: 'POST',
      body: JSON.stringify({ payrollId: closedPayrollId })
    }, token);
    assert(preview.status === 400, `POST billing/preview en 1ra → ${preview.status} (esperado 400)`);
    assert(
      /2ª quincena|2da quincena/i.test(String(preview.body?.error || '')),
      'Error indica que solo aplica en 2ª quincena'
    );
    console.log('  OK: facturación bloqueada correctamente en 1ra quincena');
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n=== RESUMEN E2E ===');
  console.log(`Fases: ${state.failed === 0 ? '12/12 OK' : 'CON FALLOS'}`);
  console.log(`Assertions: ${state.passed} passed, ${state.failed} failed`);
  console.log(`Empleados en nómina: ${payrollEmployees?.length || 'N/A'}`);
  console.log(`Empleado focal (HE/bonos): ${testEmployee?.id || 'N/A'}`);
  console.log(`Nómina cerrada: ${closedPayrollId}`);
  console.log(`Billing run: ${tracked.billingRunId || 'N/A'}`);
  console.log(`Tiempo total: ${elapsed}s`);

  if (!keepData && state.failed > 0) {
    await cleanupTracked(token);
  }

  await sequelize.close();
  process.exit(state.failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Error fatal E2E:', err);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
