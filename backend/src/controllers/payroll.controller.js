const {
  PayrollHistory,
  User,
  PayrollDraft,
  PayrollDraftEmployee,
  Company,
  Employee,
  Bonus,
  Commission,
  OperationLog,
  OperationLogReview,
  sequelize
} = require('../models');
const jwt = require('jsonwebtoken');
const { sendReactivationEmail, sendPayrollAuditDecisionEmail, sendPayrollSubmittedToAuditEmail } = require('../services/email.service');
const BillingService = require('../services/billing.service');
const {
  computePayrollSummary,
  parsePayrollEmployees,
  parsePayrollSummary,
  calculateMissingPayrollSnapshots
} = require('../services/payrollSummary.service');

const {
  calculateEmployeePayroll,
  calculatePayrollBatch,
  parseLocalPayrollDate
} = require('../services/payrollCalculator.service');
const { applyScheduledBonusesToEmployees } = require('../services/payrollBonuses.service');
const {
  assertNoBlockingOperationsForAudit,
  clearBatchDraftLink,
  setMonthlyOperationCaptureState,
  ensureBonos2daBatchForDraft
} = require('../services/operationBonusBatch.service');
const { recalculateBatchStatus } = require('../services/operationWorkflow.service');

const AUDIT_ROLES = ['AUDITOR', 'ADMIN', 'GERENTE GENERAL'];
const PAYROLL_WORKFLOW_ROLES = ['NOMINA', 'ADMIN', 'GERENTE GENERAL'];

/**
 * Al cerrar 2ª quincena, persiste Total ISR en la ficha del empleado
 * para que la próxima 1ª arranque con la mitad de ese valor.
 */
const syncEmployeeIsrFromClosed2da = async (
  periodType,
  status,
  employees,
  transaction = null
) => {
  if (periodType !== '2da' || status !== 'cerrada') return;
  const emps = Array.isArray(employees) ? employees : [];
  for (const emp of emps) {
    if (emp == null || emp.id == null) continue;
    if (emp.totalIsr === undefined || emp.totalIsr === null || emp.totalIsr === '') continue;
    const totalIsr = Number(emp.totalIsr);
    if (Number.isNaN(totalIsr)) continue;
    const current = await Employee.findByPk(emp.id, {
      attributes: ['id', 'isr'],
      transaction
    });
    if (!current) continue;
    const currentIsr = Number(current.isr) || 0;
    if (currentIsr === totalIsr) continue;
    await current.update({ isr: totalIsr }, { transaction });
  }
};

const resolveCompanyNames = async (companyIds = []) => {
  const ids = (Array.isArray(companyIds) ? companyIds : [])
    .map((c) => String(c).trim())
    .filter(Boolean);
  if (ids.length === 0) return [];

  const numericIds = ids.filter((id) => /^\d+$/.test(id)).map((id) => Number(id));
  let companies = [];
  if (numericIds.length > 0) {
    companies = await Company.findAll({
      where: { id: numericIds },
      attributes: ['id', 'nombre_comercial', 'razon_social', 'nit']
    });
  }

  return ids.map((id) => {
    const found = companies.find((c) => String(c.id) === String(id));
    return found?.nombre_comercial || found?.razon_social || found?.nit || id;
  });
};

const notifyAuditorsOfSubmission = async ({ historyRecord, companyNames, submitterName }) => {
  const auditors = await User.findAll({
    where: { role: 'AUDITOR' },
    attributes: ['id', 'name', 'email']
  });
  const summary = parsePayrollSummary(historyRecord.summary) || {};
  const details = {
    title: historyRecord.title,
    periodType: historyRecord.periodType,
    companyName: (companyNames && companyNames[0]) || '—',
    submitterName: submitterName || 'Nómina',
    employeesCount: summary.employeesCount || null
  };

  for (const auditor of auditors) {
    if (!auditor.email) continue;
    try {
      await sendPayrollSubmittedToAuditEmail(auditor.email, auditor.name, details);
    } catch (err) {
      console.error(`Fallo correo envío a auditoría (${auditor.email}):`, err.message);
    }
  }
};

const getCompaniesFromHistory = (historyRecord) => {
  const summary = parsePayrollSummary(historyRecord.summary) || {};
  if (Array.isArray(summary.companies) && summary.companies.length > 0) {
    return summary.companies;
  }
  if (Array.isArray(historyRecord.companies) && historyRecord.companies.length > 0) {
    return historyRecord.companies;
  }
  return [];
};

