const Decimal = require('decimal.js');
const {
  PayrollHistory, BillingRule, BillingRun, BillingRunLine, Company, Area
} = require('../models');
const { getCompanyCost, calculateEmployeePayroll } = require('./payrollCalculator.service');

/** Empresas que participan en facturación: Proquima, Unhesa, Econacional */
const BILLABLE_COMPANY_IDS = new Set([1, 2, 3]);
const SIN_CENTRO_COSTO = 'SIN CENTRO DE COSTO';

const round4 = (n) => new Decimal(n || 0).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
const round2 = (n) => new Decimal(n || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

const isBillableCompany = (id) => BILLABLE_COMPANY_IDS.has(Number(id));

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
    try { return JSON.parse(dist); } catch { return {}; }
  }
  return dist;
};

const getPrincipalCompanyId = (employee) => {
  const raw = employee.empresa_principal
    || employee.companyId
    || employee.id_empresa
    || (employee.companyData && employee.companyData.id);
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
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

const splitByPct = (value, pct) =>
  round4(new Decimal(value || 0).times(pct || 0).dividedBy(100));

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

const buildAllocations = (distObj, principalId, employeeName, warnings) => {
  const positiveEntries = Object.entries(distObj)
    .map(([id, pct]) => [Number(id), Number(pct) || 0])
    .filter(([, pct]) => pct > 0);

  const sumPositive = positiveEntries.reduce((s, [, pct]) => s + pct, 0);

  if (positiveEntries.length === 0 || sumPositive === 0) {
    return [{ toId: principalId, pct: 100 }];
  }

  if (Math.abs(sumPositive - 100) > 0.01) {
    warnings.push(
      `Empleado "${employeeName}": la distribución efectiva suma ${round2(sumPositive)}% (debe ser 100%). Se renormaliza a 100% para no perder costo.`
    );
    return positiveEntries.map(([toId, pct]) => ({
      toId,
      pct: round4(new Decimal(pct).times(100).dividedBy(sumPositive))
    }));
  }

  return positiveEntries.map(([toId, pct]) => ({ toId, pct }));
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

  static async buildPreview(payrollId) {
    const payroll = await PayrollHistory.findByPk(payrollId);
    if (!payroll) {
      throw new Error('Nómina no encontrada');
    }
    assertPayrollEligibleForBilling(payroll, { requireClosed: true });

    let employees = payroll.data;
    if (typeof employees === 'string') {
      try { employees = JSON.parse(employees); } catch { employees = []; }
    }
    if (employees && !Array.isArray(employees) && Array.isArray(employees.employees)) {
      employees = employees.employees;
    }
    if (!Array.isArray(employees)) {
      employees = [];
    }

    const companies = await Company.findAll();
    const companyNames = {};
    companies.forEach((c) => { companyNames[c.id] = c.nombre_comercial || c.razon_social || `Empresa ${c.id}`; });

    const areas = await Area.findAll();
    const areaNames = {};
    areas.forEach((a) => { areaNames[a.id] = a.nombre || `Área ${a.id}`; });

    const matrix = {};
    const matrixByCostCenter = {};
    const details = [];
    const warnings = [];
    const skippedNonBillable = new Set();

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
      return isBillableCompany(fromId) && isBillableCompany(toId) && fromId !== toId;
    });

    warnings.push(
      'Facturación mensual por empresa (2ª quincena): solo Proquima, Unhesa y Econacional. Otras empresas se omiten de las facturas.'
    );

    if (!Array.isArray(employees) || employees.length === 0) {
      warnings.push('La nómina no tiene empleados en el snapshot (campo data vacío).');
    } else {
      validatePayrollSnapshotForBilling(employees, warnings);
    }

    employees.forEach((e) => {
      const principalId = getPrincipalCompanyId(e);
      if (!principalId) {
        warnings.push(`Empleado "${getEmployeeName(e)}": sin empresa principal definida.`);
        return;
      }

      if (!isBillableCompany(principalId)) {
        warnings.push(
          `Empleado "${getEmployeeName(e)}": empresa principal (${companyNames[principalId] || principalId}) no es facturable; se omite.`
        );
        return;
      }

      const fromId = principalId;
      const payrollSnap = getEmployeePayrollSnapshot(e, payroll.periodType);
      const totalCost = payrollSnap.companyCost;
      const distObj = parseDist(e.dist);
      const allocations = buildAllocations(distObj, principalId, getEmployeeName(e), warnings);
      const areaId = getEmployeeAreaId(e);
      const centroCosto = getEmployeeCentroCosto(e);

      allocations.forEach(({ toId, pct }) => {
        if (toId === fromId) return;

        if (!isBillableCompany(toId)) {
          skippedNonBillable.add(companyNames[toId] || String(toId));
          return;
        }

        const amount = splitByPct(totalCost, pct);
        ensureMatrixCell(matrix, fromId, toId);
        matrix[fromId][toId] = round4(new Decimal(matrix[fromId][toId]).plus(amount));

        ensureCcMatrixCell(matrixByCostCenter, fromId, toId, centroCosto);
        matrixByCostCenter[fromId][toId][centroCosto] = round4(
          new Decimal(matrixByCostCenter[fromId][toId][centroCosto]).plus(amount)
        );

        details.push({
          employeeId: e.id,
          employeeName: getEmployeeName(e),
          principalCompanyId: principalId,
          fromCompanyId: fromId,
          toCompanyId: toId,
          fromCompany: companyNames[fromId] || String(fromId),
          toCompany: companyNames[toId] || String(toId),
          areaId,
          areaName: areaId ? (areaNames[areaId] || String(areaId)) : null,
          puesto: e.puesto || e.cargo || null,
          centroCosto,
          percentage: pct,
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
          asgSueldo: splitByPct(payrollSnap.baseSalary, pct),
          asgBonoDecreto: splitByPct(payrollSnap.bonusDec, pct),
          asgBonoIncentivo: splitByPct(payrollSnap.bonusLey, pct),
          asgBonosExtras: splitByPct(payrollSnap.bonos, pct),
          asgBonosAplicados: splitByPct(payrollSnap.bonusesSum, pct),
          asgHorasExtrasOtros: splitByPct(payrollSnap.extrasTotal, pct),
          asgBruto: splitByPct(payrollSnap.gross, pct),
          asgIgssLaboral: splitByPct(payrollSnap.igssLaboral, pct),
          asgIsr: splitByPct(payrollSnap.isr, pct),
          asgIgssPatronal: splitByPct(payrollSnap.patronal, pct),
          baseAmount: amount
        });
      });
    });

    if (skippedNonBillable.size > 0) {
      warnings.push(
        `Se omitieron tramos de distribución hacia empresas no facturables: ${[...skippedNonBillable].join(', ')}.`
      );
    }

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

    Object.keys(matrixByCostCenter).forEach((fromKey) => {
      const fromId = Number(fromKey);
      Object.keys(matrixByCostCenter[fromKey] || {}).forEach((toKey) => {
        const toId = Number(toKey);
        const byCc = matrixByCostCenter[fromKey][toKey] || {};
        Object.entries(byCc).forEach(([centroCosto, baseAmountRaw]) => {
          const baseAmount = Number(baseAmountRaw) || 0;
          if (baseAmount <= 0) return;

          const rule = findRule(fromId, toId);
          if (!rule) return;

          const marginPerc = Number(rule.marginPercentage) || 0;
          const ivaRate = Number(rule.ivaRate ?? 0.12);
          const marginAmount = round4(new Decimal(baseAmount).times(marginPerc).dividedBy(100));
          const subtotal = new Decimal(baseAmount).plus(marginAmount);
          const ivaAmount = rule.applyIva ? round4(subtotal.times(ivaRate)) : 0;
          const totalAmount = round4(subtotal.plus(ivaAmount));
          const areaId = matchAreaIdForCentroCosto(centroCosto, areas);
          const baseConcept = rule.concept || `Servicios de RRHH ${payroll.title}`;
          const concept = `${baseConcept} — ${centroCosto}`;

          lines.push({
            ruleId: rule.id,
            fromCompanyId: fromId,
            toCompanyId: toId,
            fromCompany: companyNames[fromId] || rule.fromCompany || String(fromId),
            toCompany: companyNames[toId] || rule.toCompany || String(toId),
            areaId,
            centroCosto,
            concept,
            baseAmount,
            marginPercentage: marginPerc,
            marginAmount,
            ivaAmount,
            totalAmount,
            applyIva: rule.applyIva,
            ivaRate
          });
        });
      });
    });

    lines.sort((a, b) => {
      const cc = String(a.centroCosto).localeCompare(String(b.centroCosto), 'es');
      if (cc !== 0) return cc;
      if (a.fromCompanyId !== b.fromCompanyId) return a.fromCompanyId - b.fromCompanyId;
      return a.toCompanyId - b.toCompanyId;
    });

    if (lines.length === 0 && details.length > 0) {
      const payersInMatrix = Object.keys(matrix).filter((fid) =>
        Object.values(matrix[fid] || {}).some((v) => Number(v) > 0)
      );
      const receivers = new Set();
      payersInMatrix.forEach((fid) => {
        Object.entries(matrix[fid] || {}).forEach(([tid, amt]) => {
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
      payrollTitle: payroll.title,
      payrollStatus: payroll.status,
      payrollPeriodType: payroll.periodType,
      employeeCount: employees.length,
      matrix,
      matrixByCostCenter,
      companyNames,
      billableCompanyIds: [...BILLABLE_COMPANY_IDS],
      lines,
      details,
      warnings,
      companyCosts: matrix
    };
  }

  static async confirmRun(payrollId, userId, notes = null) {
    const payroll = await PayrollHistory.findByPk(payrollId);
    assertPayrollEligibleForBilling(payroll, { requireClosed: true });

    const preview = await this.buildPreview(payrollId);

    if (!preview.lines || preview.lines.length === 0) {
      throw new Error('No hay facturas para confirmar. Genere una vista previa con al menos una línea de factura.');
    }

    const lastRun = await BillingRun.findOne({
      where: { payrollId },
      order: [['version', 'DESC']]
    });
    const version = lastRun ? lastRun.version + 1 : 1;

    const run = await BillingRun.create({
      payrollId: payroll.id,
      payrollTitle: payroll.title,
      status: 'confirmed',
      version,
      createdBy: userId || null,
      costMatrixJson: {
        matrix: preview.matrix,
        matrixByCostCenter: preview.matrixByCostCenter,
        companyNames: preview.companyNames,
        warnings: preview.warnings,
        details: preview.details,
        lines: preview.lines
      },
      notes
    });

    const lineRecords = preview.lines.map((line) => ({
      runId: run.id,
      ruleId: line.ruleId,
      fromCompanyId: line.fromCompanyId,
      toCompanyId: line.toCompanyId,
      areaId: line.areaId,
      concept: line.concept,
      baseAmount: line.baseAmount,
      marginPercentage: line.marginPercentage,
      marginAmount: line.marginAmount,
      ivaAmount: line.ivaAmount,
      totalAmount: line.totalAmount
    }));

    if (lineRecords.length > 0) {
      await BillingRunLine.bulkCreate(lineRecords);
    }

    const fullRun = await this.getRunById(run.id);
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

    const payroll = await PayrollHistory.findByPk(plain.payrollId);

    if (!payroll || payroll.status !== 'cerrada') {
      if (plain.status === 'confirmed') {
        await BillingRun.update({ status: 'stale' }, { where: { id: plain.id } });
        plain.status = 'stale';
      }
    }

    plain.payrollExists = !!payroll;
    plain.payrollStatus = payroll ? payroll.status : null;
    plain.payrollPeriodType = payroll ? payroll.periodType : null;
    return plain;
  }

  static async markRunsStaleForPayroll(payrollId) {
    await BillingRun.update(
      { status: 'stale' },
      { where: { payrollId, status: 'confirmed' } }
    );
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
        ivaAmount: line.ivaAmount,
        totalAmount: line.totalAmount
      }))
    };
  }
}

module.exports = BillingService;
module.exports.BILLABLE_COMPANY_IDS = BILLABLE_COMPANY_IDS;
