/**
 * Normaliza el valor de un multi-select (Chakra MenuOptionGroup puede devolver string | string[]).
 */
export function normalizeMultiFilter(value) {
  if (value == null || value === '') return [];
  return (Array.isArray(value) ? value : [value]).map(String).filter(Boolean);
}

/**
 * Resuelve el departamento del empleado por departmentId (canónico) o departamento_laboral (legacy).
 * Devuelve id y nombre alineados al catálogo de departamentos.
 */
export function resolveEmployeeDepartment(emp, departments = []) {
  if (!emp) return { id: '', name: 'Sin Departamento' };

  const rawId = emp.departmentId;
  const rawName = emp.departamento_laboral;
  const found = (departments || []).find(
    (d) => String(d.id) === String(rawId) || d.nombre_dimension === rawName
  );

  if (found) {
    return { id: String(found.id), name: found.nombre_dimension };
  }

  if (rawId != null && rawId !== '') {
    return { id: String(rawId), name: rawName || String(rawId) };
  }

  if (rawName) {
    return { id: '', name: rawName };
  }

  return { id: '', name: 'Sin Departamento' };
}

/**
 * ¿El empleado coincide con el filtro de departamento (por id o por nombre)?
 */
export function matchesDepartmentFilter(emp, filterDept, departments = []) {
  const selected = normalizeMultiFilter(filterDept);
  if (selected.length === 0) return true;

  const { id, name } = resolveEmployeeDepartment(emp, departments);
  return (id && selected.includes(id)) || (name && selected.includes(name));
}
