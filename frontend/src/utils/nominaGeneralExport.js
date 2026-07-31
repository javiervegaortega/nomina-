import { getNetPayable, getNetTotal } from './payrollPeriod';

const COLORS = {
  titleBg: '0E2F44',
  headerBg: '1B4F72',
  headerFg: 'FFFFFF',
  sectionBg: '154360',
  altRow: 'F4F7FA',
  border: 'C5D0DC',
  money: '1A5276',
  muted: '5D6D7E',
  totalBg: 'D4E6F1',
  summaryBg: 'EAF2F8',
  gross: 'B9770E',
  ded: 'C0392B',
  patronal: 'D35400',
  net: '1A5276',
  white: 'FFFFFF',
  text: '1C2833',
  highlight: '1ABC9C'
};

const thinBorder = {
  top: { style: 'thin', color: { argb: COLORS.border } },
  left: { style: 'thin', color: { argb: COLORS.border } },
  bottom: { style: 'thin', color: { argb: COLORS.border } },
  right: { style: 'thin', color: { argb: COLORS.border } }
};

const moneyFmt = '"Q"#,##0.00';

const getCatalogBonuses = (employee) => {
  if (employee?.calculated?.bonusesSum != null) {
    return Number(employee.calculated.bonusesSum) || 0;
  }
  return Object.values(employee?.appliedBonuses || {})
    .reduce((sum, value) => sum + (Number(value) || 0), 0);
};

