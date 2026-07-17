/**
 * Pruebas API HTTP: bonos, email preview, operation logs.
 * Requiere servidor corriendo en PORT (default 3000).
 * Uso: node src/scripts/test_api_bonos.js
 */
require('dotenv').config();
const { User, OperationBatch, sequelize } = require('../models');
const { createAssert, getTokenForRole, api } = require('./lib/testHelpers');

const state = { passed: 0, failed: 0 };
const assert = createAssert(state);

async function main() {
  console.log('=== Tests API: Bonos y correos ===\n');

  let token;
  try {
    ({ token } = await getTokenForRole('admin'));
    assert(true, 'token JWT generado para pruebas');
  } catch (err) {
    console.error('FAIL: no se pudo obtener token:', err.message);
    process.exit(1);
  }

  const testId = `api-bonus-${Date.now()}`;

  console.log('\n1. API CRUD /api/bonuses');
  {
    const create = await api('/api/bonuses', {
      method: 'POST',
      body: JSON.stringify({
        id: testId,
        name: 'Bono API Test',
        type: 'fijo',
        date: '2026-07-08',
        assignments: { emp1: 100 }
      })
    }, token);
    assert(create.status === 201, `POST /api/bonuses → ${create.status}`);

    const list = await api('/api/bonuses', {}, token);
    assert(list.status === 200 && Array.isArray(list.body), 'GET /api/bonuses retorna array');
    assert(list.body.some((b) => b.id === testId), 'bono creado aparece en listado');

    const update = await api(`/api/bonuses/${testId}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Bono API Actualizado' })
    }, token);
    assert(update.status === 200 && update.body.name === 'Bono API Actualizado', 'PUT /api/bonuses actualiza');

    const del = await api(`/api/bonuses/${testId}`, { method: 'DELETE' }, token);
    assert(del.status === 200, 'DELETE /api/bonuses elimina');
  }

  console.log('\n2. Validación operation logs vía API');
  {
    const badHe = await api('/api/operation-logs', {
      method: 'POST',
      body: JSON.stringify({ type: 'HORA_EXTRA', hoursQty: 0, hourType: 'SIMPLE', employeeId: '1', date: '2026-07-10', taskDescription: 'x' })
    }, token);
    assert(badHe.status === 400, `POST HE inválida → 400 (got ${badHe.status})`);

    const badBono = await api('/api/operation-logs', {
      method: 'POST',
      body: JSON.stringify({ type: 'BONO', bonusAmount: 0, employeeId: '1', date: '2026-07-10', taskDescription: 'x' })
    }, token);
    assert(badBono.status === 400, `POST BONO inválido → 400 (got ${badBono.status})`);
  }

  console.log('\n3. Email preview de lote operativo');
  {
    const { OperationLog: LogModel } = require('../models');
    const user = await User.findOne();
    let batch = await OperationBatch.findOne({ order: [['createdAt', 'DESC']] });
    let tempBatchId = null;

    if (!batch && user) {
      batch = await OperationBatch.create({
        title: 'Lote Test E2E',
        userId: user.id,
        status: 'PENDING_MANAGER'
      });
      tempBatchId = batch.id;
      await LogModel.create({
        type: 'BONO',
        bonusAmount: 100,
        employeeId: 1,
        date: '2026-07-10',
        taskDescription: 'Bono test E2E',
        status: 'PENDING_MANAGER',
        batchId: batch.id
      });
    }

    if (batch) {
      const preview = await api(`/api/operation-batches/${batch.id}/email-preview`, {}, token);
      assert(preview.status === 200, `GET email-preview → ${preview.status}`);
      assert(preview.body?.html?.includes('Reporte Operativo') || preview.body?.html?.includes('Corrección'), 'preview HTML válido');
      assert(preview.body?.subject?.includes('Reporte Operativo'), 'preview subject válido');
    } else {
      console.log('  SKIP: no se pudo crear lote de prueba');
    }

    if (tempBatchId) {
      await LogModel.destroy({ where: { batchId: tempBatchId } });
      await OperationBatch.destroy({ where: { id: tempBatchId } });
    }
  }

  await sequelize.close();
  console.log(`\n=== Resultado: ${state.passed} passed, ${state.failed} failed ===`);
  process.exit(state.failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
