const { OperationLog, Employee, Company } = require('../models');

const getAll = async (req, res) => {
  try {
    const logs = await OperationLog.findAll({
      include: [
        { model: Employee, attributes: ['id', 'primer_nombre', 'segundo_nombre', 'otro_nombre', 'primer_apellido', 'segundo_apellido', 'empresa_principal'] },
        { model: Company, as: 'companyData', attributes: ['id', 'nombre_comercial'] }
      ]
    });
    res.json(logs);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const create = async (req, res) => {
  try {
    const newLog = await OperationLog.create(req.body);
    const populatedLog = await OperationLog.findByPk(newLog.id, {
      include: [
        { model: Employee, attributes: ['id', 'primer_nombre', 'segundo_nombre', 'otro_nombre', 'primer_apellido', 'segundo_apellido', 'empresa_principal'] },
        { model: Company, as: 'companyData', attributes: ['id', 'nombre_comercial'] }
      ]
    });
    res.status(201).json(populatedLog);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const log = await OperationLog.findByPk(req.params.id);
    if (!log) return res.status(404).json({ error: 'No encontrado' });
    
    await log.update({ 
      status: req.body.status, 
      periodAssigned: req.body.periodAssigned || log.periodAssigned,
      justification: req.body.justification !== undefined ? req.body.justification : log.justification 
    });
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

const update = async (req, res) => {
  try {
    const log = await OperationLog.findByPk(req.params.id);
    if (!log) return res.status(404).json({ error: 'No encontrado' });
    
    // allow the applicant to update values and clear justification, resetting to pending
    await log.update({
      ...req.body,
      status: 'PENDING_MANAGER',
      justification: null
    });
    
    const populatedLog = await OperationLog.findByPk(log.id, {
      include: [
        { model: Employee, attributes: ['id', 'primer_nombre', 'segundo_nombre', 'otro_nombre', 'primer_apellido', 'segundo_apellido', 'empresa_principal'] },
        { model: Company, as: 'companyData', attributes: ['id', 'nombre_comercial'] }
      ]
    });

    res.json(populatedLog);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  getAll,
  create,
  updateStatus,
  update,
  remove
};
