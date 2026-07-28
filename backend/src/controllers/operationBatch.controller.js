const {
  OperationBatch,
  OperationLog,
  Employee,
  Company,
  User,
  sequelize
} = require('../models');
const {
  sendOperationLogEmail,
  sendOperationRejectToManagerEmail,
  buildOperationEmailHtml,
  getOperationEmailSubject
} = require('../services/email.service');
const {
  syncOperationLogTransitions
} = require('../services/payrollDraftInputs.service');
const { Op } = require('sequelize');

const NOMINA_ROLES = ['ADMIN', 'NOMINA', 'AUDITOR'];

const isNominaRole = (role) => NOMINA_ROLES.includes(role?.toUpperCase());

const getGerentesForBatch = async (batch) => {
  if (!batch.user?.idDepartamento) return [];
  return User.findAll({
    where: { role: 'GERENTE', idDepartamento: batch.user.idDepartamento }
  });
};

const batchInclude = [
  { model: User, as: 'user', attributes: ['id', 'name', 'role', 'idDepartamento'] },
  {
    model: OperationLog,
    as: 'logs',
    include: [
      {
        model: Employee,
        attributes: [
          'id', 'primer_nombre', 'segundo_nombre', 'otro_nombre',
          'primer_apellido', 'segundo_apellido', 'empresa_principal', 'dpi', 'puesto', 'estado'
        ]
      },
      { model: Company, as: 'companyData', attributes: ['id', 'nombre_comercial', 'nit'] }
    ]
  },
  { model: Company, as: 'companyData', attributes: ['id', 'nombre_comercial', 'nit'] }
];

