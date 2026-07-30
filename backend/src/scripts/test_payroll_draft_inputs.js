process.env.SKIP_DB_CONNECT_TEST = '1';

const assert = require('assert');
const {
  applyCommissionDelta,
  applyOperationLogDelta,
  commissionIsApplied,
  operationShouldApply,
  selectMatchingDrafts,
  syncCommissionTransition,
  syncOperationLogTransition
} = require('../services/payrollDraftInputs.service');
const { calculateEmployeePayroll } = require('../services/payrollCalculator.service');

const closeTo = (actual, expected, message) => {
  assert(
    Math.abs(Number(actual) - Number(expected)) < 1e-9,
    `${message}: esperado ${expected}, recibido ${actual}`
  );
};

const baseEmployee = () => ({
  id: 99,
  sueldo_ordinario: 4000,
  bon_incentivo: 250,
  bon_dec_37_2001: 0,
  days: 15,
  isr: 0,
  extras: {
    simplesQty: 0,
    doblesQty: 0,
    simplesVal: 0,
    doblesVal: 0,
    bonos: 0
  },
  deductions: {}
});

const testOperationDeltas = () => {
  const operation = {
    id: 501,
    employeeId: 99,
    companyId: 1,
    date: '2026-07-08',
    type: 'HORA_EXTRA',
    hourType: 'SIMPLE',
    hoursQty: 4,
    status: 'APPROVED_MANAGER'
  };

  const first = applyOperationLogDelta(baseEmployee(), operation, 'add');
  assert(first.changed, 'el primer alta operativo debe cambiar el snapshot');
  closeTo(first.employee.extras.simplesQty, 4, 'cantidad HE simple');
  closeTo(first.employee.extras.simplesVal, 100, 'valor HE simple');
  assert.strictEqual(first.employee.operationLogs.length, 1);

  const retry = applyOperationLogDelta(first.employee, operation, 'add');
  assert(!retry.changed, 'un reintento por el mismo ID debe ser idempotente');
  closeTo(retry.employee.extras.simplesVal, 100, 'reintento no duplica HE');

  const removedForUpdate = applyOperationLogDelta(first.employee, operation, 'remove');
  const updated = applyOperationLogDelta(removedForUpdate.employee, {
    ...operation,
    hourType: 'NOCTURNA',
    hoursQty: 2
  }, 'add');
  closeTo(updated.employee.extras.simplesVal, 0, 'editar quita el valor operativo anterior');
  closeTo(updated.employee.extras.doblesQty, 2, 'editar agrega la nueva cantidad');
  closeTo(updated.employee.extras.doblesVal, 66.66666666666667, 'editar agrega el nuevo valor');

  const removal = applyOperationLogDelta({
    ...first.employee,
    sueldo_ordinario: 8000
  }, {
    ...operation,
    hoursQty: 999
  }, 'remove');
  assert(removal.changed, 'la reversión debe encontrar el ID aplicado');
  closeTo(removal.employee.extras.simplesQty, 0, 'reversión usa horas almacenadas');
  closeTo(removal.employee.extras.simplesVal, 0, 'reversión usa valor almacenado');
  assert.strictEqual(removal.employee.operationLogs.length, 0);

  const bonus = applyOperationLogDelta(baseEmployee(), {
    ...operation,
    id: 502,
    type: 'BONO',
    bonusAmount: 75
  }, 'add');
  closeTo(bonus.employee.extras.bonos, 75, 'bono operativo');

  const calculated = calculateEmployeePayroll(bonus.employee, '1ra');
  closeTo(calculated.calculated.gross, 2200, 'el delta se recalcula con payrollCalculator');
};

