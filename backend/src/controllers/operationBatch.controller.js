const { OperationBatch, OperationLog, Employee, Company, User } = require('../models');
const {
  sendOperationLogEmail,
  sendOperationRejectToManagerEmail,
  buildOperationEmailHtml,
  getOperationEmailSubject
} = require('../services/email.service');

const NOMINA_ROLES = ['ADMIN', 'NOMINA', 'AUDITOR'];

const isNominaRole = (role) => NOMINA_ROLES.includes(role?.toUpperCase());

const getGerentesForBatch = async (batch) => {
  if (!batch.user?.idDepartamento) return [];
  return User.findAll({
    where: { role: 'GERENTE', idDepartamento: batch.user.idDepartamento }
  });
};

const getAll = async (req, res) => {
  try {
    const whereClause = {};
    if (req.user?.role === 'SOLICITANTE') {
      whereClause.userId = req.user.id;
    }

    const employeeAttrs = ['id', 'primer_nombre', 'segundo_nombre', 'otro_nombre', 'primer_apellido', 'segundo_apellido', 'empresa_principal', 'dpi', 'puesto', 'estado'];
    const batches = await OperationBatch.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'role', 'idDepartamento'] },
        { 
          model: OperationLog, 
          as: 'logs',
          include: [
            { model: Employee, attributes: employeeAttrs },
            { model: Company, as: 'companyData', attributes: ['id', 'nombre_comercial', 'nit'] }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(batches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getById = async (req, res) => {
  try {
    const employeeAttrs = ['id', 'primer_nombre', 'segundo_nombre', 'otro_nombre', 'primer_apellido', 'segundo_apellido', 'empresa_principal', 'dpi', 'puesto', 'estado'];
    const batch = await OperationBatch.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'role', 'idDepartamento'] },
        { 
          model: OperationLog, 
          as: 'logs',
          include: [
            { model: Employee, attributes: employeeAttrs },
            { model: Company, as: 'companyData', attributes: ['id', 'nombre_comercial', 'nit'] }
          ]
        }
      ]
    });
    if (!batch) return res.status(404).json({ error: 'Lote no encontrado' });
    res.json(batch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const create = async (req, res) => {
  try {
    const { title } = req.body;
    const batch = await OperationBatch.create({
      title,
      userId: req.user.id,
      status: 'DRAFT'
    });
    res.status(201).json(batch);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status, justification, rejectionFromNomina } = req.body;
    const batch = await OperationBatch.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user' },
        { model: OperationLog, as: 'logs' }
      ]
    });
    if (!batch) return res.status(404).json({ error: 'Lote no encontrado' });

    const previousStatus = batch.status;

    batch.status = status;
    if (justification !== undefined) batch.justification = justification;
    await batch.save();

    const syncedStatus = status === 'DRAFT' ? 'PENDING_MANAGER' : status;
    await OperationLog.update(
      { status: syncedStatus, ...(justification !== undefined ? { justification } : {}) },
      { where: { batchId: batch.id } }
    );
    if (batch.logs) {
      batch.logs.forEach(log => {
        log.status = syncedStatus;
        if (justification !== undefined) log.justification = justification;
      });
    }

    const isNominaReject = status === 'PENDING_MANAGER' &&
      (previousStatus === 'APPROVED_MANAGER' || rejectionFromNomina) &&
      isNominaRole(req.user?.role);

    if (status === 'PENDING_MANAGER' && batch.user?.idDepartamento) {
      try {
        const gerentes = await getGerentesForBatch(batch);
        const count = batch.logs?.length || 0;

        if (isNominaReject) {
          await Promise.all(
            gerentes
              .filter(g => g.email)
              .map(gerente => sendOperationRejectToManagerEmail(gerente.name, gerente.email, {
                solicitanteName: batch.user.name,
                count,
                justification: batch.justification,
                batchTitle: batch.title,
                rejectedBy: req.user?.name || 'Nómina'
              }))
          );
        } else {
          await Promise.all(
            gerentes
              .filter(g => g.email)
              .map(gerente => sendOperationLogEmail(gerente.name, gerente.email, batch.user.name, count))
          );
        }
      } catch (emailError) {
        console.error('Error enviando correos a los gerentes. El flujo continuará.', emailError.message);
      }
    }

    res.json(batch);
  } catch (err) {
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
  try {
    const batch = await OperationBatch.findByPk(req.params.id);
    if (!batch) return res.status(404).json({ error: 'Lote no encontrado' });
    
    await OperationLog.destroy({ where: { batchId: batch.id } });
    await batch.destroy();
    res.status(204).send();
  } catch (err) {
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
