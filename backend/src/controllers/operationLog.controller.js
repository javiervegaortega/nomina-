const {
  OperationLog,
  OperationBatch,
  Employee,
  Company,
  User,
  sequelize
} = require('../models');
const { sendOperationLogEmail, sendOperationRejectToManagerEmail } = require('../services/email.service');
const {
  assertActivePayrollForLog,
  assertBonusDateInSecondQuincena
} = require('../services/operationPayroll.service');
const {
  syncOperationLogTransition
} = require('../services/payrollDraftInputs.service');

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
  let transaction;
  try {
    const { hoursQty, hourType, bonusAmount, date, companyId, batchId } = req.body;
    let type = req.body.type;
    let resolvedCompanyId = companyId;

    if (batchId) {
      const batch = await OperationBatch.findByPk(batchId);
      if (batch?.purpose === 'BONOS_2DA') {
        type = 'BONO';
        if (batch.companyId) resolvedCompanyId = batch.companyId;
      }
    }

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
      assertBonusDateInSecondQuincena(date);
    }

    await assertActivePayrollForLog(date, resolvedCompanyId);

    const isGlobalRole = ['admin', 'nomina', 'gerente general'].includes(req.user?.role?.toLowerCase());
    const status = isGlobalRole ? 'APPROVED_MANAGER' : 'PENDING_MANAGER';
    
    transaction = await sequelize.transaction();
    const newLog = await OperationLog.create({
      ...req.body,
      type,
      companyId: resolvedCompanyId,
      status: status
    }, { transaction });
    await syncOperationLogTransition({
      current: newLog,
      transaction
    });
    await transaction.commit();

    const populatedLog = await OperationLog.findByPk(newLog.id, {
      include: [
        { model: Employee, attributes: ['id', 'primer_nombre', 'segundo_nombre', 'otro_nombre', 'primer_apellido', 'segundo_apellido', 'empresa_principal'] },
        { model: Company, as: 'companyData', attributes: ['id', 'nombre_comercial'] }
      ]
    });
    res.status(201).json(populatedLog);
  } catch (err) {
    if (transaction && !transaction.finished) await transaction.rollback();
    res.status(err.statusCode || 400).json({ error: err.message });
  }
};

const updateStatus = async (req, res) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const log = await OperationLog.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!log) {
      await transaction.rollback();
      return res.status(404).json({ error: 'No encontrado' });
    }

    const previous = log.toJSON();
    const previousStatus = log.status;
    const { status, periodAssigned, justification, rejectionFromNomina } = req.body;
    
    await log.update({ 
      status, 
      periodAssigned: periodAssigned || log.periodAssigned,
      justification: justification !== undefined ? justification : log.justification 
    }, { transaction });
    await syncOperationLogTransition({
      previous,
      current: log,
      transaction
    });
    await transaction.commit();

    const populatedLog = await OperationLog.findByPk(log.id, {
      include: [{
        model: OperationBatch,
        as: 'batch',
        include: [{ model: User, as: 'user' }]
      }]
    });

    const isNominaReject = status === 'PENDING_MANAGER' &&
      (previousStatus === 'APPROVED_MANAGER' || rejectionFromNomina) &&
      isNominaRole(req.user?.role);

    if (isNominaReject && populatedLog?.batch?.user?.idDepartamento) {
      try {
        const gerentes = await User.findAll({
          where: { role: 'GERENTE', idDepartamento: populatedLog.batch.user.idDepartamento }
        });
        await Promise.all(
          gerentes
            .filter(g => g.email)
            .map(gerente => sendOperationRejectToManagerEmail(gerente.name, gerente.email, {
              solicitanteName: populatedLog.batch.user.name,
              count: 1,
              justification: populatedLog.justification,
              batchTitle: populatedLog.batch.title,
              rejectedBy: req.user?.name || 'Nómina'
            }))
        );
      } catch (emailError) {
        console.error('Error enviando correo de rechazo al gerente.', emailError.message);
      }
    }

    res.json(populatedLog || log);
  } catch (err) {
    if (transaction && !transaction.finished) await transaction.rollback();
    res.status(400).json({ error: err.message });
  }
};

const remove = async (req, res) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const log = await OperationLog.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!log) {
      await transaction.rollback();
      return res.status(404).json({ error: 'No encontrado' });
    }
    await syncOperationLogTransition({
      previous: log,
      transaction
    });
    await log.destroy({ transaction });
    await transaction.commit();
    res.json({ message: 'Eliminado' });
  } catch (err) {
    if (transaction && !transaction.finished) await transaction.rollback();
    res.status(400).json({ error: err.message });
  }
};

const update = async (req, res) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const log = await OperationLog.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!log) {
      await transaction.rollback();
      return res.status(404).json({ error: 'No encontrado' });
    }

    const type = req.body.type || log.type;
    const hoursQty = req.body.hoursQty !== undefined ? req.body.hoursQty : log.hoursQty;
    const hourType = req.body.hourType !== undefined ? req.body.hourType : log.hourType;
    const bonusAmount = req.body.bonusAmount !== undefined ? req.body.bonusAmount : log.bonusAmount;
    const date = req.body.date !== undefined ? req.body.date : log.date;
    const companyId = req.body.companyId !== undefined ? req.body.companyId : log.companyId;

    if (type === 'HORA_EXTRA') {
      if (!hourType || !['SIMPLE', 'DOBLE', 'NOCTURNA'].includes(hourType)) {
        await transaction.rollback();
        return res.status(400).json({ error: 'hourType es requerido (SIMPLE, DOBLE o NOCTURNA) para horas extra.' });
      }
      if (!hoursQty || Number(hoursQty) <= 0) {
        await transaction.rollback();
        return res.status(400).json({ error: 'hoursQty debe ser mayor a 0 para horas extra.' });
      }
    } else if (type === 'BONO') {
      if (!bonusAmount || Number(bonusAmount) <= 0) {
        await transaction.rollback();
        return res.status(400).json({ error: 'bonusAmount debe ser mayor a 0 para bonos.' });
      }
      assertBonusDateInSecondQuincena(date);
    }

    if (log.batchId) {
      const batch = await OperationBatch.findByPk(log.batchId, { transaction });
      if (batch?.purpose === 'BONOS_2DA' && type !== 'BONO') {
        await transaction.rollback();
        return res.status(400).json({
          error: 'Este lote es solo para bonos de 2ª quincena.'
        });
      }
    }

    await assertActivePayrollForLog(date, companyId);
    
    const isGlobalRole = ['admin', 'nomina', 'gerente general'].includes(req.user?.role?.toLowerCase());
    const newStatus = isGlobalRole ? 'APPROVED_MANAGER' : 'PENDING_MANAGER';

    const previous = log.toJSON();
    await log.update({
      ...req.body,
      status: newStatus,
      justification: null
    }, { transaction });
    await syncOperationLogTransition({
      previous,
      current: log,
      transaction
    });
    await transaction.commit();

    const populatedLog = await OperationLog.findByPk(log.id, {
      include: [
        { model: Employee, attributes: ['id', 'primer_nombre', 'segundo_nombre', 'otro_nombre', 'primer_apellido', 'segundo_apellido', 'empresa_principal'] },
        { model: Company, as: 'companyData', attributes: ['id', 'nombre_comercial'] }
      ]
    });

    res.json(populatedLog);
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
