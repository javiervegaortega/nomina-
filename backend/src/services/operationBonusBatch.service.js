const { Op } = require('sequelize');
const { OperationBatch, OperationLog, Company } = require('../models');
const { getMonthBoundsFromDate } = require('./operationPayroll.service');

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const BLOCKING_BONO_STATUSES = ['PENDING_MANAGER', 'RETURNED'];
const MONTHLY_CAPTURE_STATES = ['OPEN', 'FROZEN', 'CLOSED'];

const getPeriodMonth = (date) => {
  const bounds = getMonthBoundsFromDate(date);
  if (!bounds) return null;
  return `${bounds.year}-${String(bounds.month).padStart(2, '0')}`;
};

const buildBonos2daTitle = (companyName, draftDate) => {
  const bounds = getMonthBoundsFromDate(draftDate);
  const monthName = bounds ? (MONTH_NAMES_ES[bounds.month - 1] || '') : '';
  const year = bounds?.year || '';
  return `Operaciones mensuales — ${companyName || 'Empresa'} — ${monthName} ${year} (pago en 2ª quincena)`;
};

/**
 * Crea o reutiliza el único lote mensual de Reporte Operativo.  Se vincula al
 * borrador vigente para trazabilidad, pero el ciclo pertenece al mes completo.
 */
const ensureBonos2daBatchForDraft = async ({ draftId, companyId, draftDate, userId, transaction }) => {
  if (!companyId || !draftDate) return null;
  const periodMonth = getPeriodMonth(draftDate);
  if (!periodMonth) return null;

  const existing = await OperationBatch.findOne({
    where: { purpose: 'BONOS_2DA', companyId, periodMonth },
    transaction,
    lock: transaction?.LOCK?.UPDATE
  });
  if (existing) {
    const changes = {};
    if (draftId && String(existing.payrollDraftId || '') !== String(draftId)) changes.payrollDraftId = String(draftId);
    if (!existing.userId && userId) changes.userId = userId;
    if (Object.keys(changes).length) await existing.update(changes, { transaction });
    return existing;
  }

  const company = await Company.findByPk(companyId, {
    attributes: ['id', 'nombre_comercial'], transaction
  });
  return OperationBatch.create({
    title: buildBonos2daTitle(company?.nombre_comercial, draftDate),
    userId: userId || null,
    status: 'DRAFT',
    purpose: 'BONOS_2DA',
    companyId,
    payrollDraftId: draftId ? String(draftId) : null,
    periodMonth,
    captureState: 'OPEN'
  }, { transaction });
};

const assertMonthlyOperationCaptureOpen = async ({ batch, companyId, date }) => {
  if (!batch || batch.purpose !== 'BONOS_2DA') return;
  const expectedMonth = getPeriodMonth(date);
  if (!expectedMonth || expectedMonth !== batch.periodMonth) {
    const err = new Error('La fecha debe pertenecer al mes de captura del lote.');
    err.statusCode = 400;
    throw err;
  }
  if (String(batch.companyId) !== String(companyId)) {
    const err = new Error('La empresa del registro no coincide con el lote mensual.');
    err.statusCode = 403;
    throw err;
  }
  if (batch.captureState !== 'OPEN') {
    const stateMessage = batch.captureState === 'FROZEN'
      ? 'La captura está congelada mientras la nómina está en Auditoría.'
      : 'La captura mensual ya fue cerrada por Auditoría.';
    const err = new Error(stateMessage);
    err.statusCode = 400;
    throw err;
  }
};

const setMonthlyOperationCaptureState = async ({ companyId, draftDate, captureState, payrollDraftId = undefined, transaction }) => {
  if (!MONTHLY_CAPTURE_STATES.includes(captureState)) throw new Error('Estado de captura mensual inválido.');
  const periodMonth = getPeriodMonth(draftDate);
  if (!companyId || !periodMonth) return null;
  const batch = await OperationBatch.findOne({
    where: { purpose: 'BONOS_2DA', companyId, periodMonth }, transaction,
    lock: transaction?.LOCK?.UPDATE
  });
  if (!batch) return null;
  const changes = { captureState };
  if (payrollDraftId !== undefined) changes.payrollDraftId = payrollDraftId == null ? null : String(payrollDraftId);
  await batch.update(changes, { transaction });
  return batch;
};

const clearBatchDraftLink = async (draftId, transaction) => {
  if (!draftId) return;
  await OperationBatch.update(
    { payrollDraftId: null },
    { where: { payrollDraftId: String(draftId) }, transaction }
  );
};

const findBlockingOperationLogs = async (companyId, draftDate, transaction) => {
  const bounds = getMonthBoundsFromDate(draftDate);
  if (!companyId || !bounds) return [];
  return OperationLog.findAll({
    where: {
      companyId,
      status: { [Op.in]: BLOCKING_BONO_STATUSES },
      date: { [Op.between]: [bounds.start, bounds.end] }
    },
    attributes: ['id', 'type', 'date', 'bonusAmount', 'hoursQty', 'hourType', 'status', 'employeeId', 'batchId', 'taskDescription'],
    transaction
  });
};

const assertNoBlockingOperationsForAudit = async (companyId, draftDate, transaction) => {
  const blocking = await findBlockingOperationLogs(companyId, draftDate, transaction);
  if (blocking.length === 0) return;
  const err = new Error(`Hay ${blocking.length} registro(s) de Operaciones pendientes o en corrección. Resuélvelos antes de enviar la nómina a Auditoría.`);
  err.status = 400;
  err.blockingOperations = blocking.length;
  throw err;
};

// Alias temporal para consumidores anteriores.
const findBlockingBonusLogs = findBlockingOperationLogs;
const assertNoBlockingBonusesForAudit = assertNoBlockingOperationsForAudit;

module.exports = {
  BLOCKING_BONO_STATUSES,
  MONTHLY_CAPTURE_STATES,
  getPeriodMonth,
  buildBonos2daTitle,
  ensureBonos2daBatchForDraft,
  assertMonthlyOperationCaptureOpen,
  setMonthlyOperationCaptureState,
  clearBatchDraftLink,
  findBlockingOperationLogs,
  assertNoBlockingOperationsForAudit,
  findBlockingBonusLogs,
  assertNoBlockingBonusesForAudit
};
