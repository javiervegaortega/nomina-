const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const GLOBAL_READ_ROLES = new Set(['ADMIN', 'GERENTE GENERAL', 'NOMINA', 'AUDITOR']);
const MANAGER_ROLES = new Set(['ADMIN', 'GERENTE GENERAL', 'GERENTE']);

const getRole = (user) => String(user?.role || '').trim().toUpperCase();

const getEmployeePrincipalCompanyId = (employee) => {
  const rawCompanyId = employee?.empresa_principal
    ?? employee?.companyId
    ?? employee?.id_empresa;
  const companyId = Number(rawCompanyId);

  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw createHttpError('El empleado debe tener una empresa principal valida.');
  }

  return companyId;
};

const assertSolicitanteDepartmentAccess = (employee, user) => {
  if (getRole(user) !== 'SOLICITANTE') return;

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

const logBelongsToDepartment = (log, departmentId) => (
  departmentId !== undefined
  && departmentId !== null
  && departmentId !== ''
  && String(log?.Employee?.departmentId) === String(departmentId)
);

const requesterOwnsLog = (user, operation, batch) => (
  Number(operation?.requesterId) === Number(user?.id)
  || (
    operation?.requesterId == null
    && Number(batch?.userId) === Number(user?.id)
  )
);

const assertBatchAccess = (user, batch, owner, logs = []) => {
  const role = getRole(user);
  if (GLOBAL_READ_ROLES.has(role)) return;

  if (role === 'SOLICITANTE') {
    if (batch?.purpose === 'BONOS_2DA') return;
    const hasOwnLog = (logs || []).some((log) => requesterOwnsLog(user, log, batch));
    if (Number(batch?.userId) !== Number(user?.id) && !hasOwnLog) {
      throw createHttpError('No tienes acceso a este lote.', 403);
    }
    return;
  }

  if (role === 'GERENTE') {
    const hasDepartmentLog = (logs || []).some((log) => logBelongsToDepartment(log, user?.idDepartamento));
    const ownerMatches = user?.idDepartamento
      && owner?.idDepartamento
      && String(user.idDepartamento) === String(owner.idDepartamento);
    if (!hasDepartmentLog && !ownerMatches) {
      throw createHttpError('No tienes acceso a operaciones de otro departamento.', 403);
    }
    return;
  }

  throw createHttpError('No tienes permiso para acceder a este lote.', 403);
};

const assertManagerCanReviewOperation = (user, operation, logs = []) => {
  const role = getRole(user);
  if (role === 'ADMIN' || role === 'GERENTE GENERAL') return;
  if (role !== 'GERENTE') {
    throw createHttpError('Solo gerencia puede revisar operaciones pendientes.', 403);
  }

  const operationWithEmployee = operation?.Employee
    ? operation
    : (logs || []).find((log) => String(log?.id) === String(operation?.id));
  if (!logBelongsToDepartment(operationWithEmployee, user?.idDepartamento)) {
    throw createHttpError('No puedes revisar una operacion de otro departamento.', 403);
  }
};

const assertBatchStatusTransition = (user, batch, owner, nextStatus, logs = []) => {
  assertBatchAccess(user, batch, owner, logs);
  const role = getRole(user);

  if (role === 'SOLICITANTE') {
    if (nextStatus !== 'PENDING_MANAGER' || batch?.status !== 'DRAFT') {
      throw createHttpError('El solicitante solo puede enviar un lote borrador a gerencia.', 403);
    }
    return;
  }

  if (MANAGER_ROLES.has(role)) {
    if (!['APPROVED_MANAGER', 'RETURNED'].includes(nextStatus)
      || !['PENDING_MANAGER', 'RETURNED'].includes(batch?.status)) {
      throw createHttpError('Gerencia solo puede aprobar o devolver operaciones pendientes.', 403);
    }
    return;
  }

  if (role === 'NOMINA') {
    throw createHttpError('Nomina rechaza registros individuales aprobados; no cambia lotes completos.', 403);
  }

  throw createHttpError('No tienes permiso para cambiar el estado del lote.', 403);
};

const assertOperationStatusTransition = (
  user,
  batch,
  owner,
  operation,
  nextStatus,
  logs = [],
  comment = null
) => {
  assertBatchAccess(user, batch, owner, logs);
  const role = getRole(user);
  const currentStatus = String(operation?.status || '');
  const hasComment = Boolean(String(comment || '').trim());

  if (role === 'ADMIN') {
    const validManagerDecision = currentStatus === 'PENDING_MANAGER'
      && ['APPROVED_MANAGER', 'RETURNED'].includes(nextStatus);
    const validPayrollReturn = currentStatus === 'APPROVED_MANAGER'
      && nextStatus === 'RETURNED';
    if (!validManagerDecision && !validPayrollReturn) {
      throw createHttpError('La transicion solicitada no es valida para el registro.', 400);
    }
    if (nextStatus === 'RETURNED' && !hasComment) {
      throw createHttpError('La devolucion requiere un comentario.', 400);
    }
    return;
  }

  if (MANAGER_ROLES.has(role)) {
    assertManagerCanReviewOperation(user, operation, logs);
    if (currentStatus !== 'PENDING_MANAGER'
      || !['APPROVED_MANAGER', 'RETURNED'].includes(nextStatus)) {
      throw createHttpError('Gerencia solo puede aprobar o devolver operaciones pendientes.', 403);
    }
    if (nextStatus === 'RETURNED' && !hasComment) {
      throw createHttpError('La devolucion requiere un comentario.', 400);
    }
    return;
  }

  if (role === 'NOMINA') {
    if (currentStatus !== 'APPROVED_MANAGER' || nextStatus !== 'RETURNED') {
      throw createHttpError('Nomina solo puede devolver registros aprobados por gerencia.', 403);
    }
    if (!hasComment) {
      throw createHttpError('El rechazo de Nomina requiere un comentario.', 400);
    }
    return;
  }

  if (role === 'SOLICITANTE') {
    if (!requesterOwnsLog(user, operation, batch)) {
      throw createHttpError('Solo el solicitante original puede corregir este registro.', 403);
    }
    if (currentStatus !== 'RETURNED' || nextStatus !== 'PENDING_MANAGER') {
      throw createHttpError('El solicitante solo puede reenviar sus operaciones devueltas.', 403);
    }
    return;
  }

  throw createHttpError('No tienes permiso para cambiar el estado de la operacion.', 403);
};

const assertOperationMutationAccess = (user) => {
  const role = getRole(user);
  if (role === 'ADMIN' || role === 'SOLICITANTE') return;
  throw createHttpError('Solo Operaciones puede registrar o modificar solicitudes.', 403);
};

const assertOperationCorrectionAccess = (user, operation, batch) => {
  const role = getRole(user);
  if (role === 'ADMIN') return;
  if (role !== 'SOLICITANTE' || !requesterOwnsLog(user, operation, batch)) {
    throw createHttpError('Solo el solicitante original puede corregir este registro.', 403);
  }
  if (operation?.status !== 'RETURNED') {
    throw createHttpError('Solo se pueden corregir registros devueltos.', 400);
  }
};

module.exports = {
  getRole,
  getEmployeePrincipalCompanyId,
  assertSolicitanteDepartmentAccess,
  assertBonusBatchCompanyMatches,
  assertBatchAccess,
  assertBatchStatusTransition,
  assertOperationStatusTransition,
  assertOperationMutationAccess,
  assertOperationCorrectionAccess,
  requesterOwnsLog,
  logBelongsToDepartment
};
