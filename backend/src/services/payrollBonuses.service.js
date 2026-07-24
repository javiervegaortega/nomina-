const { isDateInQuincena } = require('./payrollCalculator.service');

const parseAssignments = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

/**
 * Aplica los bonos de catálogo asignados al empleado cuya fecha corresponde a
 * la quincena. Mientras el borrador es editable, reemplaza los bonos vigentes
 * de esa quincena para que una eliminación/desasignación también se refleje.
 * En 2ª conserva únicamente el mapa explícito heredado de la 1ª.
 */
const applyScheduledBonusesToEmployees = (
  employees,
  bonusRows,
  draftDate,
  periodType
) => (Array.isArray(employees) ? employees : []).map((employee) => {
  const scheduled = {};
  const hasExplicitCarried = Object.prototype.hasOwnProperty.call(
    employee || {},
    'carriedAppliedBonuses'
  );
  const legacyExisting = parseAssignments(employee?.appliedBonuses);
  const knownBonusesById = new Map(
    (Array.isArray(bonusRows) ? bonusRows : []).map((rawBonus) => {
      const bonus = typeof rawBonus?.toJSON === 'function' ? rawBonus.toJSON() : rawBonus;
      return [String(bonus?.id), bonus];
    })
  );
  const legacyCarried = (
    periodType === '2da' && !hasExplicitCarried
  )
    ? Object.fromEntries(
        Object.entries(legacyExisting).filter(([id]) => {
          const known = knownBonusesById.get(String(id));
          // Si sigue en catálogo, solo se hereda cuando corresponde a 1ª.
          // Un ID ya eliminado se conserva por compatibilidad: pudo haberse
          // pagado y cerrado en 1ª antes de la migración.
          return !known || isDateInQuincena(known.date, draftDate, '1ra');
        })
      )
    : {};
  const carried = hasExplicitCarried
    ? parseAssignments(employee.carriedAppliedBonuses)
    : legacyCarried;

  (Array.isArray(bonusRows) ? bonusRows : []).forEach((rawBonus) => {
    const bonus = typeof rawBonus?.toJSON === 'function' ? rawBonus.toJSON() : rawBonus;
    if (!bonus || !isDateInQuincena(bonus.date, draftDate, periodType)) return;

    const assignments = parseAssignments(bonus.assignments);
    const rawAmount = assignments[String(employee.id)] ?? assignments[employee.id];
    if (rawAmount === undefined || rawAmount === null || rawAmount === '') return;

    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount === 0) return;
    scheduled[String(bonus.id)] = amount;
  });

  return {
    ...employee,
    appliedBonuses: {
      ...carried,
      ...scheduled
    },
    carriedAppliedBonuses: carried,
    scheduledBonusIds: Object.keys(scheduled)
  };
});

module.exports = {
  applyScheduledBonusesToEmployees,
  parseAssignments
};
