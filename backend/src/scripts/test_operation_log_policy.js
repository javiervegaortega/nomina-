const {
  getEmployeePrincipalCompanyId,
  assertSolicitanteDepartmentAccess,
  assertBonusBatchCompanyMatches,
  assertBatchAccess,
  assertBatchStatusTransition,
  assertOperationStatusTransition,
  assertOperationMutationAccess
} = require('../services/operationLogPolicy.service');
const { operationShouldApply } = require('../services/payrollDraftInputs.service');
const { deriveBatchStatus } = require('../services/operationWorkflow.service');

const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`OK: ${message}`);
};

const assertThrows = (callback, expectedStatus, message) => {
  try {
    callback();
  } catch (error) {
    assert(error.statusCode === expectedStatus, message);
    return;
  }
  throw new Error(`FAIL: ${message}`);
};

const operationsEmployee = { id: 10, empresa_principal: 2, departmentId: 3 };
const otherDepartmentEmployee = { id: 11, empresa_principal: 1, departmentId: 1 };
const requesterOperations = { role: 'SOLICITANTE', idDepartamento: 3 };

assert(
  getEmployeePrincipalCompanyId(operationsEmployee) === 2,
  'la empresa del registro se deriva de la empresa principal del empleado'
);
assertThrows(
  () => getEmployeePrincipalCompanyId({ id: 12, departmentId: 3 }),
  400,
  'se rechaza un empleado sin empresa principal'
);

assertSolicitanteDepartmentAccess(operationsEmployee, requesterOperations);
console.log('OK: el solicitante de Operaciones puede registrar empleados del departamento 3');
assertThrows(
  () => assertSolicitanteDepartmentAccess(otherDepartmentEmployee, requesterOperations),
  403,
  'se bloquea al solicitante que intenta usar otro departamento'
);
assertSolicitanteDepartmentAccess(otherDepartmentEmployee, { role: 'NOMINA' });
console.log('OK: Nómina conserva acceso global');

assertBonusBatchCompanyMatches({ purpose: 'BONOS_2DA', companyId: 2 }, 2);
console.log('OK: el lote de bonos acepta empleados de su empresa principal');
assertThrows(
  () => assertBonusBatchCompanyMatches({ purpose: 'BONOS_2DA', companyId: 2 }, 1),
  400,
  'se bloquea un empleado de otra empresa en un lote de bonos'
);

const operationsBatch = { id: 20, userId: 7, status: 'PENDING_MANAGER' };
const operationsRequester = { id: 7, role: 'SOLICITANTE', idDepartamento: 3 };
const operationsManager = { id: 8, role: 'GERENTE', idDepartamento: 3 };
const otherManager = { id: 9, role: 'GERENTE', idDepartamento: 4 };
const automaticOperationsBatch = { id: 21, purpose: 'BONOS_2DA', status: 'PENDING_MANAGER' };
const payrollOwner = { id: 2, role: 'NOMINA', idDepartamento: null };
const automaticOperationsLogs = [{ id: 31, Employee: { departmentId: 3 } }];

assertBatchAccess(operationsManager, operationsBatch, operationsRequester);
console.log('OK: el gerente de Operaciones puede consultar el lote de su departamento');
assertThrows(
  () => assertBatchAccess(otherManager, operationsBatch, operationsRequester),
  403,
  'se bloquea al gerente de otro departamento'
);
assertBatchStatusTransition(
  operationsManager,
  operationsBatch,
  operationsRequester,
  'APPROVED_MANAGER'
);
console.log('OK: el gerente correspondiente puede aprobar el lote pendiente');
assertBatchStatusTransition(
  operationsManager,
  automaticOperationsBatch,
  payrollOwner,
  'APPROVED_MANAGER',
  automaticOperationsLogs
);
console.log('OK: el gerente de Operaciones puede aprobar el lote automatico creado por Nomina');
assertOperationStatusTransition(
  operationsManager,
  { ...automaticOperationsBatch, status: 'DRAFT' },
  payrollOwner,
  { id: 31, status: 'PENDING_MANAGER' },
  'APPROVED_MANAGER',
  automaticOperationsLogs
);
console.log('OK: el gerente puede aprobar una operacion pendiente aunque el lote automatico siga en borrador');
assertThrows(
  () => assertBatchAccess(otherManager, automaticOperationsBatch, payrollOwner, automaticOperationsLogs),
  403,
  'se bloquea al gerente ajeno del lote automatico de Operaciones'
);
assertThrows(
  () => assertBatchStatusTransition(
    operationsRequester,
    operationsBatch,
    operationsRequester,
    'APPROVED_MANAGER'
  ),
  403,
  'se bloquea al solicitante que intenta aprobar su propio lote'
);
assertThrows(
  () => assertOperationMutationAccess(operationsManager),
  403,
  'se bloquea al gerente que intenta registrar o editar operaciones'
);
assertOperationStatusTransition(
  { id: 2, role: 'NOMINA' },
  operationsBatch,
  operationsRequester,
  { id: 32, status: 'APPROVED_MANAGER' },
  'RETURNED',
  automaticOperationsLogs,
  'Monto incorrecto'
);
console.log('OK: Nomina puede devolver un registro aprobado con comentario');
assertThrows(
  () => assertOperationStatusTransition(
    { id: 2, role: 'NOMINA' },
    operationsBatch,
    operationsRequester,
    { id: 32, status: 'PENDING_MANAGER' },
    'APPROVED_MANAGER',
    automaticOperationsLogs
  ),
  403,
  'Nomina no puede aprobar la etapa de gerencia'
);
assert(
  deriveBatchStatus([
    { status: 'APPROVED_MANAGER' },
    { status: 'RETURNED' }
  ]) === 'RETURNED',
  'un lote mixto queda devuelto mientras exista una correccion'
);
assert(
  deriveBatchStatus([
    { status: 'APPROVED_MANAGER' },
    { status: 'PENDING_MANAGER' }
  ]) === 'PENDING_MANAGER',
  'un lote corregido vuelve a pendiente de gerente'
);
assert(
  operationShouldApply({ type: 'HORA_EXTRA', status: 'APPROVED_MANAGER' }),
  'una hora extra aprobada se sincroniza con el borrador de nomina'
);
assert(
  operationShouldApply({ type: 'BONO', status: 'APPROVED_MANAGER' }),
  'un bono aprobado se sincroniza con el borrador de nomina'
);

console.log('Todas las pruebas de política de operaciones pasaron.');
