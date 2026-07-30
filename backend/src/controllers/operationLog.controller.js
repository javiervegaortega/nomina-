const {
  OperationLog,
  OperationBatch,
  OperationLogReview,
  Employee,
  Company,
  User,
  sequelize
} = require('../models');
const {
  sendOperationLogEmail,
  sendOperationReturnedToRequesterEmail
} = require('../services/email.service');
const {
  assertActivePayrollForLog,
  assertBonusDateInSecondQuincena,
  formatQuincenaLabel
} = require('../services/operationPayroll.service');
const {
  syncOperationLogTransition
} = require('../services/payrollDraftInputs.service');
const {
  getRole,
  getEmployeePrincipalCompanyId,
  assertSolicitanteDepartmentAccess,
  assertBonusBatchCompanyMatches,
  assertOperationStatusTransition,
  assertBatchAccess,
  assertOperationMutationAccess,
  assertOperationCorrectionAccess,
  requesterOwnsLog,
  logBelongsToDepartment
} = require('../services/operationLogPolicy.service');
const {
  recalculateBatchStatus,
  recordOperationReview
} = require('../services/operationWorkflow.service');

const employeeAttributes = [
  'id', 'primer_nombre', 'segundo_nombre', 'otro_nombre',
  'primer_apellido', 'segundo_apellido', 'empresa_principal',
  'departmentId', 'areaId', 'divisionId', 'subdivisionId',
  'nivel_5', 'dimension_5',
  'sueldo_ordinario'
];

const operationIncludes = [
  { model: Employee, attributes: employeeAttributes },
  { model: Company, as: 'companyData', attributes: ['id', 'nombre_comercial'] },
  {
    model: User,
    as: 'requester',
    attributes: ['id', 'name', 'email', 'role', 'idDepartamento']
  },
  {
    model: OperationLogReview,
    as: 'reviews',
    include: [{
      model: User,
      as: 'actor',
      attributes: ['id', 'name', 'role']
    }]
  }
];

const getPopulatedLog = (id) => OperationLog.findByPk(id, {
  include: operationIncludes,
  order: [[{ model: OperationLogReview, as: 'reviews' }, 'createdAt', 'ASC']]
});

const validateOperationPayload = ({
  type,
  hoursQty,
  hourType,
  bonusAmount,
  date
}) => {
  if (!['HORA_EXTRA', 'BONO'].includes(type)) {
    const error = new Error('El tipo de registro debe ser BONO o HORA_EXTRA.');
    error.statusCode = 400;
    throw error;
  }

  if (type === 'HORA_EXTRA') {
    if (!hourType || !['SIMPLE', 'NOCTURNA'].includes(String(hourType).toUpperCase())) {
      const error = new Error('hourType es requerido (SIMPLE o NOCTURNA) para horas extra.');
      error.statusCode = 400;
      throw error;
    }
    if (!hoursQty || Number(hoursQty) <= 0) {
      const error = new Error('hoursQty debe ser mayor a 0 para horas extra.');
      error.statusCode = 400;
      throw error;
    }
  } else {
    if (!bonusAmount || Number(bonusAmount) <= 0) {
      const error = new Error('bonusAmount debe ser mayor a 0 para bonos.');
      error.statusCode = 400;
      throw error;
    }
    assertBonusDateInSecondQuincena(date);
  }
};

const visibleToUser = (log, user) => {
  const role = getRole(user);
  if (['ADMIN', 'GERENTE GENERAL', 'AUDITOR'].includes(role)) return true;
  if (role === 'NOMINA') {
    return ['APPROVED_MANAGER', 'RETURNED', 'PROCESSED_PAYROLL'].includes(log.status);
  }
  if (role === 'GERENTE') return logBelongsToDepartment(log, user?.idDepartamento);
  if (role === 'SOLICITANTE') return Number(log.requesterId) === Number(user?.id);
  return false;
};

