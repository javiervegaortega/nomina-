import * as XLSX from 'xlsx';
import { getNetPayable } from './payrollPeriod';

/**
 * Campos recomendados para reportería de empleados activos.
 */
export const REPORT_REQUIRED_FIELDS = [
  { key: 'dpi', label: 'DPI' },
  { key: 'no_igss', label: 'No. IGSS' },
  { key: 'banco', label: 'Banco' },
  { key: 'no_cuenta', label: 'No. Cuenta' },
  { key: 'puesto', label: 'Puesto' },
  { key: 'empresa_principal', label: 'Empresa principal' },
];

export function validateEmployeesForReports(employees) {
  const missing = [];
  (employees || []).forEach(e => {
    const name = [e.primer_nombre, e.primer_apellido].filter(Boolean).join(' ') || `ID ${e.id}`;
    const fields = REPORT_REQUIRED_FIELDS.filter(f => {
      const v = e[f.key];
      return v == null || v === '' || v === undefined;
    }).map(f => f.label);
    if (fields.length) missing.push({ id: e.id, name, fields });
  });
  return missing;
}

function empName(e) {
  return [e.primer_nombre, e.segundo_nombre, e.otro_nombre, e.primer_apellido, e.segundo_apellido, e.apellido_casada]
    .filter(Boolean).join(' ') || e.name || '';
}

/**
 * Filas normalizadas para Verificador de Pagos.
 */
export function buildVerificadorRows(employees, periodType, companies = []) {
  return (employees || []).map(e => {
    const liquido = getNetPayable(e, periodType);
    const companyName = companies.find(c => String(c.id) === String(e.empresa_principal))?.nombre_comercial
      || e.company || '';
    return {
      Empleado: empName(e),
      DPI: e.dpi || '',
      Empresa: companyName,
      Banco: e.banco || '',
      Cuenta: e.no_cuenta || '',
      'Tipo Cuenta': e.tipo_cuenta || '',
      'Líquido a Pagar': Number(liquido.toFixed ? liquido.toFixed(2) : liquido),
      Anticipo1ra: periodType === '2da' ? (Number(e.anticipo1ra) || 0) : 0,
    };
  });
}

/**
 * Filas Libro de Salarios (resumen).
 */
export function buildLibroSalariosRows(employees, periodType) {
  return (employees || []).map(e => {
    const c = e.calculated || {};
    const liquido = getNetPayable(e, periodType);
    const bonusDetail = (e.operationLogs || [])
      .filter(l => l.type === 'BONO')
      .map(l => `Q${Number(l.bonusAmount || 0).toFixed(2)}${l.taskDescription ? ` (${l.taskDescription})` : ''}`)
      .join('; ');
    return {
      Empleado: empName(e),
      DPI: e.dpi || '',
      'Días': e.days || '',
      'Sueldo Ordinario': c.baseSalary || 0,
      'Bon. Incentivo': c.bonusLey || 0,
      'Bono Decreto': c.bonusDec || 0,
      'Bonos Operativos': c.bonos || 0,
      'Detalle Bonos': bonusDetail,
      'Extras': c.extrasTotal || 0,
      'Bruto': c.gross || 0,
      'IGSS': c.proratedDeductions?.igss ?? e.deductions?.igss ?? 0,
      'ISR': c.proratedDeductions?.isr ?? e.deductions?.isr ?? 0,
      'Total Deducciones': c.ded || 0,
      'Anticipo 1ra': periodType === '2da' ? (Number(e.anticipo1ra) || 0) : 0,
      'Líquido a Pagar': liquido,
      Observaciones: e.observaciones || '',
    };
  });
}

/**
 * Exporta Excel preliminar (desde borrador o historial).
 * @param {'verificador'|'libro'} type
 */
export function exportPayrollReportExcel({ type, employees, periodType, title, companies, isDraft = false }) {
  let rows;
  let sheetName;
  if (type === 'verificador') {
    rows = buildVerificadorRows(employees, periodType, companies);
    sheetName = 'Verificador';
  } else {
    rows = buildLibroSalariosRows(employees, periodType);
    sheetName = 'Libro Salarios';
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  if (isDraft) {
    const meta = XLSX.utils.aoa_to_sheet([
      ['PRELIMINAR / BORRADOR'],
      ['Nómina', title || ''],
      ['Periodo', periodType || ''],
      ['Generado', new Date().toLocaleString('es-GT')],
      ['Aviso', 'Este reporte no proviene de una nómina cerrada.']
    ]);
    XLSX.utils.book_append_sheet(wb, meta, 'Aviso');
  }

  const prefix = isDraft ? 'BORRADOR_' : '';
  const safeTitle = String(title || 'nomina').replace(/[^\w\-]+/g, '_').slice(0, 40);
  XLSX.writeFile(wb, `${prefix}${sheetName}_${safeTitle}.xlsx`);

  return validateEmployeesForReports(employees);
}