const testCommissionDeltas = () => {
  const commission = {
    id: 601,
    employee_id: 99,
    empresa_id: 1,
    fecha: '2026-07-10',
    horas: 8,
    tipo_hora: 'D',
    monto_bono: 50,
    estado: 'Pendiente',
    tarea_realizada: 'Prueba'
  };

  const first = applyCommissionDelta(baseEmployee(), commission, 'add');
  assert(first.changed, 'la primera comisión debe cambiar el snapshot');
  closeTo(first.employee.extras.simplesQty, 8, 'horas D son simples');
  closeTo(first.employee.extras.simplesVal, 200, 'valor horas D');
  closeTo(first.employee.extras.bonos, 50, 'monto_bono se suma a bonos');
  assert.deepStrictEqual(first.employee.commissionIds, [601]);
  assert.strictEqual(first.employee.commissionEntries[0].tarea_realizada, 'Prueba');

  const retry = applyCommissionDelta(first.employee, commission, 'add');
  assert(!retry.changed, 'la comisión no se duplica por ID');
  closeTo(retry.employee.extras.simplesVal, 200, 'reintento no duplica comisión');

  const removedForUpdate = applyCommissionDelta(first.employee, commission, 'remove');
  const updated = applyCommissionDelta(removedForUpdate.employee, {
    ...commission,
    horas: 3,
    tipo_hora: 'N',
    monto_bono: 10
  }, 'add');
  closeTo(updated.employee.extras.simplesVal, 0, 'editar quita la comisión anterior');
  closeTo(updated.employee.extras.doblesVal, 100, 'editar agrega las nuevas horas N');
  closeTo(updated.employee.extras.bonos, 10, 'editar reemplaza monto_bono');

  const removed = applyCommissionDelta({
    ...first.employee,
    sueldo_ordinario: 8000
  }, {
    ...commission,
    horas: 999,
    monto_bono: 999
  }, 'remove');
  closeTo(removed.employee.extras.simplesVal, 0, 'reversión usa detalle trazable');
  closeTo(removed.employee.extras.bonos, 0, 'reversión exacta de bono');
  assert.deepStrictEqual(removed.employee.commissionIds, []);
  assert.deepStrictEqual(removed.employee.commissionEntries, []);

  const legacy = baseEmployee();
  legacy.extras.simplesQty = 8;
  legacy.extras.simplesVal = 200;
  legacy.extras.bonos = 50;
  legacy.commissionIds = [601];
  const enriched = applyCommissionDelta(legacy, commission, 'add');
  assert(enriched.changed, 'un snapshot legado debe completar la trazabilidad');
  closeTo(enriched.employee.extras.simplesVal, 200, 'completar detalle no suma otra vez');
  assert.strictEqual(enriched.employee.commissionEntries.length, 1);
};

const testDraftMatching = () => {
  const companies = [{ id: 1, nombre_comercial: 'PROQUIMA', nit: '123' }];
  const first = {
    id: 'first',
    createdAt: '2026-07-10T12:00:00.000Z',
    periodType: '1ra',
    companies: [1],
    isApproved: false
  };
  const second = {
    id: 'second',
    createdAt: '2026-07-20T12:00:00.000Z',
    periodType: '2da',
    companies: ['PROQUIMA'],
    isApproved: false
  };
  const audited = {
    ...first,
    id: 'audited',
    isApproved: true
  };

  assert.deepStrictEqual(
    selectMatchingDrafts([first, second, audited], '2026-07-08', 1, companies)
      .map((draft) => draft.id),
    ['first'],
    'la 1ra exacta tiene prioridad y Auditoría se omite'
  );
  assert.deepStrictEqual(
    selectMatchingDrafts([second, audited], '2026-07-08', 1, companies)
      .map((draft) => draft.id),
    ['second'],
    'una aprobación tardía de días 1-15 cae en la 2da si no existe 1ra editable'
  );
  assert.deepStrictEqual(
    selectMatchingDrafts([first, second], '2026-07-22', 1, companies)
      .map((draft) => draft.id),
    ['second'],
    'los días 16-fin se asignan a la 2da'
  );
  assert.deepStrictEqual(
    selectMatchingDrafts([first, second], '2026-08-08', 1, companies),
    [],
    'no se cruza de mes'
  );

  assert(operationShouldApply({ status: 'APPROVED_MANAGER' }));
  assert(!operationShouldApply({ status: 'PENDING_MANAGER' }));
  assert(commissionIsApplied({ estado: ' Aplicado ' }));
  assert(!commissionIsApplied({ estado: 'Pendiente' }));
};

