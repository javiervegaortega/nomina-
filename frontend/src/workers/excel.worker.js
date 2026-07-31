import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { buildBillingWorkbook } from '../utils/billingExport';
import { buildNominaGeneralWorkbook } from '../utils/nominaGeneralExport';
import { buildSolicitudChequesWorkbook } from '../utils/solicitudChequesExcel';
import { buildVerificadorWorkbook } from '../utils/verificadorExcel';
import {
  buildLibroSalariosRows,
  buildVerificadorRows
} from '../utils/payrollReports';
import {
  computeEmployeePayroll,
  getEmployeeName
} from '../utils/dashboardReports';

const workbookToBuffer = async (workbook) => {
  const value = await workbook.xlsx.writeBuffer();
  if (value instanceof ArrayBuffer) return value;
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
};

const buildPayrollReport = (payload) => {
  const rows = payload.type === 'verificador'
    ? buildVerificadorRows(payload.employees, payload.periodType, payload.companies)
    : buildLibroSalariosRows(payload.employees, payload.periodType);
  const sheetName = payload.type === 'verificador' ? 'Verificador' : 'Libro Salarios';
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
  if (payload.isDraft) {
    const meta = XLSX.utils.aoa_to_sheet([
      ['PRELIMINAR / BORRADOR'],
      ['Nómina', payload.title || ''],
      ['Periodo', payload.periodType || ''],
      ['Generado', new Date().toLocaleString('es-GT')],
      ['Aviso', 'Este reporte no proviene de una nómina cerrada.']
    ]);
    XLSX.utils.book_append_sheet(workbook, meta, 'Aviso');
  }
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
};

const buildDashboardReport = (payload) => {
  const { metrics, periodLabel } = payload;
  const workbook = XLSX.utils.book_new();
  const summary = [
    { Concepto: 'Período', Valor: periodLabel },
    { Concepto: 'Nóminas incluidas', Valor: metrics.payrollCount || 0 },
    { Concepto: 'Total empleados (sistema)', Valor: metrics.totalEmployees },
    { Concepto: 'Empleados activos', Valor: metrics.activeCount },
    { Concepto: 'Empleados inactivos', Valor: metrics.inactiveCount },
    { Concepto: 'Costo bruto nómina', Valor: metrics.totalGrossPayroll },
    { Concepto: 'Total deducciones', Valor: metrics.totalDeductions },
    { Concepto: 'Neto a pagar', Valor: metrics.totalNetPay },
    { Concepto: 'Salario promedio', Valor: metrics.avgSalary },
    { Concepto: 'Costo patronal estimado', Valor: metrics.patronalCost }
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), 'Resumen');
  const companies = (metrics.companyDistribution || []).map((company) => ({
    Empresa: company.nombre_comercial || company.nit || `Empresa ${company.id}`,
    NIT: company.nit || '',
    Monto: company.total
  }));
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(companies.length ? companies : [{ Empresa: 'Sin datos', NIT: '', Monto: 0 }]),
    'Por Empresa'
  );
  const departments = (metrics.deptList || []).map(([department, data]) => ({
    Departamento: department,
    Empleados: data.count,
    Costo: data.cost
  }));
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(departments.length
      ? departments
      : [{ Departamento: 'Sin datos', Empleados: 0, Costo: 0 }]),
    'Por Departamento'
  );
  if (metrics.hasPayrollData && metrics.sourceEmployees?.length) {
    const detail = metrics.sourceEmployees.map((employee, index) => {
      const calculation = computeEmployeePayroll(employee);
      return {
        'No.': index + 1,
        Nombre: getEmployeeName(employee),
        Puesto: employee.puesto || '',
        Días: employee.days ?? 30,
        'Salario Ordinario': calculation.baseSalary,
        'Bono Incentivo': calculation.bonusLey,
        'Total Devengado': calculation.gross,
        Deducciones: calculation.ded,
        'Líquido a Recibir': calculation.netPayable
      };
    });
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detail), 'Detalle Nómina');
  }
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
};

self.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
});

self.onmessage = async ({ data }) => {
  const { id, type, payload } = data;
  try {
    let buffer;
    if (type === 'billing') {
      buffer = await workbookToBuffer(buildBillingWorkbook(payload, ExcelJS));
    } else if (type === 'nomina-general') {
      buffer = await workbookToBuffer(buildNominaGeneralWorkbook(payload, ExcelJS));
    } else if (type === 'solicitud-cheques') {
      buffer = await workbookToBuffer(buildSolicitudChequesWorkbook(payload, ExcelJS));
    } else if (type === 'verificador') {
      buffer = await workbookToBuffer(buildVerificadorWorkbook(payload, ExcelJS));
    } else if (type === 'payroll-report') {
      buffer = buildPayrollReport(payload);
    } else if (type === 'dashboard') {
      buffer = buildDashboardReport(payload);
    } else if (type === 'json-report') {
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(payload.rows || []);
      if (Array.isArray(payload.columnWidths)) {
        sheet['!cols'] = payload.columnWidths.map((width) => ({ wch: width }));
      }
      XLSX.utils.book_append_sheet(
        workbook,
        sheet,
        String(payload.sheetName || 'Reporte').slice(0, 31)
      );
      buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    } else if (type === 'workbook-report') {
      const workbook = XLSX.utils.book_new();
      (payload.sheets || []).forEach((source, index) => {
        const sheet = source.mode === 'aoa'
          ? XLSX.utils.aoa_to_sheet(source.rows || [])
          : XLSX.utils.json_to_sheet(source.rows || []);
        if (Array.isArray(source.columnWidths)) {
          sheet['!cols'] = source.columnWidths.map((width) => ({ wch: width }));
        }
        XLSX.utils.book_append_sheet(
          workbook,
          sheet,
          String(source.name || `Hoja ${index + 1}`).slice(0, 31)
        );
      });
      buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    } else {
      throw new Error(`Tipo de exportación no soportado: ${type}`);
    }
    self.postMessage({ id, buffer }, [buffer]);
  } catch (error) {
    self.postMessage({ id, error: error.message || String(error) });
  }
};
