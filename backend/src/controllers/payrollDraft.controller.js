const {
  PayrollDraft,
  PayrollDraftEmployee,
  Bonus,
  Company,
  OperationLog,
  sequelize
} = require('../models');
const { calculatePayrollBatch } = require('../services/payrollCalculator.service');
const { applyScheduledBonusesToEmployees } = require('../services/payrollBonuses.service');
const {
  ensureBonos2daBatchForDraft,
  clearBatchDraftLink
} = require('../services/operationBonusBatch.service');
const { syncOperationLogTransitions } = require('../services/payrollDraftInputs.service');
const { Op } = require('sequelize');
const { getMonthBoundsFromDate } = require('../services/operationPayroll.service');
const { getPagination, toPagedResponse, wantsPagination } = require('../utils/pagination');

/** Exige exactamente una empresa concreta (bloquea ALL / vacías / multi-empresa). */
const requireSingleCompany = (companies) => {
  let comps = companies;
  if (typeof comps === 'string') {
    try {
      comps = JSON.parse(comps);
    } catch {
      comps = [];
    }
  }
  if (!Array.isArray(comps)) comps = [];

  const normalized = comps
    .map(c => (c == null ? '' : String(c).trim()))
    .filter(Boolean);

  const hasAllToken = normalized.some(c => {
    const s = c.toLowerCase();
    return s === 'all' || s === 'todas' || s === 'todas las empresas';
  });

  if (normalized.length !== 1 || hasAllToken) {
    const err = new Error(
      'Debe seleccionar una empresa específica. No se permite crear o actualizar nóminas para todas las empresas a la vez.'
    );
    err.status = 400;
    throw err;
  }

  return normalized;
};

const samePayrollDate = (left, right) => {
  const toDateKey = (value) => {
    if (!value) return '';
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value));
    if (match) return match[1];
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  };
  return toDateKey(left) === toDateKey(right);
};

const getEmployeePrincipalCompanyId = (employee) => {
  const id = Number(
    employee?.empresa_principal
    ?? employee?.companyId
    ?? employee?.id_empresa
  );
  return Number.isInteger(id) && id > 0 ? id : null;
};

