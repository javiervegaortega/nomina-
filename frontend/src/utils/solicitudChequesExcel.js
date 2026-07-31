import { getNetPayable } from './payrollPeriod.js';

const COLORS = {
  black: '000000',
  paymentDate: 'FFF500',
};

const COLUMNS = [
  { key: 'name', width: 38 },
  { key: 'company', width: 16 },
  { key: 'personalType', width: 14 },
  { key: 'support', width: 12 },
  { key: 'bank', width: 14 },
  { key: 'paymentMethod', width: 16 },
  { key: 'amount', width: 14 },
  { key: 'totalAmount', width: 18 },
];

const HEADERS = [
  'Nombre de\nColaborador',
  'Empresa',
  'Tipo de\nPersonal',
  'Soporte',
  'Banco\nde Pago',
  'Medio de\nPago',
  'Monto',
  'Monto\nTotal',
];

const thinBlackBorder = {
  top: { style: 'thin', color: { argb: COLORS.black } },
  left: { style: 'thin', color: { argb: COLORS.black } },
  bottom: { style: 'thin', color: { argb: COLORS.black } },
  right: { style: 'thin', color: { argb: COLORS.black } },
};

const fill = (cell, argb) => {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
};

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

const applyDefaultFont = (worksheet, firstRow, lastRow) => {
  for (let rowNumber = firstRow; rowNumber <= lastRow; rowNumber += 1) {
    worksheet.getRow(rowNumber).eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { ...(cell.font || {}), name: 'Arial', size: cell.font?.size || 10 };
      cell.alignment = {
        vertical: cell.alignment?.vertical || 'middle',
        horizontal: cell.alignment?.horizontal,
        wrapText: cell.alignment?.wrapText,
      };
    });
  }
};