const getEmployeeFullName = (e) => {
  if (!e) return '';
  const parts = [
    e.primer_nombre,
    e.segundo_nombre,
    e.otro_nombre,
    e.primer_apellido,
    e.segundo_apellido,
    e.apellido_casada
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return `${e.nombres || ''} ${e.apellidos || ''}`.trim() || 'Empleado';
};

const getBonusDetail = (e) =>
  [...(e.priorOperationLogs || []), ...(e.operationLogs || [])]
    .filter((l) => l.type === 'BONO')
    .map((l) => `Q${Number(l.bonusAmount || 0).toFixed(2)}`)
    .join('; ');

const buildRowValues = (e, idx, periodType) => {
  const calc = e.calculated || {};
  const baseSalary = Number(calc.baseSalary) || 0;
  const bonusLey = Number(calc.bonusLey) || 0;
  const bonusDec = Number(calc.bonusDec) || 0;
  const bonos = (Number(calc.bonos) || 0) + getCatalogBonuses(e);
  const tDevengado = baseSalary + bonusLey + bonusDec + bonos;
  const proDed = calc.proratedDeductions || e.deductions || {};
  const otrosIngresos =
    (Number(e.extras?.otrosIngresos) || 0)
    + (Number(e.extras?.vacacionesVal) || 0)
    + (Number(e.extras?.ventasEconomicas) || 0)
    + (Number(e.extras?.comisiones) || 0);
  const liquido = getNetTotal(e);
  const pagoQuincena = getNetPayable(e, periodType);
  const anticipo = Number(e.anticipo1ra) || 0;
  const is2da = periodType === '2da';

  return {
    no: idx + 1,
    nombre: getEmployeeFullName(e),
    empresa: e.company || 'Sin empresa',
    puesto: e.puesto || 'N/A',
    dias: e.days ?? 30,
    salarioOrdinario: baseSalary,
    bonoIncentivo: bonusLey,
    bonoDecreto: bonusDec,
    bonos,
    totalDevengado: tDevengado,
    hrsSimples: Number(e.extras?.simplesQty) || 0,
    valHrsSimples: Number(e.extras?.simplesVal) || 0,
    hrsDobles: Number(e.extras?.doblesQty) || 0,
    valHrsDobles: Number(e.extras?.doblesVal) || 0,
    otrosIngresos,
    salarioTotal: Number(calc.gross) || 0,
    igss: Number(proDed.igss) || 0,
    isr: Number(proDed.isr) || 0,
    cafeteria: Number(proDed.cafe) || 0,
    celular: Number(proDed.cell) || 0,
    uniforme: Number(proDed.uniform) || 0,
    calzado: Number(proDed.shoes) || 0,
    equipo: Number(proDed.equipo) || 0,
    producto: Number(proDed.product) || 0,
    bantrab: Number(proDed.bancos) || 0,
    prestamo: Number(proDed.prestamo_empresa) || 0,
    otros: Number(proDed.otros) || 0,
    judiciales: Number(proDed.judiciales) || 0,
    seguro: Number(proDed.seguro) || 0,
    parqueo: Number(proDed.parqueo) || 0,
    boletaOrnato: Number(proDed.boleto_de_ornato) || 0,
    otrosEgresos: Number(proDed.otros_egresos) || 0,
    totalEgresos: Number(calc.ded) || 0,
    liquido,
    q1: is2da ? anticipo : liquido,
    q2: is2da ? pagoQuincena : 0,
    detalleBonos: getBonusDetail(e),
    banco: e.banco || 'N/A',
    cuenta: e.no_cuenta || e.numero_cuenta || 'N/A'
  };
};

const COLUMNS = (is2da) => {
  const cols = [
    { key: 'no', header: 'No.', width: 6, type: 'int' },
    { key: 'nombre', header: 'Nombre Empleado', width: 32, type: 'text' },
    { key: 'empresa', header: 'Empresa', width: 22, type: 'text' },
    { key: 'puesto', header: 'Puesto', width: 22, type: 'text' },
    { key: 'dias', header: 'Días Lab.', width: 10, type: 'int' },
    { key: 'salarioOrdinario', header: 'S. Ordinario', width: 13, type: 'money' },
    { key: 'bonoIncentivo', header: 'Bon. Incentivo', width: 13, type: 'money' },
    { key: 'bonoDecreto', header: 'Bono Dec. 37-2001', width: 15, type: 'money' },
    { key: 'bonos', header: 'Bonos', width: 11, type: 'money' },
    { key: 'totalDevengado', header: 'T. Devengado', width: 13, type: 'money', accent: 'highlight' },
    { key: 'hrsSimples', header: 'Hrs Simples', width: 11, type: 'number' },
    { key: 'valHrsSimples', header: 'Val Hrs Simp', width: 12, type: 'money' },
    { key: 'hrsDobles', header: 'Hrs Dobles', width: 11, type: 'number' },
    { key: 'valHrsDobles', header: 'Val Hrs Dobl', width: 12, type: 'money' },
    { key: 'otrosIngresos', header: 'Otros Ingresos', width: 13, type: 'money' },
    { key: 'salarioTotal', header: 'Salario Total', width: 13, type: 'money', accent: 'gross' },
    { key: 'igss', header: 'IGSS', width: 11, type: 'money', accent: 'ded' },
    { key: 'isr', header: 'ISR', width: 11, type: 'money', accent: 'ded' },
    { key: 'cafeteria', header: 'Cafetería', width: 11, type: 'money', accent: 'ded' },
    { key: 'celular', header: 'Celular', width: 11, type: 'money', accent: 'ded' },
    { key: 'uniforme', header: 'Uniforme', width: 11, type: 'money', accent: 'ded' },
    { key: 'calzado', header: 'Calzado', width: 11, type: 'money', accent: 'ded' },
    { key: 'equipo', header: 'Equipo', width: 11, type: 'money', accent: 'ded' },
    { key: 'producto', header: 'Producto', width: 11, type: 'money', accent: 'ded' },
    { key: 'bantrab', header: 'Bantrab', width: 11, type: 'money', accent: 'ded' },
    { key: 'prestamo', header: 'Préstamo Emp.', width: 12, type: 'money', accent: 'ded' },
    { key: 'otros', header: 'Otros', width: 11, type: 'money', accent: 'ded' },
    { key: 'judiciales', header: 'Judiciales', width: 11, type: 'money', accent: 'ded' },
    { key: 'seguro', header: 'Seguro', width: 11, type: 'money', accent: 'ded' },
    { key: 'parqueo', header: 'Parqueo', width: 11, type: 'money', accent: 'ded' },
    { key: 'boletaOrnato', header: 'Bol. Ornato', width: 11, type: 'money', accent: 'ded' },
    { key: 'otrosEgresos', header: 'Otros Egresos', width: 12, type: 'money', accent: 'ded' },
    { key: 'totalEgresos', header: 'Total Egresos', width: 13, type: 'money', accent: 'ded' },
    { key: 'liquido', header: 'Líquido a Recibir', width: 14, type: 'money', accent: 'net' }
  ];

  if (is2da) {
    cols.push(
      { key: 'q1', header: '1ra Quincena', width: 12, type: 'money' },
      { key: 'q2', header: '2da Quincena', width: 12, type: 'money' }
    );
  }

  cols.push(
    { key: 'detalleBonos', header: 'Detalle Bonos', width: 22, type: 'text' },
    { key: 'banco', header: 'Banco Depósito', width: 16, type: 'text' },
    { key: 'cuenta', header: 'Cuenta Bancaria', width: 18, type: 'text' }
  );

  return cols;
};

const MONEY_KEYS = new Set([
  'salarioOrdinario', 'bonoIncentivo', 'bonoDecreto', 'bonos', 'totalDevengado',
  'valHrsSimples', 'valHrsDobles', 'otrosIngresos', 'salarioTotal',
  'igss', 'isr', 'cafeteria', 'celular', 'uniforme', 'calzado', 'equipo', 'producto',
  'bantrab', 'prestamo', 'otros', 'judiciales', 'seguro', 'parqueo', 'boletaOrnato',
  'otrosEgresos', 'totalEgresos', 'liquido', 'q1', 'q2'
]);

const styleFill = (cell, argb) => {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
};

const applyMoney = (cell, accent) => {
  cell.numFmt = moneyFmt;
  cell.alignment = { horizontal: 'right', vertical: 'middle' };
  const color = accent && COLORS[accent] ? COLORS[accent] : COLORS.money;
  cell.font = { ...(cell.font || {}), color: { argb: color }, name: 'Calibri', size: 10 };
};

/**
 * Construye la Nómina General con encabezado, resumen y desglose completo.
 * @param {{ employees: any[], group: any, totals: { grossTotal: number, dedTotal: number, patronalTotal: number, netTotal: number } }} params
 */
export function buildNominaGeneralWorkbook({ employees, group, totals }, ExcelJS) {
  if (!ExcelJS) throw new Error('ExcelJS no fue cargado');
  const periodType = group?.periodType || '1ra';
  const is2da = periodType === '2da';
  const cols = COLUMNS(is2da);
  const colCount = cols.length;
  const rows = (employees || []).map((e, idx) => buildRowValues(e, idx, periodType));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Nómina';
  wb.created = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet('Nómina General', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 9 }]
  });

  cols.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width;
  });

  // Título
  const titleRow = ws.addRow(['NÓMINA GENERAL — DESGLOSE COMPLETO DE PAGOS']);
  titleRow.height = 30;
  for (let c = 1; c <= colCount; c += 1) {
    const cell = titleRow.getCell(c);
    styleFill(cell, COLORS.titleBg);
    cell.font = { bold: true, size: 14, color: { argb: COLORS.white }, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center' };
  }
  ws.mergeCells(1, 1, 1, colCount);

  const periodLabel = periodType === '2da' ? '2da Quincena' : '1ra Quincena';
  const statusLabel = group?.status === 'auditoria' ? 'En Auditoría' : 'Cerrada';
  const metaRow = ws.addRow([
    `Periodo: ${group?.title || '—'}  |  ${periodLabel}  |  Estado: ${statusLabel}  |  Empleados: ${rows.length}`
  ]);
  metaRow.height = 20;
  for (let c = 1; c <= colCount; c += 1) {
    const cell = metaRow.getCell(c);
    styleFill(cell, COLORS.sectionBg);
    cell.font = { size: 10, color: { argb: COLORS.white }, name: 'Calibri' };
    cell.alignment = { vertical: 'middle' };
  }
  ws.mergeCells(2, 1, 2, colCount);

  const genRow = ws.addRow([
    `Generado: ${new Date().toLocaleString('es-GT')}${group?.notes ? `  |  Notas: ${String(group.notes).replace(/\s+/g, ' ').slice(0, 120)}` : ''}`
  ]);
  genRow.height = 18;
  for (let c = 1; c <= colCount; c += 1) {
    const cell = genRow.getCell(c);
    cell.font = { size: 9, color: { argb: COLORS.muted }, name: 'Calibri', italic: true };
    cell.alignment = { vertical: 'middle' };
  }
  ws.mergeCells(3, 1, 3, colCount);

  ws.addRow([]);

  // Resumen (misma info de las tarjetas de la vista)
  const summaryLabelRow = ws.addRow(['RESUMEN DE LA NÓMINA']);
  summaryLabelRow.height = 20;
  for (let c = 1; c <= 8; c += 1) {
    const cell = summaryLabelRow.getCell(c);
    styleFill(cell, COLORS.headerBg);
    cell.font = { bold: true, size: 10, color: { argb: COLORS.white }, name: 'Calibri' };
    cell.alignment = { vertical: 'middle' };
  }
  ws.mergeCells(5, 1, 5, 8);

  const summaryHeaders = ws.addRow([
    'Costo Bruto Total',
    'Deducciones Totales',
    'Cuota Patronal Estimada',
    'Desembolso Neto',
    '',
    '',
    '',
    ''
  ]);
  summaryHeaders.height = 18;
  ['gross', 'ded', 'patronal', 'net'].forEach((accent, i) => {
    const cell = summaryHeaders.getCell(i + 1);
    styleFill(cell, COLORS.summaryBg);
    cell.font = { bold: true, size: 9, color: { argb: COLORS[accent] }, name: 'Calibri' };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  });

  const summaryValues = ws.addRow([
    Number(totals?.grossTotal) || 0,
    Number(totals?.dedTotal) || 0,
    Number(totals?.patronalTotal) || 0,
    Number(totals?.netTotal) || 0,
    '',
    '',
    '',
    ''
  ]);
  summaryValues.height = 22;
  for (let i = 1; i <= 4; i += 1) {
    const cell = summaryValues.getCell(i);
    styleFill(cell, COLORS.summaryBg);
    cell.border = thinBorder;
    applyMoney(cell, ['gross', 'ded', 'patronal', 'net'][i - 1]);
    cell.font = { bold: true, size: 12, color: { argb: COLORS[['gross', 'ded', 'patronal', 'net'][i - 1]] }, name: 'Calibri' };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  ws.addRow([]);

  // Encabezados del desglose
  const headerRow = ws.addRow(cols.map((c) => c.header));
  headerRow.height = 28;
  cols.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    styleFill(cell, COLORS.headerBg);
    cell.font = { bold: true, size: 9, color: { argb: COLORS.headerFg }, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });

  // Filas de empleados
  rows.forEach((rowData, idx) => {
    const values = cols.map((c) => rowData[c.key]);
    const row = ws.addRow(values);
    row.height = 18;
    const isAlt = idx % 2 === 1;

    cols.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      if (isAlt) styleFill(cell, COLORS.altRow);
      cell.border = thinBorder;
      cell.font = { size: 9, name: 'Calibri', color: { argb: COLORS.text } };
      cell.alignment = { vertical: 'middle' };

      if (col.type === 'money' || MONEY_KEYS.has(col.key)) {
        applyMoney(cell, col.accent);
        if (isAlt) styleFill(cell, COLORS.altRow);
      } else if (col.type === 'int' || col.type === 'number') {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (col.key === 'nombre') {
        cell.font = { bold: true, size: 9, name: 'Calibri', color: { argb: COLORS.net } };
      }
    });
  });

  // Totales consolidados
  const sums = rows.reduce((acc, r) => {
    MONEY_KEYS.forEach((k) => {
      acc[k] = (acc[k] || 0) + (Number(r[k]) || 0);
    });
    acc.hrsSimples = (acc.hrsSimples || 0) + (Number(r.hrsSimples) || 0);
    acc.hrsDobles = (acc.hrsDobles || 0) + (Number(r.hrsDobles) || 0);
    return acc;
  }, {});

  const totalValues = cols.map((c) => {
    if (c.key === 'no') return '';
    if (c.key === 'nombre') return 'TOTAL CONSOLIDADO';
    if (c.key === 'empresa') return `${rows.length} empleados`;
    if (c.key === 'puesto' || c.key === 'detalleBonos' || c.key === 'banco' || c.key === 'cuenta') return '';
    if (c.key === 'dias') return '';
    if (c.key === 'hrsSimples') return sums.hrsSimples || 0;
    if (c.key === 'hrsDobles') return sums.hrsDobles || 0;
    if (MONEY_KEYS.has(c.key)) return sums[c.key] || 0;
    return '';
  });

  const totalRow = ws.addRow(totalValues);
  totalRow.height = 22;
  cols.forEach((col, i) => {
    const cell = totalRow.getCell(i + 1);
    styleFill(cell, COLORS.totalBg);
    cell.border = thinBorder;
    cell.font = { bold: true, size: 9, name: 'Calibri', color: { argb: COLORS.text } };
    cell.alignment = { vertical: 'middle' };
    if (col.type === 'money' || MONEY_KEYS.has(col.key)) {
      applyMoney(cell, col.accent);
      styleFill(cell, COLORS.totalBg);
      cell.font = { bold: true, size: 9, name: 'Calibri', color: { argb: col.accent && COLORS[col.accent] ? COLORS[col.accent] : COLORS.money } };
    }
    if (col.key === 'nombre' || col.key === 'empresa') {
      cell.font = { bold: true, size: 9, name: 'Calibri', color: { argb: COLORS.titleBg } };
    }
  });

  // Auto-filter on header
  const headerRowNumber = 9;
  ws.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber + rows.length, column: colCount }
  };

  return wb;
}

export async function exportNominaGeneralExcel(params) {
  const { generateAndDownloadExcel } = await import('./excelWorkerClient');
  const safeTitle = String(params.group?.title || 'Nomina')
    .replace(/[^\w-]+/g, '_')
    .slice(0, 50);
  await generateAndDownloadExcel(
    'nomina-general',
    params,
    `Nomina_General_${safeTitle}.xlsx`
  );
}
