const { Op } = require('sequelize');
const {
  OperationBatch,
  OperationLog,
  Company
} = require('../models');
const { getMonthBoundsFromDate } = require('./operationPayroll.service');

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const BLOCKING_BONO_STATUSES = ['PENDING_MANAGER', 'RETURNED'];

const buildBonos2daTitle = (companyName, draftDate) => {
  const bounds = getMonthBoundsFromDate(draftDate);
  const monthName = bounds ? (MONTH_NAMES_ES[bounds.month - 1] || '') : '';
  const year = bounds?.year || '';
  const name = companyName || 'Empresa';
  return `Bonos 2da – ${name} – ${monthName} ${year}`.trim();
};

/**
 * Crea o reutiliza el lote BONOS_2DA al abrir una nómina de 2ª quincena.
 */
const ensureBonos2daBatchForDraft = async ({
  draftId,
  companyId,
  draftDate,
  userId,
  transaction
}) => {
  if (!draftId || !companyId || !userId) return null;

  const linked = await OperationBatch.findOne({
    where: { purpose: 'BONOS_2DA', payrollDraftId: String(draftId) },
    transaction
  });
  if (linked) return linked;

  const company = await Company.findByPk(companyId, {
    attributes: ['id', 'nombre_comercial'],
    transaction
  });
  const title = buildBonos2daTitle(company?.nombre_comercial, draftDate);

  const byTitle = await OperationBatch.findOne({
    where: { purpose: 'BONOS_2DA', companyId, title },
    transaction
  });
  if (byTitle) {
    await byTitle.update({ payrollDraftId: String(draftId) }, { transaction });
    return byTitle;
  }

  return OperationBatch.create({
    title,
    userId,
    status: 'DRAFT',
    purpose: 'BONOS_2DA',
    companyId,
    payrollDraftId: String(draftId)
  }, { transaction });
};

const clearBatchDraftLink = async (draftId, transaction) => {
  if (!draftId) return;
  await OperationBatch.update(
    { payrollDraftId: null },
    { where: { payrollDraftId: String(draftId) }, transaction }
  );
};

/**
 * Bonos operativos que impiden enviar la nómina a auditoría.
 */
const findBlockingBonusLogs = async (companyId, draftDate, transaction) => {
  const bounds = getMonthBoundsFromDate(draftDate);
  if (!companyId || !bounds) return [];

  return OperationLog.findAll({
    where: {
      type: 'BONO',
      companyId,
      status: { [Op.in]: BLOCKING_BONO_STATUSES },
      date: { [Op.between]: [bounds.start, bounds.end] }
    },
    attributes: ['id', 'date', 'bonusAmount', 'status', 'employeeId', 'batchId', 'taskDescription'],
    transaction
  });
};

const assertNoBlockingBonusesForAudit = async (companyId, draftDate, transaction) => {
  const blocking = await findBlockingBonusLogs(companyId, draftDate, transaction);
  if (blocking.length === 0) return;
  const err = new Error(
    `Hay ${blocking.length} bono(s) pendientes de aprobación o sin enviar a gerencia. `
    + 'Resuélvelos antes de enviar la nómina a auditoría.'
  );
  err.status = 400;
  err.blockingBonuses = blocking.length;
  throw err;
};

module.exports = {
  BLOCKING_BONO_STATUSES,
  buildBonos2daTitle,
  ensureBonos2daBatchForDraft,
  clearBatchDraftLink,
  findBlockingBonusLogs,
  assertNoBlockingBonusesForAudit
};
