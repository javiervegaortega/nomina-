const assert = require('assert');
const { sequelize, PayrollDraft, Company } = require('../models');
const { ensureOperationBatchSchema } = require('../config/ensureOperationBatchSchema');
const operationLogController = require('../controllers/operationLog.controller');
const operationBatchController = require('../controllers/operationBatch.controller');
const { findMatchingActiveDraft } = require('../services/operationPayroll.service');

const assertListEndpointWorks = async (handler, label) => {
  let statusCode = 200;
  let payload;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    }
  };

  await handler({
    user: { id: 0, role: 'ADMIN', idDepartamento: null }
  }, response);

  assert.strictEqual(
    statusCode,
    200,
    `${label} debe responder 200: ${payload?.error || 'error desconocido'}`
  );
  assert(Array.isArray(payload), `${label} debe devolver un listado`);
};

const assertApprovedPayrollBlocksInputs = async () => {
  const originalDraftFindAll = PayrollDraft.findAll;
  const originalCompanyFindAll = Company.findAll;
  const approvedDraft = {
    id: 'approved-test',
    createdAt: '2026-07-20T12:00:00.000Z',
    periodType: '2da',
    companies: [1],
    isApproved: true
  };

  try {
    Company.findAll = async () => [{
      id: 1,
      nombre_comercial: 'EMPRESA PRUEBA',
      nit: '123'
    }];
    PayrollDraft.findAll = async () => [approvedDraft];

    const blocked = await findMatchingActiveDraft('2026-07-20', 1);
    assert.strictEqual(blocked.ok, false, 'una nómina aprobada no admite nuevos registros');
    assert(
      /aprobada por Auditoría/i.test(blocked.error),
      'el bloqueo debe explicar que Auditoría cerró la captura'
    );

    PayrollDraft.findAll = async () => [{ ...approvedDraft, id: 'editable-test', isApproved: false }];
    const editable = await findMatchingActiveDraft('2026-07-20', 1);
    assert.strictEqual(editable.ok, true, 'una nómina editable sí admite registros');
  } finally {
    PayrollDraft.findAll = originalDraftFindAll;
    Company.findAll = originalCompanyFindAll;
  }
};

const run = async () => {
  try {
    await sequelize.sync();
    await ensureOperationBatchSchema(sequelize);

    const [columns] = await sequelize.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'operation_logs'
         AND COLUMN_NAME IN ('hourType', 'requesterId')`
    );
    const byName = Object.fromEntries(columns.map((column) => [column.COLUMN_NAME, column]));
    assert(byName.requesterId, 'requesterId debe existir');
    assert(/simple/i.test(byName.hourType?.COLUMN_TYPE || ''), 'hourType conserva SIMPLE');
    assert(/nocturna/i.test(byName.hourType?.COLUMN_TYPE || ''), 'hourType conserva NOCTURNA');
    assert(!/doble/i.test(byName.hourType?.COLUMN_TYPE || ''), 'hourType retira DOBLE');

    const [reviewTables] = await sequelize.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name = 'operation_log_reviews'`
    );
    assert.strictEqual(reviewTables.length, 1, 'debe existir operation_log_reviews');

    const [legacyRows] = await sequelize.query(
      `SELECT COUNT(*) AS total
       FROM operation_logs
       WHERE hourType = 'DOBLE'`
    );
    assert.strictEqual(Number(legacyRows[0].total), 0, 'no deben quedar horas DOBLE');

    await assertListEndpointWorks(operationLogController.getAll, 'GET operation-logs');
    await assertListEndpointWorks(operationBatchController.getAll, 'GET operation-batches');
    await assertApprovedPayrollBlocksInputs();

    console.log('OK operaciones: schema, migracion, historial, listados y bloqueo post-Auditoría.');
  } finally {
    await sequelize.close();
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
