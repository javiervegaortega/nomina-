const Decimal = require('decimal.js');
const {
  sequelize, PayrollHistory, BillingRule, BillingRun, BillingRunLine, Company, Area
} = require('../models');
const {
  getCompanyCost,
  calculateEmployeePayroll,
  parseLocalPayrollDate,
  CUOTA_PATRONAL_RATE,
  IRTRA_INTECAP_RATE
} = require('./payrollCalculator.service');

/** Empresas pagadoras de nómina. Cleartec solo aparece como destino facturable. */
const PAYROLL_COMPANY_IDS = new Set([1, 2, 3]);
const BILLABLE_COMPANY_IDS = new Set([1, 2, 3, 4]);
const ALLOWED_BILLING_ROUTE_KEYS = new Set([
  '1->2', '1->3',
  '2->1', '2->3',
  '3->1', '3->2', '3->4'
]);
const SIN_CENTRO_COSTO = 'SIN CENTRO DE COSTO';
const BILLING_PRECISION = 12;
// En los Excel son buckets/centros operativos distintos, pero la entidad
// legal que recibe o emite la factura es Unhesa.
const LEGAL_BILLING_COMPANY_ALIASES = new Map([
  [5, 2], // Calidul -> Unhesa
  [6, 2]  // Hidroxon / Unhesa Líquido -> Unhesa
]);