const notifyAuditDecisionRecipients = async ({ historyRecord, action, note, auditorName }) => {
  const summary = parsePayrollSummary(historyRecord.summary) || {};
  const submittedBy = summary.submittedBy || null;
  const recipients = new Map();

  const nominaUsers = await User.findAll({
    where: { role: 'NOMINA' },
    attributes: ['id', 'name', 'email']
  });
  for (const u of nominaUsers) {
    if (u.email) recipients.set(u.email.toLowerCase(), { email: u.email, name: u.name });
  }

  if (submittedBy?.email) {
    recipients.set(String(submittedBy.email).toLowerCase(), {
      email: submittedBy.email,
      name: submittedBy.name || 'Usuario'
    });
  } else if (submittedBy?.userId) {
    const submitter = await User.findByPk(submittedBy.userId, { attributes: ['id', 'name', 'email'] });
    if (submitter?.email) {
      recipients.set(submitter.email.toLowerCase(), { email: submitter.email, name: submitter.name });
    }
  }

  const details = {
    title: historyRecord.title,
    periodType: historyRecord.periodType,
    action,
    note: note || null,
    auditorName: auditorName || 'Auditoría'
  };

  const errors = [];
  for (const recipient of recipients.values()) {
    try {
      await sendPayrollAuditDecisionEmail(recipient.email, recipient.name, details);
    } catch (err) {
      console.error(`Fallo correo auditoría a ${recipient.email}:`, err.message);
      errors.push(err.message);
    }
  }
  if (recipients.size === 0) {
    console.warn('Sin destinatarios para notificación de auditoría de nómina');
  }
  return errors;
};

const formatPayrollRecord = async (payrollObj, { includeData = true } = {}) => {
  const result = { ...payrollObj };
  result.summary = parsePayrollSummary(result.summary);

  if (!result.summary || !result.summary.employeesCount) {
    const computed = computePayrollSummary(payrollObj);
    if (computed.employeesCount > 0) {
      result.summary = computed;
    }
  }

  // Exponer nombres de empresa (summary suele guardar solo IDs)
  const companyIds = getCompaniesFromHistory(result);
  if (companyIds.length > 0) {
    const names = await resolveCompanyNames(companyIds);
    result.companies = names;
    if (result.summary && typeof result.summary === 'object') {
      result.summary = { ...result.summary, companies: names, companyIds };
    }
  }

  if (!includeData) {
    delete result.data;
    return result;
  }

  let emps = parsePayrollEmployees(payrollObj.data);
  emps = calculateMissingPayrollSnapshots(emps, payrollObj.periodType);
  result.data = emps;
  return result;
};

