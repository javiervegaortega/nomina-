import ExcelJS from 'exceljs';

export const formatCurrency = (val) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(val || 0);

const COLORS = {
  primary: '1B4F72',
  primaryDark: '0E2F44',
  headerBg: '1B4F72',
  headerFg: 'FFFFFF',
  titleBg: '0E2F44',
  altRow: 'F4F7FA',
  border: 'C5D0DC',
  money: '1A5276',
  muted: '5D6D7E',
  totalBg: 'EAF2F8',
  white: 'FFFFFF'
};

const thinBorder = {
  top: { style: 'thin', color: { argb: COLORS.border } },
  left: { style: 'thin', color: { argb: COLORS.border } },
  bottom: { style: 'thin', color: { argb: COLORS.border } },
  right: { style: 'thin', color: { argb: COLORS.border } }
};

const moneyFmt = '"Q"#,##0.00';
const pctFmt = '0.00"%"';

const parseJsonField = (value) => {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
};

const styleTitleRow = (row, colCount) => {
  row.height = 28;
  for (let c = 1; c <= colCount; c += 1) {
    const cell = row.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };
    cell.font = { bold: true, size: 14, color: { argb: COLORS.white }, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center' };
  }
};

const styleMetaRow = (row, colCount) => {
  row.height = 20;
  for (let c = 1; c <= colCount; c += 1) {
    const cell = row.getCell(c);
    cell.font = { size: 10, color: { argb: COLORS.muted }, name: 'Calibri' };
    cell.alignment = { vertical: 'middle' };
  }
};

const styleHeaderRow = (row, colCount) => {
  row.height = 22;
  for (let c = 1; c <= colCount; c += 1) {
    const cell = row.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.font = { bold: true, size: 10, color: { argb: COLORS.headerFg }, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  }
};

const styleDataRow = (row, colCount, isAlt) => {
  row.height = 18;
  for (let c = 1; c <= colCount; c += 1) {
    const cell = row.getCell(c);
    if (isAlt) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.altRow } };
    }
    cell.font = { size: 10, name: 'Calibri', color: { argb: '1C2833' } };
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle' };
  }
};

const applyMoney = (cell) => {
  cell.numFmt = moneyFmt;
  cell.alignment = { horizontal: 'right', vertical: 'middle' };
  cell.font = { ...(cell.font || {}), color: { argb: COLORS.money } };
};

const applyPct = (cell) => {
  cell.numFmt = pctFmt;
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
};

const setCols = (ws, widths) => {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
};

const buildFacturasSheet = (wb, { payrollTitle, lines }) => {
  const ws = wb.addWorksheet('Facturas', { views: [{ state: 'frozen', ySplit: 4 }] });
  const cols = 9;
  setCols(ws, [28, 28, 28, 42, 14, 12, 14, 12, 14]);

  const title = ws.addRow(['Facturación Intercompañía — Facturas']);
  styleTitleRow(title, cols);
  ws.mergeCells(1, 1, 1, cols);

  const meta = ws.addRow([
    `Nómina: ${payrollTitle || '—'}`,
    '',
    '',
    '',
    '',
    '',
    '',
    `Generado: ${new Date().toLocaleString('es-GT')}`,
    ''
  ]);
  styleMetaRow(meta, cols);
  ws.mergeCells(2, 1, 2, 6);
  ws.mergeCells(2, 8, 2, 9);

  ws.addRow([]);

  const header = ws.addRow([
    'Empresa Emisora',
    'Empresa Receptora',
    'Centro de Costo',
    'Concepto',
    'Base',
    'Margen %',
    'Monto Margen',
    'IVA',
    'Total'
  ]);
  styleHeaderRow(header, cols);

  let sumBase = 0;
  let sumMargin = 0;
  let sumIva = 0;
  let sumTotal = 0;

  (lines || []).forEach((d, idx) => {
    const row = ws.addRow([
      d.fromCompany || '',
      d.toCompany || '',
      d.centroCosto || '',
      d.concept || '',
      Number(d.baseAmount) || 0,
      Number(d.marginPercentage) || 0,
      Number(d.marginAmount) || 0,
      Number(d.ivaAmount) || 0,
      Number(d.totalAmount) || 0
    ]);
    styleDataRow(row, cols, idx % 2 === 1);
    applyMoney(row.getCell(5));
    applyPct(row.getCell(6));
    applyMoney(row.getCell(7));
    applyMoney(row.getCell(8));
    applyMoney(row.getCell(9));
    row.getCell(9).font = { bold: true, size: 10, name: 'Calibri', color: { argb: '196F3D' } };

    sumBase += Number(d.baseAmount) || 0;
    sumMargin += Number(d.marginAmount) || 0;
    sumIva += Number(d.ivaAmount) || 0;
    sumTotal += Number(d.totalAmount) || 0;
  });

  if ((lines || []).length === 0) {
    const empty = ws.addRow(['Sin facturas generadas. Verifique reglas y distribución de empleados.']);
    styleDataRow(empty, cols, false);
    ws.mergeCells(empty.number, 1, empty.number, cols);
  } else {
    const total = ws.addRow(['TOTALES', '', '', '', sumBase, '', sumMargin, sumIva, sumTotal]);
    styleDataRow(total, cols, false);
    for (let c = 1; c <= cols; c += 1) {
      const cell = total.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalBg } };
      cell.font = { bold: true, size: 10, name: 'Calibri' };
    }
    applyMoney(total.getCell(5));
    applyMoney(total.getCell(7));
    applyMoney(total.getCell(8));
    applyMoney(total.getCell(9));
  }

  return ws;
};

