const READ_ROLES = new Set(['ADMIN', 'NOMINA', 'AUDITOR', 'GERENTE GENERAL']);
const WRITE_ROLES = new Set(['ADMIN', 'NOMINA', 'GERENTE GENERAL']);

const requireRole = (allowedRoles) => (req, res, next) => {
  const role = String(req.user?.role || '').trim().toUpperCase();
  if (!allowedRoles.has(role)) {
    return res.status(403).json({
      error: 'No tiene permisos para realizar esta acción de facturación.'
    });
  }
  return next();
};

const requireBillingRead = requireRole(READ_ROLES);
const requireBillingWrite = requireRole(WRITE_ROLES);

module.exports = {
  requireBillingRead,
  requireBillingWrite
};
