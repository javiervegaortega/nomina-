const {
  OperationBatch,
  OperationLog,
  OperationLogReview,
  Employee,
  Company,
  User,
  PayrollHistory,
  sequelize
} = require('../models');
const {
  sendOperationLogEmail,
  buildOperationEmailHtml,
  getOperationEmailSubject
} = require('../services/email.service');
const {
  syncOperationLogTransitions
} = require('../services/payrollDraftInputs.service');
const {
  getRole,
  assertBatchAccess,
  assertBatchStatusTransition,
  assertOperationMutationAccess,
  requesterOwnsLog,
  logBelongsToDepartment
} = require('../services/operationLogPolicy.service');
const {
  recalculateBatchStatus,
  recordOperationReview
} = require('../services/operationWorkflow.service');
const { getEffectiveMonthlyCaptureState } = require('../services/operationBonusBatch.service');
const { Op } = require('sequelize');
const { getPagination, toPagedResponse, wantsPagination } = require('../utils/pagination');

const batchInclude = [
  { model: User, as: 'user', attributes: ['id', 'name', 'email', 'role', 'idDepartamento'] },
  {
    model: OperationLog,
    as: 'logs',
    include: [
      {
        model: Employee,
        attributes: [
          'id', 'primer_nombre', 'segundo_nombre', 'otro_nombre',
          'primer_apellido', 'segundo_apellido', 'empresa_principal', 'departmentId',
          'areaId', 'divisionId', 'subdivisionId', 'nivel_5', 'dimension_5',
          'dpi', 'puesto', 'estado', 'sueldo_ordinario'
        ]
      },
      { model: Company, as: 'companyData', attributes: ['id', 'nombre_comercial', 'nit'] },
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
    ]
  },
  { model: Company, as: 'companyData', attributes: ['id', 'nombre_comercial', 'nit'] }
];

const operationReviewOrder = [
  ['createdAt', 'DESC'],
  [{ model: OperationLog, as: 'logs' }, { model: OperationLogReview, as: 'reviews' }, 'createdAt', 'ASC']
];

const filterLogsForUser = (logs, user, batch) => {
  const role = getRole(user);
  const source = Array.isArray(logs) ? logs : [];
  if (['ADMIN', 'GERENTE GENERAL', 'AUDITOR'].includes(role)) return source;
  if (role === 'NOMINA') {
    return source.filter((log) => (
      ['APPROVED_MANAGER', 'RETURNED', 'PROCESSED_PAYROLL'].includes(log.status)
    ));
  }
  if (role === 'GERENTE') {
    return source.filter((log) => logBelongsToDepartment(log, user?.idDepartamento));
  }
  if (role === 'SOLICITANTE') {
    return source.filter((log) => requesterOwnsLog(user, log, batch));
  }
  return [];
};

const serializeVisibleBatch = (batch, user) => {
  const plain = batch.toJSON ? batch.toJSON() : { ...batch };
  plain.logs = filterLogsForUser(plain.logs, user, plain);
  return plain;
};

const isVisibleBatch = (batch, user) => {
  const role = getRole(user);
  const visibleLogs = filterLogsForUser(batch.logs, user, batch);
  if (role === 'SOLICITANTE') {
    return batch.purpose === 'BONOS_2DA'
      || Number(batch.userId) === Number(user.id)
      || visibleLogs.length > 0;
  }
  if (role === 'GERENTE') return visibleLogs.length > 0 && batch.status !== 'DRAFT';
  if (role === 'NOMINA') return visibleLogs.length > 0;
  return ['ADMIN', 'GERENTE GENERAL', 'AUDITOR'].includes(role);
};

