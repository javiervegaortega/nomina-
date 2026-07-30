const Decimal = require('decimal.js');
const {
  Company,
  PayrollDraft,
  PayrollDraftEmployee
} = require('../models');
const { calculateEmployeePayroll } = require('./payrollCalculator.service');
const { draftMatchesCompany } = require('./operationPayroll.service');

const OPERATION_APPLIED_STATUS = 'APPROVED_MANAGER';
const COMMISSION_APPLIED_STATUS = 'aplicado';
const REVISION_BUMPED_DRAFTS = Symbol('payrollDraftInputRevisionBumps');

const toPlainObject = (value) => {
  if (!value) return null;
  if (typeof value.toJSON === 'function') return value.toJSON();
  return { ...value };
};

const parseEmployeeData = (raw) => {
  if (typeof raw !== 'string') return raw || {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('El snapshot del empleado en el borrador no contiene JSON válido.');
  }
};

const idEquals = (left, right) => String(left) === String(right);

const hasSameId = (rows, id) => (
  Array.isArray(rows) && rows.some((row) => idEquals(row?.id, id))
);

const removeById = (rows, id) => (
  (Array.isArray(rows) ? rows : []).filter((row) => !idEquals(row?.id, id))
);

const numberAsDecimal = (value) => {
  if (value === undefined || value === null || value === '') return new Decimal(0);
  try {
    const numeric = new Decimal(value);
    return numeric.isFinite() ? numeric : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
};

const adjustedExtra = (current, delta) => Decimal.max(
  0,
  numberAsDecimal(current).plus(delta)
).toNumber();

const operationAmounts = (operation, employee) => {
  if (operation?.payrollDraftDelta) {
    const stored = operation.payrollDraftDelta;
    const simpleValue = numberAsDecimal(stored.simpleValue);
    const doubleValue = numberAsDecimal(stored.doubleValue);
    const bonus = numberAsDecimal(stored.bonus);
    return {
      simpleQty: numberAsDecimal(stored.simpleQty),
      doubleQty: numberAsDecimal(stored.doubleQty),
      simpleValue,
      doubleValue,
      bonus,
      total: simpleValue.plus(doubleValue).plus(bonus)
    };
  }

  const salary = numberAsDecimal(employee?.sueldo_ordinario);
  const simpleHourlyRate = salary.dividedBy(30).dividedBy(8);
  const nocturnalHourlyRate = salary.dividedBy(30).dividedBy(6);
  const hours = numberAsDecimal(operation?.hoursQty);
  const hourType = String(operation?.hourType || '').trim().toUpperCase();

  let simpleQty = new Decimal(0);
  let doubleQty = new Decimal(0);
  let simpleValue = new Decimal(0);
  let doubleValue = new Decimal(0);
  let bonus = new Decimal(0);

  if (operation?.type === 'HORA_EXTRA') {
    if (hourType === 'SIMPLE') {
      simpleQty = hours;
      simpleValue = hours.times(simpleHourlyRate).times('1.5');
    } else if (hourType === 'NOCTURNA') {
      doubleQty = hours;
      doubleValue = hours.times(nocturnalHourlyRate).times('1.5');
    }
  } else if (operation?.type === 'BONO') {
    bonus = numberAsDecimal(operation?.bonusAmount);
  }

  return {
    simpleQty,
    doubleQty,
    simpleValue,
    doubleValue,
    bonus,
    total: simpleValue.plus(doubleValue).plus(bonus)
  };
};

const commissionAmounts = (commission, employee) => {
  if (commission?.payrollDraftDelta) {
    const stored = commission.payrollDraftDelta;
    return {
      simpleQty: numberAsDecimal(stored.simpleQty),
      doubleQty: numberAsDecimal(stored.doubleQty),
      simpleValue: numberAsDecimal(stored.simpleValue),
      doubleValue: numberAsDecimal(stored.doubleValue),
      bonus: numberAsDecimal(stored.bonus)
    };
  }

  const salary = numberAsDecimal(employee?.sueldo_ordinario);
  const simpleHourlyRate = salary.dividedBy(30).dividedBy(8);
  const nocturnalHourlyRate = salary.dividedBy(30).dividedBy(6);
  const hours = numberAsDecimal(commission?.horas);
  const hourType = String(commission?.tipo_hora || '').trim().toUpperCase();
  const simpleQty = hourType === 'D' ? hours : new Decimal(0);
  const doubleQty = hourType === 'N' ? hours : new Decimal(0);

  return {
    simpleQty,
    doubleQty,
    simpleValue: simpleQty.times(simpleHourlyRate).times('1.5'),
    doubleValue: doubleQty.times(nocturnalHourlyRate).times('1.5'),
    bonus: numberAsDecimal(commission?.monto_bono)
  };
};

const applyAmounts = (employee, amounts, sign) => {
  const multiplier = new Decimal(sign);
  const extras = { ...(employee.extras || {}) };

  extras.simplesQty = adjustedExtra(extras.simplesQty, amounts.simpleQty.times(multiplier));
  extras.doblesQty = adjustedExtra(extras.doblesQty, amounts.doubleQty.times(multiplier));
  extras.simplesVal = adjustedExtra(extras.simplesVal, amounts.simpleValue.times(multiplier));
  extras.doblesVal = adjustedExtra(extras.doblesVal, amounts.doubleValue.times(multiplier));
  extras.bonos = adjustedExtra(extras.bonos, amounts.bonus.times(multiplier));

  return { ...employee, extras };
};

/**
 * Aplica o retira un registro operativo de un snapshot de empleado.
 * Al retirar se usa el detalle almacenado, no el payload del cliente, para que
 * un reintento o una edición nunca reste importes diferentes a los aplicados.
 */
const applyOperationLogDelta = (employee, operationValue, mode) => {
  const operation = toPlainObject(operationValue);
  if (!operation?.id) return { employee, changed: false };

  const stored = (Array.isArray(employee.operationLogs) ? employee.operationLogs : [])
    .find((row) => idEquals(row?.id, operation.id));

  if (mode === 'add' && stored) return { employee, changed: false };
  if (mode === 'remove' && !stored) return { employee, changed: false };

  const source = mode === 'remove' ? stored : operation;
  const amounts = operationAmounts(source, employee);
  let next = applyAmounts(employee, amounts, mode === 'add' ? 1 : -1);

  if (next.netTotal !== undefined) {
    next.netTotal = numberAsDecimal(next.netTotal)
      .plus(amounts.total.times(mode === 'add' ? 1 : -1))
      .toNumber();
  }

  next.operationLogs = mode === 'add'
    ? [
        ...(Array.isArray(employee.operationLogs) ? employee.operationLogs : []),
        {
          ...operation,
          status: OPERATION_APPLIED_STATUS,
          payrollDraftDelta: {
            simpleQty: amounts.simpleQty.toNumber(),
            doubleQty: amounts.doubleQty.toNumber(),
            simpleValue: amounts.simpleValue.toNumber(),
            doubleValue: amounts.doubleValue.toNumber(),
            bonus: amounts.bonus.toNumber()
          }
        }
      ]
    : removeById(employee.operationLogs, operation.id);

  return { employee: next, changed: true };
};

/**
 * Mantiene tanto commissionIds (compatibilidad) como commissionEntries
 * (trazabilidad exacta para poder revertir una edición o eliminación).
 */
const applyCommissionDelta = (employee, commissionValue, mode) => {
  const commission = toPlainObject(commissionValue);
  if (!commission?.id) return { employee, changed: false };

  const ids = Array.isArray(employee.commissionIds) ? employee.commissionIds : [];
  const entries = Array.isArray(employee.commissionEntries)
    ? employee.commissionEntries
    : [];
  const stored = entries.find((row) => idEquals(row?.id, commission.id));
  const legacyApplied = ids.some((id) => idEquals(id, commission.id));

  if (mode === 'add' && (stored || legacyApplied)) {
    // Borradores antiguos guardaban solo el ID. Completar el detalle no debe
    // volver a sumar los importes que ya estaban incluidos.
    if (!stored && legacyApplied) {
      const legacyAmounts = commissionAmounts(commission, employee);
      return {
        employee: {
          ...employee,
          commissionEntries: [
            ...entries,
            {
              ...commission,
              payrollDraftDelta: {
                simpleQty: legacyAmounts.simpleQty.toNumber(),
                doubleQty: legacyAmounts.doubleQty.toNumber(),
                simpleValue: legacyAmounts.simpleValue.toNumber(),
                doubleValue: legacyAmounts.doubleValue.toNumber(),
                bonus: legacyAmounts.bonus.toNumber()
              }
            }
          ]
        },
        changed: true
      };
    }
    return { employee, changed: false };
  }
  if (mode === 'remove' && !stored && !legacyApplied) {
    return { employee, changed: false };
  }

  const source = mode === 'remove' ? (stored || commission) : commission;
  const amounts = commissionAmounts(source, employee);
  const next = applyAmounts(employee, amounts, mode === 'add' ? 1 : -1);
  const storedCommission = {
    ...commission,
    payrollDraftDelta: {
      simpleQty: amounts.simpleQty.toNumber(),
      doubleQty: amounts.doubleQty.toNumber(),
      simpleValue: amounts.simpleValue.toNumber(),
      doubleValue: amounts.doubleValue.toNumber(),
      bonus: amounts.bonus.toNumber()
    }
  };

  return {
    employee: {
      ...next,
      commissionIds: mode === 'add'
        ? [...ids.filter((id) => !idEquals(id, commission.id)), commission.id]
        : ids.filter((id) => !idEquals(id, commission.id)),
      commissionEntries: mode === 'add'
        ? [...removeById(entries, commission.id), storedCommission]
        : removeById(entries, commission.id)
    },
    changed: true
  };
};

const getDateParts = (value) => {
  if (!value) return null;
  const textMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (textMatch) {
    return {
      year: Number(textMatch[1]),
      month: Number(textMatch[2]),
      day: Number(textMatch[3])
    };
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate()
  };
};

const isSameMonth = (left, right) => (
  !!left
  && !!right
  && left.year === right.year
  && left.month === right.month
);

/**
 * Replica el emparejamiento del frontend: quincena exacta primero. Si un
 * registro del día 1-15 se aprueba tarde y ya no existe borrador de 1ra,
 * se acumula en el borrador de 2da del mismo mes.
 */
const selectMatchingDrafts = (drafts, inputDate, companyId, companies = []) => {
  const inputParts = getDateParts(inputDate);
  if (!inputParts || !companyId) return [];

  const expectedPeriod = inputParts.day <= 15 ? '1ra' : '2da';
  const candidates = (Array.isArray(drafts) ? drafts : []).filter((draft) => {
    if (draft?.isApproved) return false;
    if (!draftMatchesCompany(draft?.companies, companyId, companies)) return false;
    return isSameMonth(inputParts, getDateParts(draft?.createdAt));
  });
  const exact = candidates.filter((draft) => String(draft.periodType || '1ra') === expectedPeriod);
  if (exact.length > 0) return exact;

  return expectedPeriod === '1ra'
    ? candidates.filter((draft) => String(draft.periodType) === '2da')
    : [];
};

// Los conceptos de Reporte Operativo se acumulan todo el mes y siempre se
// pagan en la segunda quincena; Comisiones conserva su regla anterior.
const selectMatchingSecondQuincenaDrafts = (drafts, inputDate, companyId, companies = []) => {
  const inputParts = getDateParts(inputDate);
  if (!inputParts || !companyId) return [];
  return (Array.isArray(drafts) ? drafts : []).filter((draft) => (
    !draft?.isApproved
    && String(draft.periodType) === '2da'
    && draftMatchesCompany(draft?.companies, companyId, companies)
    && isSameMonth(inputParts, getDateParts(draft?.createdAt))
  ));
};

const commissionIsApplied = (commission) => (
  String(commission?.estado || '').trim().toLowerCase() === COMMISSION_APPLIED_STATUS
);

const operationShouldApply = (operation) => (
  operation?.status === OPERATION_APPLIED_STATUS
);

const bumpDraftRevision = async (draft, transaction) => {
  const attributes = draft?.constructor?.rawAttributes || PayrollDraft.rawAttributes || {};
  if (!attributes.revision) return;
  draft.set('revision', (Number(draft.get('revision')) || 0) + 1);
  await draft.save({ transaction, fields: ['revision'] });
};

const loadLockedDraftContext = async (transaction) => {
  const drafts = await PayrollDraft.findAll({
    transaction,
    lock: transaction.LOCK.UPDATE,
    order: [['id', 'ASC']]
  });
  const companies = await Company.findAll({
    attributes: ['id', 'nombre_comercial', 'nit'],
    transaction
  });
  return {
    drafts: drafts.filter((draft) => !draft.isApproved),
    companies,
    changedDraftIds: new Set()
  };
};

const mutateEmployeeRows = async ({
  drafts,
  employeeId,
  transaction,
  mutate,
  onlyDraftIds = null,
  changedDraftIds
}) => {
  if (!employeeId) return 0;
  const allowedIds = onlyDraftIds
    ? new Set(onlyDraftIds.map((id) => String(id)))
    : null;
  const candidateDrafts = drafts.filter(
    (draft) => !allowedIds || allowedIds.has(String(draft.id))
  );
  if (candidateDrafts.length === 0) return 0;

  const rows = await PayrollDraftEmployee.findAll({
    where: {
      draftId: candidateDrafts.map((draft) => draft.id),
      employeeId
    },
    transaction,
    lock: transaction.LOCK.UPDATE,
    order: [['draftId', 'ASC'], ['id', 'ASC']]
  });
  const draftsById = new Map(
    candidateDrafts.map((draft) => [String(draft.id), draft])
  );
  let changedRows = 0;

  for (const row of rows) {
    const draft = draftsById.get(String(row.draftId));
    if (!draft || draft.isApproved) continue;
    const employee = parseEmployeeData(row.data);
    const result = mutate(employee);
    if (!result?.changed) continue;

    row.set('data', calculateEmployeePayroll(result.employee, draft.periodType));
    await row.save({ transaction, fields: ['data'] });
    if (changedDraftIds) changedDraftIds.add(String(draft.id));
    changedRows += 1;
  }
  return changedRows;
};

const removeOperationEverywhere = async (operation, context, transaction) => (
  mutateEmployeeRows({
    drafts: context.drafts,
    employeeId: operation?.employeeId,
    transaction,
    changedDraftIds: context.changedDraftIds,
    mutate: (employee) => applyOperationLogDelta(employee, operation, 'remove')
  })
);

const addOperationToMatchingDrafts = async (operation, context, transaction) => {
  if (!operationShouldApply(operation)) return 0;
  const matches = selectMatchingSecondQuincenaDrafts(
    context.drafts,
    operation.date,
    operation.companyId,
    context.companies
  );
  return mutateEmployeeRows({
    drafts: context.drafts,
    employeeId: operation.employeeId,
    transaction,
    onlyDraftIds: matches.map((draft) => draft.id),
    changedDraftIds: context.changedDraftIds,
    mutate: (employee) => applyOperationLogDelta(employee, operation, 'add')
  });
};

const removeCommissionEverywhere = async (commission, context, transaction) => (
  mutateEmployeeRows({
    drafts: context.drafts,
    employeeId: commission?.employee_id,
    transaction,
    changedDraftIds: context.changedDraftIds,
    mutate: (employee) => applyCommissionDelta(employee, commission, 'remove')
  })
);

const addCommissionToMatchingDrafts = async (commission, context, transaction) => {
  if (commissionIsApplied(commission)) return 0;
  const matches = selectMatchingDrafts(
    context.drafts,
    commission.fecha,
    commission.empresa_id,
    context.companies
  );
  return mutateEmployeeRows({
    drafts: context.drafts,
    employeeId: commission.employee_id,
    transaction,
    onlyDraftIds: matches.map((draft) => draft.id),
    changedDraftIds: context.changedDraftIds,
    mutate: (employee) => applyCommissionDelta(employee, commission, 'add')
  });
};

const bumpChangedDraftRevisions = async (context, transaction) => {
  if (!transaction[REVISION_BUMPED_DRAFTS]) {
    transaction[REVISION_BUMPED_DRAFTS] = new Set();
  }
  const alreadyBumped = transaction[REVISION_BUMPED_DRAFTS];
  const draftsById = new Map(
    context.drafts.map((draft) => [String(draft.id), draft])
  );

  for (const draftId of context.changedDraftIds) {
    if (alreadyBumped.has(draftId)) continue;
    const draft = draftsById.get(draftId);
    if (!draft) continue;
    await bumpDraftRevision(draft, transaction);
    alreadyBumped.add(draftId);
  }
};

/**
 * Sincroniza una transición de registro operativo dentro de una transacción
 * ya abierta por el controlador.
 */
const syncOperationLogTransition = async ({
  previous = null,
  current = null,
  transaction,
  context = null
}) => {
  if (!transaction) throw new Error('La sincronización de nómina requiere una transacción.');
  const ownsContext = !context;
  const sharedContext = context || await loadLockedDraftContext(transaction);
  let changes = 0;
  if (previous) {
    changes += await removeOperationEverywhere(
      toPlainObject(previous),
      sharedContext,
      transaction
    );
  }
  if (current) {
    changes += await addOperationToMatchingDrafts(
      toPlainObject(current),
      sharedContext,
      transaction
    );
  }
  if (ownsContext) {
    await bumpChangedDraftRevisions(sharedContext, transaction);
  }
  return changes;
};

const syncOperationLogTransitions = async ({
  transitions,
  transaction
}) => {
  if (!transaction) throw new Error('La sincronización de nómina requiere una transacción.');
  const context = await loadLockedDraftContext(transaction);
  let changes = 0;
  const ordered = [...(transitions || [])].sort((left, right) => (
    Number(left?.current?.id || left?.previous?.id || 0)
    - Number(right?.current?.id || right?.previous?.id || 0)
  ));
  for (const transition of ordered) {
    changes += await syncOperationLogTransition({
      ...transition,
      transaction,
      context
    });
  }
  await bumpChangedDraftRevisions(context, transaction);
  return changes;
};

const syncCommissionTransition = async ({
  previous = null,
  current = null,
  transaction
}) => {
  if (!transaction) throw new Error('La sincronización de nómina requiere una transacción.');
  const context = await loadLockedDraftContext(transaction);
  let changes = 0;
  if (previous) {
    changes += await removeCommissionEverywhere(
      toPlainObject(previous),
      context,
      transaction
    );
  }
  if (current) {
    changes += await addCommissionToMatchingDrafts(
      toPlainObject(current),
      context,
      transaction
    );
  }
  await bumpChangedDraftRevisions(context, transaction);
  return changes;
};

module.exports = {
  OPERATION_APPLIED_STATUS,
  applyCommissionDelta,
  applyOperationLogDelta,
  commissionIsApplied,
  getDateParts,
  operationShouldApply,
  selectMatchingDrafts,
  selectMatchingSecondQuincenaDrafts,
  syncCommissionTransition,
  syncOperationLogTransition,
  syncOperationLogTransitions
};
