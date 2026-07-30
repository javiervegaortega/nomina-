/**
 * Pruebas de integración: API bonos, validación operation logs, flujo de datos.
 * Uso: node src/scripts/test_integration_bonos.js
 */
require('dotenv').config();
const { Bonus, OperationLog, sequelize } = require('../models');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  OK: ${message}`);
  } else {
    failed += 1;
    console.error(`  FAIL: ${message}`);
  }
}

async function testBonusCrud() {
  console.log('1. CRUD catálogo de bonos (modelo Bonus)');
  const testId = `test-bonus-${Date.now()}`;
  try {
    const created = await Bonus.create({
      id: testId,
      name: 'Bono Test Automatizado',
      type: 'fijo',
      date: '2026-07-10',
      assignments: { '1': 150 }
    });
    assert(created.id === testId, 'crear bono en BD');

    const found = await Bonus.findByPk(testId);
    assert(found && found.name === 'Bono Test Automatizado', 'leer bono de BD');
    assert(found.date === '2026-07-10', 'fecha persistida correctamente');
    const raw = found.assignments;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
    const hasAssignment = Object.values(parsed).some((v) => Number(v) === 150);
    assert(hasAssignment, 'assignments JSON persistido');

    await found.update({ name: 'Bono Actualizado' });
    const updated = await Bonus.findByPk(testId);
    assert(updated.name === 'Bono Actualizado', 'actualizar bono');

    await Bonus.destroy({ where: { id: testId } });
    const deleted = await Bonus.findByPk(testId);
    assert(!deleted, 'eliminar bono');
  } catch (err) {
    failed += 1;
    console.error(`  FAIL: CRUD bonos — ${err.message}`);
    await Bonus.destroy({ where: { id: testId } }).catch(() => {});
  }
}

function validateOperationLogPayload(body) {
  const { type, hoursQty, hourType, bonusAmount } = body;
  if (type === 'HORA_EXTRA') {
    if (!hourType || !['SIMPLE', 'NOCTURNA'].includes(hourType)) {
      return 'hourType es requerido (SIMPLE o NOCTURNA) para horas extra.';
    }
    if (!hoursQty || Number(hoursQty) <= 0) {
      return 'hoursQty debe ser mayor a 0 para horas extra.';
    }
  } else if (type === 'BONO') {
    if (!bonusAmount || Number(bonusAmount) <= 0) {
      return 'bonusAmount debe ser mayor a 0 para bonos.';
    }
  }
  return null;
}

function testOperationLogValidation() {
  console.log('\n2. Validación operation logs');
  assert(
    validateOperationLogPayload({ type: 'HORA_EXTRA', hoursQty: 0, hourType: 'SIMPLE' }) !== null,
    'rechaza HE con hoursQty 0'
  );
  assert(
    validateOperationLogPayload({ type: 'HORA_EXTRA', hoursQty: 4 }) !== null,
    'rechaza HE sin hourType'
  );
  assert(
    validateOperationLogPayload({ type: 'HORA_EXTRA', hoursQty: 4, hourType: 'DOBLE' }) !== null,
    'rechaza el tipo de hora DOBLE retirado'
  );
  assert(
    validateOperationLogPayload({ type: 'BONO', bonusAmount: 0 }) !== null,
    'rechaza BONO con monto 0'
  );
  assert(
    validateOperationLogPayload({ type: 'HORA_EXTRA', hoursQty: 4, hourType: 'SIMPLE' }) === null,
    'acepta HE válida'
  );
  assert(
    validateOperationLogPayload({ type: 'BONO', bonusAmount: 500 }) === null,
    'acepta BONO válido'
  );
}

async function testOperationLogsInDb() {
  console.log('\n3. Estado operation_logs en BD');
  try {
    const total = await OperationLog.count();
    const heCount = await OperationLog.count({ where: { type: 'HORA_EXTRA' } });
    const bonoCount = await OperationLog.count({ where: { type: 'BONO' } });
    const approved = await OperationLog.count({ where: { status: 'APPROVED_MANAGER' } });
    console.log(`  Info: ${total} logs total (${heCount} HE, ${bonoCount} bonos, ${approved} aprobados)`);
    assert(total >= 0, 'consulta operation_logs exitosa');
  } catch (err) {
    failed += 1;
    console.error(`  FAIL: ${err.message}`);
  }
}

async function main() {
  console.log('=== Tests de integración: Bonos y HE ===\n');
  await testBonusCrud();
  testOperationLogValidation();
  await testOperationLogsInDb();
  await sequelize.close();
  console.log(`\n=== Resultado: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
