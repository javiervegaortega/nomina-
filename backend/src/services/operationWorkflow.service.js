const {
  OperationBatch,
  OperationLog,
  OperationLogReview
} = require('../models');

const deriveBatchStatus = (logs, fallback = 'DRAFT') => {
  const statuses = (Array.isArray(logs) ? logs : [])
    .map((log) => String(log?.status || '').toUpperCase())
    .filter(Boolean);

  if (statuses.length === 0) return fallback === 'DRAFT' ? 'DRAFT' : fallback;
  if (statuses.some((status) => ['RETURNED', 'REJECTED'].includes(status))) return 'RETURNED';
  if (statuses.some((status) => status === 'PENDING_MANAGER')) return 'PENDING_MANAGER';
  if (statuses.every((status) => ['APPROVED_MANAGER', 'PROCESSED_PAYROLL'].includes(status))) {
    return 'APPROVED_MANAGER';
  }
  return fallback || 'DRAFT';
};

const recalculateBatchStatus = async (batchId, { transaction, latestComment } = {}) => {
  if (!batchId) return null;
  const batch = await OperationBatch.findByPk(batchId, {
    transaction,
    lock: transaction?.LOCK?.UPDATE
  });
  if (!batch) return null;

  const logs = await OperationLog.findAll({
    where: { batchId },
    attributes: ['id', 'status', 'justification'],
    transaction,
    lock: transaction?.LOCK?.UPDATE
  });
  const nextStatus = deriveBatchStatus(logs, batch.status);
  const returned = logs.find((log) => ['RETURNED', 'REJECTED'].includes(log.status));

  await batch.update({
    status: nextStatus,
    justification: nextStatus === 'RETURNED'
      ? (latestComment || returned?.justification || batch.justification || null)
      : null
  }, { transaction });

  return batch;
};

const recordOperationReview = async ({
  operationLogId,
  actor,
  action,
  fromStatus = null,
  toStatus = null,
  comment = null,
  transaction
}) => OperationLogReview.create({
  operationLogId,
  actorId: actor?.id || null,
  actorRole: String(actor?.role || 'SYSTEM').toUpperCase(),
  action,
  fromStatus,
  toStatus,
  comment: String(comment || '').trim() || null
}, { transaction });

module.exports = {
  deriveBatchStatus,
  recalculateBatchStatus,
  recordOperationReview
};
