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

const buildPorCentroCostoSheet = (
  wb,
  { payrollTitle, lines, operationalDetails, companyNames }
) => {
  const byCc = {};
  const receiverIds = new Set();
  const sourceRows = operationalDetails?.length ? operationalDetails : (lines || []);

  sourceRows.forEach((line) => {
    const cc = line.centroCosto || 'SIN CENTRO DE COSTO';
    const toId = line.operationalToCompanyId ?? line.toCompanyId;
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

  const title = ws.addRow(['Costos por Centro Operativo (bruto antes de mapeo legal y neteo)']);
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

const ASSIGNED_DETAIL_FIELDS = [
  'asgSueldo',
  'asgBonoDecreto',
  'asgBonoIncentivo',
  'asgBonosExtras',
  'asgHorasExtrasOtros',
  'asgBruto',
  'asgIgssLaboral',
  'asgIsr',
  'asgIgssPatronal',
  'baseAmount'
];

const addDetailAmount = (left, right) => (
  Math.round(((Number(left) || 0) + (Number(right) || 0)) * 1000000) / 1000000
);

export const consolidateBillingDetailsByEmployee = (details = []) => {
  const grouped = new Map();

  (Array.isArray(details) ? details : []).forEach((detail, index) => {
    const employeeKey = detail?.employeeId != null
      ? `id:${detail.employeeId}`
      : `name:${detail?.employeeName || 'sin-empleado'}:${index}`;
    let group = grouped.get(employeeKey);
    if (!group) {
      group = {
        ...detail,
        _costCenters: new Set(),
        _fromCompanies: new Set(),
        _destinations: new Map(),
        percentage: 0
      };
      ASSIGNED_DETAIL_FIELDS.forEach((field) => { group[field] = 0; });
      grouped.set(employeeKey, group);
    }

    if (detail?.centroCosto) group._costCenters.add(String(detail.centroCosto));
    if (detail?.fromCompany) group._fromCompanies.add(String(detail.fromCompany));
    const destination = String(detail?.toCompany || 'Sin empresa destino');
    group._destinations.set(
      destination,
      addDetailAmount(group._destinations.get(destination), detail?.percentage)
    );
    group.percentage = addDetailAmount(group.percentage, detail?.percentage);
    ASSIGNED_DETAIL_FIELDS.forEach((field) => {
      group[field] = addDetailAmount(group[field], detail?.[field]);
    });
  });

  return [...grouped.values()].map((group) => {
    const destinations = [...group._destinations.entries()];
    const result = {
      ...group,
      centroCosto: [...group._costCenters].join(' / '),
      fromCompany: [...group._fromCompanies].join(' / '),
      toCompany: destinations.length <= 1
        ? (destinations[0]?.[0] || '')
        : destinations.map(([name, percentage]) => `${name} (${Number(percentage).toFixed(2)}%)`).join(' / ')
    };
    delete result._costCenters;
    delete result._fromCompanies;
    delete result._destinations;
    return result;
  });
};

const buildDetalleSheet = (wb, { payrollTitle, billingMonth, details }) => {
  const consolidatedDetails = consolidateBillingDetailsByEmployee(details);
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
    13, 12, 12, 12, 13, 12, 12,
    10, 13, 13, 11, 12, 13,
    11, 13, 13, 12, 11, 11, 12, 10, 12, 16
  ]);

  const title = ws.addRow(['Detalle por Empleado — Distribución de Costos (desglose de nómina)']);
  styleTitleRow(title, cols);
  ws.mergeCells(1, 1, 1, Math.min(cols, 10));

  const meta = ws.addRow([
    `Nómina: ${payrollTitle || '—'}`,
    '',
    '',
    `Empleados: ${consolidatedDetails.length}`,
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

  const moneyCols = Array.from({ length: 23 }, (_, index) => index + 9);
  let sumAmount = 0;
  const detailPeriod = resolveBillingMonthYear({ billingMonth, payrollTitle }) || '—';

  consolidatedDetails.forEach((d, idx) => {
    const pct = Number(d.percentage) || 0;
    const amount = Number(d.baseAmount) || 0;
    const employeeCost = Number(d.employeeCost ?? d.totalCost) || (pct > 0 ? amount / (pct / 100) : 0);
    const row = ws.addRow([
      d.employeeId ?? '',
      d.employeeName || '',
      d.centroCosto || '',
      d.fromCompany || '',
      d.toCompany || '',
      pct,
      d.days != null ? Number(d.days) : '',
      detailPeriod,
      Number(d.sueldoOrdinario) || 0,
      Number(d.bonoDecreto) || 0,
      Number(d.bonoIncentivo) || 0,
      Number(d.bonosExtras) || 0,
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
    row.getCell(31).font = { bold: true, size: 10, name: 'Calibri', color: { argb: '196F3D' } };
    sumAmount += amount;
  });

  if (consolidatedDetails.length === 0) {
    const empty = ws.addRow([
      'Sin detalle por empleado. Regenere la vista previa o confirme de nuevo la facturación para obtener el desglose completo.'
    ]);
    styleDataRow(empty, cols, false);
    ws.mergeCells(empty.number, 1, empty.number, cols);
  } else {
    const totalValues = Array(cols).fill('');
    totalValues[1] = 'TOTALES';
    totalValues[30] = sumAmount;
    const total = ws.addRow(totalValues);
    styleDataRow(total, cols, false);
    for (let c = 1; c <= cols; c += 1) {
      const cell = total.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalBg } };
      cell.font = { bold: true, size: 10, name: 'Calibri' };
    }
    applyMoney(total.getCell(31));
  }

  return ws;
};

const MONTH_NAMES_ES_UPPER = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

export const resolveBillingMonthYear = ({ billingMonth, payrollTitle } = {}) => {
  const monthKey = String(billingMonth || '').trim();
  const keyMatch = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (keyMatch) {
    const year = Number(keyMatch[1]);
    const monthIndex = Number(keyMatch[2]) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${MONTH_NAMES_ES_UPPER[monthIndex]} ${year}`;
    }
  }

  const titleMatch = String(payrollTitle || '').match(
    /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{4})\b/i
  );
  if (!titleMatch) return null;
  return `${String(titleMatch[1]).toUpperCase()} ${titleMatch[2]}`;
};

const ZONA_FRANCA_NOTE = 'No afecta al IVA (Decreto 65-89 Ley de Zonas Francas)';

/** IDs canónicos del maestro (Proquima / Unhesa / Econacional / Cleartec). */
const COMPANY_ID = {
  PROQUIMA: 1,
  UNHESA: 2,
  ECONACIONAL: 3,
  CLEARTEC: 4
};

const shortCompanyName = (name) => {
  if (!name) return '';
  return String(name)
    .replace(/,?\s*S\.?\s*A\.?\s*$/i, '')
    .replace(/,?\s*SOCIEDAD\s+AN[OÓ]NIMA\s*$/i, '')
    .trim()
    .toUpperCase();
};

const normalizeCompanyKey = (name) => shortCompanyName(name)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ');

const isProquimaName = (name) => {
  const n = normalizeCompanyKey(name);
  return n.includes('PROQUIMA');
};

const isUnhesaName = (name) => {
  const n = normalizeCompanyKey(name);
  return n.includes('UNHESA') || n.includes('UNION HERMANOS') || n.includes('UNION HERMANO');
};

const isEconacionalName = (name) => normalizeCompanyKey(name).includes('ECONACIONAL');

const isCleartecName = (name) => normalizeCompanyKey(name).includes('CLEARTEC');

const companyIdOf = (line, side) => {
  const id = Number(side === 'from' ? line?.fromCompanyId : line?.toCompanyId);
  return Number.isFinite(id) && id > 0 ? id : null;
};

const isProquimaUnhesaPair = (line) => {
  const fromId = companyIdOf(line, 'from');
  const toId = companyIdOf(line, 'to');
  if (fromId && toId) {
    const set = new Set([fromId, toId]);
    return set.has(COMPANY_ID.PROQUIMA) && set.has(COMPANY_ID.UNHESA);
  }
  const fromP = isProquimaName(line?.fromCompany);
  const fromU = isUnhesaName(line?.fromCompany);
  const toP = isProquimaName(line?.toCompany);
  const toU = isUnhesaName(line?.toCompany);
  return (fromP && toU) || (fromU && toP);
};

const isEconacionalToCleartec = (line) => {
  const fromId = companyIdOf(line, 'from');
  const toId = companyIdOf(line, 'to');
  if (fromId && toId) {
    return fromId === COMPANY_ID.ECONACIONAL && toId === COMPANY_ID.CLEARTEC;
  }
  return isEconacionalName(line?.fromCompany) && isCleartecName(line?.toCompany);
};

const roundMoney2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const splitAmountPair = (amount) => {
  const total = roundMoney2(amount);
  const first = roundMoney2(total / 2);
  const second = roundMoney2(total - first);
  return [first, second];
};

/**
 * Transformaciones solo para hoja Vista Previa 2:
 * - Cleartec zona franca → Cleartec + Sabomix 50/50
 * - Proquima↔Unhesa → bloque neto positivo + espejo negativo
 */
const buildVistaPrevia2DisplayLines = (lines) => {
  const withSabomix = [];
  (lines || []).forEach((line) => {
    if (!isEconacionalToCleartec(line)) {
      withSabomix.push(line);
      return;
    }
    const [baseA, baseB] = splitAmountPair(line.baseAmount);
    const [marginA, marginB] = splitAmountPair(line.marginAmount);
    const [ivaA, ivaB] = splitAmountPair(line.ivaAmount);
    const [totalA, totalB] = splitAmountPair(line.totalAmount);
    withSabomix.push({
      ...line,
      toCompany: 'CLEARTEC',
      toCompanyId: COMPANY_ID.CLEARTEC,
      baseAmount: baseA,
      marginAmount: marginA,
      ivaAmount: ivaA,
      totalAmount: totalA,
      applyIva: false
    });
    withSabomix.push({
      ...line,
      toCompany: 'SABOMIX',
      toCompanyId: null,
      baseAmount: baseB,
      marginAmount: marginB,
      ivaAmount: ivaB,
      totalAmount: totalB,
      applyIva: false
    });
  });

  const display = [];
  withSabomix.forEach((line) => {
    if (!isProquimaUnhesaPair(line)) {
      display.push(line);
      return;
    }
    // Redondear ambos bloques igual para que el espejo +/- cuadre al céntimo.
    const positive = {
      ...line,
      baseAmount: roundMoney2(line.baseAmount),
      marginAmount: roundMoney2(line.marginAmount),
      ivaAmount: roundMoney2(line.ivaAmount),
      totalAmount: roundMoney2(line.totalAmount)
    };
    display.push(positive);
    display.push({
      ...positive,
      fromCompanyId: positive.toCompanyId,
      toCompanyId: positive.fromCompanyId,
      fromCompany: positive.toCompany,
      toCompany: positive.fromCompany,
      baseAmount: -positive.baseAmount,
      marginAmount: -positive.marginAmount,
      ivaAmount: -positive.ivaAmount,
      totalAmount: -positive.totalAmount
    });
  });
  return display;
};

const resolveBillingPeriod = (data) => {
  const label = resolveBillingMonthYear(data);
  if (label) {
    const match = /^(.*)\s+(\d{4})$/.exec(label);
    if (match) {
      return { year: Number(match[2]), monthName: match[1] };
    }
  }
  const now = new Date();
  return { year: now.getFullYear(), monthName: MONTH_NAMES_ES_UPPER[now.getMonth()] };
};

const buildFacturarInstruction = (line, period) => {
  const from = shortCompanyName(line.fromCompany);
  const to = shortCompanyName(line.toCompany);
  return `FACTURAR CON FECHA ${period.monthName} SERVICIOS DE RRHH DE ${period.monthName} ${period.year} DE ${from} A ${to}`;
};

const lineSkipsIva = (line) => {
  if (line?.applyIva === false || line?.applyIva === 0 || line?.applyIva === '0') return true;
  // Historial antiguo sin flag: si hay base y IVA en 0, asumir zona franca
  if (line?.applyIva == null) {
    return Number(line?.ivaAmount) === 0 && Number(line?.baseAmount) > 0;
  }
  return false;
};

/**
 * Hoja "Vista Previa 2": instrucciones de facturación por bloque
 * (como el Excel operativo: texto amarillo + tabla BASE/MARGEN/IVA/TOTAL).
 */
const buildVistaPrevia2Sheet = (wb, data) => {
  const lines = buildVistaPrevia2DisplayLines(
    Array.isArray(data?.lines) ? data.lines : []
  );
  const period = resolveBillingPeriod(data);
  const ws = wb.addWorksheet('Vista Previa 2');

  // Dos columnas de bloques: A–D (izq) y F–I (der)
  setCols(ws, [16, 14, 14, 16, 3, 16, 14, 14, 16]);

  const yellowFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFF00' }
  };
  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'D9E2F3' }
  };
  const blockBorder = {
    top: { style: 'thin', color: { argb: '000000' } },
    left: { style: 'thin', color: { argb: '000000' } },
    bottom: { style: 'thin', color: { argb: '000000' } },
    right: { style: 'thin', color: { argb: '000000' } }
  };
  const vistaMoneyFmt = '#,##0.00';

  const styleInstruction = (row, startCol) => {
    for (let c = 0; c < 4; c += 1) {
      const cell = row.getCell(startCol + c);
      cell.fill = yellowFill;
      cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: '000000' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    }
    row.height = 32;
  };

  const writeBlock = (startRow, startCol, line) => {
    let r = startRow;
    const instruction = buildFacturarInstruction(line, period);
    const instrRow = ws.getRow(r);
    instrRow.getCell(startCol).value = instruction;
    styleInstruction(instrRow, startCol);
    ws.mergeCells(r, startCol, r, startCol + 3);
    r += 1;

    if (lineSkipsIva(line)) {
      const noteRow = ws.getRow(r);
      noteRow.getCell(startCol).value = ZONA_FRANCA_NOTE;
      noteRow.getCell(startCol).font = {
        bold: true,
        size: 9,
        name: 'Calibri',
        color: { argb: '000000' }
      };
      noteRow.getCell(startCol).alignment = { vertical: 'middle', wrapText: true };
      ws.mergeCells(r, startCol, r, startCol + 3);
      noteRow.height = 18;
      r += 1;
    }

    const headers = ['BASE', 'MARGEN', 'IVA', 'TOTAL'];
    const headerRow = ws.getRow(r);
    headers.forEach((label, i) => {
      const cell = headerRow.getCell(startCol + i);
      cell.value = label;
      cell.fill = headerFill;
      cell.font = { bold: true, size: 10, name: 'Calibri' };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = blockBorder;
    });
    headerRow.height = 18;
    r += 1;

    const values = [
      Number(line.baseAmount) || 0,
      Number(line.marginAmount) || 0,
      Number(line.ivaAmount) || 0,
      Number(line.totalAmount) || 0
    ];
    const valueRow = ws.getRow(r);
    values.forEach((val, i) => {
      const cell = valueRow.getCell(startCol + i);
      cell.value = val;
      cell.numFmt = vistaMoneyFmt;
      cell.font = { size: 10, name: 'Calibri' };
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.border = blockBorder;
      if (i === 3) cell.font = { bold: true, size: 10, name: 'Calibri' };
    });
    valueRow.height = 18;
    r += 1;

    return r; // next free row after block (no spacer yet)
  };

  if (lines.length === 0) {
    const empty = ws.addRow(['Sin facturas para vista previa. Genere el cálculo de facturación primero.']);
    empty.getCell(1).font = { size: 11, name: 'Calibri', color: { argb: COLORS.muted } };
    ws.mergeCells(1, 1, 1, 4);
    return ws;
  }

  // Emparejar facturas en dos columnas (como el Excel de referencia)
  let leftRow = 1;
  let rightRow = 1;
  const blockGap = 2; // filas en blanco entre bloques

  lines.forEach((line, idx) => {
    const useLeft = idx % 2 === 0;
    if (useLeft) {
      const end = writeBlock(leftRow, 1, line);
      leftRow = end + blockGap;
    } else {
      const end = writeBlock(rightRow, 6, line);
      rightRow = end + blockGap;
    }
  });

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

export const buildBillingWorkbook = (data, ExcelJS) => {
  if (!ExcelJS) throw new Error('ExcelJS no fue cargado');
  const payload = {
    payrollTitle: data?.payrollTitle,
    billingMonth: data?.billingMonth,
    lines: data?.lines || [],
    matrix: data?.matrix || {},
    companyNames: data?.companyNames || {},
    details: data?.details || [],
    operationalDetails: data?.operationalDetails || [],
    warnings: data?.warnings || []
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Nómina';
  wb.created = new Date();
  wb.modified = new Date();

  buildVistaPrevia2Sheet(wb, payload);
  buildResumenSheet(wb, payload);
  buildFacturasSheet(wb, payload);
  buildPorCentroCostoSheet(wb, payload);
  buildMatrizSheet(wb, payload);
  buildDetalleSheet(wb, payload);
  return wb;
};

export const exportBillingExcel = async (data, filename) => {
  const { generateAndDownloadExcel } = await import('./excelWorkerClient');
  await generateAndDownloadExcel(
    'billing',
    data,
    filename || 'Vista_Previa_2_Facturacion.xlsx'
  );
};

export const buildExportFromRun = (run) => {
  const costMatrix = parseJsonField(run?.costMatrixJson) || {};
  const matrix = costMatrix.matrix || {};
  const companyNames = costMatrix.companyNames || {};
  const details = Array.isArray(costMatrix.details) ? costMatrix.details : [];
  const operationalDetails = Array.isArray(costMatrix.operationalDetails)
    ? costMatrix.operationalDetails
    : [];
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
      totalAmount: Number(l.totalAmount),
      applyIva: l.applyIva != null ? l.applyIva : stored.applyIva
    };
  });

  return {
    payrollTitle: run.payrollTitle,
    billingMonth: costMatrix.billingMonth,
    lines,
    matrix,
    companyNames,
    details,
    operationalDetails,
    warnings
  };
};