export function buildSolicitudChequesWorkbook(
  { employees = [], group = {}, companies = [] } = {},
  ExcelJS
) {
  if (!ExcelJS) throw new Error('ExcelJS no fue cargado');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Nómina';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Sol.Cheques', {
    views: [{
      state: 'normal',
      showGridLines: false,
      zoomScale: 85,
    }],
    pageSetup: {
      paperSize: 5,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: false,
      verticalCentered: false,
      margins: {
        left: 0.1,
        right: 0.1,
        top: 0.15,
        bottom: 0.15,
        header: 0,
        footer: 0,
      },
    },
  });

  worksheet.properties.defaultRowHeight = 15;
  worksheet.pageSetup.printTitlesRow = '1:5';
  worksheet.headerFooter.oddHeader = '';
  worksheet.headerFooter.oddFooter = '';

  COLUMNS.forEach((column, index) => {
    worksheet.getColumn(index + 1).width = column.width;
  });

  worksheet.getCell('A1').value = 'GRUPO ECONSA';
  worksheet.getCell('A1').font = { name: 'Arial', size: 11, bold: true };
  worksheet.getRow(1).height = 16;

  worksheet.getCell('A2').value = 'SOLICITUD DE CHEQUES';
  worksheet.getCell('A2').font = { name: 'Arial', size: 11 };
  worksheet.getRow(2).height = 16;

  worksheet.getCell('A3').value = 'FECHA DE PAGO:';
  worksheet.getCell('A3').font = { name: 'Arial', size: 10, bold: true };
  worksheet.getCell('B3').value = formatDate(group?.closedAt || group?.date);
  worksheet.getCell('B3').font = { name: 'Arial', size: 10, bold: true };
  worksheet.getCell('B3').alignment = { horizontal: 'center', vertical: 'middle' };
  fill(worksheet.getCell('B3'), COLORS.paymentDate);
  worksheet.getRow(3).height = 18;

  const headerRow = worksheet.getRow(5);
  headerRow.values = HEADERS;
  headerRow.height = 32;
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { name: 'Arial', size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBlackBorder;
  });

  const groups = buildCompanyGroups(employees, companies);
  let currentRow = 7;

  groups.forEach((companyGroup) => {
    worksheet.mergeCells(currentRow, 1, currentRow, 8);
    const companyCell = worksheet.getCell(currentRow, 1);
    companyCell.value = {
      richText: [
        { font: { name: 'Arial', size: 10, bold: true }, text: 'Empresa:   ' },
        { font: { name: 'Arial', size: 10, bold: true }, text: companyGroup.companyName.toUpperCase() },
      ],
    };
    companyCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(currentRow).height = 16;
    currentRow += 1;

    const firstChequeRow = currentRow;
    companyGroup.cheques.forEach((employee) => {
      const row = worksheet.getRow(currentRow);
      row.height = 17;
      row.getCell(1).value = employeeName(employee);
      row.getCell(2).value = compactCompanyName(companyGroup.companyName);
      row.getCell(3).value = String(readFirst(employee, [
        'condicion_laboral',
        'tipo_personal',
        'tipoPersonal',
      ]) || 'fijo').toLowerCase();
      row.getCell(6).value = 'cheque';
      row.getCell(7).value = getNetPayable(employee, group?.periodType);
      row.getCell(7).numFmt = '#,##0.00';
      row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
      currentRow += 1;
    });

    currentRow += 2;
    const subtotalCell = worksheet.getCell(currentRow, 8);
    subtotalCell.value = {
      formula: `SUM(G${firstChequeRow}:G${firstChequeRow + companyGroup.cheques.length - 1})`,
    };
    subtotalCell.numFmt = '#,##0.00';
    subtotalCell.alignment = { horizontal: 'right', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 17;
    currentRow += 1;
  });

  const totalTopRow = Math.max(currentRow + 3, 17);
  worksheet.getCell(totalTopRow, 8).border = {
    top: { style: 'thin', color: { argb: COLORS.black } },
    bottom: { style: 'double', color: { argb: COLORS.black } },
  };

  const totalLabelRow = totalTopRow + 1;
  worksheet.mergeCells(totalLabelRow, 5, totalLabelRow, 6);
  const totalLabelCell = worksheet.getCell(totalLabelRow, 5);
  totalLabelCell.value = 'TOTAL GENERAL';
  totalLabelCell.font = { name: 'Arial', size: 10, bold: true };
  totalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

  const totalRow = totalTopRow + 3;
  worksheet.getCell(totalRow, 7).value = 'Q';
  worksheet.getCell(totalRow, 7).font = { name: 'Arial', size: 10, bold: true };
  worksheet.getCell(totalRow, 7).alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getCell(totalRow, 8).value = {
    formula: `SUM(G7:G${totalTopRow - 1})`,
  };
  worksheet.getCell(totalRow, 8).numFmt = '#,##0.00';
  worksheet.getCell(totalRow, 8).font = { name: 'Arial', size: 10, bold: true };
  worksheet.getCell(totalRow, 8).alignment = { horizontal: 'right', vertical: 'middle' };
  worksheet.getCell(totalRow, 8).border = {
    top: { style: 'thin', color: { argb: COLORS.black } },
    bottom: { style: 'double', color: { argb: COLORS.black } },
  };

  worksheet.mergeCells(totalRow, 1, totalRow, 3);
  const preparedCell = worksheet.getCell(totalRow, 1);
  preparedCell.value = 'Elaborado por: Alejandra Pérez';
  preparedCell.font = { name: 'Arial', size: 10 };
  preparedCell.alignment = { horizontal: 'left', vertical: 'middle' };

  const signatureLineRow = Math.max(totalRow + 8, 29);
  worksheet.mergeCells(signatureLineRow + 1, 1, signatureLineRow + 1, 4);
  const auditCell = worksheet.getCell(signatureLineRow + 1, 1);
  auditCell.value = 'Autorizado por: Walter Mendez (Auditoria Interna)';
  auditCell.font = { name: 'Arial', size: 10 };
  auditCell.alignment = { horizontal: 'left', vertical: 'middle' };

  for (let column = 5; column <= 8; column += 1) {
    worksheet.getCell(signatureLineRow, column).border = {
      top: { style: 'medium', color: { argb: COLORS.black } },
    };
  }
  worksheet.mergeCells(signatureLineRow + 1, 5, signatureLineRow + 1, 8);
  const hrCell = worksheet.getCell(signatureLineRow + 1, 5);
  hrCell.value = 'Autorizado por: Iris de Lemus (Recursos Humanos)';
  hrCell.font = { name: 'Arial', size: 10 };
  hrCell.alignment = { horizontal: 'left', vertical: 'middle' };

  const printEndRow = signatureLineRow + 4;
  worksheet.pageSetup.printArea = `A1:H${printEndRow}`;
  applyDefaultFont(worksheet, 1, printEndRow);

  return workbook;
}

export async function exportSolicitudChequesExcel(params = {}) {
  const { generateAndDownloadExcel } = await import('./excelWorkerClient');
  const safeTitle = String(params.group?.title || 'Nomina')
    .replace(/[^\w-]+/g, '_')
    .slice(0, 50);
  await generateAndDownloadExcel(
    'solicitud-cheques',
    params,
    `Sol_Cheques_${safeTitle}.xlsx`
  );
}