const round4 = (n) => new Decimal(n || 0).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
const round2 = (n) => new Decimal(n || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
const roundBilling = (n) => new Decimal(n || 0)
  .toDecimalPlaces(BILLING_PRECISION, Decimal.ROUND_HALF_UP)
  .toNumber();

const billingRouteKey = (fromId, toId) => `${Number(fromId)}->${Number(toId)}`;
const isPayrollCompany = (id) => PAYROLL_COMPANY_IDS.has(Number(id));
const isBillableDestination = (id) => BILLABLE_COMPANY_IDS.has(Number(id));
const isAllowedBillingRoute = (fromId, toId) =>
  ALLOWED_BILLING_ROUTE_KEYS.has(billingRouteKey(fromId, toId));
const canonicalBillingCompanyId = (id) => (
  LEGAL_BILLING_COMPANY_ALIASES.get(Number(id)) || Number(id)
);

const parseJsonField = (value) => {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return null;
};

const parseDist = (dist) => {
  if (!dist) return {};
  if (typeof dist === 'string') {
    try {
      const parsed = JSON.parse(dist);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return typeof dist === 'object' && !Array.isArray(dist) ? dist : null;
};

const parseComponentDist = (componentDist) => {
  if (!componentDist) return {};
  const parsed = parseDist(componentDist);
  if (parsed === null) return null;
  return parsed;
};

const getPrincipalCompanyId = (employee) => {
  const raw = employee.empresa_principal
    || employee.companyId
    || employee.id_empresa
    || (employee.companyData && employee.companyData.id);
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
};

const getPayrollEmployees = (payroll) => {
  let employees = payroll?.data;
  if (typeof employees === 'string') {
    try { employees = JSON.parse(employees); } catch { employees = []; }
  }
  if (employees && !Array.isArray(employees) && Array.isArray(employees.employees)) {
    employees = employees.employees;
  }
  return Array.isArray(employees) ? employees : [];
};

const getPayrollLegalCompanyId = (payroll) => {
  const summary = parseJsonField(payroll?.summary) || {};
  const explicit = [
    ...(Array.isArray(summary.companyIds) ? summary.companyIds : []),
    ...(Array.isArray(summary.companies) ? summary.companies : [])
  ]
    .map(Number)
    .filter((id) => PAYROLL_COMPANY_IDS.has(id));
  const uniqueExplicit = [...new Set(explicit)];
  if (uniqueExplicit.length === 1) return uniqueExplicit[0];

  const employeeCompanies = [...new Set(
    getPayrollEmployees(payroll)
      .map(getPrincipalCompanyId)
      .filter((id) => PAYROLL_COMPANY_IDS.has(id))
  )];
  return employeeCompanies.length === 1 ? employeeCompanies[0] : null;
};

const getPayrollMonthKey = (payroll) => {
  const date = parseLocalPayrollDate(
    payroll?.createdAt || payroll?.closedAt || 0
  );
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const canonicalizeAllocations = (allocations) => {
  const merged = new Map();
  (Array.isArray(allocations) ? allocations : []).forEach((allocation) => {
    const toId = canonicalBillingCompanyId(allocation.toId);
    merged.set(
      toId,
      new Decimal(merged.get(toId) || 0).plus(allocation.pct || 0).toNumber()
    );
  });
  return [...merged.entries()].map(([toId, pct]) => ({ toId, pct }));
};

const netLegalCompanyMatrix = (grossMatrix) => {
  const netMatrix = {};
  const nettingPairs = [];
  const companyIds = new Set();
  Object.entries(grossMatrix || {}).forEach(([fromId, destinations]) => {
    companyIds.add(Number(fromId));
    Object.keys(destinations || {}).forEach((toId) => companyIds.add(Number(toId)));
  });
  const sorted = [...companyIds].sort((a, b) => a - b);

  sorted.forEach((leftId, index) => {
    sorted.slice(index + 1).forEach((rightId) => {
      const leftToRight = new Decimal(grossMatrix?.[leftId]?.[rightId] || 0);
      const rightToLeft = new Decimal(grossMatrix?.[rightId]?.[leftId] || 0);
      const difference = leftToRight.minus(rightToLeft)
        .toDecimalPlaces(BILLING_PRECISION, Decimal.ROUND_HALF_UP);
      if (difference.isZero()) {
        if (!leftToRight.isZero() || !rightToLeft.isZero()) {
          nettingPairs.push({
            leftCompanyId: leftId,
            rightCompanyId: rightId,
            leftToRight: roundBilling(leftToRight),
            rightToLeft: roundBilling(rightToLeft),
            netFromCompanyId: null,
            netToCompanyId: null,
            netAmount: 0
          });
        }
        return;
      }
      const fromId = difference.gt(0) ? leftId : rightId;
      const toId = difference.gt(0) ? rightId : leftId;
      const amount = difference.abs();
      ensureMatrixCell(netMatrix, fromId, toId);
      netMatrix[fromId][toId] = roundBilling(amount);
      nettingPairs.push({
        leftCompanyId: leftId,
        rightCompanyId: rightId,
        leftToRight: roundBilling(leftToRight),
        rightToLeft: roundBilling(rightToLeft),
        netFromCompanyId: fromId,
        netToCompanyId: toId,
        netAmount: roundBilling(amount)
      });
    });
  });

  return { netMatrix, nettingPairs };
};

const getEmployeeName = (e) => {
  if (!e) return 'Empleado';
  if (e.nombre) return e.nombre;
  if (e.name) return e.name;
  const parts = [
    e.primer_nombre,
    e.segundo_nombre,
    e.otro_nombre,
    e.primer_apellido,
    e.segundo_apellido,
    e.apellido_casada
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  const legacy = [e.nombres, e.apellidos].filter(Boolean).join(' ').trim();
  return legacy || `Empleado #${e.id || '?'}`;
};

const getEmployeeAreaId = (e) => {
  const raw = e.areaId || e.id_area || e.AreaId || (e.area && e.area.id);
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
};

const getEmployeeCentroCosto = (e) => {
  const raw = e.centro_de_costo || e.centroCosto || e.centro_costo || null;
  if (raw == null) return SIN_CENTRO_COSTO;
  const text = String(raw).trim();
  return text || SIN_CENTRO_COSTO;
};

const getEmployeePayrollSnapshot = (employee, periodType) => {
  // Una nómina cerrada es un documento histórico: su cálculo queda congelado.
  // Solo se recalculan snapshots antiguos que no traen el bloque calculated.
  const withCalc = employee.calculated
    ? employee
    : calculateEmployeePayroll(employee, periodType);
  const calc = withCalc.calculated || {};
  const proDed = calc.proratedDeductions || withCalc.deductions || employee.deductions || {};

  const baseSalary = round2(calc.baseSalary);
  const bonusDec = round2(calc.bonusDec);
  const bonusLey = round2(calc.bonusLey);
  const bonos = round2(calc.bonos);
  const extrasTotal = round2(calc.extrasTotal);
  const bonusesSum = round2(calc.bonusesSum);
  const igssBase = round2(calc.igssBase ?? (baseSalary + extrasTotal));
  const gross = round2(calc.gross);
  const patronal = round2(calc.patronal);
  const irtraIntecap = round2(calc.irtraIntecap);
  const companyCost = round2(getCompanyCost(calc));
  const igssLaboral = round2(proDed.igss ?? employee.igss_laboral);
  const isr = round2(proDed.isr ?? employee.isr);
  const otherDeductions = round2(
    Object.entries(proDed).reduce((sum, [key, val]) => {
      if (key === 'igss' || key === 'isr') return sum;
      return sum + (Number(val) || 0);
    }, 0)
  );
  const totalDeductions = round2(calc.ded ?? (igssLaboral + isr + otherDeductions));
  const net = round2(calc.net ?? (gross - totalDeductions));
  const days = Number(employee.days != null ? employee.days : (calc.periodType === 'mensual' ? 30 : 15)) || 0;

  return {
    days,
    periodType: periodType || calc.periodType || null,
    baseSalary,
    bonusDec,
    bonusLey,
    bonos,
    extrasTotal,
    bonusesSum,
    igssBase,
    gross,
    igssLaboral,
    isr,
    otherDeductions,
    totalDeductions,
    net,
    patronal,
    irtraIntecap,
    companyCost
  };
};

/**
 * La nómina paga en centavos, pero el Excel distribuye el costo con la
 * precisión interna de salario/30/8 y de la carga patronal. Este snapshot
 * conserva esa precisión; la línea de factura se redondea después de sumar
 * todos los empleados.
 */
const getEmployeeBillingCostSnapshot = (employee, payrollSnap) => {
  const calc = employee.calculated || {};
  const rawDays = employee.days;
  const days = new Decimal(
    rawDays === undefined || rawDays === null || rawDays === ''
      ? (payrollSnap.days ?? 30)
      : rawDays
  );
  const factor = days.dividedBy(30);
  const hasValue = (obj, key) => (
    obj
    && Object.prototype.hasOwnProperty.call(obj, key)
    && obj[key] !== null
    && obj[key] !== ''
  );
  const proratedMaster = (key, fallback) => (
    hasValue(employee, key)
      ? new Decimal(employee[key] || 0).times(factor)
      : new Decimal(fallback || 0)
  );

  const baseSalary = proratedMaster('sueldo_ordinario', payrollSnap.baseSalary);
  const bonusLey = proratedMaster('bon_incentivo', payrollSnap.bonusLey);
  const bonusDec = proratedMaster('bon_dec_37_2001', payrollSnap.bonusDec);
  const extras = employee.extras || {};
  const variableKeys = [
    'simplesVal',
    'doblesVal',
    'comisiones',
    'otrosIngresos',
    'vacacionesVal',
    'ventasEconomicas'
  ];
  const hasRawVariableExtras = variableKeys.some((key) => hasValue(extras, key));
  const extrasTotal = hasRawVariableExtras
    ? variableKeys.reduce(
      (sum, key) => sum.plus(new Decimal(extras[key] || 0)),
      new Decimal(0)
    )
    : new Decimal(payrollSnap.extrasTotal || 0);
  const operationalBonuses = hasValue(extras, 'bonos')
    ? new Decimal(extras.bonos || 0)
    : new Decimal(payrollSnap.bonos || 0);
  const appliedBonuses = parseJsonField(employee.appliedBonuses);
  const bonusesSum = appliedBonuses && !Array.isArray(appliedBonuses)
    ? Object.values(appliedBonuses).reduce(
      (sum, value) => sum.plus(new Decimal(value || 0)),
      new Decimal(0)
    )
    : new Decimal(payrollSnap.bonusesSum || 0);
  const igssBase = baseSalary.plus(extrasTotal);
  const igssExempt = employee.igss_exempt === true
    || employee.igss_exempt === 1
    || calc.igssExempt === true;
  const patronal = igssExempt ? new Decimal(0) : igssBase.times(CUOTA_PATRONAL_RATE);
  const irtraIntecap = igssExempt ? new Decimal(0) : igssBase.times(IRTRA_INTECAP_RATE);
  const gross = baseSalary
    .plus(bonusLey)
    .plus(bonusDec)
    .plus(operationalBonuses)
    .plus(extrasTotal)
    .plus(bonusesSum);
  const companyCost = gross.plus(patronal).plus(irtraIntecap);

  return {
    baseSalary: roundBilling(baseSalary),
    bonusLey: roundBilling(bonusLey),
    bonusDec: roundBilling(bonusDec),
    bonos: roundBilling(operationalBonuses),
    bonusesSum: roundBilling(bonusesSum),
    extrasTotal: roundBilling(extrasTotal),
    igssBase: roundBilling(igssBase),
    gross: roundBilling(gross),
    patronal: roundBilling(patronal),
    irtraIntecap: roundBilling(irtraIntecap),
    companyCost: roundBilling(companyCost)
  };
};

const SNAPSHOT_LOG_STATUSES = new Set(['APPROVED_MANAGER', 'PROCESSED_PAYROLL']);

const verifyEmployeeSnapshotForBilling = (employee, warnings) => {
  const name = getEmployeeName(employee);
  const extras = employee.extras || {};
  const appliedBonuses = employee.appliedBonuses || {};
  const appliedBonusTotal = Object.values(appliedBonuses)
    .reduce((sum, val) => sum + (Number(val) || 0), 0);
  const operationLogs = Array.isArray(employee.operationLogs) ? employee.operationLogs : [];
  const relevantLogs = operationLogs.filter((log) => SNAPSHOT_LOG_STATUSES.has(log.status));

  if (!employee.extras && relevantLogs.length > 0) {
    warnings.push(
      `Empleado "${name}": tiene registros operativos en el snapshot pero falta el objeto extras.`
    );
  }

  if (!employee.calculated) {
    warnings.push(
      `Empleado "${name}": sin campo calculated en el snapshot; se recalculará al facturar.`
    );
  }

  const hasOvertimeLogs = relevantLogs.some((log) => log.type === 'HORA_EXTRA');
  const hasBonusLogs = relevantLogs.some((log) => log.type === 'BONO');
  const hasOvertimeValues = (Number(extras.simplesVal) || 0) > 0 || (Number(extras.doblesVal) || 0) > 0;
  const hasExtrasBonos = (Number(extras.bonos) || 0) > 0;

  if (hasOvertimeLogs && !hasOvertimeValues) {
    warnings.push(
      `Empleado "${name}": tiene horas extra en operation logs pero extras.simplesVal/doblesVal están en 0 en el snapshot.`
    );
  }

  if (hasBonusLogs && !hasExtrasBonos) {
    warnings.push(
      `Empleado "${name}": tiene bonos en operation logs pero extras.bonos está en 0 en el snapshot.`
    );
  }

  if (appliedBonusTotal > 0) {
    const calcBonusesSum = Number(employee.calculated?.bonusesSum) || 0;
    if (!employee.calculated || Math.abs(calcBonusesSum - appliedBonusTotal) > 0.02) {
      warnings.push(
        `Empleado "${name}": appliedBonuses suma Q${round2(appliedBonusTotal)} pero calculated.bonusesSum no coincide (Q${round2(calcBonusesSum)}).`
      );
    }
  }

  const hasVacacionesMaster = Number(employee.vacaciones || 0) > 0;
  const hasVentasMaster = Number(employee.ventas_economicas || 0) > 0;
  if (hasVacacionesMaster && !(Number(extras.vacacionesVal) || Number(employee.calculated?.vacacionesVal))) {
    warnings.push(
      `Empleado "${name}": tiene vacaciones en maestro pero vacacionesVal no está en el snapshot.`
    );
  }
  if (hasVentasMaster && !(Number(extras.ventasEconomicas) || Number(employee.calculated?.ventasEconomicas))) {
    warnings.push(
      `Empleado "${name}": tiene ventas económicas en maestro pero ventasEconomicas no está en el snapshot.`
    );
  }
};

const validatePayrollSnapshotForBilling = (employees, warnings) => {
  if (!Array.isArray(employees) || employees.length === 0) return;

  let withExtras = 0;
  let withAppliedBonuses = 0;
  let withOvertime = 0;
  let withCalculated = 0;

  employees.forEach((employee) => {
    verifyEmployeeSnapshotForBilling(employee, warnings);

    if (employee.calculated) withCalculated += 1;
    if (employee.extras) withExtras += 1;

    const appliedBonusTotal = Object.values(employee.appliedBonuses || {})
      .reduce((sum, val) => sum + (Number(val) || 0), 0);
    if (appliedBonusTotal > 0) withAppliedBonuses += 1;

    const extras = employee.extras || {};
    if ((Number(extras.simplesVal) || 0) > 0 || (Number(extras.doblesVal) || 0) > 0) {
      withOvertime += 1;
    }
  });

  warnings.push(
    `Integridad snapshot: ${withCalculated}/${employees.length} con calculated, ${withExtras}/${employees.length} con extras, ${withOvertime} con horas extra, ${withAppliedBonuses} con bonos de catálogo.`
  );
};

const buildAllocations = (distObj, principalId, employeeName, blockingErrors) => {
  const entries = Object.entries(distObj).map(([id, pct]) => ({
    toId: Number(id),
    pct: Number(pct)
  }));

  const invalidEntries = entries.filter(({ toId, pct }) =>
    !Number.isInteger(toId)
    || toId <= 0
    || !Number.isFinite(pct)
    || pct < 0
    || pct > 100
  );
  if (invalidEntries.length > 0) {
    blockingErrors.push(
      `Empleado "${employeeName}": contiene porcentajes o empresas inválidas en su distribución.`
    );
  }

  const positiveEntries = entries
    .filter(({ toId, pct }) => Number.isInteger(toId) && toId > 0 && Number.isFinite(pct) && pct > 0)
    .map(({ toId, pct }) => [toId, pct]);

  const sumPositive = positiveEntries.reduce(
    (sum, [, pct]) => sum.plus(pct),
    new Decimal(0)
  );

  if (positiveEntries.length === 0 || sumPositive.isZero()) {
    return [{ toId: principalId, pct: 100 }];
  }

  if (!sumPositive.equals(100)) {
    blockingErrors.push(
      `Empleado "${employeeName}": la distribución suma ${sumPositive.toString()}% y debe sumar exactamente 100%.`
    );
  }

  return positiveEntries.map(([toId, pct]) => ({ toId, pct }));
};

const isFallbackDistribution = (distObj) => {
  if (!distObj || Object.keys(distObj).length === 0) return true;
  const values = Object.values(distObj).map((pct) => Number(pct));
  return values.length === 0 || values.every((pct) => Number.isFinite(pct) && pct === 0);
};

const buildComponentAllocations = (
  componentName,
  componentDist,
  generalAllocations,
  employeeName,
  blockingErrors
) => {
  if (componentDist === undefined || componentDist === null || componentDist === '') {
    return generalAllocations;
  }
  const parsed = parseDist(componentDist);
  if (parsed === null) {
    blockingErrors.push(
      `Empleado "${employeeName}": la distribución de ${componentName} no tiene un formato válido.`
    );
    return generalAllocations;
  }
  if (isFallbackDistribution(parsed)) return generalAllocations;

  const entries = Object.entries(parsed).map(([id, pct]) => ({
    toId: Number(id),
    pct: Number(pct)
  }));
  const validEntries = entries.every(({ toId, pct }) => (
    Number.isInteger(toId)
    && toId > 0
    && Number.isFinite(pct)
    && pct >= 0
    && pct <= 100
  ));
  const total = entries.reduce(
    (sum, { pct }) => sum.plus(Number.isFinite(pct) ? pct : 0),
    new Decimal(0)
  );

  if (!validEntries) {
    blockingErrors.push(
      `Empleado "${employeeName}": la distribución de ${componentName} contiene empresas o porcentajes inválidos.`
    );
  }
  if (!total.equals(100)) {
    blockingErrors.push(
      `Empleado "${employeeName}": la distribución de ${componentName} suma ${total.toString()}% y debe sumar exactamente 100%.`
    );
  }

  // Se devuelven los porcentajes escritos por el usuario. Nunca se normalizan
  // distribuciones inválidas; los errores anteriores bloquean la confirmación.
  return entries
    .filter(({ toId, pct }) => Number.isInteger(toId) && toId > 0 && Number.isFinite(pct) && pct > 0)
    .map(({ toId, pct }) => ({ toId, pct }));
};

/**
 * Distribuye con precisión interna de facturación. El único ajuste permitido
 * es el residuo de redondeo cuando los porcentajes suman exactamente 100%.
 * El redondeo a 4 decimales ocurre al terminar la agregación de la factura.
 */
const allocateAmount = (amount, allocations) => {
  const result = new Map();
  if (!Array.isArray(allocations) || allocations.length === 0) return result;

  const amountDecimal = new Decimal(amount || 0)
    .toDecimalPlaces(BILLING_PRECISION, Decimal.ROUND_HALF_UP);
  const pctTotal = allocations.reduce(
    (sum, allocation) => sum.plus(allocation.pct || 0),
    new Decimal(0)
  );
  const mayCloseRounding = pctTotal.equals(100);
  let assigned = new Decimal(0);

  allocations.forEach((allocation, index) => {
    let value = amountDecimal
      .times(allocation.pct || 0)
      .dividedBy(100)
      .toDecimalPlaces(BILLING_PRECISION, Decimal.ROUND_HALF_UP);
    if (mayCloseRounding && index === allocations.length - 1) {
      value = amountDecimal.minus(assigned)
        .toDecimalPlaces(BILLING_PRECISION, Decimal.ROUND_HALF_UP);
    }
    assigned = assigned.plus(value);
    result.set(
      allocation.toId,
      new Decimal(result.get(allocation.toId) || 0)
        .plus(value)
        .toDecimalPlaces(BILLING_PRECISION, Decimal.ROUND_HALF_UP)
        .toNumber()
    );
  });

  return result;
};

const mapAmount = (map, key) => Number(map.get(key) || 0);

const sumAllocationMaps = (...maps) => {
  const result = new Map();
  maps.forEach((map) => {
    map.forEach((value, key) => {
      result.set(
        key,
        new Decimal(result.get(key) || 0)
          .plus(value || 0)
          .toDecimalPlaces(BILLING_PRECISION, Decimal.ROUND_HALF_UP)
          .toNumber()
      );
    });
  });
  return result;
};

/**
 * Separa el costo empresa sin inventar base:
 * - general: salario + bonos legales + carga patronal del salario;
 * - bonuses: bonos operativos + catálogo, sin carga patronal;
 * - extras: HE/comisiones/otros/vacaciones/ventas + su carga patronal.
 *
 * La carga real del snapshot se reparte proporcionalmente sobre la base IGSS;
 * así representa el 12.67% aplicado por nómina y cierra exactamente contra
 * companyCost aun cuando el redondeo de IGSS/IRTRA-INTECAP produzca centavos.
 */
const getPayrollCostComponents = (payrollSnap) => {
  const totalCost = new Decimal(payrollSnap.companyCost || 0)
    .toDecimalPlaces(BILLING_PRECISION, Decimal.ROUND_HALF_UP);
  // Bono decreto + bonos operativos + catálogo: se reparte con component_dist.bonuses
  // (o dist general si no hay override). No debe ir dentro de "general".
  const bonuses = new Decimal(payrollSnap.bonusDec || 0)
    .plus(payrollSnap.bonos || 0)
    .plus(payrollSnap.bonusesSum || 0)
    .toDecimalPlaces(BILLING_PRECISION, Decimal.ROUND_HALF_UP);
  const extrasGross = new Decimal(payrollSnap.extrasTotal || 0)
    .toDecimalPlaces(BILLING_PRECISION, Decimal.ROUND_HALF_UP);
  const employerTotal = new Decimal(payrollSnap.patronal || 0)
    .plus(payrollSnap.irtraIntecap || 0)
    .toDecimalPlaces(BILLING_PRECISION, Decimal.ROUND_HALF_UP);
  const igssBase = new Decimal(payrollSnap.igssBase || 0);
  const extrasEmployer = igssBase.gt(0)
    ? employerTotal.times(extrasGross).dividedBy(igssBase)
      .toDecimalPlaces(BILLING_PRECISION, Decimal.ROUND_HALF_UP)
    : new Decimal(0);
  const generalEmployer = employerTotal.minus(extrasEmployer)
    .toDecimalPlaces(BILLING_PRECISION, Decimal.ROUND_HALF_UP);
  const extras = extrasGross.plus(extrasEmployer)
    .toDecimalPlaces(BILLING_PRECISION, Decimal.ROUND_HALF_UP);
  // El residuo contable (incluido cualquier centavo de redondeo) pertenece al
  // componente general, nunca a bonos ni a una normalización porcentual.
  const general = totalCost.minus(bonuses).minus(extras)
    .toDecimalPlaces(BILLING_PRECISION, Decimal.ROUND_HALF_UP);

  return {
    totalCost: totalCost.toNumber(),
    general: general.toNumber(),
    bonuses: bonuses.toNumber(),
    extras: extras.toNumber(),
    employerTotal: employerTotal.toNumber(),
    generalEmployer: generalEmployer.toNumber(),
    extrasEmployer: extrasEmployer.toNumber()
  };
};

const ensureMatrixCell = (matrix, fromId, toId) => {
  if (!matrix[fromId]) matrix[fromId] = {};
  if (!matrix[fromId][toId]) matrix[fromId][toId] = 0;
};

const ensureCcMatrixCell = (matrixByCc, fromId, toId, centroCosto) => {
  if (!matrixByCc[fromId]) matrixByCc[fromId] = {};
  if (!matrixByCc[fromId][toId]) matrixByCc[fromId][toId] = {};
  if (!matrixByCc[fromId][toId][centroCosto]) matrixByCc[fromId][toId][centroCosto] = 0;
};

const assertPayrollEligibleForBilling = (payroll, { requireClosed = false } = {}) => {
  if (!payroll) {
    throw new Error('Nómina no encontrada');
  }
  const periodType = String(payroll.periodType || '').toLowerCase();
  if (periodType !== '2da') {
    throw new Error(
      'La facturación solo se ejecuta sobre nóminas de 2ª quincena (una vez al mes por empresa).'
    );
  }
  if (requireClosed && payroll.status !== 'cerrada') {
    throw new Error('Solo se puede confirmar facturación de nóminas con estado cerrada');
  }
};

const resolveBillingPayrollGroup = async (primaryPayroll) => {
  const primaryCompanyId = getPayrollLegalCompanyId(primaryPayroll);
  const monthKey = getPayrollMonthKey(primaryPayroll);
  const issues = [];

  // Los libros de Econacional forman un bloque independiente. El único libro
  // que consolida dos pagadoras es el conjunto Proquima + Unhesa.
  if (![1, 2].includes(primaryCompanyId)) {
    if (primaryCompanyId !== 3) {
      issues.push(
        'No se pudo determinar una única empresa pagadora legal para la nómina.'
      );
    }
    return {
      payrolls: [primaryPayroll],
      primaryCompanyId,
      monthKey,
      issues,
      isConsolidated: false
    };
  }

  const candidates = await PayrollHistory.findAll({
    where: { periodType: '2da', status: 'cerrada' }
  });
  const byCompany = new Map([[1, []], [2, []]]);
  candidates.forEach((candidate) => {
    if (getPayrollMonthKey(candidate) !== monthKey) return;
    const companyId = getPayrollLegalCompanyId(candidate);
    if (byCompany.has(companyId)) byCompany.get(companyId).push(candidate);
  });

  const selected = [];
  [1, 2].forEach((companyId) => {
    const rows = byCompany.get(companyId) || [];
    if (rows.length === 0) {
      issues.push(
        `Falta la nómina cerrada de 2ª quincena de la empresa legal ${companyId === 1 ? 'Proquima' : 'Unhesa'} para ${monthKey}.`
      );
      return;
    }
    if (rows.length > 1) {
      issues.push(
        `Existen ${rows.length} nóminas cerradas de ${companyId === 1 ? 'Proquima' : 'Unhesa'} para ${monthKey}; debe quedar una sola antes de facturar.`
      );
    }
    const primaryMatch = rows.find(
      row => String(row.id) === String(primaryPayroll.id)
    );
    const chosen = primaryMatch || [...rows].sort((a, b) => (
      new Date(b.closedAt || b.updatedAt || b.createdAt || 0)
      - new Date(a.closedAt || a.updatedAt || a.createdAt || 0)
    ))[0];
    if (chosen) selected.push(chosen);
  });

  return {
    payrolls: selected,
    primaryCompanyId,
    monthKey,
    issues,
    isConsolidated: true
  };
};

const matchAreaIdForCentroCosto = (centroCosto, areas) => {
  if (!centroCosto || centroCosto === SIN_CENTRO_COSTO) return null;
  const needle = String(centroCosto).trim().toUpperCase();
  const codeMatch = needle.match(/^(\d{5,})/);
  const code = codeMatch ? codeMatch[1] : null;

  for (const area of areas) {
    const name = String(area.nombre || '').trim().toUpperCase();
    if (!name) continue;
    if (name === needle) return area.id;
    if (code && name.startsWith(code)) return area.id;
    // Match parent code 102000 against 102010-style labels in area names
    if (code && code.length >= 6) {
      const parent = `${code.slice(0, 3)}000`;
      if (name.startsWith(parent)) return area.id;
    }
  }
  return null;
};

class BillingService {
  static getBillableCompanyIds() {
    return [...BILLABLE_COMPANY_IDS];
  }

  static getPayrollCompanyIds() {
    return [...PAYROLL_COMPANY_IDS];
  }

  static isAllowedBillingRoute(fromId, toId) {
    return isAllowedBillingRoute(fromId, toId);
  }

  static async buildPreview(payrollId) {
    const payroll = await PayrollHistory.findByPk(payrollId);
    if (!payroll) {
      throw new Error('Nómina no encontrada');
    }
    assertPayrollEligibleForBilling(payroll, { requireClosed: true });

    const payrollGroup = await resolveBillingPayrollGroup(payroll);
    const sourcePayrolls = payrollGroup.payrolls;
    const employeeEntries = sourcePayrolls.flatMap((sourcePayroll) => (
      getPayrollEmployees(sourcePayroll).map((employee) => ({
        employee,
        sourcePayroll,
        sourceCompanyId: getPayrollLegalCompanyId(sourcePayroll)
      }))
    ));
    const employees = employeeEntries.map(entry => entry.employee);

    const companies = await Company.findAll();
    const companyNames = {};
    companies.forEach((c) => { companyNames[c.id] = c.nombre_comercial || c.razon_social || `Empresa ${c.id}`; });

    const areas = await Area.findAll();
    const areaNames = {};
    areas.forEach((a) => { areaNames[a.id] = a.nombre || `Área ${a.id}`; });

    const matrix = {};
    const matrixByCostCenter = {};
    const operationalMatrixByCostCenter = {};
    const details = [];
    const operationalDetails = [];
    const warnings = [];
    const blockingErrors = [];
    const skippedNonBillable = new Set();
    const pushBlockingError = (message) => {
      if (!blockingErrors.includes(message)) blockingErrors.push(message);
    };
    payrollGroup.issues.forEach(pushBlockingError);

    const activeRules = await BillingRule.findAll({
      where: { isActive: true },
      include: [
        { model: Company, as: 'fromCompanyData' },
        { model: Company, as: 'toCompanyData' }
      ]
    });

    const billableRules = activeRules.filter((rule) => {
      const fromId = Number(rule.fromCompanyId);
      const toId = Number(rule.toCompanyId);
      return isAllowedBillingRoute(fromId, toId);
    });

    warnings.push(
      'Facturación mensual (2ª quincena): nóminas de Proquima, Unhesa y Econacional; Cleartec se admite como destino desde Econacional.'
    );

    if (!Array.isArray(employees) || employees.length === 0) {
      warnings.push('La nómina no tiene empleados en el snapshot (campo data vacío).');
      pushBlockingError('La nómina no contiene empleados y no puede facturarse.');
    } else {
      validatePayrollSnapshotForBilling(employees, warnings);
    }

    employeeEntries.forEach(({ employee: e, sourcePayroll, sourceCompanyId }) => {
      const principalId = getPrincipalCompanyId(e);
      if (!principalId) {
        warnings.push(`Empleado "${getEmployeeName(e)}": sin empresa principal definida.`);
        pushBlockingError(`Empleado "${getEmployeeName(e)}": debe tener una empresa principal.`);
        return;
      }

      if (!isPayrollCompany(principalId)) {
        warnings.push(
          `Empleado "${getEmployeeName(e)}": empresa principal (${companyNames[principalId] || principalId}) no es facturable; se omite.`
        );
        pushBlockingError(
          `Empleado "${getEmployeeName(e)}": su empresa principal no participa en la facturación.`
        );
        return;
      }
      if (sourceCompanyId && principalId !== sourceCompanyId) {
        pushBlockingError(
          `Empleado "${getEmployeeName(e)}": su empresa principal no coincide con la empresa de la nómina ${sourcePayroll.title}.`
        );
        return;
      }

      const fromId = principalId;
      const payrollSnap = getEmployeePayrollSnapshot(e, sourcePayroll.periodType);
      const billingSnap = getEmployeeBillingCostSnapshot(e, payrollSnap);
      const totalCost = billingSnap.companyCost;
      const employeeName = getEmployeeName(e);
      const distObj = parseDist(e.dist);
      if (distObj === null) {
        pushBlockingError(
          `Empleado "${employeeName}": la distribución intercompañía no tiene un formato válido.`
        );
      }
      const rawGeneralAllocations = buildAllocations(
        distObj || {},
        principalId,
        employeeName,
        blockingErrors
      );
      const generalAllocations = canonicalizeAllocations(rawGeneralAllocations);
      const componentDist = parseComponentDist(e.component_dist);
      if (componentDist === null) {
        pushBlockingError(
          `Empleado "${employeeName}": la distribución por componente no tiene un formato válido.`
        );
      }
      const unexpectedComponents = componentDist && typeof componentDist === 'object'
        ? Object.keys(componentDist).filter((key) => !['bonuses', 'extras'].includes(key))
        : [];
      if (unexpectedComponents.length > 0) {
        pushBlockingError(
          `Empleado "${employeeName}": la distribución por componente solo acepta bonuses y extras.`
        );
      }
      const rawBonusAllocations = buildComponentAllocations(
        'bonos',
        componentDist?.bonuses,
        rawGeneralAllocations,
        employeeName,
        blockingErrors
      );
      const rawExtrasAllocations = buildComponentAllocations(
        'extras',
        componentDist?.extras,
        rawGeneralAllocations,
        employeeName,
        blockingErrors
      );
      const bonusAllocations = canonicalizeAllocations(rawBonusAllocations);
      const extrasAllocations = canonicalizeAllocations(rawExtrasAllocations);
      const costComponents = getPayrollCostComponents(billingSnap);
      const operationalAssignmentMap = sumAllocationMaps(
        allocateAmount(costComponents.general, rawGeneralAllocations),
        allocateAmount(costComponents.bonuses, rawBonusAllocations),
        allocateAmount(costComponents.extras, rawExtrasAllocations)
      );
      const generalCostMap = allocateAmount(costComponents.general, generalAllocations);
      const bonusCostMap = allocateAmount(costComponents.bonuses, bonusAllocations);
      const extrasCostMap = allocateAmount(costComponents.extras, extrasAllocations);
      const totalAssignmentMap = sumAllocationMaps(generalCostMap, bonusCostMap, extrasCostMap);

      const assignedEmployeeCost = [...totalAssignmentMap.values()].reduce(
        (sum, amount) => sum.plus(amount || 0),
        new Decimal(0)
      ).toDecimalPlaces(BILLING_PRECISION, Decimal.ROUND_HALF_UP);
      if (!assignedEmployeeCost.equals(
        new Decimal(totalCost).toDecimalPlaces(BILLING_PRECISION)
      )) {
        pushBlockingError(
          `Empleado "${employeeName}": el costo asignado (Q${assignedEmployeeCost.toFixed(4)}) no cierra con companyCost (Q${new Decimal(totalCost).toFixed(4)}). Revise distribuciones; no se normalizaron porcentajes.`
        );
      }

      const generalPct = new Map(generalAllocations.map((allocation) => [allocation.toId, allocation.pct]));
      const bonusPct = new Map(bonusAllocations.map((allocation) => [allocation.toId, allocation.pct]));
      const extrasPct = new Map(extrasAllocations.map((allocation) => [allocation.toId, allocation.pct]));

      // Mapas de detalle; baseAmount es la autoridad para el cierre exacto.
      const salaryMap = allocateAmount(billingSnap.baseSalary, generalAllocations);
      const bonusDecMap = allocateAmount(billingSnap.bonusDec, bonusAllocations);
      const bonusLeyMap = allocateAmount(billingSnap.bonusLey, generalAllocations);
      const operationalBonusMap = allocateAmount(billingSnap.bonos, bonusAllocations);
      const catalogBonusMap = allocateAmount(billingSnap.bonusesSum, bonusAllocations);
      const variableExtrasMap = allocateAmount(billingSnap.extrasTotal, extrasAllocations);
      const grossMap = sumAllocationMaps(
        salaryMap,
        bonusDecMap,
        bonusLeyMap,
        operationalBonusMap,
        catalogBonusMap,
        variableExtrasMap
      );

      const employerTotal = new Decimal(costComponents.employerTotal || 0);
      const generalEmployerRatio = employerTotal.isZero()
        ? new Decimal(0)
        : new Decimal(costComponents.generalEmployer || 0).dividedBy(employerTotal);
      const generalPatronal = new Decimal(billingSnap.patronal || 0)
        .times(generalEmployerRatio)
        .toDecimalPlaces(BILLING_PRECISION, Decimal.ROUND_HALF_UP);
      const extrasPatronal = new Decimal(billingSnap.patronal || 0)
        .minus(generalPatronal)
        .toDecimalPlaces(BILLING_PRECISION, Decimal.ROUND_HALF_UP);
      const generalIrtra = new Decimal(billingSnap.irtraIntecap || 0)
        .times(generalEmployerRatio)
        .toDecimalPlaces(BILLING_PRECISION, Decimal.ROUND_HALF_UP);
      const extrasIrtra = new Decimal(billingSnap.irtraIntecap || 0)
        .minus(generalIrtra)
        .toDecimalPlaces(BILLING_PRECISION, Decimal.ROUND_HALF_UP);
      const patronalMap = sumAllocationMaps(
        allocateAmount(generalPatronal, generalAllocations),
        allocateAmount(extrasPatronal, extrasAllocations)
      );
      const irtraMap = sumAllocationMaps(
        allocateAmount(generalIrtra, generalAllocations),
        allocateAmount(extrasIrtra, extrasAllocations)
      );
      const igssLaboralMap = allocateAmount(payrollSnap.igssLaboral, generalAllocations);
      const isrMap = allocateAmount(payrollSnap.isr, generalAllocations);

      const areaId = getEmployeeAreaId(e);
      const centroCosto = getEmployeeCentroCosto(e);

      operationalAssignmentMap.forEach((amount, operationalToId) => {
        const legalToId = canonicalBillingCompanyId(operationalToId);
        ensureCcMatrixCell(
          operationalMatrixByCostCenter,
          fromId,
          operationalToId,
          centroCosto
        );
        operationalMatrixByCostCenter[fromId][operationalToId][centroCosto] = roundBilling(
          new Decimal(
            operationalMatrixByCostCenter[fromId][operationalToId][centroCosto]
          ).plus(amount)
        );
        operationalDetails.push({
          employeeId: e.id,
          employeeName,
          principalCompanyId: principalId,
          fromCompanyId: fromId,
          operationalToCompanyId: operationalToId,
          legalToCompanyId: legalToId,
          fromCompany: companyNames[fromId] || String(fromId),
          toCompany: companyNames[operationalToId] || String(operationalToId),
          legalToCompany: companyNames[legalToId] || String(legalToId),
          centroCosto,
          percentage: totalCost
            ? round4(new Decimal(amount).times(100).dividedBy(totalCost))
            : 0,
          employeeCost: totalCost,
          baseAmount: amount,
          isLegalIntercompany: legalToId !== fromId
        });
      });

      totalAssignmentMap.forEach((amount, toId) => {
        if (toId === fromId) return;

        if (!isBillableDestination(toId) || !isAllowedBillingRoute(fromId, toId)) {
          skippedNonBillable.add(companyNames[toId] || String(toId));
          pushBlockingError(
            `Empleado "${employeeName}": la ruta ${companyNames[fromId] || fromId} → ${companyNames[toId] || toId} no está habilitada para facturación.`
          );
          return;
        }

        // Aporte por empleado a 2 decimales (moneda), luego se acumula.
        // Evita deriva de céntimos vs Excel al sumar muchos importes largos.
        const contribution = round2(amount);
        ensureMatrixCell(matrix, fromId, toId);
        matrix[fromId][toId] = round2(
          new Decimal(matrix[fromId][toId]).plus(contribution)
        );

        ensureCcMatrixCell(matrixByCostCenter, fromId, toId, centroCosto);
        matrixByCostCenter[fromId][toId][centroCosto] = round2(
          new Decimal(matrixByCostCenter[fromId][toId][centroCosto]).plus(contribution)
        );

        details.push({
          employeeId: e.id,
          employeeName,
          principalCompanyId: principalId,
          fromCompanyId: fromId,
          toCompanyId: toId,
          fromCompany: companyNames[fromId] || String(fromId),
          toCompany: companyNames[toId] || String(toId),
          areaId,
          areaName: areaId ? (areaNames[areaId] || String(areaId)) : null,
          puesto: e.puesto || e.cargo || null,
          centroCosto,
          percentage: totalCost
            ? round4(new Decimal(amount).times(100).dividedBy(totalCost))
            : 0,
          generalPercentage: Number(generalPct.get(toId) || 0),
          bonusesPercentage: Number(bonusPct.get(toId) || 0),
          extrasPercentage: Number(extrasPct.get(toId) || 0),
          periodType: payrollSnap.periodType,
          days: payrollSnap.days,
          sueldoOrdinario: payrollSnap.baseSalary,
          bonoDecreto: payrollSnap.bonusDec,
          bonoIncentivo: payrollSnap.bonusLey,
          bonosExtras: payrollSnap.bonos,
          horasExtrasOtros: payrollSnap.extrasTotal,
          bonosAplicados: payrollSnap.bonusesSum,
          bruto: payrollSnap.gross,
          igssLaboral: payrollSnap.igssLaboral,
          isr: payrollSnap.isr,
          otrosDescuentos: payrollSnap.otherDeductions,
          totalDescuentos: payrollSnap.totalDeductions,
          liquido: payrollSnap.net,
          igssPatronal: payrollSnap.patronal,
          irtraIntecap: payrollSnap.irtraIntecap,
          employeeCost: totalCost,
          asgSueldo: mapAmount(salaryMap, toId),
          asgBonoDecreto: mapAmount(bonusDecMap, toId),
          asgBonoIncentivo: mapAmount(bonusLeyMap, toId),
          asgBonosExtras: mapAmount(operationalBonusMap, toId),
          asgBonosAplicados: mapAmount(catalogBonusMap, toId),
          asgHorasExtrasOtros: mapAmount(variableExtrasMap, toId),
          asgBruto: mapAmount(grossMap, toId),
          asgIgssLaboral: mapAmount(igssLaboralMap, toId),
          asgIsr: mapAmount(isrMap, toId),
          asgIgssPatronal: mapAmount(patronalMap, toId),
          asgIrtraIntecap: mapAmount(irtraMap, toId),
          asgCargaPatronal: round4(
            new Decimal(mapAmount(patronalMap, toId)).plus(mapAmount(irtraMap, toId))
          ),
          baseAmount: amount
        });
      });
    });

    if (skippedNonBillable.size > 0) {
      warnings.push(
        `Se omitieron tramos de distribución hacia empresas no facturables: ${[...skippedNonBillable].join(', ')}.`
      );
    }
    warnings.push(
      'Hidroxon y Calidul se conservaron como centros operativos y se consolidaron legalmente dentro de Unhesa.'
    );

    // El Excel decide una sola dirección por par legal después de sumar todos
    // los centros de costo. matrix conserva únicamente ese saldo facturable.
    const grossMatrix = matrix;
    const { netMatrix, nettingPairs } = netLegalCompanyMatrix(grossMatrix);

    const nameToId = {};
    companies.forEach((c) => {
      if (c.nombre_comercial) nameToId[c.nombre_comercial.trim().toUpperCase()] = c.id;
      if (c.razon_social) nameToId[c.razon_social.trim().toUpperCase()] = c.id;
    });

    const resolveRuleIds = (rule) => {
      let fromId = rule.fromCompanyId;
      let toId = rule.toCompanyId;
      if (!fromId && rule.fromCompany) {
        fromId = nameToId[String(rule.fromCompany).trim().toUpperCase()] || null;
      }
      if (!toId && rule.toCompany) {
        toId = nameToId[String(rule.toCompany).trim().toUpperCase()] || null;
      }
      return { fromId: fromId ? Number(fromId) : null, toId: toId ? Number(toId) : null };
    };

    const findRule = (fromId, toId) => {
      for (const rule of billableRules) {
        const ids = resolveRuleIds(rule);
        if (ids.fromId === fromId && ids.toId === toId) return rule;
      }
      return null;
    };

    const lines = [];
    const missingRules = new Set();

    Object.keys(netMatrix).forEach((fromKey) => {
      const fromId = Number(fromKey);
      Object.keys(netMatrix[fromKey] || {}).forEach((toKey) => {
        const toId = Number(toKey);
        const baseAmountPrecise = new Decimal(netMatrix[fromId][toId] || 0);
        if (baseAmountPrecise.lte(0)) return;

        const rule = findRule(fromId, toId);
        if (!rule) {
          missingRules.add(
            `${companyNames[fromId] || fromId} → ${companyNames[toId] || toId}`
          );
          return;
        }

        const marginPerc = Number(rule.marginPercentage) || 0;
        const ivaRate = Number(rule.ivaRate ?? 0.12);
        const baseAdjustment = round2(rule.baseAdjustment || 0);
        // Dinero a 2 decimales (mismo criterio contable/Excel):
        // BASE (+ ajuste de regla) → MARGEN → IVA → TOTAL.
        const baseAmount = round2(baseAmountPrecise.plus(baseAdjustment));
        const marginAmount = round2(
          new Decimal(baseAmount).times(marginPerc).dividedBy(100)
        );
        const subtotalAmount = round2(new Decimal(baseAmount).plus(marginAmount));
        const ivaAmount = rule.applyIva
          ? round2(new Decimal(subtotalAmount).times(ivaRate))
          : 0;
        const totalAmount = round2(new Decimal(subtotalAmount).plus(ivaAmount));
        const centroCosto = 'CONSOLIDADO GLOBAL';
        const baseConcept = rule.concept || `Servicios de RRHH ${payroll.title}`;
        const concept = baseAdjustment
          ? `${baseConcept} — neteo global intercompany (incl. ajuste Q${baseAdjustment.toFixed(2)})`
          : `${baseConcept} — neteo global intercompany`;

        lines.push({
          ruleId: rule.id,
          fromCompanyId: fromId,
          toCompanyId: toId,
          fromCompany: companyNames[fromId] || rule.fromCompany || String(fromId),
          toCompany: companyNames[toId] || rule.toCompany || String(toId),
          areaId: null,
          centroCosto,
          concept,
          baseAmount,
          baseAdjustment,
          marginPercentage: marginPerc,
          marginAmount,
          subtotalAmount,
          ivaAmount,
          totalAmount,
          applyIva: rule.applyIva,
          ivaRate
        });
      });
    });

    lines.sort((a, b) => {
      const cc = String(a.centroCosto).localeCompare(String(b.centroCosto), 'es');
      if (cc !== 0) return cc;
      if (a.fromCompanyId !== b.fromCompanyId) return a.fromCompanyId - b.fromCompanyId;
      return a.toCompanyId - b.toCompanyId;
    });

    if (missingRules.size > 0) {
      pushBlockingError(
        `Faltan reglas activas de facturación para: ${[...missingRules].join(', ')}.`
      );
    }

    if (lines.length === 0 && details.length > 0) {
      const payersInMatrix = Object.keys(netMatrix).filter((fid) =>
        Object.values(netMatrix[fid] || {}).some((v) => Number(v) > 0)
      );
      const receivers = new Set();
      payersInMatrix.forEach((fid) => {
        Object.entries(netMatrix[fid] || {}).forEach(([tid, amt]) => {
          if (Number(amt) > 0) receivers.add(companyNames[tid] || tid);
        });
      });
      if (payersInMatrix.length === 0 || receivers.size === 0) {
        warnings.push(
          'No se generaron facturas: la distribución por empresa de los empleados no genera cargos intercompañía (p. ej. 100% en la misma empresa pagadora).'
        );
      } else {
        warnings.push(
          `No se generaron facturas: revise «Reglas de Fact.» para las relaciones emisora→receptora (${payersInMatrix.map((id) => companyNames[id] || id).join(', ')} → ${[...receivers].join(', ')}).`
        );
      }
    }

    return {
      payrollId: payroll.id,
      payrollTitle: payrollGroup.isConsolidated
        ? `Nómina consolidada Proquima + Unhesa ${payrollGroup.monthKey}`
        : payroll.title,
      payrollStatus: payroll.status,
      payrollPeriodType: payroll.periodType,
      sourcePayrollIds: sourcePayrolls.map(source => source.id),
      sourcePayrollTitles: sourcePayrolls.map(source => source.title),
      billingMonth: payrollGroup.monthKey,
      isConsolidated: payrollGroup.isConsolidated,
      employeeCount: employees.length,
      matrix: netMatrix,
      grossMatrix,
      matrixByCostCenter,
      operationalMatrixByCostCenter,
      nettingPairs,
      companyNames,
      billableCompanyIds: [...BILLABLE_COMPANY_IDS],
      lines,
      details,
      operationalDetails,
      warnings,
      blockingErrors,
      companyCosts: netMatrix
    };
  }

  static async confirmRun(payrollId, userId, notes = null) {
    const payroll = await PayrollHistory.findByPk(payrollId);
    assertPayrollEligibleForBilling(payroll, { requireClosed: true });

    const preview = await this.buildPreview(payrollId);

    if (preview.blockingErrors?.length) {
      throw new Error(
        `No se puede confirmar la facturación: ${preview.blockingErrors.join(' ')}`
      );
    }
    if (!preview.lines || preview.lines.length === 0) {
      throw new Error('No hay facturas para confirmar. Genere una vista previa con al menos una línea de factura.');
    }
    const sourcePayrollIds = [...new Set(
      (preview.sourcePayrollIds?.length ? preview.sourcePayrollIds : [payrollId])
        .map(String)
    )].sort();
    const anchorPayrollId = sourcePayrollIds[0];

    const runId = await sequelize.transaction(async (transaction) => {
      // El bloqueo de todas las nóminas fuente serializa el consolidado mensual.
      const lockedPayrolls = await PayrollHistory.findAll({
        where: { id: sourcePayrollIds },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (lockedPayrolls.length !== sourcePayrollIds.length) {
        throw new Error(
          'Una de las nóminas fuente cambió o fue reactivada; genere nuevamente la vista previa.'
        );
      }
      lockedPayrolls.forEach(lockedPayroll => (
        assertPayrollEligibleForBilling(lockedPayroll, { requireClosed: true })
      ));

      const lastRun = await BillingRun.findOne({
        where: { payrollId: anchorPayrollId },
        order: [['version', 'DESC']],
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      const version = lastRun ? Number(lastRun.version) + 1 : 1;

      const run = await BillingRun.create({
        payrollId: anchorPayrollId,
        payrollTitle: preview.payrollTitle,
        status: 'confirmed',
        version,
        createdBy: userId || null,
        costMatrixJson: {
          matrix: preview.matrix,
          grossMatrix: preview.grossMatrix,
          matrixByCostCenter: preview.matrixByCostCenter,
          operationalMatrixByCostCenter: preview.operationalMatrixByCostCenter,
          nettingPairs: preview.nettingPairs,
          companyNames: preview.companyNames,
          sourcePayrollIds,
          sourcePayrollTitles: preview.sourcePayrollTitles,
          billingMonth: preview.billingMonth,
          isConsolidated: preview.isConsolidated,
          warnings: preview.warnings,
          details: preview.details,
          operationalDetails: preview.operationalDetails,
          lines: preview.lines
        },
        notes
      }, { transaction });

      const lineRecords = preview.lines.map((line) => ({
        runId: run.id,
        ruleId: line.ruleId,
        fromCompanyId: line.fromCompanyId,
        toCompanyId: line.toCompanyId,
        areaId: line.areaId,
        centroCosto: line.centroCosto,
        concept: line.concept,
        baseAmount: line.baseAmount,
        marginPercentage: line.marginPercentage,
        marginAmount: line.marginAmount,
        subtotalAmount: line.subtotalAmount,
        applyIva: !!line.applyIva,
        ivaRate: line.ivaRate,
        ivaAmount: line.ivaAmount,
        totalAmount: line.totalAmount
      }));

      await BillingRunLine.bulkCreate(lineRecords, { transaction });
      return run.id;
    });

    const fullRun = await this.getRunById(runId);
    return fullRun;
  }

  static async getRuns() {
    const runs = await BillingRun.findAll({
      order: [['createdAt', 'DESC']],
      include: [{ model: BillingRunLine, as: 'lines' }]
    });

    return Promise.all(runs.map((run) => this.enrichRunStatus(run)));
  }

  static async getRunById(id) {
    const run = await BillingRun.findByPk(id, {
      include: [
        {
          model: BillingRunLine,
          as: 'lines',
          include: [
            { model: Company, as: 'fromCompanyData' },
            { model: Company, as: 'toCompanyData' }
          ]
        }
      ]
    });
    if (!run) return null;
    return this.enrichRunStatus(run);
  }

  static async enrichRunStatus(run) {
    const plain = run.toJSON ? run.toJSON() : { ...run };

    const parsedMatrix = parseJsonField(plain.costMatrixJson);
    plain.costMatrixJson = parsedMatrix || (typeof plain.costMatrixJson === 'object' ? plain.costMatrixJson : null);

    const sourcePayrollIds = [...new Set(
      (
        Array.isArray(plain.costMatrixJson?.sourcePayrollIds)
          ? plain.costMatrixJson.sourcePayrollIds
          : [plain.payrollId]
      ).map(String)
    )];
    const sourcePayrolls = await PayrollHistory.findAll({
      where: { id: sourcePayrollIds }
    });
    const allSourcesValid = (
      sourcePayrolls.length === sourcePayrollIds.length
      && sourcePayrolls.every(source => source.status === 'cerrada')
    );

    if (!allSourcesValid) {
      if (plain.status === 'confirmed') {
        await BillingRun.update({ status: 'stale' }, { where: { id: plain.id } });
        plain.status = 'stale';
      }
    }

    plain.sourcePayrollIds = sourcePayrollIds;
    plain.payrollExists = sourcePayrolls.length === sourcePayrollIds.length;
    plain.payrollStatus = allSourcesValid ? 'cerrada' : 'stale';
    plain.payrollPeriodType = sourcePayrolls[0]?.periodType || null;
    return plain;
  }

  static async markRunsStaleForPayroll(payrollId) {
    await BillingRun.update(
      { status: 'stale' },
      { where: { payrollId, status: 'confirmed' } }
    );
    const confirmedRuns = await BillingRun.findAll({
      where: { status: 'confirmed' },
      attributes: ['id', 'payrollId', 'costMatrixJson']
    });
    const relatedRunIds = confirmedRuns
      .filter((run) => {
        const plain = run.toJSON();
        const matrix = parseJsonField(plain.costMatrixJson) || {};
        const sources = Array.isArray(matrix.sourcePayrollIds)
          ? matrix.sourcePayrollIds
          : [plain.payrollId];
        return sources.some(id => String(id) === String(payrollId));
      })
      .map(run => run.id);
    if (relatedRunIds.length > 0) {
      await BillingRun.update(
        { status: 'stale' },
        { where: { id: relatedRunIds } }
      );
    }
  }

  /** @deprecated alias para compatibilidad */
  static async calculateDistribution(payrollId) {
    const preview = await this.buildPreview(payrollId);
    return {
      payrollId: preview.payrollId,
      payrollTitle: preview.payrollTitle,
      period: preview.payrollId,
      matrix: preview.matrix,
      matrixByCostCenter: preview.matrixByCostCenter,
      companyCosts: preview.companyCosts,
      companyNames: preview.companyNames,
      lines: preview.lines,
      details: preview.details,
      warnings: preview.warnings,
      distributions: preview.lines.map((line) => ({
        ruleId: line.ruleId,
        fromCompany: line.fromCompany,
        toCompany: line.toCompany,
        centroCosto: line.centroCosto,
        concept: line.concept,
        baseAmount: line.baseAmount,
        marginPercentage: line.marginPercentage,
        marginAmount: line.marginAmount,
        subtotalAmount: line.subtotalAmount,
        ivaAmount: line.ivaAmount,
        totalAmount: line.totalAmount
      }))
    };
  }
}

module.exports = BillingService;
module.exports.BILLABLE_COMPANY_IDS = BILLABLE_COMPANY_IDS;
module.exports.PAYROLL_COMPANY_IDS = PAYROLL_COMPANY_IDS;
module.exports.ALLOWED_BILLING_ROUTE_KEYS = ALLOWED_BILLING_ROUTE_KEYS;
module.exports.__componentDistributionTest = {
  allocateAmount,
  buildAllocations,
  buildComponentAllocations,
  canonicalBillingCompanyId,
  canonicalizeAllocations,
  getEmployeeBillingCostSnapshot,
  getPayrollCostComponents,
  netLegalCompanyMatrix,
  sumAllocationMaps
};
