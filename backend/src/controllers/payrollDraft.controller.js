const {
  PayrollDraft,
  PayrollDraftEmployee,
  Bonus,
  Company,
  sequelize
} = require('../models');
const { calculatePayrollBatch } = require('../services/payrollCalculator.service');
const { applyScheduledBonusesToEmployees } = require('../services/payrollBonuses.service');

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

    await t.commit();
    res.status(201).json({
      ...req.body,
      companies: validatedCompanies,
      employees: calculatedEmployees,
      revision: Number(newDraft.revision) || 0
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
  try {
    const draft = await PayrollDraft.findByPk(req.params.id);
    if (!draft) return res.status(404).json({ error: 'Borrador no encontrado' });
    
    // Cascade delete will handle PayrollDraftEmployee
    await draft.destroy();
    res.json({ message: 'Borrador eliminado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  getAll,
  create,
  update,
  remove
};