const buildPorCentroCostoSheet = (wb, { payrollTitle, lines, companyNames }) => {
  const byCc = {};
  const receiverIds = new Set();

  (lines || []).forEach((line) => {
    const cc = line.centroCosto || 'SIN CENTRO DE COSTO';
    const toId = line.toCompanyId != null ? String(line.toCompanyId) : (line.toCompany || 'destino');
    const toLabel = line.toCompany || companyNames?.[toId] || toId;
    if (!byCc[cc]) byCc[cc] = {};
    if (!byCc[cc][toLabel]) byCc[cc][toLabel] = 0;
    byCc[cc][toLabel] += Number(line.baseAmount) || 0;
    receiverIds.add(toLabel);
  });

  const receivers = [...receiverIds].sort((a, b) => String(a).localeCompare(String(b), 'es'));
  const colCount = Math.max(2, receivers.length + 2);
  const ws = wb.addWorksheet('Por Centro de Costo', { views: [{ state: 'frozen', ySplit: 4, xSplit: 1 }] });
  setCols(ws, [32, ...receivers.map(() => 16), 16]);

  const title = ws.addRow(['Costos por Centro de Costo (distribución REAL facturable)']);
  styleTitleRow(title, colCount);
  ws.mergeCells(1, 1, 1, colCount);

  const meta = ws.addRow([`Nómina: ${payrollTitle || '—'}`]);
  styleMetaRow(meta, colCount);
  ws.mergeCells(2, 1, 2, colCount);

  ws.addRow([]);

  const header = ws.addRow(['Centro de Costo', ...receivers, 'Total']);
  styleHeaderRow(header, colCount);

  const ccKeys = Object.keys(byCc).sort((a, b) => a.localeCompare(b, 'es'));
  const colTotals = receivers.map(() => 0);
  let grand = 0;

  ccKeys.forEach((cc, idx) => {
    let rowTotal = 0;
    const values = receivers.map((recv, i) => {
      const amt = Number(byCc[cc][recv]) || 0;
      colTotals[i] += amt;
      rowTotal += amt;
      return amt;
    });
    grand += rowTotal;
    const row = ws.addRow([cc, ...values, rowTotal]);
    styleDataRow(row, colCount, idx % 2 === 1);
    for (let c = 2; c <= colCount; c += 1) applyMoney(row.getCell(c));
    row.getCell(1).font = { bold: true, size: 10, name: 'Calibri' };
  });

  if (ccKeys.length === 0) {
    const empty = ws.addRow(['Sin datos por centro de costo.']);
    styleDataRow(empty, colCount, false);
    ws.mergeCells(empty.number, 1, empty.number, colCount);
  } else {
    const total = ws.addRow(['TOTALES', ...colTotals, grand]);
    styleDataRow(total, colCount, false);
    for (let c = 1; c <= colCount; c += 1) {
      const cell = total.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalBg } };
      cell.font = { bold: true, size: 10, name: 'Calibri' };
    }
    for (let c = 2; c <= colCount; c += 1) applyMoney(total.getCell(c));
  }

  return ws;
};

