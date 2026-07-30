import { jsPDF } from 'jspdf';
import { getNetPayable } from './payrollPeriod.js';

const PAGE = {
  width: 1008,
  height: 612,
  tableX: 18,
  tableWidth: 911,
  headerY: 70,
  headerHeight: 34,
  dataStartY: 130,
  dataBottomY: 285,
};

const COLUMN_WIDTHS = [277, 90, 62, 57, 92, 100, 103, 130];
const HEADERS = [
  ['Nombre de', 'Colaborador'],
  ['Empresa'],
  ['Tipo de', 'Personal'],
  ['Soporte'],
  ['Banco', 'de Pago'],
  ['Medio de', 'Pago'],
  ['Monto'],
  ['Monto', 'Total'],
];

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
  return `${employee?.apellidos || ''} ${employee?.nombres || ''}`.trim() || 'Empleado';
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
  .toLowerCase();

const buildCompanyGroups = (employees, companies) => {
  const groups = new Map();
  (employees || [])
    .filter(employee => String(employee?.tipo_de_pago || '').toLowerCase() === 'cheque')
    .forEach((employee) => {
      const companyName = resolveCompany(employee, companies);
      if (!groups.has(companyName)) groups.set(companyName, []);
      groups.get(companyName).push(employee);
    });
  return [...groups.entries()].map(([companyName, cheques]) => ({ companyName, cheques }));
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
  doc.setDrawColor(185, 185, 185);
  doc.setLineWidth(1);
  doc.rect(6, 6, PAGE.width - 12, PAGE.height - 12);
  doc.setDrawColor(0, 0, 0);
};

const drawDocumentHeader = (doc, paymentDate, continuation = false) => {
  drawPageFrame(doc);

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('GRUPO ECONSA', PAGE.tableX, 22);

  doc.setFont('helvetica', 'normal');
  doc.text(
    continuation ? 'SOLICITUD DE CHEQUES - CONTINUACION' : 'SOLICITUD DE CHEQUES',
    PAGE.tableX,
    38,
  );

  doc.setFont('helvetica', 'bold');
  doc.text('FECHA DE PAGO:', PAGE.tableX, 54);
  doc.setFillColor(255, 245, 0);
  doc.rect(columnStarts[1], 41, COLUMN_WIDTHS[1], 17, 'F');
  doc.text(paymentDate, columnStarts[1] + COLUMN_WIDTHS[1] / 2, 53.5, { align: 'center' });

  HEADERS.forEach((lines, index) => {
    const x = columnStarts[index];
    const width = COLUMN_WIDTHS[index];
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.65);
    doc.rect(x, PAGE.headerY, width, PAGE.headerHeight);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    if (lines.length === 1) {
      doc.text(lines[0], x + width / 2, PAGE.headerY + 20, { align: 'center' });
    } else {
      doc.text(lines[0], x + width / 2, PAGE.headerY + 14, { align: 'center' });
      doc.text(lines[1], x + width / 2, PAGE.headerY + 27, { align: 'center' });
    }
  });
};

const drawCompanyHeading = (doc, companyName, y, continuation = false) => {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Empresa:', PAGE.tableX, y);
  const suffix = continuation ? ' (CONTINUACION)' : '';
  doc.text(
    fitText(doc, `${String(companyName).toUpperCase()}${suffix}`, 270),
    PAGE.tableX + 62,
    y,
  );
};

const drawChequeRow = (doc, employee, companyName, group, y) => {
  const amount = getNetPayable(employee, group?.periodType);
  const personalType = readFirst(employee, [
    'condicion_laboral',
    'tipo_personal',
    'tipoPersonal',
  ]) || 'fijo';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.4);
  drawTextInColumn(doc, employeeName(employee), 0, y);
  drawTextInColumn(doc, compactCompanyName(companyName), 1, y);
  drawTextInColumn(doc, String(personalType).toLowerCase(), 2, y);
  drawTextInColumn(doc, 'cheque', 5, y, { align: 'left' });
  drawTextInColumn(doc, formatAmount(amount), 6, y, { align: 'right' });
  return amount;
};

const drawCompanySubtotal = (doc, subtotal, y) => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  drawTextInColumn(doc, formatAmount(subtotal), 7, y, { align: 'right' });
};

const drawTotalsAndSignatures = (doc, total) => {
  const totalValueX = columnStarts[7];
  const totalValueRight = PAGE.tableX + PAGE.tableWidth;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.65);
  doc.line(totalValueX, 330, totalValueRight, 330);
  doc.line(totalValueX, 350, totalValueRight, 350);
  doc.line(totalValueX, 352, totalValueRight, 352);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('TOTAL GENERAL', totalValueX - 25, 373, { align: 'right' });
  doc.text('Q', totalValueX - 12, 400);
  doc.text(formatAmount(total), totalValueRight - 6, 400, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text('Elaborado por: Alejandra Pérez', PAGE.tableX, 400);

  doc.setLineWidth(0.8);
  doc.line(593, 530, 980, 530);
  doc.text('Autorizado por: Walter Mendez (Auditoria Interna)', PAGE.tableX, 548);
  doc.text('Autorizado por: Iris de Lemus (Recursos Humanos)', 604, 548);
};

/**
 * Genera la Solicitud de Cheques con la distribución del formato
 * institucional usado en Excel.
 */
export function buildSolicitudChequesPdf({ data = [], group = {}, companies = [] } = {}) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'legal',
    compress: true,
    putOnlyUsedFonts: true,
  });

  const paymentDate = formatDate(group?.closedAt || group?.date);
  const companyGroups = buildCompanyGroups(data, companies);
  let y = PAGE.dataStartY;
  let total = 0;
  let pageNumber = 1;

  doc.setProperties({
    title: `Solicitud de Cheques - ${group?.title || 'Nomina'}`,
    subject: 'Solicitud de Cheques',
    author: 'Grupo ECONSA',
    creator: 'Sistema de Nomina',
  });

  const startContinuationPage = () => {
    doc.addPage('legal', 'landscape');
    pageNumber += 1;
    drawDocumentHeader(doc, paymentDate, true);
    y = PAGE.dataStartY;
  };

  drawDocumentHeader(doc, paymentDate);

  companyGroups.forEach((companyGroup) => {
    if (y + 34 > PAGE.dataBottomY) startContinuationPage();

    drawCompanyHeading(doc, companyGroup.companyName, y);
    y += 20;

    let companySubtotal = 0;
    companyGroup.cheques.forEach((employee) => {
      if (y + 18 > PAGE.dataBottomY) {
        startContinuationPage();
        drawCompanyHeading(doc, companyGroup.companyName, y, true);
        y += 20;
      }
      const amount = drawChequeRow(doc, employee, companyGroup.companyName, group, y);
      companySubtotal += amount;
      total += amount;
      y += 18;
    });

    if (y + 36 > PAGE.dataBottomY) {
      startContinuationPage();
      drawCompanyHeading(doc, companyGroup.companyName, y, true);
      y += 20;
    }
    y += 18;
    drawCompanySubtotal(doc, companySubtotal, y);
    y += 24;
  });

  drawTotalsAndSignatures(doc, total);

  if (pageNumber > 1) {
    const finalPage = doc.getNumberOfPages();
    for (let page = 1; page <= finalPage; page += 1) {
      doc.setPage(page);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(90, 90, 90);
      doc.text(`Página ${page} de ${finalPage}`, PAGE.width - 14, PAGE.height - 12, { align: 'right' });
    }
  }

  return doc;
}