const testDatabaseTransaction = async () => {
  const {
    Company,
    Employee,
    PayrollDraft,
    PayrollDraftEmployee,
    sequelize
  } = require('../models');
  let transaction;

  try {
    transaction = await sequelize.transaction();
    const employee = await Employee.findOne({ transaction });
    if (!employee?.empresa_principal) {
      console.log('SKIP integración BD: no hay empleado con empresa principal.');
      return;
    }
    const company = await Company.findByPk(employee.empresa_principal, { transaction });
    if (!company) {
      console.log('SKIP integración BD: la empresa principal del empleado no existe.');
      return;
    }

    const draftId = `test-input-sync-${Date.now()}-${process.pid}`;
    const employeeSnapshot = {
      ...employee.toJSON(),
      sueldo_ordinario: 4000,
      bon_incentivo: 250,
      bon_dec_37_2001: 0,
      days: 15,
      isr: 0,
      extras: {
        simplesQty: 0,
        doblesQty: 0,
        simplesVal: 0,
        doblesVal: 0,
        bonos: 0
      },
      deductions: {}
    };
    await PayrollDraft.create({
      id: draftId,
      title: 'Prueba transaccional de inputs',
      companies: [company.id],
      periodType: '1ra',
      employeesCount: 1,
      isApproved: false,
      revision: 0,
      createdAt: '2099-07-10T12:00:00.000Z'
    }, { transaction });
    await PayrollDraftEmployee.create({
      draftId,
      employeeId: employee.id,
      data: employeeSnapshot
    }, { transaction });

    const operation = {
      id: 2147483001,
      employeeId: employee.id,
      companyId: company.id,
      date: '2099-07-08',
      type: 'HORA_EXTRA',
      hourType: 'SIMPLE',
      hoursQty: 4,
      status: 'APPROVED_MANAGER'
    };
    await syncOperationLogTransition({ current: operation, transaction });

    let row = await PayrollDraftEmployee.findOne({
      where: { draftId, employeeId: employee.id },
      transaction
    });
    let data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    closeTo(data.extras.simplesVal, 100, 'integración BD aplica HE');
    assert.strictEqual(data.operationLogs.length, 1);
    let draft = await PayrollDraft.findByPk(draftId, { transaction });
    assert.strictEqual(Number(draft.revision), 1, 'la revisión sube al aplicar');

    await syncOperationLogTransition({ current: operation, transaction });
    draft = await PayrollDraft.findByPk(draftId, { transaction });
    assert.strictEqual(Number(draft.revision), 1, 'un reintento no sube la revisión');

    await syncOperationLogTransition({
      previous: operation,
      current: { ...operation, status: 'RETURNED' },
      transaction
    });
    row = await PayrollDraftEmployee.findOne({
      where: { draftId, employeeId: employee.id },
      transaction
    });
    data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    closeTo(data.extras.simplesVal, 0, 'rechazo de Nómina retira solo la HE devuelta');

    const returnedOperation = { ...operation, status: 'RETURNED' };
    const pendingCorrection = { ...operation, status: 'PENDING_MANAGER', hoursQty: 6 };
    const reapprovedCorrection = { ...pendingCorrection, status: 'APPROVED_MANAGER' };
    await syncOperationLogTransition({
      previous: returnedOperation,
      current: pendingCorrection,
      transaction
    });
    await syncOperationLogTransition({
      previous: pendingCorrection,
      current: reapprovedCorrection,
      transaction
    });
    await syncOperationLogTransition({
      previous: pendingCorrection,
      current: reapprovedCorrection,
      transaction
    });
    row = await PayrollDraftEmployee.findOne({
      where: { draftId, employeeId: employee.id },
      transaction
    });
    data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    closeTo(data.extras.simplesVal, 150, 'la corrección reaprobada aparece exactamente una vez');
    assert.strictEqual(data.operationLogs.length, 1, 'la reaprobación conserva un solo registro');
    await syncOperationLogTransition({
      previous: reapprovedCorrection,
      transaction
    });

    const commission = {
      id: 2147483002,
      employee_id: employee.id,
      empresa_id: company.id,
      fecha: '2099-07-08',
      horas: 8,
      tipo_hora: 'D',
      monto_bono: 50,
      estado: 'Pendiente'
    };
    await syncCommissionTransition({ current: commission, transaction });
    row = await PayrollDraftEmployee.findOne({
      where: { draftId, employeeId: employee.id },
      transaction
    });
    data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    closeTo(data.extras.simplesVal, 200, 'integración BD aplica comisión');
    assert.strictEqual(data.commissionEntries.length, 1);

    await syncCommissionTransition({ previous: commission, transaction });
    row = await PayrollDraftEmployee.findOne({
      where: { draftId, employeeId: employee.id },
      transaction
    });
    data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    closeTo(data.extras.simplesVal, 0, 'integración BD revierte comisión');
    assert.strictEqual(data.commissionEntries.length, 0);

    await syncCommissionTransition({
      current: { ...commission, id: 2147483003, estado: 'Aplicado' },
      transaction
    });
    row = await PayrollDraftEmployee.findOne({
      where: { draftId, employeeId: employee.id },
      transaction
    });
    data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    closeTo(data.extras.simplesVal, 0, 'una comisión Aplicado se excluye');
    assert.strictEqual(data.commissionEntries.length, 0);

    draft = await PayrollDraft.findByPk(draftId, { transaction });
    assert.strictEqual(
      Number(draft.revision),
      1,
      'una transacción incrementa revision una sola vez por borrador'
    );

    console.log('OK integración BD: locks, JSON, revisión y recálculo transaccional.');
  } finally {
    if (transaction && !transaction.finished) await transaction.rollback();
    await sequelize.close();
  }
};

const run = async () => {
  testOperationDeltas();
  testCommissionDeltas();
  testDraftMatching();
  console.log('OK payrollDraftInputs: deltas, trazabilidad, recálculo y selección de borradores.');

  if (process.argv.includes('--db')) {
    await testDatabaseTransaction();
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
