const { Op } = require('sequelize');
const {
  Company,
  Department,
  Employee,
  PayrollDraft,
  PayrollHistory
} = require('../models');
const {
  computePayrollSummary,
  parsePayrollEmployees,
  parsePayrollSummary
} = require('../services/payrollSummary.service');

const FINANCIAL_ROLES = new Set(['ADMIN', 'GERENTE GENERAL', 'NOMINA', 'AUDITOR']);
const PERIOD_MODES = new Set(['latest', 'month', 'payroll', 'all', 'snapshot']);

const payrollDate = (record) => {
  const date = new Date(record?.createdAt || record?.closedAt || 0);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
};

const normalizeSummary = (record) => {
  const stored = parsePayrollSummary(record.summary);
  return stored?.version >= 2 ? stored : computePayrollSummary(record);
};

const companyKeys = (record) => {
  const stored = parsePayrollSummary(record.summary);
  const summary = stored?.companies?.length ? stored : normalizeSummary(record);
  return new Set((summary.companies || []).map((value) => String(value)));
};

const overlapsCompany = (left, right) => {
  const leftKeys = companyKeys(left);
  const rightKeys = companyKeys(right);
  return leftKeys.size > 0 && [...leftKeys].some((key) => rightKeys.has(key));
};

const withoutOverlappingFirstQuincena = (records) => records.filter((record) => {
  if (record.periodType !== '1ra') return true;
  const date = payrollDate(record);
  return !records.some((candidate) => {
    if (candidate.periodType !== '2da' || candidate.status !== 'cerrada') return false;
    const candidateDate = payrollDate(candidate);
    return candidateDate.getFullYear() === date.getFullYear()
      && candidateDate.getMonth() === date.getMonth()
      && overlapsCompany(record, candidate);
  });
});

const selectRecords = (history, query) => {
  const mode = PERIOD_MODES.has(query.mode) ? query.mode : 'latest';
  const sorted = history
    .filter((record) => !record.status || record.status === 'cerrada')
    .sort((left, right) => payrollDate(right) - payrollDate(left));
  if (mode === 'snapshot') return [];
  if (mode === 'latest') return sorted.slice(0, 1);
  if (mode === 'payroll') {
    return sorted.filter((record) => String(record.id) === String(query.payrollId || ''));
  }
  if (mode === 'month') {
    const match = /^(\d{4})-(\d{2})$/.exec(String(query.month || ''));
    if (!match) return [];
    const year = Number(match[1]);
    const month = Number(match[2]);
    return sorted.filter((record) => {
      const date = payrollDate(record);
      return date.getFullYear() === year && date.getMonth() + 1 === month;
    });
  }
  return sorted;
};

