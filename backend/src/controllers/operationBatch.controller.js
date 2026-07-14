const { OperationBatch, OperationLog, Employee, Company, User } = require('../models');
const { sendOperationLogEmail } = require('../services/email.service');

const getAll = async (req, res) => {
  try {
    const whereClause = {};
    if (req.user?.role === 'SOLICITANTE') {
      whereClause.userId = req.user.id;
    }

    const batches = await OperationBatch.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'role', 'idDepartamento'] },
        { 
          model: OperationLog, 
          as: 'logs',
          include: [{ model: Employee }, { model: Company, as: 'companyData' }]
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
    const batch = await OperationBatch.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'role', 'idDepartamento'] },
        { 
          model: OperationLog, 
          as: 'logs',
          include: [{ model: Employee }, { model: Company, as: 'companyData' }]
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
    const { status, justification } = req.body;
    const batch = await OperationBatch.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user' },
        { model: OperationLog, as: 'logs' }
      ]
    });
    if (!batch) return res.status(404).json({ error: 'Lote no encontrado' });

    batch.status = status;
    if (justification) batch.justification = justification;
    await batch.save();

    // Update all child logs to match status, EXCEPT when DRAFT. Logs are usually PENDING_MANAGER natively, but we'll sync them.
    for (const log of batch.logs) {
      log.status = status === 'DRAFT' ? 'PENDING_MANAGER' : status;
      await log.save();
    }

    // Send email to manager if sent to review
    if (status === 'PENDING_MANAGER' && batch.user?.idDepartamento) {
      const gerentes = await User.findAll({ 
        where: { role: 'GERENTE', idDepartamento: batch.user.idDepartamento } 
      });
      for (const gerente of gerentes) {
        await sendOperationLogEmail(gerente.name, gerente.email, batch.user.name, batch.logs.length);
      }
    }

    res.json(batch);
  } catch (err) {
    res.status(400).json({ error: err.message });
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
  remove
};
