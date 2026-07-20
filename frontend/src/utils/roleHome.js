/** Home path after login / denied route, by user role. */
export function getHomePathForRole(role) {
  if (role === 'SOLICITANTE' || role === 'GERENTE') return '/operations';
  return '/dashboard';
}
