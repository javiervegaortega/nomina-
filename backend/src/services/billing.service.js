const Decimal = require('decimal.js');
const {
  PayrollHistory, BillingRule, BillingRun, BillingRunLine, Company, Area
} = require('../models');
const { getCompanyCost, calculateEmployeePayroll } = require('./payrollCalculator.service');

const round4 = (n) => new Decimal(n || 0).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
const round2 = (n) => new Decimal(n || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

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
    companyCost
  };
};

const getEmployeeCompanyCost = (employee, periodType) => {
  return getEmployeePayrollSnapshot(employee, periodType).companyCost;
};

const splitByPct = (value, pct) =>
  round4(new Decimal(value || 0).times(pct || 0).dividedBy(100));

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
    // Renormalizar para que el 100% del companyCost se asigne (evita "perder" costo)
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

class BillingService {
  static async buildPreview(payrollId) {
    const payroll = await PayrollHistory.findByPk(payrollId);
    if (!payroll) {
      throw new Error('Nómina no encontrada');
    }

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
    const details = [];
    const warnings = [];

    if (!Array.isArray(employees) || employees.length === 0) {
      warnings.push('La nómina no tiene empleados en el snapshot (campo data vacío).');
    }

    employees.forEach((e) => {
      const fromId = getPrincipalCompanyId(e);
      if (!fromId) {
        warnings.push(`Empleado "${getEmployeeName(e)}": sin empresa principal definida.`);
        return;
      }

      const payrollSnap = getEmployeePayrollSnapshot(e, payroll.periodType);
      const totalCost = payrollSnap.companyCost;
      const distObj = parseDist(e.dist);
      const allocations = buildAllocations(distObj, fromId, getEmployeeName(e), warnings);
      const areaId = getEmployeeAreaId(e);

      allocations.forEach(({ toId, pct }) => {
        const amount = splitByPct(totalCost, pct);
        ensureMatrixCell(matrix, fromId, toId);
        matrix[fromId][toId] = round4(new Decimal(matrix[fromId][toId]).plus(amount));

        details.push({
          employeeId: e.id,
          employeeName: getEmployeeName(e),
          fromCompanyId: fromId,
          toCompanyId: toId,
          fromCompany: companyNames[fromId] || String(fromId),
          toCompany: companyNames[toId] || String(toId),
          areaId,
          areaName: areaId ? (areaNames[areaId] || String(areaId)) : null,
          puesto: e.puesto || e.cargo || null,
          centroCosto: e.centro_de_costo || e.centroCosto || null,
          percentage: pct,
          periodType: payrollSnap.periodType,
          days: payrollSnap.days,
          // Totales del período (quincena/mes) — no prorrateados por empresa
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
          employeeCost: totalCost,
          // Parte asignada a la empresa destino según %
          asgSueldo: splitByPct(payrollSnap.baseSalary, pct),
          asgBonoDecreto: splitByPct(payrollSnap.bonusDec, pct),
          asgBonoIncentivo: splitByPct(payrollSnap.bonusLey, pct),
          asgBonosExtras: splitByPct(payrollSnap.bonos, pct),
          asgHorasExtrasOtros: splitByPct(payrollSnap.extrasTotal, pct),
          asgBruto: splitByPct(payrollSnap.gross, pct),
          asgIgssLaboral: splitByPct(payrollSnap.igssLaboral, pct),
          asgIsr: splitByPct(payrollSnap.isr, pct),
          asgIgssPatronal: splitByPct(payrollSnap.patronal, pct),
          baseAmount: amount
        });
      });
    });

    const activeRules = await BillingRule.findAll({
      where: { isActive: true },
      include: [
        { model: Company, as: 'fromCompanyData' },
        { model: Company, as: 'toCompanyData' }
      ]
    });

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
      return { fromId, toId };
    };

    const lines = [];

    activeRules.forEach((rule) => {
      const { fromId, toId } = resolveRuleIds(rule);
      if (!fromId || !toId) return;

      const baseAmount = (matrix[fromId] && matrix[fromId][toId]) ? matrix[fromId][toId] : 0;
      if (baseAmount <= 0) return;

      const marginPerc = Number(rule.marginPercentage) || 0;
      const ivaRate = Number(rule.ivaRate ?? 0.12);
      const marginAmount = round4(new Decimal(baseAmount).times(marginPerc).dividedBy(100));
      const subtotal = new Decimal(baseAmount).plus(marginAmount);
      const ivaAmount = rule.applyIva
        ? round4(subtotal.times(ivaRate))
        : 0;
      const totalAmount = round4(subtotal.plus(ivaAmount));

      lines.push({
        ruleId: rule.id,
        fromCompanyId: fromId,
        toCompanyId: toId,
        fromCompany: companyNames[fromId] || rule.fromCompany || String(fromId),
        toCompany: companyNames[toId] || rule.toCompany || String(toId),
        areaId: null,
        concept: rule.concept || `Servicios de RRHH ${payroll.title}`,
        baseAmount,
        marginPercentage: marginPerc,
        marginAmount,
        ivaAmount,
        totalAmount,
        applyIva: rule.applyIva,
        ivaRate
      });
    });

    return {
      payrollId: payroll.id,
      payrollTitle: payroll.title,
      payrollStatus: payroll.status,
      matrix,
      companyNames,
      lines,
      details,
      warnings,
      companyCosts: matrix
    };
  }

  static async confirmRun(payrollId, userId, notes = null) {
    const payroll = await PayrollHistory.findByPk(payrollId);
    if (!payroll) {
      throw new Error('Nómina no encontrada');
    }
    if (payroll.status !== 'cerrada') {
      throw new Error('Solo se puede confirmar facturación de nóminas con estado cerrada');
    }

    const preview = await this.buildPreview(payrollId);

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
        companyNames: preview.companyNames,
        warnings: preview.warnings,
        details: preview.details
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

    // En MySQL la columna es LONGTEXT: Sequelize puede devolver string sin parsear.
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
      companyCosts: preview.companyCosts,
      companyNames: preview.companyNames,
      lines: preview.lines,
      details: preview.details,
      warnings: preview.warnings,
      distributions: preview.lines.map((line) => ({
        ruleId: line.ruleId,
        fromCompany: line.fromCompany,
        toCompany: line.toCompany,
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
