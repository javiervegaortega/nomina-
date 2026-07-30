import ExcelJS from 'exceljs';
import { getNetPayable } from './payrollPeriod.js';

const COLORS = {
  black: '000000',
  company: '003070',
  lotHeader: 'DDEBCA',
  lotControl: 'FCBE89',
  paymentDate: 'FFF500',
  note: 'FFF500',
  white: 'FFFFFF',
};

const COLUMNS = [
  { key: 'name', width: 36 },
  { key: 'company', width: 16 },
  { key: 'personalType', width: 14 },
  { key: 'lotDelete', width: 14 },
  { key: 'lotCorrect', width: 14 },
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
  'LOTE A\nELIMINAR',
  'LOTE\nCORRECTO',
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

const buildCompanyGroups = (employees, companies) => {
  const groups = new Map();

  (employees || []).forEach((employee) => {
    const companyName = resolveCompany(employee, companies);
    if (!groups.has(companyName)) {
      groups.set(companyName, { companyName, transfers: [], cheques: [] });
    }
    const destination = String(employee?.tipo_de_pago || '').toLowerCase() === 'cheque'
      ? groups.get(companyName).cheques
      : groups.get(companyName).transfers;
    destination.push(employee);
  });

  return [...groups.values()];
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

const setSignature = (worksheet, lineRow, text, startColumn, endColumn) => {
  for (let column = startColumn; column <= endColumn; column += 1) {
    worksheet.getCell(lineRow, column).border = {
      top: { style: 'medium', color: { argb: COLORS.black } },
    };
  }
  worksheet.mergeCells(lineRow + 1, startColumn, lineRow + 1, endColumn);
  const labelCell = worksheet.getCell(lineRow + 1, startColumn);
  labelCell.value = text;
  labelCell.font = { name: 'Arial', size: 10 };
  labelCell.alignment = { vertical: 'top', horizontal: 'left' };
};

const downloadWorkbook = async (workbook, filename) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

/**
 * Construye el Verificador de Pagos con la distribución del formato
 * institucional y fórmulas auditables para subtotales y total general.
 */
export function buildVerificadorWorkbook({ employees = [], group = {}, companies = [] } = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Nómina';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Verificador de pago', {
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
  worksheet.pageSetup.printTitlesRow = '1:4';
  worksheet.headerFooter.oddHeader = '';
  worksheet.headerFooter.oddFooter = '';

  COLUMNS.forEach((column, index) => {
    worksheet.getColumn(index + 1).width = column.width;
  });

  worksheet.getCell('A1').value = 'GRUPO ECONSA';
  worksheet.getCell('A1').font = { name: 'Arial', size: 11, bold: true };
  worksheet.getRow(1).height = 16;

  worksheet.getCell('A2').value = 'VERIFICADOR DE PAGO DE NOMINA';
  worksheet.getCell('A2').font = { name: 'Arial', size: 11 };
  worksheet.getRow(2).height = 16;

  worksheet.getCell('A3').value = 'FECHA DE PAGO:';
  worksheet.getCell('A3').font = { name: 'Arial', size: 10, bold: true };
  worksheet.getCell('B3').value = formatDate(group?.closedAt || group?.date);
  worksheet.getCell('B3').font = { name: 'Arial', size: 10, bold: true };
  worksheet.getCell('B3').alignment = { horizontal: 'center', vertical: 'middle' };
  fill(worksheet.getCell('B3'), COLORS.paymentDate);
  worksheet.getRow(3).height = 18;

  const headerRow = worksheet.getRow(4);
  headerRow.values = HEADERS;
  headerRow.height = 32;
  headerRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    cell.font = { name: 'Arial', size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBlackBorder;
    if (columnNumber === 4 || columnNumber === 5) fill(cell, COLORS.lotHeader);
  });

  const groups = buildCompanyGroups(employees, companies);
  let currentRow = 5;

  groups.forEach((companyGroup) => {
    const hasTransfers = companyGroup.transfers.length > 0;
    const hasCheques = companyGroup.cheques.length > 0;
    if (!hasTransfers && !hasCheques) return;

    worksheet.mergeCells(currentRow, 1, currentRow, 10);
    const companyCell = worksheet.getCell(currentRow, 1);
    companyCell.value = {
      richText: [
        { font: { name: 'Arial', size: 10, bold: true, color: { argb: COLORS.black } }, text: 'Empresa:   ' },
        { font: { name: 'Arial', size: 10, bold: true, color: { argb: COLORS.company } }, text: companyGroup.companyName.toUpperCase() },
      ],
    };
    companyCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(currentRow).height = 16;
    currentRow += 1;

    if (hasTransfers) {
      const transferRow = worksheet.getRow(currentRow);
      transferRow.height = 17;
      transferRow.getCell(1).value = 'Varios Plantilla';
      transferRow.getCell(4).value = resolveLot(group, companyGroup.transfers, 'delete');
      transferRow.getCell(5).value = resolveLot(group, companyGroup.transfers, 'correct');
      transferRow.getCell(6).value = 'Nomina';
      transferRow.getCell(7).value = resolveBank(companyGroup.transfers);
      transferRow.getCell(8).value = 'Transferencia';
      transferRow.getCell(9).value = companyGroup.transfers.reduce(
        (sum, employee) => sum + getNetPayable(employee, group?.periodType),
        0,
      );

      fill(transferRow.getCell(4), COLORS.lotControl);
      fill(transferRow.getCell(5), COLORS.lotControl);
      transferRow.getCell(4).font = { name: 'Arial', size: 10, bold: true };
      transferRow.getCell(5).font = { name: 'Arial', size: 10, bold: true };
      transferRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
      transferRow.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
      transferRow.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
      transferRow.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
      transferRow.getCell(9).numFmt = '"Q" #,##0.00';
      transferRow.getCell(9).font = { name: 'Arial', size: 10, bold: true };
      transferRow.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };

      for (let column = 6; column <= 10; column += 1) {
        transferRow.getCell(column).border = {
          bottom: { style: 'thin', color: { argb: COLORS.black } },
        };
      }
      currentRow += 1;
    }

    const firstChequeRow = currentRow;
    companyGroup.cheques.forEach((employee) => {
      const chequeRow = worksheet.getRow(currentRow);
      chequeRow.height = 17;
      chequeRow.getCell(1).value = employeeName(employee);
      chequeRow.getCell(2).value = compactCompanyName(companyGroup.companyName);
      chequeRow.getCell(3).value = String(readFirst(employee, [
        'condicion_laboral',
        'tipo_personal',
        'tipoPersonal',
      ]) || 'FIJO').toUpperCase();
      chequeRow.getCell(8).value = 'CHEQUE';
      chequeRow.getCell(9).value = getNetPayable(employee, group?.periodType);
      chequeRow.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
      chequeRow.getCell(9).numFmt = '"Q" #,##0.00';
      chequeRow.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
      currentRow += 1;
    });

    if (hasCheques) {
      currentRow += 2;
      const subtotalCell = worksheet.getCell(currentRow, 10);
      subtotalCell.value = {
        formula: `SUM(I${firstChequeRow}:I${firstChequeRow + companyGroup.cheques.length - 1})`,
      };
      subtotalCell.numFmt = '"Q"#,##0.00';
      subtotalCell.font = { name: 'Arial', size: 10, bold: true };
      subtotalCell.alignment = { horizontal: 'right', vertical: 'middle' };
      worksheet.getRow(currentRow).height = 17;
      currentRow += 1;
    }
  });

  const dividerRow = Math.max(currentRow + 2, 17);
  for (let column = 1; column <= 10; column += 1) {
    worksheet.getCell(dividerRow, column).border = {
      top: { style: 'medium', color: { argb: COLORS.black } },
      bottom: { style: 'thin', color: { argb: COLORS.black } },
    };
  }
  worksheet.getRow(dividerRow).height = 4;

  const totalTopRow = dividerRow + 6;
  for (let column = 9; column <= 10; column += 1) {
    worksheet.getCell(totalTopRow, column).border = {
      top: { style: 'thin', color: { argb: COLORS.black } },
      bottom: { style: 'double', color: { argb: COLORS.black } },
    };
  }

  const totalRow = dividerRow + 8;
  worksheet.mergeCells(totalRow, 7, totalRow, 8);
  const totalLabelCell = worksheet.getCell(totalRow, 7);
  totalLabelCell.value = 'TOTAL GENERAL';
  totalLabelCell.font = { name: 'Arial', size: 10, bold: true };
  totalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

  worksheet.getCell(totalRow, 9).value = 'Q';
  worksheet.getCell(totalRow, 9).font = { name: 'Arial', size: 10, bold: true };
  worksheet.getCell(totalRow, 9).alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getCell(totalRow, 10).value = {
    formula: `SUM(I5:I${dividerRow - 1})`,
  };
  worksheet.getCell(totalRow, 10).numFmt = '#,##0.00';
  worksheet.getCell(totalRow, 10).font = { name: 'Arial', size: 10, bold: true };
  worksheet.getCell(totalRow, 10).alignment = { horizontal: 'right', vertical: 'middle' };
  for (let column = 9; column <= 10; column += 1) {
    worksheet.getCell(totalRow, column).border = {
      top: { style: 'thin', color: { argb: COLORS.black } },
      bottom: { style: 'double', color: { argb: COLORS.black } },
    };
  }

  const firstSignatureLine = dividerRow + 14;
  setSignature(worksheet, firstSignatureLine, 'Hecho por:   Alejandra Pérez', 1, 3);
  setSignature(
    worksheet,
    firstSignatureLine,
    'Revisado por: Iris de Lemus (Recursos Humanos)',
    7,
    10,
  );

  const secondSignatureLine = dividerRow + 21;
  setSignature(
    worksheet,
    secondSignatureLine,
    'Revisado por: Walter Mendez (Auditoria)',
    1,
    3,
  );
  setSignature(
    worksheet,
    secondSignatureLine,
    'Autorizado por: Gerardo Estrada (Presidencia)',
    7,
    10,
  );

  const noteRow = dividerRow + 24;
  worksheet.mergeCells(noteRow, 2, noteRow, 7);
  const noteCell = worksheet.getCell(noteRow, 2);
  noteCell.value = {
    richText: [
      { font: { name: 'Arial', size: 10, bold: true }, text: 'Nota: Transferencia programada para      ' },
      { font: { name: 'Arial', size: 10, bold: true }, text: `${formatDate(group?.closedAt || group?.date)} INMEDIATO` },
    ],
  };
  fill(noteCell, COLORS.note);
  noteCell.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(noteRow).height = 18;

  const printEndRow = noteRow + 4;
  worksheet.pageSetup.printArea = `A1:J${printEndRow}`;
  applyDefaultFont(worksheet, 1, printEndRow);

  return workbook;
}

export async function exportVerificadorExcel(params = {}) {
  const workbook = buildVerificadorWorkbook(params);
  const safeTitle = String(params.group?.title || 'Nomina')
    .replace(/[^\w-]+/g, '_')
    .slice(0, 50);
  await downloadWorkbook(workbook, `Verificador_Pagos_${safeTitle}.xlsx`);
}
