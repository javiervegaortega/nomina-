const { OperationLog, OperationBatch, Employee, Company, User } = require('../models');
const { sendOperationLogEmail, sendOperationRejectToManagerEmail } = require('../services/email.service');

const NOMINA_ROLES = ['ADMIN', 'NOMINA', 'AUDITOR'];

const isNominaRole = (role) => NOMINA_ROLES.includes(role?.toUpperCase());

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
    const { type, hoursQty, hourType, bonusAmount } = req.body;

    if (type === 'HORA_EXTRA') {
      if (!hourType || !['SIMPLE', 'DOBLE', 'NOCTURNA'].includes(hourType)) {
        return res.status(400).json({ error: 'hourType es requerido (SIMPLE, DOBLE o NOCTURNA) para horas extra.' });
      }
      if (!hoursQty || Number(hoursQty) <= 0) {
        return res.status(400).json({ error: 'hoursQty debe ser mayor a 0 para horas extra.' });
      }
    } else if (type === 'BONO') {
      if (!bonusAmount || Number(bonusAmount) <= 0) {
        return res.status(400).json({ error: 'bonusAmount debe ser mayor a 0 para bonos.' });
      }
    }

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
    const log = await OperationLog.findByPk(req.params.id, {
      include: [{
        model: OperationBatch,
        as: 'batch',
        include: [{ model: User, as: 'user' }]
      }]
    });
    if (!log) return res.status(404).json({ error: 'No encontrado' });

    const previousStatus = log.status;
    const { status, periodAssigned, justification, rejectionFromNomina } = req.body;
    
    await log.update({ 
      status, 
      periodAssigned: periodAssigned || log.periodAssigned,
      justification: justification !== undefined ? justification : log.justification 
    });

    const isNominaReject = status === 'PENDING_MANAGER' &&
      (previousStatus === 'APPROVED_MANAGER' || rejectionFromNomina) &&
      isNominaRole(req.user?.role);

    if (isNominaReject && log.batch?.user?.idDepartamento) {
      try {
        const gerentes = await User.findAll({
          where: { role: 'GERENTE', idDepartamento: log.batch.user.idDepartamento }
        });
        await Promise.all(
          gerentes
            .filter(g => g.email)
            .map(gerente => sendOperationRejectToManagerEmail(gerente.name, gerente.email, {
              solicitanteName: log.batch.user.name,
              count: 1,
              justification: log.justification,
              batchTitle: log.batch.title,
              rejectedBy: req.user?.name || 'Nómina'
            }))
        );
      } catch (emailError) {
        console.error('Error enviando correo de rechazo al gerente.', emailError.message);
      }
    }

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

    const type = req.body.type || log.type;
    const hoursQty = req.body.hoursQty !== undefined ? req.body.hoursQty : log.hoursQty;
    const hourType = req.body.hourType !== undefined ? req.body.hourType : log.hourType;
    const bonusAmount = req.body.bonusAmount !== undefined ? req.body.bonusAmount : log.bonusAmount;

    if (type === 'HORA_EXTRA') {
      if (!hourType || !['SIMPLE', 'DOBLE', 'NOCTURNA'].includes(hourType)) {
        return res.status(400).json({ error: 'hourType es requerido (SIMPLE, DOBLE o NOCTURNA) para horas extra.' });
      }
      if (!hoursQty || Number(hoursQty) <= 0) {
        return res.status(400).json({ error: 'hoursQty debe ser mayor a 0 para horas extra.' });
      }
    } else if (type === 'BONO') {
      if (!bonusAmount || Number(bonusAmount) <= 0) {
        return res.status(400).json({ error: 'bonusAmount debe ser mayor a 0 para bonos.' });
      }
    }
    
    const isGlobalRole = ['admin', 'nomina', 'gerente general'].includes(req.user?.role?.toLowerCase());
    const newStatus = isGlobalRole ? 'APPROVED_MANAGER' : 'PENDING_MANAGER';

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

    await Promise.all(
      gerentes
        .filter(g => g.email)
        .map(gerente => sendOperationLogEmail(gerente.name, gerente.email, req.user.name, count))
    );

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