const getAll = async (req, res) => {
  try {
    const whereClause = {};
    if (req.user?.role === 'SOLICITANTE') {
      // Propios + lotes compartidos de bonos 2ª (auto-creados con la nómina)
      whereClause[Op.or] = [
        { userId: req.user.id },
        { purpose: 'BONOS_2DA' }
      ];
    }

    const batches = await OperationBatch.findAll({
      where: whereClause,
      include: batchInclude,
      order: [['createdAt', 'DESC']]
    });
    res.json(batches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getById = async (req, res) => {
  try {
    const batch = await OperationBatch.findByPk(req.params.id, {
      include: batchInclude
    });
    if (!batch) return res.status(404).json({ error: 'Lote no encontrado' });

    if (
      req.user?.role === 'SOLICITANTE'
      && Number(batch.userId) !== Number(req.user.id)
      && batch.purpose !== 'BONOS_2DA'
    ) {
      return res.status(403).json({ error: 'No tienes acceso a este lote.' });
    }

    res.json(batch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const create = async (req, res) => {
  try {
    const { title, companyId, purpose } = req.body;
    const batch = await OperationBatch.create({
      title,
      userId: req.user.id,
      status: 'DRAFT',
      purpose: purpose === 'BONOS_2DA' ? 'BONOS_2DA' : 'GENERAL',
      companyId: companyId || null
    });
    res.status(201).json(batch);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const updateStatus = async (req, res) => {
  let transaction;
  try {
    const { status, justification, rejectionFromNomina } = req.body;
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
      transaction,
      lock: transaction.LOCK.UPDATE,
      order: [['id', 'ASC']]
    });

    const previousStatus = batch.status;
    const logCount = logs.length;

    // No enviar a gerencia ni aprobar un lote vacío
    if (status === 'PENDING_MANAGER' && ['DRAFT', 'RETURNED'].includes(previousStatus) && logCount === 0) {
      await transaction.rollback();
      return res.status(400).json({
        error: 'No se puede enviar un lote vacío. Agrega al menos un registro (bono o horas extra).'
      });
    }
    if (status === 'APPROVED_MANAGER' && logCount === 0) {
      await transaction.rollback();
      return res.status(400).json({
        error: 'No se puede aprobar un lote sin registros.'
      });
    }

    batch.status = status;
    if (justification !== undefined) batch.justification = justification;
    await batch.save({ transaction });

    const syncedStatus = status === 'DRAFT' ? 'PENDING_MANAGER' : status;
    await OperationLog.update(
      { status: syncedStatus, ...(justification !== undefined ? { justification } : {}) },
      { where: { batchId: batch.id }, transaction }
    );
    const transitions = logs.map((log) => {
      const previous = log.toJSON();
      log.status = syncedStatus;
      if (justification !== undefined) log.justification = justification;
      return { previous, current: log.toJSON() };
    });
    await syncOperationLogTransitions({ transitions, transaction });
    await transaction.commit();

    const populatedBatch = await OperationBatch.findByPk(batch.id, {
      include: [
        { model: User, as: 'user' },
        { model: OperationLog, as: 'logs' }
      ]
    });

    const isNominaReject = status === 'PENDING_MANAGER' &&
      (previousStatus === 'APPROVED_MANAGER' || rejectionFromNomina) &&
      isNominaRole(req.user?.role);

    if (status === 'PENDING_MANAGER' && populatedBatch?.user?.idDepartamento) {
      try {
        const gerentes = await getGerentesForBatch(populatedBatch);
        const count = populatedBatch.logs?.length || 0;

        if (isNominaReject) {
          await Promise.all(
            gerentes
              .filter(g => g.email)
              .map(gerente => sendOperationRejectToManagerEmail(gerente.name, gerente.email, {
                solicitanteName: populatedBatch.user.name,
                count,
                justification: populatedBatch.justification,
                batchTitle: populatedBatch.title,
                rejectedBy: req.user?.name || 'Nómina'
              }))
          );
        } else {
          await Promise.all(
            gerentes
              .filter(g => g.email)
              .map(gerente => sendOperationLogEmail(gerente.name, gerente.email, populatedBatch.user.name, count))
          );
        }
      } catch (emailError) {
        console.error('Error enviando correos a los gerentes. El flujo continuará.', emailError.message);
      }
    }

    res.json(populatedBatch || batch);
  } catch (err) {
    if (transaction && !transaction.finished) await transaction.rollback();
    res.status(400).json({ error: err.message });
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

    const isRejection = batch.status === 'PENDING_MANAGER' && !!batch.justification;
    const details = {
      gerenteName: 'Gerente de Área',
      solicitanteName: batch.user?.name || 'Solicitante',
      count: batch.logs?.length || 0,
      justification: batch.justification,
      isRejection,
      batchTitle: batch.title,
      rejectedBy: req.user?.name || 'Nómina'
    };

    res.json({
      subject: getOperationEmailSubject(details),
      html: buildOperationEmailHtml(details)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const notifyBatch = async (req, res) => {
  try {
    const batch = await OperationBatch.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user' },
        { model: OperationLog, as: 'logs' }
      ]
    });
    if (!batch) return res.status(404).json({ error: 'Lote no encontrado' });

    if (batch.status !== 'PENDING_MANAGER') {
      return res.status(400).json({ error: 'Solo se puede reenviar cuando el lote está pendiente de gerente.' });
    }

    const gerentes = await getGerentesForBatch(batch);
    if (gerentes.length === 0) {
      return res.status(404).json({ error: 'No se encontró un gerente para este departamento.' });
    }

    const count = batch.logs?.length || 0;
    const isRejection = !!batch.justification;

    await Promise.all(
      gerentes
        .filter(g => g.email)
        .map(gerente => isRejection
          ? sendOperationRejectToManagerEmail(gerente.name, gerente.email, {
              solicitanteName: batch.user.name,
              count,
              justification: batch.justification,
              batchTitle: batch.title,
              rejectedBy: req.user?.name || 'Nómina'
            })
          : sendOperationLogEmail(gerente.name, gerente.email, batch.user.name, count)
        )
    );

    res.json({ message: 'Notificación reenviada exitosamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const remove = async (req, res) => {
  let transaction;
  try {
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
      transaction,
      lock: transaction.LOCK.UPDATE,
      order: [['id', 'ASC']]
    });
    await syncOperationLogTransitions({
      transitions: logs.map((log) => ({ previous: log.toJSON() })),
      transaction
    });
    await OperationLog.destroy({
      where: { batchId: batch.id },
      transaction
    });
    await batch.destroy({ transaction });
    await transaction.commit();
    res.status(204).send();
  } catch (err) {
    if (transaction && !transaction.finished) await transaction.rollback();
    res.status(500).json({ error: err.message });
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