const getAll = async (req, res) => {
  try {
    const logs = await OperationLog.findAll({
      include: operationIncludes,
      order: [
        ['createdAt', 'DESC'],
        [{ model: OperationLogReview, as: 'reviews' }, 'createdAt', 'ASC']
      ]
    });
    res.json(logs.filter((log) => visibleToUser(log, req.user)));
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
};

const create = async (req, res) => {
  let transaction;
  try {
    assertOperationMutationAccess(req.user);
    const {
      hoursQty,
      bonusAmount,
      date,
      batchId,
      employeeId
    } = req.body;
    const type = String(req.body.type || '').toUpperCase();
    const hourType = req.body.hourType
      ? String(req.body.hourType).toUpperCase()
      : null;

    const employee = await Employee.findByPk(employeeId);
    if (!employee) return res.status(404).json({ error: 'Empleado no encontrado.' });
    assertSolicitanteDepartmentAccess(employee, req.user);
    const resolvedCompanyId = getEmployeePrincipalCompanyId(employee);

    let batch = null;
    if (batchId) {
      batch = await OperationBatch.findByPk(batchId);
      if (!batch) return res.status(404).json({ error: 'Lote no encontrado.' });
      if (batch.purpose !== 'BONOS_2DA' && batch.status !== 'DRAFT') {
        return res.status(400).json({ error: 'Solo se pueden agregar registros a un lote borrador.' });
      }
      if (batch.purpose === 'BONOS_2DA') {
        assertBonusBatchCompanyMatches(batch, resolvedCompanyId);
      } else {
        const owner = await User.findByPk(batch.userId);
        assertBatchAccess(req.user, batch, owner);
      }
    }

    validateOperationPayload({ type, hoursQty, hourType, bonusAmount, date });
    await assertActivePayrollForLog(date, resolvedCompanyId);

    const status = getRole(req.user) === 'ADMIN'
      ? 'APPROVED_MANAGER'
      : 'PENDING_MANAGER';
    transaction = await sequelize.transaction();
    const newLog = await OperationLog.create({
      employeeId: employee.id,
      date,
      type,
      hoursQty: type === 'HORA_EXTRA' ? Number(hoursQty) : 0,
      hourType: type === 'HORA_EXTRA' ? hourType : null,
      bonusQty: type === 'BONO' ? Number(req.body.bonusQty) || 1 : 0,
      bonusAmount: type === 'BONO' ? Number(bonusAmount) : 0,
      taskDescription: String(req.body.taskDescription || '').trim(),
      companyId: resolvedCompanyId,
      batchId: batch?.id || null,
      requesterId: req.user.id,
      status
    }, { transaction });

    await recordOperationReview({
      operationLogId: newLog.id,
      actor: req.user,
      action: 'CREATED',
      toStatus: status,
      transaction
    });
    await syncOperationLogTransition({ current: newLog, transaction });
    if (batch?.purpose === 'BONOS_2DA') {
      await recalculateBatchStatus(batch.id, { transaction });
    }
    await transaction.commit();

    const populatedLog = await getPopulatedLog(newLog.id);
    let notificationWarning = null;
    if (batch?.purpose === 'BONOS_2DA' && req.user?.idDepartamento) {
      try {
        const managers = await User.findAll({
          where: { role: 'GERENTE', idDepartamento: req.user.idDepartamento }
        });
        await Promise.all(
          managers
            .filter((manager) => manager.email)
            .map((manager) => sendOperationLogEmail(
              manager.name,
              manager.email,
              req.user.name,
              1
            ))
        );
      } catch (emailError) {
        notificationWarning = 'El registro fue guardado, pero no se pudo notificar al gerente.';
        console.error('[operations] registro automatico guardado; fallo el correo:', emailError.message);
      }
    }

    res.status(201).json({
      ...(populatedLog?.toJSON ? populatedLog.toJSON() : populatedLog),
      ...(notificationWarning ? { notificationWarning } : {})
    });
  } catch (err) {
    if (transaction && !transaction.finished) await transaction.rollback();
    res.status(err.statusCode || 400).json({ error: err.message });
  }
};

const updateStatus = async (req, res) => {
  let transaction;
  try {
    const status = String(req.body.status || '').toUpperCase();
    const justification = String(req.body.justification || '').trim();
    if (getRole(req.user) === 'SOLICITANTE') {
      const error = new Error('Usa Guardar correccion y reenviar para una operacion devuelta.');
      error.statusCode = 400;
      throw error;
    }

    transaction = await sequelize.transaction();
    const log = await OperationLog.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!log) {
      await transaction.rollback();
      return res.status(404).json({ error: 'No encontrado' });
    }

    const employee = await Employee.findByPk(log.employeeId, {
      attributes: ['id', 'departmentId'],
      transaction
    });
    const operationForPolicy = { ...log.toJSON(), Employee: employee?.toJSON() };
    const batch = log.batchId
      ? await OperationBatch.findByPk(log.batchId, { transaction, lock: transaction.LOCK.UPDATE })
      : null;
    const owner = batch ? await User.findByPk(batch.userId, { transaction }) : null;
    const batchLogs = batch ? await OperationLog.findAll({
      where: { batchId: batch.id },
      include: [{ model: Employee, attributes: ['departmentId'] }],
      transaction,
      lock: transaction.LOCK.UPDATE
    }) : [operationForPolicy];

    assertOperationStatusTransition(
      req.user,
      batch,
      owner,
      operationForPolicy,
      status,
      batchLogs,
      justification
    );

    const previous = log.toJSON();
    const fromStatus = log.status;
    await log.update({
      status,
      periodAssigned: req.body.periodAssigned || log.periodAssigned,
      justification: status === 'RETURNED' ? justification : null
    }, { transaction });
    await syncOperationLogTransition({ previous, current: log, transaction });

    const role = getRole(req.user);
    const isPayrollReturn = (
      (role === 'NOMINA' || role === 'ADMIN')
      && fromStatus === 'APPROVED_MANAGER'
      && status === 'RETURNED'
    );
    const action = isPayrollReturn
      ? 'PAYROLL_RETURNED'
      : status === 'APPROVED_MANAGER'
        ? 'MANAGER_APPROVED'
        : 'MANAGER_RETURNED';
    await recordOperationReview({
      operationLogId: log.id,
      actor: req.user,
      action,
      fromStatus,
      toStatus: status,
      comment: justification,
      transaction
    });
    await recalculateBatchStatus(log.batchId, {
      transaction,
      latestComment: justification
    });
    await transaction.commit();

    const populatedLog = await getPopulatedLog(log.id);
    let notificationWarning = null;
    if (isPayrollReturn && populatedLog?.requester?.email) {
      try {
        const employeeName = [
          populatedLog.Employee?.primer_nombre,
          populatedLog.Employee?.segundo_nombre,
          populatedLog.Employee?.otro_nombre,
          populatedLog.Employee?.primer_apellido,
          populatedLog.Employee?.segundo_apellido
        ].filter(Boolean).join(' ');
        const concept = populatedLog.type === 'BONO'
          ? `Bono de Q${Number(populatedLog.bonusAmount || 0).toFixed(2)}`
          : `${populatedLog.hoursQty} horas ${String(populatedLog.hourType || '').toLowerCase()}`;
        await sendOperationReturnedToRequesterEmail(
          populatedLog.requester.email,
          populatedLog.requester.name,
          {
            employeeName,
            periodLabel: formatQuincenaLabel(populatedLog.date),
            concept,
            comment: justification,
            batchId: populatedLog.batchId,
            rejectedBy: req.user?.name || 'Nomina'
          }
        );
      } catch (emailError) {
        notificationWarning = 'El registro fue devuelto, pero no se pudo enviar el correo al solicitante.';
        console.error('[operations] rechazo guardado; fallo el correo al solicitante:', emailError.message);
      }
    }

    res.json({
      ...(populatedLog?.toJSON ? populatedLog.toJSON() : populatedLog),
      ...(notificationWarning ? { notificationWarning } : {})
    });
  } catch (err) {
    if (transaction && !transaction.finished) await transaction.rollback();
    res.status(err.statusCode || 400).json({ error: err.message });
  }
};