const resolveCompanyId = async (rawCompany, transaction) => {
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

const assertEmployeesBelongToCompany = (employees, companyId) => {
  const mismatches = (Array.isArray(employees) ? employees : []).filter(
    employee => getEmployeePrincipalCompanyId(employee) !== Number(companyId)
  );
  if (mismatches.length > 0) {
    const sample = mismatches.slice(0, 3).map((employee) => (
      employee?.id != null ? `#${employee.id}` : 'sin ID'
    )).join(', ');
    const err = new Error(
      `Todos los empleados del borrador deben pertenecer a la empresa seleccionada. Revise: ${sample}.`
    );
    err.status = 400;
    throw err;
  }
};

const getAll = async (req, res) => {
  try {
    const summaryOnly = req.query.summary === '1' || req.query.summary === 'true';
    if (summaryOnly) {
      const paged = wantsPagination(req.query);
      const pagination = paged ? getPagination(req.query) : null;
      const query = {
        order: [['createdAt', 'DESC'], ['id', 'ASC']],
        ...(pagination ? { limit: pagination.limit, offset: pagination.offset } : {})
      };
      const result = paged
        ? await PayrollDraft.findAndCountAll(query)
        : { rows: await PayrollDraft.findAll(query), count: null };
      const draftValues = result.rows.map((draft) => draft.toJSON());
      const companyIds = [...new Set(draftValues.flatMap((draft) => {
        let values = draft.companies;
        if (typeof values === 'string') {
          try { values = JSON.parse(values); } catch { values = []; }
        }
        return (Array.isArray(values) ? values : [])
          .map(Number)
          .filter((id) => Number.isInteger(id) && id > 0);
      }))];
      const toYearMonth = (value) => {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      };
      const months = draftValues
        .map((draft) => toYearMonth(draft.createdAt))
        .filter((month) => /^\d{4}-\d{2}$/.test(month))
        .sort();
      let operationalCounts = new Map();

      if (companyIds.length > 0 && months.length > 0) {
        const [lastYear, lastMonth] = months[months.length - 1].split('-').map(Number);
        const lastDay = new Date(lastYear, lastMonth, 0).getDate();
        const logs = await OperationLog.findAll({
          where: {
            companyId: { [Op.in]: companyIds },
            date: {
              [Op.between]: [
                `${months[0]}-01`,
                `${months[months.length - 1]}-${String(lastDay).padStart(2, '0')}`
              ]
            },
            type: { [Op.in]: ['BONO', 'HORA_EXTRA'] },
            status: {
              [Op.in]: [
                'PENDING_MANAGER',
                'RETURNED',
                'APPROVED_MANAGER',
                'PROCESSED_PAYROLL'
              ]
            }
          },
          attributes: ['companyId', 'date', 'type', 'status'],
          raw: true
        });
        operationalCounts = logs.reduce((counts, log) => {
          const key = `${log.companyId}:${String(log.date).slice(0, 7)}`;
          const current = counts.get(key) || { pending: 0, approved: 0 };
          if (['PENDING_MANAGER', 'RETURNED'].includes(log.status)) current.pending += 1;
          if (
            log.type === 'BONO'
            && ['APPROVED_MANAGER', 'PROCESSED_PAYROLL'].includes(log.status)
          ) current.approved += 1;
          counts.set(key, current);
          return counts;
        }, new Map());
      }

      const rows = draftValues.map((value) => {
        let companies = value.companies;
        if (typeof companies === 'string') {
          try { companies = JSON.parse(companies); } catch { companies = []; }
        }
        const companyId = Array.isArray(companies) ? companies[0] : null;
        const month = toYearMonth(value.createdAt);
        return {
          id: value.id,
          title: value.title,
          companies: value.companies,
          periodType: value.periodType,
          notes: value.notes,
          employeesCount: Number(value.employeesCount) || 0,
          isApproved: !!value.isApproved,
          correctionNote: value.correctionNote || null,
          revision: Number(value.revision) || 0,
          operationalCounts: operationalCounts.get(`${companyId}:${month}`)
            || { pending: 0, approved: 0 },
          createdAt: value.createdAt
        };
      });
      res.set('Cache-Control', 'no-store');
      return res.json(paged
        ? toPagedResponse(rows, result.count, pagination.page, pagination.pageSize)
        : rows);
    }
    const drafts = await PayrollDraft.findAll({
      include: [{ model: PayrollDraftEmployee, as: 'draftEmployees' }]
    });

    // Transform backend structure back to what frontend expects
    const formattedDrafts = drafts.map(d => {
      const draftObj = d.toJSON();
      let employeesArr = draftObj.draftEmployees.map(de => {
        try {
          return typeof de.data === 'string' ? JSON.parse(de.data) : de.data;
        } catch(e) {
          return de.data;
        }
      });
      // Un borrador aprobado es el snapshot visto por Auditoría: no puede
      // cambiar porque se despliegue una fórmula nueva antes del cierre.
      // Solo completamos snapshots antiguos que no tenían "calculated".
      if (
        Array.isArray(employeesArr)
        && employeesArr.length > 0
        && !draftObj.isApproved
      ) {
        employeesArr = calculatePayrollBatch(employeesArr, draftObj.periodType);
      } else if (Array.isArray(employeesArr) && draftObj.isApproved) {
        employeesArr = employeesArr.map((employee) => (
          employee?.calculated
            ? employee
            : calculatePayrollBatch([employee], draftObj.periodType)[0]
        ));
      }

      return {
        id: draftObj.id,
        title: draftObj.title,
        companies: draftObj.companies,
        periodType: draftObj.periodType,
        notes: draftObj.notes,
        isApproved: !!draftObj.isApproved,
        correctionNote: draftObj.correctionNote || null,
        revision: Number(draftObj.revision) || 0,
        employees: employeesArr,
        createdAt: draftObj.createdAt
      };
    });

    res.json(formattedDrafts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getById = async (req, res) => {
  try {
    const draft = await PayrollDraft.findByPk(req.params.id, {
      include: [{ model: PayrollDraftEmployee, as: 'draftEmployees' }]
    });
    if (!draft) return res.status(404).json({ error: 'Borrador no encontrado' });
    const value = draft.toJSON();
    let employees = (value.draftEmployees || []).map((row) => {
      try {
        return typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      } catch {
        return row.data;
      }
    });
    if (!value.isApproved) {
      employees = calculatePayrollBatch(employees, value.periodType);
    } else {
      employees = employees.map((employee) => (
        employee?.calculated
          ? employee
          : calculatePayrollBatch([employee], value.periodType)[0]
      ));
    }
    res.set('Cache-Control', 'no-store');
    return res.json({
      id: value.id,
      title: value.title,
      companies: value.companies,
      periodType: value.periodType,
      notes: value.notes,
      employeesCount: Number(value.employeesCount) || employees.length,
      isApproved: !!value.isApproved,
      correctionNote: value.correctionNote || null,
      revision: Number(value.revision) || 0,
      employees,
      createdAt: value.createdAt
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const validateExpectedRevision = (rawRevision, currentRevision) => {
  const expected = Number(rawRevision);
  if (
    (typeof rawRevision !== 'number' && typeof rawRevision !== 'string')
    || String(rawRevision).trim() === ''
    || !Number.isInteger(expected)
    || expected < 0
  ) {
    const error = new Error('Debe enviar la revisión actual del borrador.');
    error.status = 400;
    error.currentRevision = currentRevision;
    throw error;
  }
  if (expected !== currentRevision) {
    const error = new Error(
      'El borrador fue modificado por otro usuario. Recargue la nómina antes de guardar nuevamente.'
    );
    error.status = 409;
    error.currentRevision = currentRevision;
    throw error;
  }
};

const patchEmployee = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const draftId = String(req.params.id);
    const employeeId = Number(req.params.employeeId);
    const draft = await PayrollDraft.findByPk(draftId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!draft) {
      const error = new Error('Borrador no encontrado');
      error.status = 404;
      throw error;
    }
    const currentRevision = Number(draft.revision) || 0;
    validateExpectedRevision(req.body?.revision, currentRevision);
    if (draft.isApproved) {
      const error = new Error('Una nómina aprobada no puede editarse.');
      error.status = 403;
      throw error;
    }
    const incoming = req.body?.employee;
    if (!incoming || Number(incoming.id) !== employeeId) {
      const error = new Error('El empleado enviado no coincide con la ruta.');
      error.status = 400;
      throw error;
    }
    const row = await PayrollDraftEmployee.findOne({
      where: { draftId, employeeId },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!row) {
      const error = new Error('Empleado no encontrado en el borrador.');
      error.status = 404;
      throw error;
    }

    const companyId = await resolveCompanyId(
      requireSingleCompany(draft.companies)[0],
      transaction
    );
    assertEmployeesBelongToCompany([incoming], companyId);
    const scheduledBonuses = await Bonus.findAll({ transaction });
    const withBonuses = applyScheduledBonusesToEmployees(
      [incoming],
      scheduledBonuses,
      draft.createdAt,
      draft.periodType
    );
    const calculated = calculatePayrollBatch(withBonuses, draft.periodType)[0];
    row.set('data', calculated);
    await row.save({ transaction, fields: ['data'] });
    draft.set('revision', currentRevision + 1);
    await draft.save({ transaction, fields: ['revision'] });
    await transaction.commit();
    return res.json({ revision: Number(draft.revision), employee: calculated });
  } catch (err) {
    await transaction.rollback();
    return res.status(err.status || 400).json({
      error: err.message,
      ...(err.currentRevision !== undefined
        ? { currentRevision: err.currentRevision }
        : {})
    });
  }
};

const patchMetadata = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const draft = await PayrollDraft.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!draft) {
      const error = new Error('Borrador no encontrado');
      error.status = 404;
      throw error;
    }
    const currentRevision = Number(draft.revision) || 0;
    validateExpectedRevision(req.body?.revision, currentRevision);
    if (draft.isApproved) {
      const error = new Error('Una nómina aprobada no puede editarse.');
      error.status = 403;
      throw error;
    }
    await draft.update({
      ...(req.body.title !== undefined ? { title: req.body.title } : {}),
      ...(req.body.notes !== undefined ? { notes: req.body.notes } : {}),
      revision: currentRevision + 1
    }, { transaction });
    await transaction.commit();
    return res.json({
      id: draft.id,
      title: draft.title,
      notes: draft.notes,
      revision: Number(draft.revision)
    });
  } catch (err) {
    await transaction.rollback();
    return res.status(err.status || 400).json({
      error: err.message,
      ...(err.currentRevision !== undefined
        ? { currentRevision: err.currentRevision }
        : {})
    });
  }
};

const create = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id, title, companies, employees, createdAt, periodType, notes } = req.body;
    const companyToken = requireSingleCompany(companies)[0];
    const companyId = await resolveCompanyId(companyToken, t);
    const validatedCompanies = [companyId];

    const scheduledBonuses = employees && employees.length > 0
      ? await Bonus.findAll({ transaction: t })
      : [];
    const employeesWithBonuses = applyScheduledBonusesToEmployees(
      employees,
      scheduledBonuses,
      createdAt,
      periodType
    );
    assertEmployeesBelongToCompany(employeesWithBonuses, companyId);

    // SERVER-SIDE CALCULATION ENFORCEMENT
    const calculatedEmployees = employeesWithBonuses.length > 0
      ? calculatePayrollBatch(employeesWithBonuses, periodType)
      : [];
    
    // Create main draft record
    const newDraft = await PayrollDraft.create({
      id,
      title,
      companies: validatedCompanies,
      periodType,
      notes,
      employeesCount: calculatedEmployees.length,
      createdAt
    }, { transaction: t });

    // Create secondary records
    if (calculatedEmployees.length > 0) {
      const employeeRecords = calculatedEmployees.map(emp => ({
        draftId: id,
        employeeId: emp.id,
        data: emp
      }));
      await PayrollDraftEmployee.bulkCreate(employeeRecords, { transaction: t });
    }

    let bonusBatch = null;
    if (['1ra', '2da'].includes(String(periodType))) {
      bonusBatch = await ensureBonos2daBatchForDraft({
        draftId: id,
        companyId,
        draftDate: createdAt || newDraft.createdAt,
        userId: req.user?.id || null,
        transaction: t
      });
    }
    // Si la 2ª se abre después de aprobaciones del mes, el backend la hidrata
    // de forma idempotente y sin tocar la primera quincena.
    if (String(periodType) === '2da') {
      const monthBounds = getMonthBoundsFromDate(createdAt || newDraft.createdAt);
      const approvedOperations = await OperationLog.findAll({
        where: {
          companyId,
          status: 'APPROVED_MANAGER',
          date: {
            [Op.between]: [monthBounds.start, monthBounds.end]
          }
        },
        transaction: t
      });
      await syncOperationLogTransitions({
        transitions: approvedOperations.map((operation) => ({ current: operation })),
        transaction: t
      });
    }

    await t.commit();
    res.status(201).json({
      ...req.body,
      companies: validatedCompanies,
      employees: calculatedEmployees,
      revision: Number(newDraft.revision) || 0,
      bonusBatchId: bonusBatch?.id || null
    }); // Return the calculated payload
  } catch (err) {
    await t.rollback();
    res.status(err.status || 400).json({ error: err.message });
  }
};

const update = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const draftId = req.params.id;
    const draft = await PayrollDraft.findByPk(draftId, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    
    if (!draft) {
      await t.rollback();
      return res.status(404).json({ error: 'Borrador no encontrado' });
    }

    const rawRevision = req.body.revision;
    const expectedRevision = Number(rawRevision);
    if (
      (typeof rawRevision !== 'number' && typeof rawRevision !== 'string')
      || String(rawRevision).trim() === ''
      || !Number.isInteger(expectedRevision)
      || expectedRevision < 0
    ) {
      await t.rollback();
      return res.status(400).json({
        error: 'Debe enviar la revisión actual del borrador para actualizarlo.',
        currentRevision: Number(draft.revision) || 0
      });
    }

    const currentRevision = Number(draft.revision) || 0;
    if (expectedRevision !== currentRevision) {
      await t.rollback();
      return res.status(409).json({
        error: 'El borrador fue modificado por otro usuario. Recargue la nómina antes de guardar nuevamente.',
        currentRevision
      });
    }

    if (draft.isApproved) {
      await t.rollback();
      return res.status(403).json({
        error: 'Esta nómina ya tiene visto bueno de auditoría y no puede editarse. Solo puede cerrarse definitivamente.'
      });
    }

    const { title, companies, employees, createdAt, periodType, notes } = req.body;
    const requestedCompanyToken = requireSingleCompany(
      companies !== undefined ? companies : draft.companies
    )[0];
    const currentCompanyToken = requireSingleCompany(draft.companies)[0];
    const requestedCompanyId = await resolveCompanyId(requestedCompanyToken, t);
    const currentCompanyId = await resolveCompanyId(currentCompanyToken, t);
    const validatedCompanies = [requestedCompanyId];
    const finalPeriodType = periodType || draft.periodType;
    const finalCreatedAt = createdAt || draft.createdAt;
    if (
      String(requestedCompanyId) !== String(currentCompanyId)
      || String(finalPeriodType) !== String(draft.periodType)
      || !samePayrollDate(finalCreatedAt, draft.createdAt)
    ) {
      const err = new Error(
        'Empresa, período y fecha son inmutables después de generar el borrador. Cree un borrador nuevo para cambiarlos.'
      );
      err.status = 400;
      throw err;
    }
    console.log("UPDATE DRAFT ID:", draftId, "PAYLOAD PERIOD:", periodType);

    const scheduledBonuses = employees && employees.length > 0
      ? await Bonus.findAll({ transaction: t })
      : [];
    const employeesWithBonuses = applyScheduledBonusesToEmployees(
      employees,
      scheduledBonuses,
      finalCreatedAt,
      finalPeriodType
    );
    assertEmployeesBelongToCompany(employeesWithBonuses, requestedCompanyId);

    // SERVER-SIDE CALCULATION ENFORCEMENT
    const calculatedEmployees = employeesWithBonuses.length > 0
      ? calculatePayrollBatch(employeesWithBonuses, finalPeriodType)
      : [];

    // Update main record
    await draft.update({
      title,
      companies: validatedCompanies,
      periodType: finalPeriodType,
      notes,
      createdAt: finalCreatedAt,
      employeesCount: calculatedEmployees.length,
      revision: currentRevision + 1
    }, { transaction: t });

    // If employees array is provided, rebuild the employees table for this draft
    if (employees) {
      await PayrollDraftEmployee.destroy({ where: { draftId }, transaction: t });
      
      if (calculatedEmployees.length > 0) {
        const employeeRecords = calculatedEmployees.map(emp => {
          const empObj = typeof emp === 'string' ? JSON.parse(emp) : emp;
          return {
            draftId,
            employeeId: empObj.id,
            data: empObj
          };
        });
        await PayrollDraftEmployee.bulkCreate(employeeRecords, { transaction: t });
      }
    }

    await t.commit();
    res.json({
      ...req.body,
      companies: validatedCompanies,
      employees: calculatedEmployees,
      isApproved: !!draft.isApproved,
      correctionNote: draft.correctionNote || null,
      revision: Number(draft.revision)
    });
  } catch (err) {
    await t.rollback();
    res.status(err.status || 400).json({ error: err.message });
  }
};

const remove = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const draft = await PayrollDraft.findByPk(req.params.id, { transaction: t });
    if (!draft) {
      await t.rollback();
      return res.status(404).json({ error: 'Borrador no encontrado' });
    }

    await clearBatchDraftLink(draft.id, t);
    // Cascade delete will handle PayrollDraftEmployee
    await draft.destroy({ transaction: t });
    await t.commit();
    res.json({ message: 'Borrador eliminado' });
  } catch (err) {
    await t.rollback();
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  patchEmployee,
  patchMetadata,
  remove
};
