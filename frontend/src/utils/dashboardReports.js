import { formatQ, CUOTA_PATRONAL_RATE } from '../data/mockData';

export const PERIOD_MODES = {
  LATEST: 'latest',
  MONTH: 'month',
  PAYROLL: 'payroll',
  ALL: 'all',
  SNAPSHOT: 'snapshot',
};

export const getPayrollDate = (record) => new Date(record?.closedAt || record?.createdAt || 0);

export const parseEmployeeList = (record) => {
  let list = record?.data || record?.employees || [];
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { list = []; }
  }
  return Array.isArray(list) ? list : [];
};

export const computeEmployeePayroll = (e) => {
  const baseFactor = (e.days || 30) / 30;
  const sueldoOrd = Number(e.sueldo_ordinario) || 0;
  const bonInc = Number(e.bon_incentivo) || 0;
  const bonDec = Number(e.bon_dec_37_2001) || 0;

  const baseSalary = sueldoOrd * baseFactor;
  const bonusLey = bonInc * baseFactor;
  const bonusDec = bonDec * baseFactor;
  const bonos = Number(e.extras?.bonos) || 0;
  const extrasTotal = (e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0)
    + (e.extras?.comisiones || 0) + (e.extras?.otrosIngresos || 0);
  const bonusesSum = Object.values(e.appliedBonuses || {}).reduce((a, b) => a + Number(b), 0);
  const gross = baseSalary + bonusLey + bonusDec + bonos + extrasTotal + bonusesSum;
  const ded = Object.values(e.deductions || {}).reduce((a, b) => a + Number(b), 0);

  return { baseSalary, bonusLey, bonusDec, bonos, extrasTotal, bonusesSum, gross, ded, net: gross - ded };
};

export const computeHistoryTotals = (record) => {
  const list = parseEmployeeList(record);
  let grossTotal = 0;
  let dedTotal = 0;

  list.forEach(e => {
    const calc = computeEmployeePayroll(e);
    grossTotal += calc.gross;
    dedTotal += calc.ded;
  });

  return { grossTotal, dedTotal, netTotal: grossTotal - dedTotal, employeeCount: list.length };
};

export const filterPayrollByPeriod = (payrollHistory, period) => {
  const history = payrollHistory || [];
  if (!history.length) return [];

  const sorted = [...history].sort((a, b) => getPayrollDate(b) - getPayrollDate(a));

  switch (period.mode) {
    case PERIOD_MODES.LATEST:
      return [sorted[0]];
    case PERIOD_MODES.ALL:
      return sorted;
    case PERIOD_MODES.MONTH: {
      if (!period.month) return [];
      const [year, month] = period.month.split('-').map(Number);
      return sorted.filter(r => {
        const d = getPayrollDate(r);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });
    }
    case PERIOD_MODES.PAYROLL:
      return sorted.filter(r => String(r.id) === String(period.payrollId));
    default:
      return [];
  }
};

export const aggregatePayrollRecords = (records) => {
  const allEmployees = [];
  let grossTotal = 0;
  let dedTotal = 0;

  records.forEach(r => {
    const totals = computeHistoryTotals(r);
    grossTotal += totals.grossTotal;
    dedTotal += totals.dedTotal;
    parseEmployeeList(r).forEach(e => allEmployees.push(e));
  });

  return {
    grossTotal,
    dedTotal,
    netTotal: grossTotal - dedTotal,
    employeeCount: allEmployees.length,
    employees: allEmployees,
    payrollCount: records.length,
  };
};

export const getBasePay = (e) => (Number(e.sueldo_ordinario) || 0) + (Number(e.bon_incentivo) || 0);

export const parseDist = (dist) => {
  if (!dist) return {};
  if (typeof dist === 'string') {
    try { return JSON.parse(dist); } catch { return {}; }
  }
  return dist;
};

export const getEmployeeName = (e) => {
  const first = e.primer_nombre || e.nombres || '';
  const last = e.primer_apellido || e.apellidos || '';
  return `${first} ${last}`.trim() || e.name || 'Empleado';
};

