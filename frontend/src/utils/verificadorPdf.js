import { jsPDF } from 'jspdf';
import { getNetPayable } from './payrollPeriod.js';

const PAGE = {
  width: 1008,
  height: 612,
  border: 3,
  tableX: 3,
  tableWidth: 934,
  headerY: 45,
  headerHeight: 27,
  dataStartY: 84,
  dataBottomY: 238,
  dividerY: 246,
};

const COLUMN_WIDTHS = [223, 85, 54, 71, 74, 43, 89, 78, 95, 122];
const HEADERS = [
  ['Nombre de', 'Colaborador'],
  ['Empresa'],
  ['Tipo de', 'Personal'],
  ['LOTE A', 'ELIMINAR'],
  ['LOTE', 'CORRECTO'],
  ['Soporte'],
  ['Banco', 'de Pago'],
  ['Medio de', 'Pago'],
  ['Monto'],
  ['Monto', 'Total'],
];

const COLORS = {
  black: [0, 0, 0],
  blueBorder: [0, 32, 210],
  company: [0, 48, 112],
  lotHeader: [221, 235, 202],
  lotControl: [252, 190, 137],
  paymentDate: [255, 245, 0],
  note: [255, 245, 0],
};

const columnStarts = COLUMN_WIDTHS.reduce((starts, width, index) => {
  if (index === 0) return [PAGE.tableX];
  return [...starts, starts[index - 1] + COLUMN_WIDTHS[index - 1]];
}, []);

const readFirst = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
};

const employeeName = (employee) => {
  const parts = [
    employee?.primer_apellido,
    employee?.segundo_apellido,
    employee?.apellido_casada,
    employee?.primer_nombre,
    employee?.segundo_nombre,
    employee?.otro_nombre,
  ].filter(Boolean);

  if (parts.length) return parts.join(' ');
  return `${employee?.nombres || ''} ${employee?.apellidos || ''}`.trim() || 'Empleado';
};