const buildMatrizSheet = (wb, { payrollTitle, matrix, companyNames }) => {
  const fromIds = Object.keys(matrix || {});
  const toIdsSet = new Set();
  fromIds.forEach((fid) => Object.keys(matrix[fid] || {}).forEach((tid) => toIdsSet.add(tid)));
  const toIds = [...toIdsSet];
  const colCount = Math.max(2, toIds.length + 1);

  const ws = wb.addWorksheet('Matriz', { views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }] });
  setCols(ws, [28, ...toIds.map(() => 16)]);

  const title = ws.addRow(['Matriz de Costos (Empresa Pagadora \\ Empresa Destino)']);
  styleTitleRow(title, colCount);
  ws.mergeCells(1, 1, 1, colCount);

  const meta = ws.addRow([`Nómina: ${payrollTitle || '—'}`]);
  styleMetaRow(meta, colCount);
  ws.mergeCells(2, 1, 2, colCount);

  ws.addRow([]);

  const header = ws.addRow(['De \\ A', ...toIds.map((id) => companyNames?.[id] || `Empresa ${id}`)]);
  styleHeaderRow(header, colCount);

  fromIds.forEach((fid, idx) => {
    const values = [companyNames?.[fid] || `Empresa ${fid}`, ...toIds.map((tid) => Number(matrix[fid]?.[tid]) || 0)];
    const row = ws.addRow(values);
    styleDataRow(row, colCount, idx % 2 === 1);
    row.getCell(1).font = { bold: true, size: 10, name: 'Calibri' };
    for (let c = 2; c <= colCount; c += 1) applyMoney(row.getCell(c));
  });

  if (fromIds.length === 0) {
    const empty = ws.addRow(['Sin datos en la matriz de costos.']);
    styleDataRow(empty, colCount, false);
    ws.mergeCells(empty.number, 1, empty.number, colCount);
  }

  return ws;
};

