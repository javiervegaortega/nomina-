const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const GLOBAL_OPERATION_REVIEW_ROLES = new Set(['ADMIN', 'GERENTE GENERAL', 'NOMINA']);

const getRole = (user) => String(user?.role || '').trim().toUpperCase();

const getEmployeePrincipalCompanyId = (employee) => {
  const rawCompanyId = employee?.empresa_principal
    ?? employee?.companyId
    ?? employee?.id_empresa;
  const companyId = Number(rawCompanyId);

  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw createHttpError('El empleado debe tener una empresa principal válida.');
  }

  return companyId;
};

const assertSolicitanteDepartmentAccess = (employee, user) => {
  if (String(user?.role || '').toUpperCase() !== 'SOLICITANTE') return;

  if (user?.idDepartamento === undefined || user?.idDepartamento === null || user.idDepartamento === '') {
    throw createHttpError('El usuario solicitante no tiene un departamento asignado.', 403);
  }

  if (String(employee?.departmentId) !== String(user.idDepartamento)) {
    throw createHttpError('No tienes permiso para registrar operaciones de empleados de otro departamento.', 403);
  }
};

const assertBonusBatchCompanyMatches = (batch, principalCompanyId) => {
  if (batch?.purpose !== 'BONOS_2DA') return;

  const batchCompanyId = Number(batch.companyId);
  if (!Number.isInteger(batchCompanyId) || batchCompanyId <= 0) {
    throw createHttpError('El lote de operaciones no tiene una empresa asignada.');
  }
  if (batchCompanyId !== Number(principalCompanyId)) {
    throw createHttpError('El empleado no pertenece a la empresa principal del lote de operaciones.');
  }
};

const belongsToAutomaticBatchDepartment = (user, batch, owner, logs = []) => {
  if (batch?.purpose !== 'BONOS_2DA' || owner?.idDepartamento || !user?.idDepartamento) {
    return false;
  }
  if (!Array.isArray(logs) || logs.length === 0) return false;
  return logs.every((log) => String(log?.Employee?.departmentId) === String(user.idDepartamento));
};

const assertBatchAccess = (user, batch, owner, logs = []) => {
  const role = getRole(user);
  if (GLOBAL_OPERATION_REVIEW_ROLES.has(role) || role === 'AUDITOR') return;

  if (role === 'SOLICITANTE') {
    if (Number(batch?.userId) !== Number(user?.id)
      && !belongsToAutomaticBatchDepartment(user, batch, owner, logs)) {
      throw createHttpError('No tienes acceso a este lote.', 403);
    }
    return;
  }

  if (role === 'GERENTE') {
    if (belongsToAutomaticBatchDepartment(user, batch, owner, logs)) return;
    if (!user?.idDepartamento || !owner?.idDepartamento) {
      throw createHttpError('El gerente y el solicitante deben tener un departamento asignado.', 403);
    }
    if (String(user.idDepartamento) !== String(owner.idDepartamento)) {
      throw createHttpError('No tienes acceso a operaciones de otro departamento.', 403);
    }
    return;
  }

  throw createHttpError('No tienes permiso para acceder a este lote.', 403);
};

const assertBatchStatusTransition = (user, batch, owner, nextStatus, logs = []) => {
  assertBatchAccess(user, batch, owner, logs);
  const role = getRole(user);
  if (GLOBAL_OPERATION_REVIEW_ROLES.has(role)) return;

  if (role === 'SOLICITANTE') {
    if (nextStatus !== 'PENDING_MANAGER' || !['DRAFT', 'RETURNED'].includes(batch?.status)) {
      throw createHttpError('El solicitante solo puede enviar sus lotes a gerencia.', 403);
    }
    return;
  }

  if (role === 'GERENTE') {
    if (!['APPROVED_MANAGER', 'RETURNED'].includes(nextStatus) || batch?.status !== 'PENDING_MANAGER') {
      throw createHttpError('El gerente solo puede aprobar o devolver lotes pendientes.', 403);
    }
    return;
  }

  throw createHttpError('No tienes permiso para cambiar el estado del lote.', 403);
};

const assertOperationStatusTransition = (user, batch, owner, operation, nextStatus, logs = []) => {
  assertBatchAccess(user, batch, owner, logs);
  const role = getRole(user);
  if (GLOBAL_OPERATION_REVIEW_ROLES.has(role)) return;

  if (role === 'SOLICITANTE') {
    if (nextStatus !== 'PENDING_MANAGER' || !['DRAFT', 'RETURNED'].includes(operation?.status)) {
      throw createHttpError('El solicitante solo puede reenviar sus operaciones devueltas.', 403);
    }
    return;
  }

  if (role === 'GERENTE') {
    if (!['APPROVED_MANAGER', 'RETURNED'].includes(nextStatus) || operation?.status !== 'PENDING_MANAGER') {
      throw createHttpError('El gerente solo puede aprobar o devolver operaciones pendientes.', 403);
    }
    return;
  }

  throw createHttpError('No tienes permiso para cambiar el estado de la operacion.', 403);
};

const assertOperationMutationAccess = (user) => {
  const role = getRole(user);
  if (GLOBAL_OPERATION_REVIEW_ROLES.has(role) || role === 'SOLICITANTE') return;
  throw createHttpError('No tienes permiso para registrar o modificar operaciones.', 403);
};

module.exports = {
  getEmployeePrincipalCompanyId,
  assertSolicitanteDepartmentAccess,
  assertBonusBatchCompanyMatches,
  assertBatchAccess,
  assertBatchStatusTransition,
  assertOperationStatusTransition,
  assertOperationMutationAccess
};