const formatDate = (dateValue) => {
  const rawValue = String(dateValue || '');
  const localDateMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = localDateMatch
    ? new Date(
      Number(localDateMatch[1]),
      Number(localDateMatch[2]) - 1,
      Number(localDateMatch[3]),
      12,
    )
    : dateValue
      ? new Date(dateValue)
      : new Date();
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const day = String(validDate.getDate()).padStart(2, '0');
  const month = String(validDate.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${validDate.getFullYear()}`;
};

const formatAmount = (value) => Number(value || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const resolveCompany = (employee, companies) => (
  companies?.find(company => String(company.id) === String(employee?.empresa_principal))?.nombre_comercial
  || employee?.company
  || 'Sin Empresa'
);

const compactCompanyName = (companyName) => String(companyName || '')
  .replace(/,?\s*S\.?\s*A\.?$/i, '')
  .replace(/\s+SOCIEDAD\s+AN[ÓO]NIMA$/i, '')
  .trim()
  .toUpperCase();

const resolveBank = (employees) => {
  const rawBank = employees
    .map(employee => readFirst(employee, ['banco', 'bankName', 'nombre_banco']))
    .find(Boolean);

  if (!rawBank) return '';

  const normalized = String(rawBank).trim();
  if (/industrial/i.test(normalized)) return 'BI';
  if (/promerica/i.test(normalized)) return 'PROMERICA';
  return normalized.toUpperCase();
};

const resolveLot = (group, employees, type) => {
  const groupKeys = type === 'delete'
    ? ['lote_a_eliminar', 'loteAEliminar', 'batchToDelete']
    : ['lote_correcto', 'loteCorrecto', 'correctBatch'];
  const employeeKeys = type === 'delete'
    ? ['lote_a_eliminar', 'loteAEliminar']
    : ['lote_correcto', 'loteCorrecto'];

  return readFirst(group, groupKeys)
    || employees.map(employee => readFirst(employee, employeeKeys)).find(Boolean)
    || '';
};

const buildCompanyGroups = (data, companies) => {
  const groups = new Map();

  (data || []).forEach((employee) => {
    const companyName = resolveCompany(employee, companies);
    if (!groups.has(companyName)) {
      groups.set(companyName, { companyName, transfers: [], cheques: [] });
    }
    const target = String(employee?.tipo_de_pago || '').toLowerCase() === 'cheque'
      ? groups.get(companyName).cheques
      : groups.get(companyName).transfers;
    target.push(employee);
  });

  return [...groups.values()];
};

const fitText = (doc, value, maxWidth) => {
  const text = String(value ?? '');
  if (doc.getTextWidth(text) <= maxWidth) return text;

  let shortened = text;
  while (shortened.length > 1 && doc.getTextWidth(`${shortened}...`) > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened}...`;
};

const drawTextInColumn = (doc, value, columnIndex, y, options = {}) => {
  const x = columnStarts[columnIndex];
  const width = COLUMN_WIDTHS[columnIndex];
  const align = options.align || 'left';
  const padding = options.padding ?? 3;
  const text = fitText(doc, value, width - padding * 2);
  const textX = align === 'right'
    ? x + width - padding
    : align === 'center'
      ? x + width / 2
      : x + padding;

  doc.text(text, textX, y, { align });
};

const drawPageFrame = (doc) => {
  doc.setDrawColor(...COLORS.blueBorder);
  doc.setLineWidth(1.2);
  doc.rect(
    PAGE.border / 2,
    PAGE.border / 2,
    PAGE.width - PAGE.border,
    PAGE.height - PAGE.border,
  );
  doc.setDrawColor(...COLORS.black);
};

const drawDocumentHeader = (doc, paymentDate, continuation = false) => {
  drawPageFrame(doc);

  doc.setTextColor(...COLORS.black);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('GRUPO ECONSA', PAGE.tableX, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    continuation
      ? 'VERIFICADOR DE PAGO DE NOMINA - CONTINUACION'
      : 'VERIFICADOR DE PAGO DE NOMINA',
    PAGE.tableX,
    27,
  );

  doc.setFont('helvetica', 'bold');
  doc.text('FECHA DE PAGO:', PAGE.tableX, 42);
  doc.setFillColor(...COLORS.paymentDate);
  doc.rect(columnStarts[1], 30, COLUMN_WIDTHS[1], 15, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text(paymentDate, columnStarts[1] + COLUMN_WIDTHS[1] / 2, 41.5, { align: 'center' });

  HEADERS.forEach((lines, index) => {
    const x = columnStarts[index];
    const width = COLUMN_WIDTHS[index];
    if (index === 3 || index === 4) {
      doc.setFillColor(...COLORS.lotHeader);
      doc.rect(x, PAGE.headerY, width, PAGE.headerHeight, 'F');
    }
    doc.setDrawColor(...COLORS.black);
    doc.setLineWidth(0.75);
    doc.rect(x, PAGE.headerY, width, PAGE.headerHeight);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    if (lines.length === 1) {
      doc.text(lines[0], x + width / 2, PAGE.headerY + 16, { align: 'center' });
    } else {
      doc.text(lines[0], x + width / 2, PAGE.headerY + 11, { align: 'center' });
      doc.text(lines[1], x + width / 2, PAGE.headerY + 21, { align: 'center' });
    }
  });
};

const drawCompanyHeading = (doc, companyName, y, continuation = false) => {
  doc.setFontSize(8.6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text('Empresa:', PAGE.tableX, y);

  doc.setTextColor(...COLORS.company);
  const suffix = continuation ? ' (CONTINUACION)' : '';
  doc.text(
    fitText(doc, `${String(companyName).toUpperCase()}${suffix}`, 250),
    PAGE.tableX + 43,
    y,
  );
  doc.setTextColor(...COLORS.black);
};

const drawTransferRow = (doc, group, payrollGroup, y) => {
  const sum = payrollGroup.transfers.reduce(
    (total, employee) => total + getNetPayable(employee, group?.periodType),
    0,
  );

  doc.setFillColor(...COLORS.lotControl);
  doc.rect(columnStarts[3], y - 10, COLUMN_WIDTHS[3], 15, 'F');
  doc.rect(columnStarts[4], y - 10, COLUMN_WIDTHS[4], 15, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.4);
  drawTextInColumn(doc, 'Varios Plantilla', 0, y);

  doc.setFont('helvetica', 'bold');
  drawTextInColumn(doc, resolveLot(group, payrollGroup.transfers, 'delete'), 3, y, { align: 'right' });
  drawTextInColumn(doc, resolveLot(group, payrollGroup.transfers, 'correct'), 4, y, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  drawTextInColumn(doc, 'Nomina', 5, y);
  drawTextInColumn(doc, resolveBank(payrollGroup.transfers), 6, y, { align: 'center' });
  drawTextInColumn(doc, 'Transferencia', 7, y, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.text('Q', columnStarts[8] + 5, y);
  doc.text(formatAmount(sum), columnStarts[8] + COLUMN_WIDTHS[8] - 5, y, { align: 'right' });

  doc.setLineWidth(0.7);
  doc.line(columnStarts[5], y + 4, PAGE.tableX + PAGE.tableWidth, y + 4);
  return sum;
};

const drawChequeRow = (doc, employee, companyName, group, y) => {
  const amount = getNetPayable(employee, group?.periodType);
  const personalType = readFirst(employee, [
    'condicion_laboral',
    'tipo_personal',
    'tipoPersonal',
  ]) || 'FIJO';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.1);
  drawTextInColumn(doc, employeeName(employee), 0, y);
  drawTextInColumn(doc, compactCompanyName(companyName), 1, y);
  drawTextInColumn(doc, String(personalType).toUpperCase(), 2, y);
  drawTextInColumn(doc, 'CHEQUE', 7, y, { align: 'center' });
  doc.text('Q', columnStarts[8] + 5, y);
  doc.text(formatAmount(amount), columnStarts[8] + COLUMN_WIDTHS[8] - 5, y, { align: 'right' });

  return amount;
};

const drawChequeSubtotal = (doc, subtotal, y) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.6);
  doc.text(`Q${formatAmount(subtotal)}`, columnStarts[9] + COLUMN_WIDTHS[9] - 4, y, { align: 'right' });
};

const drawTableDivider = (doc) => {
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.65);
  doc.line(PAGE.tableX, PAGE.dividerY, PAGE.tableX + PAGE.tableWidth, PAGE.dividerY);
  doc.line(PAGE.tableX, PAGE.dividerY + 2, PAGE.tableX + PAGE.tableWidth, PAGE.dividerY + 2);
};

const drawGrandTotal = (doc, grandTotal) => {
  const valueX = columnStarts[8];
  const valueRight = PAGE.tableX + PAGE.tableWidth;

  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.75);
  doc.line(valueX, 305, valueRight, 305);
  doc.line(valueX, 320, valueRight, 320);
  doc.line(valueX, 322, valueRight, 322);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('TOTAL GENERAL', valueX - 8, 340, { align: 'right' });
  doc.text('Q', valueX + 8, 340);
  doc.text(formatAmount(grandTotal), valueRight - 6, 340, { align: 'right' });

  doc.line(valueX, 344, valueRight, 344);
  doc.line(valueX, 347, valueRight, 347);
};