const buildDetalleSheet = (wb, { payrollTitle, details }) => {
  const headers = [
    'ID',
    'Empleado',
    'Centro de Costo',
    'Empresa Pagadora',
    'Empresa Destino',
    '% Destino',
    'Días',
    'Período',
    'Sueldo Ordinario',
    'Bono Decreto',
    'Bono Incentivo',
    'Bonos Extras',
    'Bonos Catálogo',
    'H. Extras y Otros',
    'Bruto Período',
    'IGSS Laboral',
    'ISR',
    'Otros Descuentos',
    'Total Descuentos',
    'Líquido',
    'IGSS Patronal',
    'Costo Empleado',
    'Asg. Sueldo',
    'Asg. Bono Decreto',
    'Asg. Bono Incentivo',
    'Asg. Bonos Extras',
    'Asg. Bonos Catálogo',
    'Asg. H. Extras',
    'Asg. Bruto',
    'Asg. IGSS Laboral',
    'Asg. ISR',
    'Asg. IGSS Patronal',
    'Monto Asignado (Costo)'
  ];
  const cols = headers.length;
  const ws = wb.addWorksheet('Detalle', { views: [{ state: 'frozen', ySplit: 4, xSplit: 2 }] });
  setCols(ws, [
    8, 28, 28, 22, 22, 10, 8, 10,
    13, 12, 12, 12, 12, 13, 12,
    12, 10, 13, 13, 11, 12, 13,
    11, 13, 13, 12, 12, 11, 11, 12, 10, 12, 16
  ]);

  const title = ws.addRow(['Detalle por Empleado — Distribución de Costos (desglose de nómina)']);
  styleTitleRow(title, cols);
  ws.mergeCells(1, 1, 1, Math.min(cols, 10));

  const meta = ws.addRow([
    `Nómina: ${payrollTitle || '—'}`,
    '',
    '',
    `Registros: ${(details || []).length}`,
    '',
    '',
    `Generado: ${new Date().toLocaleString('es-GT')}`
  ]);
  styleMetaRow(meta, cols);
  ws.mergeCells(2, 1, 2, 3);
  ws.mergeCells(2, 4, 2, 5);
  ws.mergeCells(2, 7, 2, 10);

  ws.addRow([]);

  const header = ws.addRow(headers);
  styleHeaderRow(header, cols);

  const moneyCols = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33];
  let sumAmount = 0;

  (details || []).forEach((d, idx) => {
    const pct = Number(d.percentage) || 0;
    const amount = Number(d.baseAmount) || 0;
    const employeeCost = Number(d.employeeCost ?? d.totalCost) || (pct > 0 ? amount / (pct / 100) : 0);
    const periodLabel = d.periodType === '1ra' ? '1ra Quincena'
      : d.periodType === '2da' ? '2da Quincena'
      : d.periodType === 'mensual' ? 'Mensual'
      : (d.periodType || '—');

    const row = ws.addRow([
      d.employeeId ?? '',
      d.employeeName || '',
      d.centroCosto || '',
      d.fromCompany || '',
      d.toCompany || '',
      pct,
      d.days != null ? Number(d.days) : '',
      periodLabel,
      Number(d.sueldoOrdinario) || 0,
      Number(d.bonoDecreto) || 0,
      Number(d.bonoIncentivo) || 0,
      Number(d.bonosExtras) || 0,
      Number(d.bonosAplicados) || 0,
      Number(d.horasExtrasOtros) || 0,
      Number(d.bruto) || 0,
      Number(d.igssLaboral) || 0,
      Number(d.isr) || 0,
      Number(d.otrosDescuentos) || 0,
      Number(d.totalDescuentos) || 0,
      Number(d.liquido) || 0,
      Number(d.igssPatronal) || 0,
      Math.round(employeeCost * 100) / 100,
      Number(d.asgSueldo) || 0,
      Number(d.asgBonoDecreto) || 0,
      Number(d.asgBonoIncentivo) || 0,
      Number(d.asgBonosExtras) || 0,
      Number(d.asgBonosAplicados) || 0,
      Number(d.asgHorasExtrasOtros) || 0,
      Number(d.asgBruto) || 0,
      Number(d.asgIgssLaboral) || 0,
      Number(d.asgIsr) || 0,
      Number(d.asgIgssPatronal) || 0,
      amount
    ]);
    styleDataRow(row, cols, idx % 2 === 1);
    applyPct(row.getCell(6));
    moneyCols.forEach((c) => applyMoney(row.getCell(c)));
    row.getCell(33).font = { bold: true, size: 10, name: 'Calibri', color: { argb: '196F3D' } };
    sumAmount += amount;
  });

  if ((details || []).length === 0) {
    const empty = ws.addRow([
      'Sin detalle por empleado. Regenere la vista previa o confirme de nuevo la facturación para obtener el desglose completo.'
    ]);
    styleDataRow(empty, cols, false);
    ws.mergeCells(empty.number, 1, empty.number, cols);
  } else {
    const totalValues = Array(cols).fill('');
    totalValues[1] = 'TOTALES';
    totalValues[32] = sumAmount;
    const total = ws.addRow(totalValues);
    styleDataRow(total, cols, false);
    for (let c = 1; c <= cols; c += 1) {
      const cell = total.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalBg } };
      cell.font = { bold: true, size: 10, name: 'Calibri' };
    }
    applyMoney(total.getCell(33));
  }

  return ws;
};