export const buildCompanyDistribution = (employees, companies, usePayrollGross = false) => {
  // Siempre mostrar todas las empresas registradas, aunque el período no tenga movimiento
  const baseCompanies = (companies || []).length
    ? companies
    : [...new Set(employees.map(e => e.empresa_principal || e.companyId).filter(Boolean))]
        .map(id => ({ id, nombre_comercial: `Empresa ${id}` }));

  return baseCompanies.map(c => {
    const companyId = c.id?.toString();
    const total = employees.reduce((s, e) => {
      const amount = usePayrollGross ? computeEmployeePayroll(e).gross : getBasePay(e);

      if (usePayrollGross) {
        const dist = parseDist(e.dist);
        const distValue = dist?.[companyId] ?? dist?.[c.id] ?? 0;
        const pct = Number(distValue) || 0;
        if (pct > 0) return s + (amount * (pct / 100));

        const primaryId = (e.empresa_principal || e.companyId || '').toString();
        return companyId && primaryId === companyId ? s + amount : s;
      }

      const base = amount;
      const dist = parseDist(e.dist);
      const distValue = dist?.[companyId] ?? dist?.[c.id] ?? 0;
      const pct = Number(distValue) || 0;
      if (pct > 0) return s + (base * (pct / 100));

      const primaryId = (e.empresa_principal || e.companyId || '').toString();
      return companyId && primaryId === companyId ? s + base : s;
    }, 0);
    return { ...c, total };
  }).sort((a, b) => b.total - a.total);
};

export const buildDeptDistribution = (employees, deptNameById, usePayrollGross = false) => {
  const groups = {};
  employees.forEach(e => {
    // departmentId es el campo actual; departamento_laboral queda como fallback de datos legacy
    const deptKey = e.departmentId || e.departamento_laboral || 'Sin Depto';
    const label = deptNameById[String(deptKey)] || (deptKey === 'Sin Depto' ? deptKey : String(deptKey));
    if (!groups[label]) groups[label] = { count: 0, cost: 0 };
    groups[label].count++;
    groups[label].cost += usePayrollGross ? computeEmployeePayroll(e).gross : getBasePay(e);
  });
  return Object.entries(groups).sort((a, b) => b[1].cost - a[1].cost);
};

export const getPeriodLabel = (period, payrollHistory) => {
  switch (period.mode) {
    case PERIOD_MODES.LATEST: {
      const sorted = [...(payrollHistory || [])].sort((a, b) => getPayrollDate(b) - getPayrollDate(a));
      const latest = sorted[0];
      return latest
        ? `Última nómina: ${latest.title || (latest.periodType === '2da' ? '2da Quincena' : '1ra Quincena')}`
        : 'Sin nóminas — datos actuales';
    }
    case PERIOD_MODES.MONTH: {
      if (!period.month) return 'Mes no seleccionado';
      const [y, m] = period.month.split('-');
      const date = new Date(Number(y), Number(m) - 1, 1);
      const label = date.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
      return `Mes: ${label.charAt(0).toUpperCase() + label.slice(1)}`;
    }
    case PERIOD_MODES.PAYROLL: {
      const record = (payrollHistory || []).find(r => String(r.id) === String(period.payrollId));
      return record ? `Nómina: ${record.title || record.id}` : 'Nómina seleccionada';
    }
    case PERIOD_MODES.ALL:
      return 'Todo el historial de nóminas';
    case PERIOD_MODES.SNAPSHOT:
      return 'Datos actuales de empleados';
    default:
      return 'Período';
  }
};