const getAll = async (req, res) => {
  try {
    const query = req.query || {};
    const summaryOnly = query.summary === '1' || query.summary === 'true';
    if (summaryOnly) {
      const role = getRole(req.user);
      const visibilityIncludes = [];
      const batchWhere = {
        [Op.or]: [
          { purpose: { [Op.ne]: 'BONOS_2DA' } },
          { captureState: null },
          { captureState: { [Op.ne]: 'CLOSED' } }
        ]
      };
      if (role === 'SOLICITANTE') {
        batchWhere[Op.and] = [{
          [Op.or]: [
            { userId: req.user.id },
            { purpose: 'BONOS_2DA' },
            { '$logs.requesterId$': req.user.id }
          ]
        }];
        visibilityIncludes.push({
          model: OperationLog,
          as: 'logs',
          attributes: [],
          required: false
        });
      } else if (role === 'GERENTE') {
        batchWhere.status = { [Op.ne]: 'DRAFT' };
        visibilityIncludes.push({
          model: OperationLog,
          as: 'logs',
          attributes: [],
          required: true,
          include: [{
            model: Employee,
            attributes: [],
            required: true,
            where: { departmentId: req.user.idDepartamento }
          }]
        });
      } else if (role === 'NOMINA') {
        visibilityIncludes.push({
          model: OperationLog,
          as: 'logs',
          attributes: [],
          required: true,
          where: {
            status: { [Op.in]: ['APPROVED_MANAGER', 'RETURNED', 'PROCESSED_PAYROLL'] }
          }
        });
      } else if (!['ADMIN', 'GERENTE GENERAL', 'AUDITOR'].includes(role)) {
        return res.json(wantsPagination(query)
          ? toPagedResponse([], 0, 1, getPagination(query).pageSize)
          : []);
      }

      const paged = wantsPagination(query);
      const pagination = paged ? getPagination(query) : null;
      const total = paged
        ? await OperationBatch.count({
            where: batchWhere,
            include: visibilityIncludes,
            distinct: true,
            col: 'id'
          })
        : null;
      const visibleIdRows = await OperationBatch.findAll({
        where: batchWhere,
        attributes: ['id', 'createdAt'],
        include: visibilityIncludes,
        order: [['createdAt', 'DESC']],
        group: ['OperationBatch.id', 'OperationBatch.createdAt'],
        subQuery: false,
        ...(pagination ? { limit: pagination.limit, offset: pagination.offset } : {}),
        raw: true
      });
      const visibleIds = [...new Set(visibleIdRows.map((row) => Number(row.id)))];
      const selectedIds = visibleIds;
      const batches = selectedIds.length
        ? await OperationBatch.findAll({
            where: { id: { [Op.in]: selectedIds } },
            include: [
              { model: User, as: 'user', attributes: ['id', 'name', 'role'] },
              { model: Company, as: 'companyData', attributes: ['id', 'nombre_comercial', 'nit'] }
            ]
          })
        : [];
      const logCounts = selectedIds.length
        ? await OperationLog.findAll({
            where: { batchId: { [Op.in]: selectedIds } },
            attributes: [
              'batchId',
              [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: ['batchId'],
            raw: true
          })
        : [];
      const countByBatch = new Map(
        logCounts.map((row) => [String(row.batchId), Number(row.count) || 0])
      );
      const byId = new Map(batches.map((batch) => [Number(batch.id), batch]));
      const rows = selectedIds
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((batch) => ({
          ...batch.toJSON(),
          logsCount: countByBatch.get(String(batch.id)) || 0
        }));
      return res.json(paged
        ? toPagedResponse(rows, total, pagination.page, pagination.pageSize)
        : rows);
    }

    const batches = await OperationBatch.findAll({
      include: batchInclude,
      order: operationReviewOrder
    });
    const activeBatches = batches.filter((batch) => {
      if (batch.purpose !== 'BONOS_2DA') return true;
      // El lote se conserva vacío o tras cerrar 1ª. Solo desaparece al cerrar
      // definitivamente la 2ª por Auditoría.
      return batch.captureState !== 'CLOSED';
    });

    res.json(
      activeBatches
        .filter((batch) => isVisibleBatch(batch, req.user))
        .map((batch) => serializeVisibleBatch(batch, req.user))
    );
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

const getById = async (req, res) => {
  try {
    const batch = await OperationBatch.findByPk(req.params.id, {
      include: batchInclude,
      order: [[{ model: OperationLog, as: 'logs' }, { model: OperationLogReview, as: 'reviews' }, 'createdAt', 'ASC']]
    });
    if (!batch) return res.status(404).json({ error: 'Lote no encontrado' });
    assertBatchAccess(req.user, batch, batch.user, batch.logs);
    const visible = serializeVisibleBatch(batch, req.user);
    if (!isVisibleBatch(batch, req.user) && visible.logs.length === 0) {
      return res.status(403).json({ error: 'No tienes acceso a este lote.' });
    }
    if (visible.purpose === 'BONOS_2DA') {
      const effectiveCapture = await getEffectiveMonthlyCaptureState({ batch });
      visible.captureState = effectiveCapture.captureState;
      visible.captureBlockedByPayroll = effectiveCapture.auditedPayroll
        ? {
            id: effectiveCapture.auditedPayroll.id,
            title: effectiveCapture.auditedPayroll.title,
            periodType: effectiveCapture.auditedPayroll.periodType,
            status: effectiveCapture.auditedPayroll.status
          }
        : null;
    }
    res.json(visible);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

const create = async (req, res) => {
  try {
    assertOperationMutationAccess(req.user);
    const { title, companyId, purpose } = req.body;
    if (!String(title || '').trim()) {
      return res.status(400).json({ error: 'El titulo del lote es requerido.' });
    }
    const batch = await OperationBatch.create({
      title: String(title).trim(),
      userId: req.user.id,
      status: 'DRAFT',
      purpose: purpose === 'BONOS_2DA' ? 'BONOS_2DA' : 'GENERAL',
      companyId: companyId || null
    });
    res.status(201).json(batch);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
};

const targetLogsForActor = (logs, user, batch) => {
  const role = getRole(user);
  if (role === 'SOLICITANTE') {
    return logs.filter((log) => requesterOwnsLog(user, log, batch));
  }
  if (role === 'GERENTE') {
    return logs.filter((log) => logBelongsToDepartment(log, user?.idDepartamento));
  }
  return logs;
};

const notifyManagersForLogs = async (logs, fallbackOwner) => {
  const departmentIds = new Set(
    logs
      .map((log) => log.requester?.idDepartamento)
      .filter(Boolean)
  );
  if (departmentIds.size === 0 && fallbackOwner?.idDepartamento) {
    departmentIds.add(fallbackOwner.idDepartamento);
  }
  if (departmentIds.size === 0) return;

  const managers = await User.findAll({
    where: {
      role: 'GERENTE',
      idDepartamento: { [Op.in]: [...departmentIds] }
    }
  });
  await Promise.all(
    managers
      .filter((manager) => manager.email)
      .map((manager) => {
        const count = logs.filter((log) => (
          String(log.requester?.idDepartamento || fallbackOwner?.idDepartamento)
          === String(manager.idDepartamento)
        )).length;
        const requesterName = logs.find((log) => (
          String(log.requester?.idDepartamento) === String(manager.idDepartamento)
        ))?.requester?.name || fallbackOwner?.name || 'Operaciones';
        return sendOperationLogEmail(manager.name, manager.email, requesterName, count || logs.length);
      })
  );
};

const updateStatus = async (req, res) => {
  let transaction;
  try {
    const status = String(req.body.status || '').toUpperCase();
    const justification = String(req.body.justification || '').trim();
    if (status === 'RETURNED' && !justification) {
      return res.status(400).json({ error: 'La devolucion requiere un comentario.' });
    }

    transaction = await sequelize.transaction();
    const batch = await OperationBatch.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!batch) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Lote no encontrado' });
    }
    const logs = await OperationLog.findAll({
      where: { batchId: batch.id },
      include: [
        { model: Employee, attributes: ['departmentId'] },
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'name', 'email', 'idDepartamento']
        }
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
      order: [['id', 'ASC']]
    });
    const owner = await User.findByPk(batch.userId, { transaction });
    assertBatchStatusTransition(req.user, batch, owner, status, logs);

    const actorLogs = targetLogsForActor(logs, req.user, batch);
    const targetLogs = status === 'PENDING_MANAGER'
      ? actorLogs
      : actorLogs.filter((log) => log.status === 'PENDING_MANAGER');
    if (targetLogs.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'No hay registros elegibles para esta accion.' });
    }

    const transitions = [];
    for (const log of targetLogs) {
      const previous = log.toJSON();
      if (status !== 'PENDING_MANAGER') {
        await log.update({
          status,
          justification: status === 'RETURNED' ? justification : null
        }, { transaction });
        transitions.push({ previous, current: log.toJSON() });
      }
      await recordOperationReview({
        operationLogId: log.id,
        actor: req.user,
        action: status === 'PENDING_MANAGER'
          ? 'SUBMITTED_MANAGER'
          : status === 'APPROVED_MANAGER'
            ? 'MANAGER_APPROVED'
            : 'MANAGER_RETURNED',
        fromStatus: previous.status,
        toStatus: status,
        comment: justification,
        transaction
      });
    }

    if (transitions.length > 0) {
      await syncOperationLogTransitions({ transitions, transaction });
    }
    if (status === 'PENDING_MANAGER') {
      await batch.update({ status: 'PENDING_MANAGER', justification: null }, { transaction });
    } else {
      await recalculateBatchStatus(batch.id, {
        transaction,
        latestComment: justification
      });
    }
    await transaction.commit();

    let notificationWarning = null;
    if (status === 'PENDING_MANAGER') {
      try {
        await notifyManagersForLogs(targetLogs, owner);
      } catch (emailError) {
        notificationWarning = 'El lote fue enviado, pero no se pudo notificar al gerente.';
        console.error('[operations] lote enviado; fallo el correo a gerencia:', emailError.message);
      }
    }

    const populatedBatch = await OperationBatch.findByPk(batch.id, {
      include: batchInclude,
      order: [[{ model: OperationLog, as: 'logs' }, { model: OperationLogReview, as: 'reviews' }, 'createdAt', 'ASC']]
    });
    res.json({
      ...serializeVisibleBatch(populatedBatch, req.user),
      ...(notificationWarning ? { notificationWarning } : {})
    });
  } catch (err) {
    if (transaction && !transaction.finished) await transaction.rollback();
    res.status(err.statusCode || 400).json({ error: err.message });
  }
};

const getEmailPreview = async (req, res) => {
  try {
    const batch = await OperationBatch.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user' },
        { model: OperationLog, as: 'logs' }
      ]
    });
    if (!batch) return res.status(404).json({ error: 'Lote no encontrado' });
    assertBatchAccess(req.user, batch, batch.user, batch.logs);

    const details = {
      gerenteName: 'Gerente de Area',
      solicitanteName: batch.user?.name || 'Solicitante',
      count: filterLogsForUser(batch.logs, req.user, batch).length,
      batchTitle: batch.title
    };
    res.json({
      subject: getOperationEmailSubject(details),
      html: buildOperationEmailHtml(details)
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

const notifyBatch = async (req, res) => {
  try {
    const batch = await OperationBatch.findByPk(req.params.id, {
      include: batchInclude
    });
    if (!batch) return res.status(404).json({ error: 'Lote no encontrado' });
    assertBatchAccess(req.user, batch, batch.user, batch.logs);
    if (batch.status !== 'PENDING_MANAGER') {
      return res.status(400).json({ error: 'Solo se reenvia un lote pendiente de gerente.' });
    }
    const visibleLogs = filterLogsForUser(batch.logs, req.user, batch);
    await notifyManagersForLogs(visibleLogs, batch.user);
    res.json({ message: 'Notificacion reenviada exitosamente.' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

const remove = async (req, res) => {
  let transaction;
  try {
    assertOperationMutationAccess(req.user);
    transaction = await sequelize.transaction();
    const batch = await OperationBatch.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!batch) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Lote no encontrado' });
    }
    const owner = await User.findByPk(batch.userId, { transaction });
    assertBatchAccess(req.user, batch, owner);
    if (getRole(req.user) !== 'ADMIN' && batch.status !== 'DRAFT') {
      throw Object.assign(new Error('Solo se eliminan lotes antes de enviarlos.'), { statusCode: 400 });
    }
    const logs = await OperationLog.findAll({
      where: { batchId: batch.id },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    await syncOperationLogTransitions({
      transitions: logs.map((log) => ({ previous: log.toJSON() })),
      transaction
    });
    await OperationLogReview.destroy({
      where: { operationLogId: logs.map((log) => log.id) },
      transaction
    });
    await OperationLog.destroy({ where: { batchId: batch.id }, transaction });
    await batch.destroy({ transaction });
    await transaction.commit();
    res.status(204).send();
  } catch (err) {
    if (transaction && !transaction.finished) await transaction.rollback();
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

module.exports = {
  getAll,
  getById,
  create,
  updateStatus,
  getEmailPreview,
  notifyBatch,
  remove
};