const correctAndResubmit = async (req, res) => {
  let transaction;
  try {
    assertOperationMutationAccess(req.user);
    transaction = await sequelize.transaction();
    const log = await OperationLog.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!log) {
      await transaction.rollback();
      return res.status(404).json({ error: 'No encontrado' });
    }
    const batch = log.batchId
      ? await OperationBatch.findByPk(log.batchId, { transaction, lock: transaction.LOCK.UPDATE })
      : null;
    assertOperationCorrectionAccess(req.user, log, batch);

    const type = String(req.body.type || log.type).toUpperCase();
    const hoursQty = req.body.hoursQty !== undefined ? req.body.hoursQty : log.hoursQty;
    const hourType = req.body.hourType !== undefined
      ? String(req.body.hourType || '').toUpperCase()
      : log.hourType;
    const bonusAmount = req.body.bonusAmount !== undefined
      ? req.body.bonusAmount
      : log.bonusAmount;
    const date = req.body.date !== undefined ? req.body.date : log.date;
    const targetEmployeeId = req.body.employeeId !== undefined
      ? req.body.employeeId
      : log.employeeId;
    const employee = await Employee.findByPk(targetEmployeeId, { transaction });
    if (!employee) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Empleado no encontrado.' });
    }
    assertSolicitanteDepartmentAccess(employee, req.user);
    const resolvedCompanyId = getEmployeePrincipalCompanyId(employee);
    validateOperationPayload({ type, hoursQty, hourType, bonusAmount, date });

    if (batch?.purpose === 'BONOS_2DA') {
      assertBonusBatchCompanyMatches(batch, resolvedCompanyId);
    }
    await assertActivePayrollForLog(date, resolvedCompanyId);

    const previous = log.toJSON();
    await log.update({
      employeeId: employee.id,
      companyId: resolvedCompanyId,
      date,
      type,
      hoursQty: type === 'HORA_EXTRA' ? Number(hoursQty) : 0,
      hourType: type === 'HORA_EXTRA' ? hourType : null,
      bonusQty: type === 'BONO' ? Number(req.body.bonusQty ?? log.bonusQty) || 1 : 0,
      bonusAmount: type === 'BONO' ? Number(bonusAmount) : 0,
      taskDescription: String(req.body.taskDescription ?? log.taskDescription).trim(),
      status: 'PENDING_MANAGER',
      justification: null
    }, { transaction });
    await syncOperationLogTransition({ previous, current: log, transaction });
    await recordOperationReview({
      operationLogId: log.id,
      actor: req.user,
      action: 'CORRECTED_RESUBMITTED',
      fromStatus: previous.status,
      toStatus: 'PENDING_MANAGER',
      comment: req.body.correctionComment,
      transaction
    });
    await recalculateBatchStatus(log.batchId, { transaction });
    await transaction.commit();

    const populatedLog = await getPopulatedLog(log.id);
    let notificationWarning = null;
    try {
      const requester = populatedLog?.requester;
      if (requester?.idDepartamento) {
        const managers = await User.findAll({
          where: { role: 'GERENTE', idDepartamento: requester.idDepartamento }
        });
        await Promise.all(
          managers
            .filter((manager) => manager.email)
            .map((manager) => sendOperationLogEmail(
              manager.name,
              manager.email,
              requester.name,
              1
            ))
        );
      }
    } catch (emailError) {
      notificationWarning = 'La correccion fue reenviada, pero no se pudo notificar al gerente.';
      console.error('[operations] correccion guardada; fallo el correo al gerente:', emailError.message);
    }

    res.json({
      ...(populatedLog?.toJSON ? populatedLog.toJSON() : populatedLog),
      ...(notificationWarning ? { notificationWarning } : {})
    });
  } catch (err) {
    if (transaction && !transaction.finished) await transaction.rollback();
    res.status(err.statusCode || 400).json({ error: err.message });
  }
};