const drawSignaturesAndNote = (doc, paymentDate) => {
  const leftStart = PAGE.tableX;
  const leftEnd = 310;
  const rightStart = 636;
  const rightEnd = PAGE.tableX + PAGE.tableWidth;

  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(1.35);
  doc.line(leftStart, 421, leftEnd, 421);
  doc.line(rightStart, 421, rightEnd, 421);
  doc.line(leftStart, 510, leftEnd, 510);
  doc.line(rightStart, 510, rightEnd, 510);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Hecho por:   Alejandra Pérez', leftStart, 433);
  doc.text('Revisado por: Iris de Lemus (Recursos Humanos)', rightStart + 8, 433);
  doc.text('Revisado por: Walter Mendez (Auditoria)', leftStart + 10, 522);
  doc.text('Autorizado por: Gerardo Estrada (Presidencia)', rightStart + 23, 522);

  const noteX = columnStarts[1];
  const noteY = 540;
  const noteWidth = 491;
  doc.setFillColor(...COLORS.note);
  doc.rect(noteX, noteY, noteWidth, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Nota: Transferencia programada para', noteX + 4, noteY + 11);
  doc.text(`${paymentDate} INMEDIATO`, noteX + 220, noteY + 11);
};

/**
 * Genera el Verificador de Pago con la misma distribución del formato
 * institucional usado en Excel.
 */
export function buildVerificadorPdf({ data = [], group = {}, companies = [] } = {}) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'legal',
    compress: true,
    putOnlyUsedFonts: true,
  });

  const paymentDate = formatDate(group?.closedAt || group?.date);
  const payrollGroups = buildCompanyGroups(data, companies);
  let pageNumber = 1;
  let y = PAGE.dataStartY;
  let grandTotal = 0;

  doc.setProperties({
    title: `Verificador de Pago - ${group?.title || 'Nomina'}`,
    subject: 'Verificador de Pago de Nomina',
    author: 'Grupo ECONSA',
    creator: 'Sistema de Nomina',
  });

  const startContinuationPage = () => {
    drawTableDivider(doc);
    doc.addPage('legal', 'landscape');
    pageNumber += 1;
    drawDocumentHeader(doc, paymentDate, true);
    y = PAGE.dataStartY;
  };

  drawDocumentHeader(doc, paymentDate);

  payrollGroups.forEach((payrollGroup) => {
    const hasTransfer = payrollGroup.transfers.length > 0;
    const hasCheques = payrollGroup.cheques.length > 0;
    if (!hasTransfer && !hasCheques) return;

    const minimumSectionHeight = 15 + (hasTransfer || hasCheques ? 15 : 0);
    if (y + minimumSectionHeight > PAGE.dataBottomY) startContinuationPage();

    drawCompanyHeading(doc, payrollGroup.companyName, y);
    y += 15;

    if (hasTransfer) {
      if (y + 15 > PAGE.dataBottomY) {
        startContinuationPage();
        drawCompanyHeading(doc, payrollGroup.companyName, y, true);
        y += 15;
      }
      grandTotal += drawTransferRow(doc, group, payrollGroup, y);
      y += 15;
    }

    let chequeSubtotal = 0;
    payrollGroup.cheques.forEach((employee) => {
      if (y + 15 > PAGE.dataBottomY) {
        startContinuationPage();
        drawCompanyHeading(doc, payrollGroup.companyName, y, true);
        y += 15;
      }
      const amount = drawChequeRow(doc, employee, payrollGroup.companyName, group, y);
      chequeSubtotal += amount;
      grandTotal += amount;
      y += 15;
    });

    if (hasCheques) {
      if (y + 43 > PAGE.dataBottomY) {
        startContinuationPage();
        drawCompanyHeading(doc, payrollGroup.companyName, y, true);
        y += 15;
      }
      y += 28;
      drawChequeSubtotal(doc, chequeSubtotal, y);
      y += 15;
    }
  });

  drawTableDivider(doc);
  drawGrandTotal(doc, grandTotal);
  drawSignaturesAndNote(doc, paymentDate);

  if (pageNumber > 1) {
    const finalPage = doc.getNumberOfPages();
    for (let page = 1; page <= finalPage; page += 1) {
      doc.setPage(page);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(90, 90, 90);
      doc.text(`Página ${page} de ${finalPage}`, PAGE.width - 12, PAGE.height - 8, { align: 'right' });
    }
  }

  return doc;
}
