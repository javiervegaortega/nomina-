const { OperationLog, Employee, Company, User } = require('../models');
const { sendOperationLogEmail } = require('../services/email.service');

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
    const isGlobalRole = ['admin', 'nomina', 'gerente general'].includes(req.user?.role?.toLowerCase());
    const status = isGlobalRole ? 'APPROVED_MANAGER' : 'PENDING_MANAGER';
    
    const newLog = await OperationLog.create({
      ...req.body,
      status: status
    });
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
    
    const isGlobalRole = ['admin', 'nomina', 'gerente general'].includes(req.user?.role?.toLowerCase());
    const newStatus = isGlobalRole ? 'APPROVED_MANAGER' : 'PENDING_MANAGER';

    // allow the applicant to update values and clear justification, resetting to pending or approved
    await log.update({
      ...req.body,
      status: newStatus,
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

const notifyManager = async (req, res) => {
  try {
    const { count } = req.body;
    const userDept = req.user?.idDepartamento;
    
    if (!userDept) {
      return res.status(400).json({ error: 'El usuario no tiene un departamento asignado.' });
    }

    const gerentes = await User.findAll({ 
      where: { 
        role: 'GERENTE',
        idDepartamento: userDept
      } 
    });

    if (gerentes.length === 0) {
      return res.status(404).json({ error: 'No se encontró un gerente para este departamento.' });
    }

    for (const gerente of gerentes) {
      await sendOperationLogEmail(gerente.name, gerente.email, req.user.name, count);
    }

    res.json({ message: 'Notificación enviada al gerente exitosamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAll,
  create,
  updateStatus,
  update,
  remove,
  notifyManager
};