const buildResumenSheet = (wb, data) => {
  const { payrollTitle, lines = [], matrix = {}, details = [], warnings = [] } = data;
  const ws = wb.addWorksheet('Resumen', { views: [{ state: 'frozen', ySplit: 1 }] });
  setCols(ws, [32, 28, 18]);

  const title = ws.addRow(['Resumen de Facturación Intercompañía']);
  styleTitleRow(title, 3);
  ws.mergeCells(1, 1, 1, 3);

  const addKv = (label, value) => {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { bold: true, size: 10, name: 'Calibri', color: { argb: COLORS.primary } };
    row.getCell(2).font = { size: 10, name: 'Calibri' };
    row.getCell(1).border = thinBorder;
    row.getCell(2).border = thinBorder;
    ws.mergeCells(row.number, 2, row.number, 3);
  };

  ws.addRow([]);
  addKv('Nómina', payrollTitle || '—');
  addKv('Fecha de generación', new Date().toLocaleString('es-GT'));
  addKv('Facturas', (lines || []).length);
  addKv('Filas de detalle', (details || []).length);
  addKv('Empresas en matriz (pagadoras)', Object.keys(matrix || {}).length);
  addKv(
    'Total facturado',
    formatCurrency((lines || []).reduce((s, l) => s + (Number(l.totalAmount) || 0), 0))
  );
  addKv(
    'Total base distribuida',
    formatCurrency((details || []).reduce((s, d) => s + (Number(d.baseAmount) || 0), 0))
  );

  if ((warnings || []).length > 0) {
    ws.addRow([]);
    const wh = ws.addRow(['Advertencias']);
    styleHeaderRow(wh, 3);
    ws.mergeCells(wh.number, 1, wh.number, 3);
    warnings.forEach((w, i) => {
      const row = ws.addRow([String(w)]);
      styleDataRow(row, 3, i % 2 === 1);
      ws.mergeCells(row.number, 1, row.number, 3);
    });
  }

  return ws;
};

export const exportBillingExcel = async (data, filename) => {
  const payload = {
    payrollTitle: data?.payrollTitle,
    lines: data?.lines || [],
    matrix: data?.matrix || {},
    companyNames: data?.companyNames || {},
    details: data?.details || [],
    warnings: data?.warnings || []
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Nómina';
  wb.created = new Date();
  wb.modified = new Date();

  buildResumenSheet(wb, payload);
  buildFacturasSheet(wb, payload);
  buildPorCentroCostoSheet(wb, payload);
  buildMatrizSheet(wb, payload);
  buildDetalleSheet(wb, payload);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'Facturacion_Intercompania.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const buildExportFromRun = (run) => {
  const costMatrix = parseJsonField(run?.costMatrixJson) || {};
  const matrix = costMatrix.matrix || {};
  const companyNames = costMatrix.companyNames || {};
  const details = Array.isArray(costMatrix.details) ? costMatrix.details : [];
  const warnings = Array.isArray(costMatrix.warnings) ? costMatrix.warnings : [];

  const storedLines = Array.isArray(costMatrix.lines) ? costMatrix.lines : [];
  const lines = (run.lines || []).map((l, idx) => {
    const stored = storedLines[idx] || storedLines.find(
      (s) => s.fromCompanyId === l.fromCompanyId
        && s.toCompanyId === l.toCompanyId
        && Number(s.baseAmount) === Number(l.baseAmount)
        && String(s.concept || '') === String(l.concept || '')
    ) || {};
    let centroCosto = stored.centroCosto || '';
    if (!centroCosto && l.concept) {
      const parts = String(l.concept).split(' — ');
      if (parts.length > 1) centroCosto = parts.slice(1).join(' — ').trim();
    }
    return {
      fromCompanyId: l.fromCompanyId,
      toCompanyId: l.toCompanyId,
      fromCompany: l.fromCompanyData?.nombre_comercial || companyNames[l.fromCompanyId] || l.fromCompanyId,
      toCompany: l.toCompanyData?.nombre_comercial || companyNames[l.toCompanyId] || l.toCompanyId,
      centroCosto,
      concept: l.concept,
      baseAmount: Number(l.baseAmount),
      marginPercentage: Number(l.marginPercentage),
      marginAmount: Number(l.marginAmount),
      ivaAmount: Number(l.ivaAmount),
      totalAmount: Number(l.totalAmount)
    };
  });

  return {
    payrollTitle: run.payrollTitle,
    lines,
    matrix,
    companyNames,
    details,
    warnings
  };
};
