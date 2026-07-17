const { calculatePayrollBatch } = require('./payrollCalculator.service');

const parseJsonField = (raw) => {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const parsePayrollSummary = (raw) => {
  const parsed = parseJsonField(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  return {
    employeesCount: Number(parsed.employeesCount) || 0,
    grossTotal: Number(parsed.grossTotal) || 0,
    netTotal: Number(parsed.netTotal) || 0,
    companies: Array.isArray(parsed.companies) ? parsed.companies : []
  };
};

const parsePayrollEmployees = (raw) => {
  let emps = raw;
  if (typeof emps === 'string') {
    try { emps = JSON.parse(emps); } catch { emps = []; }
  }
  return Array.isArray(emps) ? emps : [];
};

const getNetPayableServer = (emp, periodType) => {
  const net = Number(emp?.calculated?.net ?? emp?.netTotal ?? 0);
  if (periodType === '2da') {
    if (emp?.calculated?.netPayable != null) return Number(emp.calculated.netPayable);
    const anticipo = Number(emp?.anticipo1ra ?? emp?.calculated?.anticipo1ra ?? 0);
    return net - anticipo;
  }
  return net;
};

const inferCompanies = (payrollObj, emps) => {
  const set = new Set();
  let comps = payrollObj.companies;
  if (typeof comps === 'string') {
    try { comps = JSON.parse(comps); } catch { comps = []; }
  }
  (Array.isArray(comps) ? comps : []).forEach((c) => {
    if (c != null && String(c).trim()) set.add(String(c).trim());
  });

  emps.forEach((e) => {
    if (e?.company) set.add(String(e.company).trim());
  });

  if (set.size === 0 && payrollObj.title) {
    const title = String(payrollObj.title);
    const patterns = [
      /Nómina E2E\s+(.+?)\s+\d/i,
      /Nómina E2E\s+(.+?)(?:\s+Re-auditoría|\s+Auditoría|\s+cerrada|$)/i,
      /Nómina\s+(.+?)\s+\d/i
    ];
    for (const re of patterns) {
      const m = title.match(re);
      if (m?.[1]) {
        set.add(m[1].trim());
        break;
      }
    }
  }

  return Array.from(set);
};

const buildPayrollSummary = (emps, periodType, companies) => {
  let grossTotal = 0;
  let netTotal = 0;
  const companySet = new Set(companies || []);

  emps.forEach((e) => {
    if (e?.company) companySet.add(String(e.company).trim());

    if (e?.calculated?.gross != null) {
      grossTotal += Number(e.calculated.gross) || 0;
      netTotal += getNetPayableServer(e, periodType);
      return;
    }
    const baseFactor = (e.days || 30) / 30;
    const sueldoOrd = Number(e.sueldo_ordinario) || 0;
    const bonInc = Number(e.bon_incentivo) || 0;
    const bonDec = Number(e.bon_dec_37_2001) || 0;
    const bonos = Number(e.extras?.bonos) || 0;
    const bonusesSum = Object.values(e.appliedBonuses || {}).reduce((a, b) => a + Number(b), 0);
    const extrasTotal = (Number(e.extras?.simplesVal) || 0) + (Number(e.extras?.doblesVal) || 0)
      + (Number(e.extras?.comisiones) || 0) + (Number(e.extras?.otrosIngresos) || 0);
    const gross = (sueldoOrd * baseFactor) + (bonInc * baseFactor) + (bonDec * baseFactor)
      + bonos + extrasTotal + bonusesSum;
    const ded = Object.values(e.deductions || {}).reduce((a, b) => a + Number(b), 0);
    grossTotal += gross;
    netTotal += getNetPayableServer(
      { ...e, calculated: { gross, ded, net: gross - ded } },
      periodType
    );
  });

  return {
    employeesCount: emps.length,
    grossTotal: Math.round(grossTotal * 100) / 100,
    netTotal: Math.round(netTotal * 100) / 100,
    companies: Array.from(companySet)
  };
};

const computePayrollSummary = (payrollObj) => {
  let emps = parsePayrollEmployees(payrollObj.data);
  if (emps.length > 0 && !emps.every((e) => e && e.calculated)) {
    emps = calculatePayrollBatch(emps, payrollObj.periodType);
  }
  const companies = inferCompanies(payrollObj, emps);
  return buildPayrollSummary(emps, payrollObj.periodType || '1ra', companies);
};

async function backfillPayrollSummaries(PayrollHistory) {
  const rows = await PayrollHistory.findAll({
    where: {},
    attributes: ['id', 'title', 'periodType', 'data', 'summary']
  });

  let updated = 0;
  for (const row of rows) {
    const obj = row.toJSON();
    const existing = parsePayrollSummary(obj.summary);
    if (existing && existing.employeesCount > 0) continue;

    const summary = computePayrollSummary(obj);
    if (!summary.employeesCount) continue;

    await PayrollHistory.update({ summary }, { where: { id: obj.id } });
    updated += 1;
  }

  if (updated > 0) {
    console.log(`[payroll] Summary backfill: ${updated} nómina(s) actualizadas.`);
  }
  return updated;
}

module.exports = {
  parseJsonField,
  parsePayrollSummary,
  parsePayrollEmployees,
  inferCompanies,
  buildPayrollSummary,
  computePayrollSummary,
  backfillPayrollSummaries
};