const remove = async (req, res) => {
  let transaction;
  try {
    assertOperationMutationAccess(req.user);
    transaction = await sequelize.transaction();
    const log = await OperationLog.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!log) {
      await transaction.rollback();
      return res.status(404).json({ error: 'No encontrado' });
    }
    const batch = log.batchId
      ? await OperationBatch.findByPk(log.batchId, { transaction, lock: transaction.LOCK.UPDATE })
      : null;
    if (getRole(req.user) !== 'ADMIN') {
      if (!requesterOwnsLog(req.user, log, batch)) {
        throw Object.assign(new Error('Solo puedes eliminar tus propios registros.'), { statusCode: 403 });
      }
      if (batch?.status !== 'DRAFT' || log.status !== 'PENDING_MANAGER') {
        throw Object.assign(new Error('Solo se eliminan registros antes de enviar el lote.'), { statusCode: 400 });
      }
    }

    await syncOperationLogTransition({ previous: log, transaction });
    await OperationLogReview.destroy({ where: { operationLogId: log.id }, transaction });
    await log.destroy({ transaction });
    await recalculateBatchStatus(log.batchId, { transaction });
    await transaction.commit();
    res.json({ message: 'Eliminado' });
  } catch (err) {
    if (transaction && !transaction.finished) await transaction.rollback();
    res.status(err.statusCode || 400).json({ error: err.message });
  }
};

const notifyManager = async (req, res) => {
  try {
    const { count } = req.body;
    const userDept = req.user?.idDepartamento;
    if (!userDept) {
      return res.status(400).json({ error: 'El usuario no tiene un departamento asignado.' });
    }
    const managers = await User.findAll({
      where: { role: 'GERENTE', idDepartamento: userDept }
    });
    if (managers.length === 0) {
      return res.status(404).json({ error: 'No se encontro un gerente para este departamento.' });
    }
    await Promise.all(
      managers
        .filter((manager) => manager.email)
        .map((manager) => sendOperationLogEmail(
          manager.name,
          manager.email,
          req.user.name,
          count
        ))
    );
    res.json({ message: 'Notificacion enviada al gerente exitosamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAll,
  create,
  updateStatus,
  update: correctAndResubmit,
  correctAndResubmit,
  remove,
  notifyManager
};