const periodLabel = (query, selected, history) => {
  const mode = PERIOD_MODES.has(query.mode) ? query.mode : 'latest';
  if (mode === 'snapshot') return 'Datos actuales de empleados';
  if (mode === 'all') return 'Todo el historial de nóminas';
  if (mode === 'month') {
    const match = /^(\d{4})-(\d{2})$/.exec(String(query.month || ''));
    if (!match) return 'Mes no seleccionado';
    const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
    const label = date.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
    return `Mes: ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
  }
  if (mode === 'payroll') {
    const record = selected[0];
    return record ? `Nómina: ${record.title || record.id}` : 'Nómina seleccionada';
  }
  const latest = selected[0] || history[0];
  return latest
    ? `Última nómina: ${latest.title || (latest.periodType === '2da' ? '2da Quincena' : '1ra Quincena')}`
    : 'Sin nóminas — datos actuales';
};

const addDistribution = (target, key, values) => {
  (values || []).forEach((row) => {
    const id = String(row[key] ?? '');
    if (!id) return;
    const current = target.get(id) || { count: 0, cost: 0, total: 0 };
    current.count += Number(row.count) || 0;
    current.cost += Number(row.cost) || 0;
    current.total += Number(row.total) || 0;
    target.set(id, current);
  });
};

const loadHistoryForSummary = async () => {
  const rows = await PayrollHistory.findAll({
    where: { status: 'cerrada' },
    attributes: ['id', 'title', 'periodType', 'status', 'closedAt', 'createdAt', 'summary'],
    order: [['createdAt', 'DESC']]
  });
  const history = rows.map((row) => row.toJSON());
  const missingIds = history
    .filter((record) => (parsePayrollSummary(record.summary)?.version || 0) < 2)
    .map((record) => record.id);
  if (missingIds.length === 0) return history;
  const detailRows = await PayrollHistory.findAll({
    where: { id: { [Op.in]: missingIds } },
    attributes: ['id', 'data']
  });
  const dataById = new Map(detailRows.map((row) => [
    String(row.id),
    row.data
  ]));
  return history.map((record) => ({
    ...record,
    data: dataById.get(String(record.id))
  }));
};

const buildSnapshotMetrics = async () => {
  const activeEmployees = await Employee.findAll({
    where: { estado: { [Op.in]: ['Activo', 'activo', 'ACTIVE', 'active'] } },
    attributes: [
      'id', 'empresa_principal', 'companyId', 'departmentId',
      'sueldo_ordinario', 'bon_incentivo', 'total_igss', 'isr', 'dist'
    ],
    raw: true
  });
  const companyDistribution = new Map();
  const departmentDistribution = new Map();
  let gross = 0;
  let deductions = 0;
  activeEmployees.forEach((employee) => {
    const base = (Number(employee.sueldo_ordinario) || 0)
      + (Number(employee.bon_incentivo) || 0);
    gross += base;
    deductions += (Number(employee.total_igss) || 0) + (Number(employee.isr) || 0);
    let distribution = employee.dist;
    if (typeof distribution === 'string') {
      try { distribution = JSON.parse(distribution); } catch { distribution = null; }
    }
    const hasDistribution = distribution && Object.values(distribution)
      .some((value) => (Number(value) || 0) > 0);
    const effective = hasDistribution
      ? distribution
      : { [employee.empresa_principal || employee.companyId]: 100 };
    Object.entries(effective).forEach(([companyId, percentage]) => {
      const current = companyDistribution.get(String(companyId)) || { total: 0 };
      current.total += base * ((Number(percentage) || 0) / 100);
      companyDistribution.set(String(companyId), current);
    });
    const departmentId = String(employee.departmentId || 'sin-departamento');
    const department = departmentDistribution.get(departmentId) || { count: 0, cost: 0 };
    department.count += 1;
    department.cost += base;
    departmentDistribution.set(departmentId, department);
  });
  return {
    activeEmployees,
    gross,
    deductions,
    net: gross - deductions,
    patronal: 0,
    companyDistribution,
    departmentDistribution
  };
};

const getDashboardSummary = async (req, res) => {
  try {
    const [
      historyRows,
      companies,
      departments,
      employeeCounts,
      activeCount,
      recentEmployees,
      recentDrafts
    ] = await Promise.all([
      loadHistoryForSummary(),
      Company.findAll({
        attributes: ['id', 'nit', 'nombre_comercial', 'razon_social', 'color', 'gradient'],
        raw: true
      }),
      Department.findAll({ attributes: ['id', 'nombre_dimension'], raw: true }),
      Employee.count(),
      Employee.count({ where: { estado: { [Op.in]: ['Activo', 'activo', 'ACTIVE', 'active'] } } }),
      Employee.findAll({
        where: {
          [Op.or]: [
            { fecha_inicio: { [Op.ne]: null } },
            { fecha_baja: { [Op.ne]: null } }
          ]
        },
        attributes: ['id', 'primer_nombre', 'primer_apellido', 'fecha_inicio', 'fecha_baja'],
        order: [['fecha_inicio', 'DESC']],
        limit: 5,
        raw: true
      }),
      PayrollDraft.findAll({
        attributes: ['id', 'title', 'createdAt'],
        order: [['createdAt', 'DESC']],
        limit: 2,
        raw: true
      })
    ]);

    const history = historyRows;
    const selected = selectRecords(history, req.query);
    const effectiveRecords = withoutOverlappingFirstQuincena(selected);
    const snapshot = effectiveRecords.length === 0 ? await buildSnapshotMetrics() : null;
    const companyDistribution = snapshot?.companyDistribution || new Map();
    const departmentDistribution = snapshot?.departmentDistribution || new Map();
    let gross = snapshot?.gross || 0;
    let deductions = snapshot?.deductions || 0;
    let net = snapshot?.net || 0;
    let patronal = snapshot?.patronal || 0;
    let payrollEmployees = 0;

    if (!snapshot) {
      effectiveRecords.forEach((record) => {
        const summary = normalizeSummary(record);
        payrollEmployees += Number(summary.employeesCount) || 0;
        gross += Number(summary.grossTotal) || 0;
        deductions += Number(summary.deductionsTotal) || 0;
        net += Number(summary.netTotal) || 0;
        patronal += Number(summary.patronalTotal) || 0;
        addDistribution(companyDistribution, 'companyId', summary.companyDistribution);
        addDistribution(departmentDistribution, 'departmentId', summary.departmentDistribution);
      });
    }

    const companyMap = new Map(companies.map((company) => [String(company.id), company]));
    const departmentMap = new Map(departments.map((department) => [
      String(department.id),
      department.nombre_dimension || String(department.id)
    ]));
    const hasFinancialAccess = FINANCIAL_ROLES.has(
      String(req.user?.role || '').trim().toUpperCase()
    );
    const filteredRecords = effectiveRecords.map((record) => {
      const summary = normalizeSummary(record);
      return {
        id: record.id,
        title: record.title,
        periodType: record.periodType,
        createdAt: record.createdAt,
        closedAt: record.closedAt,
        ...(hasFinancialAccess ? {
          totals: {
            grossTotal: summary.grossTotal,
            dedTotal: summary.deductionsTotal,
            netTotal: summary.netTotal
          }
        } : {})
      };
    });
    const response = {
      periodLabel: periodLabel(req.query, selected, history),
      hasPayrollData: effectiveRecords.length > 0,
      payrollCount: effectiveRecords.length,
      totalEmployees: employeeCounts,
      activeCount,
      inactiveCount: employeeCounts - activeCount,
      companyCount: companies.length,
      companyDistribution: hasFinancialAccess ? [...companyDistribution.entries()]
        .map(([id, value]) => ({
          ...(companyMap.get(id) || { id, nombre_comercial: `Empresa ${id}` }),
          total: Math.round((Number(value.total) || 0) * 100) / 100
        }))
        .sort((left, right) => right.total - left.total) : [],
      deptList: hasFinancialAccess ? [...departmentDistribution.entries()]
        .map(([id, value]) => [
          departmentMap.get(id) || (id === 'sin-departamento' ? 'Sin Depto' : id),
          {
            count: Number(value.count) || 0,
            cost: Math.round((Number(value.cost) || 0) * 100) / 100
          }
        ])
        .sort((left, right) => right[1].cost - left[1].cost) : [],
      filteredRecords,
      availableMonths: [...new Set(history.map((record) => {
        const date = payrollDate(record);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }))].sort((left, right) => right.localeCompare(left)),
      payrollOptions: history.map((record) => ({
        id: record.id,
        label: `${record.title || 'Nómina'} — ${payrollDate(record).toLocaleDateString('es-GT')}`
      })),
      recentActivity: [
        ...history.slice(0, 2).map((record) => ({
          type: record.status === 'auditoria' ? 'audit' : 'closed',
          text: `Nómina "${record.title || 'Nómina'}" cerrada`,
          date: record.closedAt || record.createdAt
        })),
        ...recentDrafts.map((draft) => ({
          type: 'draft',
          text: `Borrador activo: ${draft.title || 'Nómina en proceso'}`,
          date: draft.createdAt
        })),
        ...recentEmployees.flatMap((employee) => {
          const name = `${employee.primer_nombre || ''} ${employee.primer_apellido || ''}`.trim() || 'Empleado';
          const rows = [];
          if (employee.fecha_inicio) rows.push({
            type: 'employee-added',
            text: `Alta de ${name}`,
            date: employee.fecha_inicio
          });
          if (employee.fecha_baja) rows.push({
            type: 'employee-removed',
            text: `Baja de ${name}`,
            date: employee.fecha_baja
          });
          return rows;
        })
      ].sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0)).slice(0, 4)
    };

    if (hasFinancialAccess) {
      response.totalGrossPayroll = gross;
      response.totalDeductions = deductions;
      response.totalNetPay = net;
      response.avgSalary = (payrollEmployees || activeCount) > 0
        ? gross / (payrollEmployees || activeCount)
        : 0;
      response.patronalCost = patronal;
    }
    res.set('Cache-Control', 'private, no-store');
    return res.json(response);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getDashboardExportData = async (req, res) => {
  if (!FINANCIAL_ROLES.has(String(req.user?.role || '').trim().toUpperCase())) {
    return res.status(403).json({ error: 'No tiene permiso para exportar datos financieros.' });
  }
  try {
    const rows = await PayrollHistory.findAll({
      where: { status: 'cerrada' },
      attributes: ['id', 'title', 'periodType', 'status', 'closedAt', 'createdAt', 'summary'],
      order: [['createdAt', 'DESC']]
    });
    const history = rows.map((row) => row.toJSON());
    const selected = withoutOverlappingFirstQuincena(selectRecords(history, req.query));
    const detailRows = selected.length
      ? await PayrollHistory.findAll({
          where: { id: { [Op.in]: selected.map((record) => record.id) } },
          attributes: ['id', 'periodType', 'data']
        })
      : [];
    const sourceEmployees = detailRows.flatMap((row) => (
      parsePayrollEmployees(row.data).map((employee) => ({
        ...employee,
        periodType: row.periodType || employee.periodType
      }))
    ));
    res.set('Cache-Control', 'no-store');
    return res.json({ sourceEmployees });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = { getDashboardSummary, getDashboardExportData };