export const getAvailableMonths = (payrollHistory) => {
  const months = new Set();
  (payrollHistory || []).forEach(r => {
    const d = getPayrollDate(r);
    if (!Number.isNaN(d.getTime())) {
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  });
  return [...months].sort((a, b) => b.localeCompare(a));
};

export const buildDashboardMetrics = ({
  period,
  payrollHistory,
  employees,
  companies,
  departments,
}) => {
  const isActive = (e) => {
    const status = (e.estado || e.status || '').toString().toLowerCase();
    return status === 'activo' || status === 'active';
  };

  const deptNameById = {};
  (departments || []).forEach(d => {
    deptNameById[String(d.id)] = d.nombre_dimension || d.nombre || d.name || d.codigo || String(d.id);
  });

  const activeEmployees = (employees || []).filter(isActive);
  const filteredRecords = period.mode === PERIOD_MODES.SNAPSHOT
    ? []
    : filterPayrollByPeriod(payrollHistory, period);

  const hasPayrollData = filteredRecords.length > 0;
  const aggregated = hasPayrollData ? aggregatePayrollRecords(filteredRecords) : null;

  const totalEmployees = employees?.length || 0;
  const activeCount = activeEmployees.length;

  const totalGrossPayroll = aggregated?.grossTotal
    ?? activeEmployees.reduce((s, e) => s + getBasePay(e), 0);
  const totalDeductions = aggregated?.dedTotal
    ?? activeEmployees.reduce((s, e) => s + (Number(e.total_igss) || 0) + (Number(e.isr) || 0), 0);
  const totalNetPay = aggregated?.netTotal ?? (totalGrossPayroll - totalDeductions);

  const sourceEmployees = hasPayrollData ? aggregated.employees : activeEmployees;
  const usePayrollGross = hasPayrollData;

  const companyDistribution = buildCompanyDistribution(sourceEmployees, companies, usePayrollGross);
  const deptList = buildDeptDistribution(sourceEmployees, deptNameById, usePayrollGross);

  const avgSalary = hasPayrollData
    ? (aggregated.employeeCount > 0 ? totalGrossPayroll / aggregated.employeeCount : 0)
    : (activeCount > 0 ? activeEmployees.reduce((s, e) => s + getBasePay(e), 0) / activeCount : 0);

  const patronalCost = totalGrossPayroll * CUOTA_PATRONAL_RATE;

  return {
    periodLabel: getPeriodLabel(period, payrollHistory),
    hasPayrollData,
    payrollCount: aggregated?.payrollCount || 0,
    totalEmployees,
    activeCount,
    inactiveCount: totalEmployees - activeCount,
    totalGrossPayroll,
    totalDeductions,
    totalNetPay,
    avgSalary,
    patronalCost,
    companyDistribution,
    deptList,
    sourceEmployees,
    filteredRecords,
    deptNameById,
  };
};

export const exportDashboardExcel = async (metrics, periodLabel) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const resumen = [
    { Concepto: 'Período', Valor: periodLabel },
    { Concepto: 'Nóminas incluidas', Valor: metrics.payrollCount || (metrics.hasPayrollData ? metrics.filteredRecords?.length : 0) },
    { Concepto: 'Total empleados (sistema)', Valor: metrics.totalEmployees },
    { Concepto: 'Empleados activos', Valor: metrics.activeCount },
    { Concepto: 'Empleados inactivos', Valor: metrics.inactiveCount },
    { Concepto: 'Costo bruto nómina', Valor: metrics.totalGrossPayroll },
    { Concepto: 'Total deducciones', Valor: metrics.totalDeductions },
    { Concepto: 'Neto a pagar', Valor: metrics.totalNetPay },
    { Concepto: 'Salario promedio', Valor: metrics.avgSalary },
    { Concepto: 'Costo patronal estimado', Valor: metrics.patronalCost },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Resumen');

  const empresas = metrics.companyDistribution.map(c => ({
    Empresa: c.nombre_comercial || c.nit || `Empresa ${c.id}`,
    NIT: c.nit || '',
    Monto: c.total,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empresas.length ? empresas : [{ Empresa: 'Sin datos', NIT: '', Monto: 0 }]), 'Por Empresa');

  const deptos = metrics.deptList.map(([dept, data]) => ({
    Departamento: dept,
    Empleados: data.count,
    Costo: data.cost,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deptos.length ? deptos : [{ Departamento: 'Sin datos', Empleados: 0, Costo: 0 }]), 'Por Departamento');

  if (metrics.hasPayrollData && metrics.sourceEmployees?.length) {
    const detalle = metrics.sourceEmployees.map((e, idx) => {
      const calc = computeEmployeePayroll(e);
      return {
        'No.': idx + 1,
        Nombre: getEmployeeName(e),
        Puesto: e.puesto || '',
        Días: e.days || 30,
        'Salario Ordinario': calc.baseSalary,
        'Bono Incentivo': calc.bonusLey,
        'Total Devengado': calc.gross,
        Deducciones: calc.ded,
        'Líquido a Recibir': calc.net,
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle), 'Detalle Nómina');
  }

  const safeName = periodLabel.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
  XLSX.writeFile(wb, `Reporte_Dashboard_${safeName}.xlsx`);
};

export const buildReportHtml = (metrics, periodLabel) => {
  const companyRows = metrics.companyDistribution.map(c => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${c.nombre_comercial || c.nit || ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;">${formatQ(c.total)}</td>
    </tr>
  `).join('');

  const deptRows = metrics.deptList.slice(0, 10).map(([dept, data]) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${dept}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${data.count}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;">${formatQ(data.cost)}</td>
    </tr>
  `).join('');

  const issueDate = new Date().toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });

  return `
    <div style="width:794px;background:#fff;color:#1a1a1a;font-family:'Segoe UI',Arial,sans-serif;padding:48px 56px;box-sizing:border-box;">
      <div style="border-bottom:2px solid #1e3a5f;padding-bottom:16px;margin-bottom:24px;">
        <div style="font-size:20px;font-weight:700;color:#1e3a5f;">Reporte Ejecutivo de Nómina</div>
        <div style="font-size:12px;color:#666;margin-top:4px;">${periodLabel}</div>
        <div style="font-size:11px;color:#888;margin-top:2px;">Generado el ${issueDate}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:28px;">
        ${[
          ['Costo bruto', formatQ(metrics.totalGrossPayroll)],
          ['Neto a pagar', formatQ(metrics.totalNetPay)],
          ['Deducciones', formatQ(metrics.totalDeductions)],
          ['Salario promedio', formatQ(metrics.avgSalary)],
          ['Empleados activos', metrics.activeCount],
          ['Costo patronal est.', formatQ(metrics.patronalCost)],
        ].map(([label, val]) => `
          <div style="border:1px solid #e2e8f0;border-radius:6px;padding:12px 16px;">
            <div style="font-size:10px;color:#888;text-transform:uppercase;">${label}</div>
            <div style="font-size:16px;font-weight:700;color:#1e3a5f;margin-top:4px;">${val}</div>
          </div>
        `).join('')}
      </div>

      <div style="margin-bottom:24px;">
        <div style="font-size:12px;font-weight:700;color:#1e3a5f;text-transform:uppercase;margin-bottom:8px;">Distribución por empresa</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
          <thead><tr style="background:#f0f4f8;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;">Empresa</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;">Monto</th>
          </tr></thead>
          <tbody>${companyRows || '<tr><td colspan="2" style="padding:12px;">Sin datos</td></tr>'}</tbody>
        </table>
      </div>

      <div>
        <div style="font-size:12px;font-weight:700;color:#1e3a5f;text-transform:uppercase;margin-bottom:8px;">Costo por departamento</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
          <thead><tr style="background:#f0f4f8;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;">Departamento</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;">Empleados</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;">Costo</th>
          </tr></thead>
          <tbody>${deptRows || '<tr><td colspan="3" style="padding:12px;">Sin datos</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;
};

export const exportDashboardPdf = async (metrics, periodLabel) => {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.innerHTML = buildReportHtml(metrics, periodLabel);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container.firstElementChild, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);

    const safeName = periodLabel.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
    pdf.save(`Reporte_Dashboard_${safeName}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
};