const getPayrolls = async (req, res) => {
  try {
    const summaryOnly = req.query.summary === '1' || req.query.summary === 'true';
    const payrolls = await PayrollHistory.findAll({
      order: [['closedAt', 'DESC'], ['createdAt', 'DESC']],
      ...(summaryOnly ? { attributes: { exclude: ['data'] } } : {})
    });

    const formattedPayrolls = await Promise.all(
      payrolls.map(async (p) => {
        let obj = p.toJSON();
        if (summaryOnly && (!obj.summary || !parsePayrollSummary(obj.summary)?.employeesCount)) {
          const full = await PayrollHistory.findByPk(p.id);
          if (full) {
            const fullObj = full.toJSON();
            fullObj.summary = parsePayrollSummary(fullObj.summary);
            const summary = computePayrollSummary(fullObj);
            if (summary.employeesCount > 0) {
              obj.summary = summary;
              await PayrollHistory.update({ summary }, { where: { id: obj.id } });
            }
          }
        }
        return await formatPayrollRecord(obj, { includeData: !summaryOnly });
      })
    );

    res.json(formattedPayrolls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getPayrollById = async (req, res) => {
  try {
    const payroll = await PayrollHistory.findByPk(req.params.id);
    if (!payroll) return res.status(404).json({ error: 'Nómina no encontrada' });
    res.json(await formatPayrollRecord(payroll.toJSON(), { includeData: true }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Exige exactamente una empresa concreta al cerrar/crear historial de nómina. */
const requireSingleCompany = (companies) => {
  let comps = companies;
  if (typeof comps === 'string') {
    try { comps = JSON.parse(comps); } catch { comps = []; }
  }
  if (!Array.isArray(comps)) comps = [];
  const normalized = comps.map(c => (c == null ? '' : String(c).trim())).filter(Boolean);
  const hasAllToken = normalized.some(c => {
    const s = c.toLowerCase();
    return s === 'all' || s === 'todas' || s === 'todas las empresas';
  });
  if (normalized.length !== 1 || hasAllToken) {
    const err = new Error(
      'Debe seleccionar una empresa específica. No se permite cerrar nóminas para todas las empresas a la vez.'
    );
    err.status = 400;
    throw err;
  }
  return normalized;
};

const resolveCanonicalCompanyId = async (rawCompany, transaction = null) => {
  const numericId = Number(rawCompany);
  if (Number.isInteger(numericId) && numericId > 0) {
    const company = await Company.findByPk(numericId, { transaction });
    if (company) return company.id;
  }
  const needle = String(rawCompany || '').trim().toUpperCase();
  const companies = await Company.findAll({ transaction });
  const match = companies.find((company) => (
    [company.nombre_comercial, company.razon_social, company.nit]
      .filter(Boolean)
      .some((value) => String(value).trim().toUpperCase() === needle)
  ));
  if (!match) {
    const err = new Error('La empresa seleccionada no existe.');
    err.status = 400;
    throw err;
  }
  return match.id;
};

const getEmployeePrincipalCompanyId = (employee) => {
  const id = Number(
    employee?.empresa_principal
    ?? employee?.companyId
    ?? employee?.id_empresa
  );
  return Number.isInteger(id) && id > 0 ? id : null;
};

const assertEmployeesMatchPayrollCompany = (employees, companyId) => {
  const mismatches = (Array.isArray(employees) ? employees : []).filter(
    employee => getEmployeePrincipalCompanyId(employee) !== Number(companyId)
  );
  if (mismatches.length === 0) return;
  const sample = mismatches.slice(0, 3).map((employee) => (
    employee?.id != null ? `#${employee.id}` : 'sin ID'
  )).join(', ');
  const err = new Error(
    `La nómina contiene empleados que no pertenecen a la empresa seleccionada: ${sample}.`
  );
  err.status = 400;
  throw err;
};

const assertClosedFirstQuincenaExists = async (
  payload,
  companyIds,
  transaction = null
) => {
  if (payload.periodType !== '2da') return;
  const targetDate = parseLocalPayrollDate(
    payload.createdAt || payload.closedAt || Date.now()
  );
  const targetCompanies = new Set((companyIds || []).map(String));
  const firstPayrolls = await PayrollHistory.findAll({
    where: { periodType: '1ra', status: 'cerrada' },
    attributes: ['id', 'closedAt', 'createdAt', 'summary'],
    transaction
  });
  const match = firstPayrolls.some((payroll) => {
    const row = payroll.toJSON();
    const rowDate = parseLocalPayrollDate(row.createdAt || row.closedAt || 0);
    if (
      rowDate.getFullYear() !== targetDate.getFullYear()
      || rowDate.getMonth() !== targetDate.getMonth()
    ) {
      return false;
    }
    const rowCompanies = getCompaniesFromHistory(row).map(String);
    return rowCompanies.some((company) => targetCompanies.has(company));
  });
  if (!match) {
    const err = new Error(
      'No se puede crear la 2ª quincena sin una 1ª quincena cerrada del mismo mes y empresa.'
    );
    err.status = 400;
    throw err;
  }
};

const getCurrentPayrollOperationLogIds = (employees) => {
  const ids = new Set();
  (Array.isArray(employees) ? employees : []).forEach((employee) => {
    (Array.isArray(employee?.operationLogs) ? employee.operationLogs : [])
      .filter((log) => (
        !log.carriedFromFirstQuincena
        && ['APPROVED_MANAGER', 'PROCESSED_PAYROLL'].includes(log.status)
        && log.id != null
      ))
      .forEach((log) => ids.add(log.id));
  });
  return [...ids];
};

const setPayrollOperationLogsStatus = async (
  employees,
  status,
  periodAssigned,
  transaction
) => {
  const ids = getCurrentPayrollOperationLogIds(employees);
  if (ids.length === 0) return;
  await OperationLog.update(
    { status, periodAssigned },
    { where: { id: ids }, transaction }
  );
};

const getCurrentPayrollCommissionIds = (employees) => {
  const ids = new Set();
  (Array.isArray(employees) ? employees : []).forEach((employee) => {
    (Array.isArray(employee?.commissionIds) ? employee.commissionIds : [])
      .filter(id => id != null)
      .forEach(id => ids.add(id));
  });
  return [...ids];
};

const setPayrollCommissionsStatus = async (
  employees,
  estado,
  transaction
) => {
  const ids = getCurrentPayrollCommissionIds(employees);
  if (ids.length === 0) return;
  await Commission.update(
    { estado },
    { where: { id: ids }, transaction }
  );
};

const createPayroll = async (req, res) => {
  const t = await sequelize.transaction();
  let newPayroll = null;
  let validatedCompanies = [];
  let submitterName = req.user?.name || 'Nómina';
  let targetStatus = null;

  try {
    const role = String(req.user?.role || '').trim().toUpperCase();
    if (!PAYROLL_WORKFLOW_ROLES.includes(role)) {
      const err = new Error('No tienes permiso para enviar o cerrar nóminas.');
      err.status = 403;
      throw err;
    }

    const draftId = String(req.body?.draftId || '').trim();
    if (!draftId) {
      const err = new Error(
        'Debe indicar el borrador que se enviará. El servidor no acepta importes de nómina construidos por el navegador.'
      );
      err.status = 400;
      throw err;
    }

    const draft = await PayrollDraft.findByPk(draftId, {
      include: [{ model: PayrollDraftEmployee, as: 'draftEmployees' }],
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!draft) {
      const err = new Error('Borrador de nómina no encontrado.');
      err.status = 404;
      throw err;
    }

    const companyToken = requireSingleCompany(draft.companies)[0];
    const canonicalCompanyId = await resolveCanonicalCompanyId(companyToken, t);
    validatedCompanies = [canonicalCompanyId];
    targetStatus = draft.isApproved ? 'cerrada' : 'auditoria';

    let emps = (draft.draftEmployees || []).map((row) => {
      const raw = row.data;
      if (typeof raw !== 'string') return raw;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }).filter(Boolean);
    assertEmployeesMatchPayrollCompany(emps, canonicalCompanyId);

    if (draft.isApproved) {
      // Auditoría aprobó estos valores exactos. Nunca se vuelven a calcular
      // salvo para completar un registro histórico antiguo sin snapshot.
      emps = emps.map((employee) => (
        employee?.calculated
          ? employee
          : calculateEmployeePayroll(employee, draft.periodType)
      ));
    } else {
      // Al enviar por primera vez se toma el catálogo vigente y se congela el
      // resultado calculado del servidor que verá Auditoría.
      const scheduledBonuses = emps.length > 0
        ? await Bonus.findAll({ transaction: t })
        : [];
      emps = applyScheduledBonusesToEmployees(
        emps,
        scheduledBonuses,
        draft.createdAt,
        draft.periodType
      );
      emps = calculatePayrollBatch(emps, draft.periodType);
    }

    await assertClosedFirstQuincenaExists({
      periodType: draft.periodType,
      createdAt: draft.createdAt
    }, validatedCompanies, t);

    // Solo al enviar a auditoría una 2ª: bonos operativos pendientes del mes
    if (targetStatus === 'auditoria' && String(draft.periodType) === '2da') {
      await assertNoBlockingOperationsForAudit(
        canonicalCompanyId,
        draft.createdAt,
        t
      );
    }

    let summary = computePayrollSummary({
      companies: validatedCompanies,
      data: emps,
      periodType: draft.periodType
    });
    // Mantener siempre los IDs canónicos, no nombres mezclados de empleados.
    summary.companies = validatedCompanies;

    if (targetStatus === 'auditoria' && req.user) {
      let submitterEmail = null;
      const dbUser = await User.findByPk(req.user.id, {
        attributes: ['id', 'name', 'email'],
        transaction: t
      });
      submitterEmail = dbUser?.email || null;
      if (dbUser?.name) submitterName = dbUser.name;
      summary = {
        ...summary,
        submittedBy: {
          userId: req.user.id,
          name: submitterName,
          email: submitterEmail
        }
      };
    }

    newPayroll = await PayrollHistory.create({
      id: draft.id,
      title: draft.title,
      periodType: draft.periodType,
      status: targetStatus,
      closedAt: new Date().toISOString(),
      createdAt: draft.createdAt,
      data: emps,
      notes: draft.notes,
      summary
    }, { transaction: t });

    await syncEmployeeIsrFromClosed2da(
      draft.periodType,
      targetStatus,
      emps,
      t
    );
    await setPayrollOperationLogsStatus(
      emps,
      'PROCESSED_PAYROLL',
      newPayroll.id,
      t
    );
    await setPayrollCommissionsStatus(emps, 'Aplicado', t);
    if (String(draft.periodType) === '2da') {
      await setMonthlyOperationCaptureState({
        companyId: canonicalCompanyId,
        draftDate: draft.createdAt,
        captureState: targetStatus === 'auditoria' ? 'FROZEN' : 'CLOSED',
        payrollDraftId: null,
        transaction: t
      });
    }

    await PayrollDraftEmployee.destroy({
      where: { draftId: draft.id },
      transaction: t
    });
    await clearBatchDraftLink(draft.id, t);
    await draft.destroy({ transaction: t });
    await t.commit();

    if (targetStatus === 'auditoria') {
      try {
        const companyNames = await resolveCompanyNames(validatedCompanies);
        await notifyAuditorsOfSubmission({
          historyRecord: newPayroll,
          companyNames,
          submitterName
        });
      } catch (mailErr) {
        console.error('Error notificando auditores al enviar nómina:', mailErr);
      }
    }

    res.status(201).json(newPayroll);
  } catch (err) {
    if (!t.finished) await t.rollback();
    res.status(err.status || 400).json({ error: err.message });
  }
};

const deletePayroll = async (req, res) => {
  try {
    const payroll = await PayrollHistory.findByPk(req.params.id);
    if (!payroll) return res.status(404).json({ error: 'No encontrado' });
    await BillingService.markRunsStaleForPayroll(payroll.id);
    await payroll.destroy();
    res.json({ message: 'Eliminado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const requestReactivation = async (req, res) => {
  try {
    const { payrollIds, concepto } = req.body;
    if (!Array.isArray(payrollIds) || payrollIds.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron IDs de nómina' });
    }

    // Combine data from all requested payrolls
    let totalGross = 0;
    let totalEmployees = 0;
    let payrollTitle = "Varias Nóminas";
    let periodType = "N/A";
    let companies = new Set();

    const payrolls = await PayrollHistory.findAll({ where: { id: payrollIds } });
    if (payrolls.length === 0) {
      return res.status(404).json({ error: 'Nómina(s) no encontrada(s)' });
    }

    // Solo se puede reactivar nómina de fin de mes (2da quincena) ya cerrada
    for (const p of payrolls) {
      if (p.periodType !== '2da') {
        return res.status(400).json({
          error: 'Solo se puede reactivar la nómina de 2ª quincena (fin de mes).'
        });
      }
      if (p.status !== 'cerrada') {
        return res.status(400).json({
          error: `La nómina "${p.title}" no está cerrada; solo se reactivan nóminas con estado cerrada.`
        });
      }
    }

    if (payrolls.length > 0) {
      payrollTitle = payrolls[0].title;
      periodType = payrolls[0].periodType;
    }

    for (const payroll of payrolls) {
      const emps = typeof payroll.data === 'string' ? JSON.parse(payroll.data) : (payroll.data || []);
      totalEmployees += emps.length;
      
      emps.forEach(e => {
        // Nóminas cerradas conservan su snapshot; historiales antiguos sin él
        // se completan con el mismo motor central usado al crear la nómina.
        const employeeWithSnapshot = e?.calculated
          ? e
          : calculateEmployeePayroll(e, payroll.periodType);
        totalGross += Number(employeeWithSnapshot.calculated?.gross) || 0;
      });
    }

    const details = {
      title: payrollTitle,
      solicitante: req.user ? req.user.name : 'Usuario del Sistema',
      monto: totalGross.toLocaleString('es-GT', { style: 'currency', currency: 'GTQ' }),
      empleados: totalEmployees,
      periodo: periodType,
      concepto: concepto || null
    };

    // Generate JWT token
    const token = jwt.sign({ payrollIds }, process.env.JWT_SECRET || 'secretkey', { expiresIn: '24h' });

    // Find all users with GERENTE GENERAL role
    const gerentes = await User.findAll({ where: { role: 'GERENTE GENERAL' } });
    if (gerentes.length === 0) {
      return res.status(400).json({ error: 'No hay usuarios con el rol GERENTE GENERAL para aprobar la solicitud.' });
    }

    // Send email to all GERENTE GENERAL users in parallel
    await Promise.all(
      gerentes
        .filter(g => g.email)
        .map(gerente => sendReactivationEmail(gerente.name, gerente.email, token, details))
    );

    res.json({ message: 'Solicitud de reactivación enviada por correo a los Gerentes Generales.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

const assertReactivatablePayrolls = async (payrollIds, transaction) => {
  const payrolls = await PayrollHistory.findAll({
    where: { id: payrollIds },
    transaction
  });
  if (payrolls.length === 0) {
    throw new Error('Nómina(s) no encontrada(s)');
  }
  for (const p of payrolls) {
    if (p.periodType !== '2da') {
      throw new Error('Solo se puede reactivar la nómina de 2ª quincena (fin de mes).');
    }
    if (p.status !== 'cerrada') {
      throw new Error(`La nómina "${p.title}" no está cerrada; solo se reactivan nóminas con estado cerrada.`);
    }
  }
  return payrolls;
};

const reactivate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { token } = req.body;
    if (!token) {
      await t.rollback();
      return res.status(400).json({ error: 'Token no proporcionado' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
    const { payrollIds } = decoded;

    if (!Array.isArray(payrollIds)) {
      await t.rollback();
      return res.status(400).json({ error: 'Token inválido: no contiene IDs de nómina' });
    }

    await assertReactivatablePayrolls(payrollIds, t);

    for (const payrollId of payrollIds) {
      // Check if it exists in history
      const historyRecord = await PayrollHistory.findByPk(payrollId, { transaction: t });
      if (!historyRecord) continue;

      const data = typeof historyRecord.data === 'string' ? JSON.parse(historyRecord.data) : historyRecord.data;

      // We will recreate the PayrollDraft
      const draftId = `draft_${Date.now()}_${Math.floor(Math.random()*1000)}`;
      await PayrollDraft.create({
        id: draftId,
        title: historyRecord.title,
        periodType: historyRecord.periodType,
        companies: getCompaniesFromHistory(historyRecord),
        employeesCount: data ? data.length : 0,
        notes: historyRecord.notes,
        createdAt: historyRecord.createdAt || historyRecord.closedAt || new Date()
      }, { transaction: t });

      if (data && data.length > 0) {
        const employeeRecords = data.map(emp => ({
          draftId: draftId,
          employeeId: emp.id,
          data: emp
        }));
        await PayrollDraftEmployee.bulkCreate(employeeRecords, { transaction: t });
      }

      // Delete from history
      await BillingService.markRunsStaleForPayroll(payrollId);
      await historyRecord.destroy({ transaction: t });
    }

    await t.commit();
    res.json({ message: 'Nómina reactivada exitosamente.' });
  } catch (err) {
    await t.rollback();
    res.status(400).json({ error: err.message });
  }
};

const reactivateViaGet = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { token } = req.query;
    if (!token) {
      await t.rollback();
      return res.status(400).send('<h1>Error: Token no proporcionado</h1>');
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
    const { payrollIds } = decoded;

    if (!Array.isArray(payrollIds)) {
      await t.rollback();
      return res.status(400).send('<h1>Error: Token inválido</h1>');
    }

    try {
      await assertReactivatablePayrolls(payrollIds, t);
    } catch (validationErr) {
      await t.rollback();
      return res.status(400).send(`<h1>Error: ${validationErr.message}</h1>`);
    }

    let reactivated = false;

    for (const payrollId of payrollIds) {
      const historyRecord = await PayrollHistory.findByPk(payrollId, { transaction: t });
      if (!historyRecord) continue;

      const data = typeof historyRecord.data === 'string' ? JSON.parse(historyRecord.data) : historyRecord.data;

      const draftId = `draft_${Date.now()}_${Math.floor(Math.random()*1000)}`;
      await PayrollDraft.create({
        id: draftId,
        title: historyRecord.title,
        periodType: historyRecord.periodType,
        companies: getCompaniesFromHistory(historyRecord),
        employeesCount: data ? data.length : 0,
        notes: historyRecord.notes,
        createdAt: historyRecord.createdAt || historyRecord.closedAt || new Date()
      }, { transaction: t });

      if (data && data.length > 0) {
        const employeeRecords = data.map(emp => ({
          draftId: draftId,
          employeeId: emp.id,
          data: emp
        }));
        await PayrollDraftEmployee.bulkCreate(employeeRecords, { transaction: t });
      }

      await BillingService.markRunsStaleForPayroll(payrollId);
      await historyRecord.destroy({ transaction: t });
      reactivated = true;
    }

    await t.commit();
    
    if (reactivated) {
      res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reactivación Exitosa</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
            body { font-family: 'Plus Jakarta Sans', Tahoma, Geneva, Verdana, sans-serif; background-color: #1a202c; color: #e2e8f0; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .card { background-color: #2d3748; padding: 50px 40px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5); text-align: center; max-width: 500px; width: 90%; border: 1px solid #4a5568; }
            .icon { color: #48bb78; font-size: 72px; margin-bottom: 20px; line-height: 1; }
            h1 { color: #ffffff; margin-top: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
            p { color: #a0aec0; margin-bottom: 35px; line-height: 1.6; font-size: 15px; }
            a { display: inline-block; background-color: #3182ce; color: white; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-weight: 700; transition: all 0.2s; box-shadow: 0 4px 6px rgba(49, 130, 206, 0.3); }
            a:hover { background-color: #2b6cb0; transform: translateY(-1px); box-shadow: 0 6px 8px rgba(49, 130, 206, 0.4); }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✓</div>
            <h1>¡Reactivación Aprobada!</h1>
            <p>La nómina ha sido reactivada exitosamente. Ahora se encuentra en estado de borrador y puede ser modificada desde el sistema.</p>
            <a href="http://localhost:5173/dashboard">Volver al Sistema</a>
          </div>
        </body>
        </html>
      `);
    } else {
      res.status(400).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Nómina no encontrada</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
            body { font-family: 'Plus Jakarta Sans', Tahoma, Geneva, Verdana, sans-serif; background-color: #1a202c; color: #e2e8f0; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .card { background-color: #2d3748; padding: 50px 40px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5); text-align: center; max-width: 500px; width: 90%; border: 1px solid #4a5568; }
            .icon { color: #d69e2e; font-size: 72px; margin-bottom: 20px; line-height: 1; }
            h1 { color: #ffffff; margin-top: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
            p { color: #a0aec0; margin-bottom: 35px; line-height: 1.6; font-size: 15px; }
            a { display: inline-block; background-color: #4a5568; color: white; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; transition: all 0.2s; }
            a:hover { background-color: #2d3748; border: 1px solid #718096; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">⚠</div>
            <h1>Nómina no encontrada</h1>
            <p>Es posible que esta nómina ya haya sido reactivada previamente o el enlace haya expirado.</p>
            <a href="http://localhost:5173/dashboard">Ir al Sistema</a>
          </div>
        </body>
        </html>
      `);
    }
  } catch (err) {
    await t.rollback();
    res.status(400).send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
          body { font-family: 'Plus Jakarta Sans', Tahoma, Geneva, Verdana, sans-serif; background-color: #1a202c; color: #e2e8f0; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .card { background-color: #2d3748; padding: 50px 40px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5); text-align: center; max-width: 500px; width: 90%; border: 1px solid #4a5568; }
          .icon { color: #e53e3e; font-size: 72px; margin-bottom: 20px; line-height: 1; }
          h1 { color: #ffffff; margin-top: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
          p { color: #a0aec0; margin-bottom: 35px; line-height: 1.6; font-size: 15px; }
          a { display: inline-block; background-color: #4a5568; color: white; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; transition: all 0.2s; }
          a:hover { background-color: #2d3748; border: 1px solid #718096; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✕</div>
          <h1>Error al Reactivar</h1>
          <p>${err.message}</p>
          <a href="http://localhost:5173/dashboard">Volver al Sistema</a>
        </div>
      </body>
      </html>
    `);
  }
};

const auditorApprove = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    if (!req.user || !AUDIT_ROLES.includes(req.user.role)) {
      await t.rollback();
      return res.status(403).json({ error: 'No tienes permiso para aprobar nóminas en auditoría.' });
    }

    const historyRecord = await PayrollHistory.findByPk(req.params.id, { transaction: t });
    if (!historyRecord) {
      await t.rollback();
      return res.status(404).json({ error: 'Nómina no encontrada' });
    }
    if (historyRecord.status !== 'auditoria') {
      await t.rollback();
      return res.status(400).json({ error: 'Solo se pueden aprobar nóminas en estado de auditoría.' });
    }

    const data = typeof historyRecord.data === 'string' ? JSON.parse(historyRecord.data) : historyRecord.data;
    const companies = getCompaniesFromHistory(historyRecord);

    const draftId = `draft_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    await PayrollDraft.create({
      id: draftId,
      title: historyRecord.title,
      periodType: historyRecord.periodType,
      companies,
      employeesCount: data ? data.length : 0,
      notes: historyRecord.notes,
      isApproved: true,
      correctionNote: null,
      createdAt: historyRecord.createdAt || historyRecord.closedAt || new Date()
    }, { transaction: t });

    if (data && data.length > 0) {
      const employeeRecords = data.map(emp => ({ draftId, employeeId: emp.id, data: emp }));
      await PayrollDraftEmployee.bulkCreate(employeeRecords, { transaction: t });
    }

    if (String(historyRecord.periodType) === '2da' && companies.length === 1) {
      await setMonthlyOperationCaptureState({
        companyId: companies[0],
        draftDate: historyRecord.createdAt || historyRecord.closedAt,
        captureState: 'CLOSED',
        payrollDraftId: null,
        transaction: t
      });
    }

    await BillingService.markRunsStaleForPayroll(historyRecord.id);
    const historySnapshot = historyRecord.toJSON();
    await historyRecord.destroy({ transaction: t });
    await t.commit();

    // Correos fuera de la transacción
    try {
      await notifyAuditDecisionRecipients({
        historyRecord: historySnapshot,
        action: 'approved',
        auditorName: req.user.name
      });
    } catch (mailErr) {
      console.error('Error notificando aprobación de auditoría:', mailErr);
    }

    res.json({ message: 'Nómina devuelta a borradores como aprobada.' });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
};

const auditorReject = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    if (!req.user || !AUDIT_ROLES.includes(req.user.role)) {
      await t.rollback();
      return res.status(403).json({ error: 'No tienes permiso para rechazar nóminas en auditoría.' });
    }

    const { note } = req.body;
    const historyRecord = await PayrollHistory.findByPk(req.params.id, { transaction: t });
    if (!historyRecord) {
      await t.rollback();
      return res.status(404).json({ error: 'Nómina no encontrada' });
    }
    if (historyRecord.status !== 'auditoria') {
      await t.rollback();
      return res.status(400).json({ error: 'Solo se pueden rechazar nóminas en estado de auditoría.' });
    }

    const data = typeof historyRecord.data === 'string' ? JSON.parse(historyRecord.data) : historyRecord.data;
    const companies = getCompaniesFromHistory(historyRecord);

    // Al devolver la nómina, los registros operativos de esta quincena vuelven
    // a quedar disponibles para corrección. Los heredados de 1ª no se tocan.
    await setPayrollOperationLogsStatus(
      data,
      'RETURNED',
      null,
      t
    );
    const returnedOperationIds = getCurrentPayrollOperationLogIds(data);
    if (returnedOperationIds.length > 0) {
      const returnedLogs = await OperationLog.findAll({
        where: { id: returnedOperationIds },
        attributes: ['id', 'batchId'],
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      const auditComment = note || 'Devuelto por Auditoría para corrección.';
      await OperationLog.update(
        { justification: auditComment },
        { where: { id: returnedOperationIds }, transaction: t }
      );
      await OperationLogReview.bulkCreate(returnedLogs.map((log) => ({
        operationLogId: log.id,
        actorId: req.user.id,
        actorRole: String(req.user.role || 'AUDITOR').toUpperCase(),
        action: 'AUDIT_RETURNED',
        fromStatus: 'PROCESSED_PAYROLL',
        toStatus: 'RETURNED',
        comment: auditComment
      })), { transaction: t });
      await Promise.all([...new Set(returnedLogs.map((log) => log.batchId).filter(Boolean))]
        .map((batchId) => recalculateBatchStatus(batchId, { transaction: t, latestComment: auditComment })));
    }
    await setPayrollCommissionsStatus(data, 'Pendiente', t);

    const draftId = `draft_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    await PayrollDraft.create({
      id: draftId,
      title: historyRecord.title,
      periodType: historyRecord.periodType,
      companies,
      employeesCount: data ? data.length : 0,
      notes: historyRecord.notes,
      isApproved: false,
      correctionNote: note || 'Requiere correcciones',
      createdAt: historyRecord.createdAt || historyRecord.closedAt || new Date()
    }, { transaction: t });

    if (data && data.length > 0) {
      const employeeRecords = data.map(emp => ({ draftId, employeeId: emp.id, data: emp }));
      await PayrollDraftEmployee.bulkCreate(employeeRecords, { transaction: t });
    }

    if (String(historyRecord.periodType) === '2da' && companies.length === 1) {
      await ensureBonos2daBatchForDraft({
        draftId,
        companyId: companies[0],
        draftDate: historyRecord.createdAt || historyRecord.closedAt,
        userId: req.user.id,
        transaction: t
      });
      await setMonthlyOperationCaptureState({
        companyId: companies[0],
        draftDate: historyRecord.createdAt || historyRecord.closedAt,
        captureState: 'OPEN',
        payrollDraftId: draftId,
        transaction: t
      });
    }

    await BillingService.markRunsStaleForPayroll(historyRecord.id);
    const historySnapshot = historyRecord.toJSON();
    await historyRecord.destroy({ transaction: t });
    await t.commit();

    try {
      await notifyAuditDecisionRecipients({
        historyRecord: historySnapshot,
        action: 'rejected',
        note: note || 'Requiere correcciones',
        auditorName: req.user.name
      });
    } catch (mailErr) {
      console.error('Error notificando rechazo de auditoría:', mailErr);
    }

    res.json({ message: 'Nómina rebotada a borradores para corrección.' });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!req.user || !AUDIT_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        error: 'No tiene permiso para cambiar el estado de una nómina.'
      });
    }
    if (status !== 'cerrada') {
      return res.status(400).json({
        error: 'La única transición permitida en este endpoint es auditoría → cerrada.'
      });
    }
    const payroll = await PayrollHistory.findByPk(req.params.id);
    if (!payroll) return res.status(404).json({ error: 'No encontrado' });
    if (payroll.status !== 'auditoria') {
      return res.status(400).json({
        error: 'Solo una nómina en auditoría puede marcarse como cerrada.'
      });
    }

    const companyIds = getCompaniesFromHistory(payroll);
    await assertClosedFirstQuincenaExists({
      periodType: payroll.periodType,
      createdAt: payroll.createdAt,
      closedAt: payroll.closedAt
    }, companyIds);

    const prevStatus = payroll.status;
    payroll.status = status;
    payroll.closedAt = new Date();
    await payroll.save();

    if (prevStatus !== 'cerrada' && status === 'cerrada') {
      try {
        const emps = typeof payroll.data === 'string' ? JSON.parse(payroll.data) : (payroll.data || []);
        await syncEmployeeIsrFromClosed2da(payroll.periodType, status, emps);
      } catch (isrSyncErr) {
        console.error('Error sincronizando ISR al cambiar status a cerrada:', isrSyncErr);
      }
    }

    res.json(payroll);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  getPayrolls,
  getPayrollById,
  updateStatus,
  createPayroll,
  deletePayroll,
  requestReactivation,
  reactivate,
  reactivateViaGet,
  auditorApprove,
  auditorReject
};
