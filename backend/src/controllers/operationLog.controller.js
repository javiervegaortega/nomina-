const { OperationLog, Employee } = require('../models');

const getAll = async (req, res) => {
  try {
    const logs = await OperationLog.findAll({
      include: [{ model: Employee, attributes: ['id', 'primer_nombre', 'primer_apellido', 'empresa_principal'] }]
    });
    res.json(logs);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const create = async (req, res) => {
  try {
    const newLog = await OperationLog.create(req.body);
    res.status(201).json(newLog);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const log = await OperationLog.findByPk(req.params.id);
    if (!log) return res.status(404).json({ error: 'No encontrado' });
    
    await log.update({ status: req.body.status, periodAssigned: req.body.periodAssigned || log.periodAssigned });
    res.json(log);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const log = await OperationLog.findByPk(req.params.id);
    if (!log) return res.status(404).json({ error: 'No encontrado' });
    await log.destroy();
    res.json({ message: 'Eliminado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  getAll,
  create,
  updateStatus,
  remove
};
