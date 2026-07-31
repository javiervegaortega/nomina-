import { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  Button, Box, Table, Thead, Tbody, Tr, Th, Td, Heading, Text, Flex, useColorModeValue, Badge, Spinner, Center,
  Menu, MenuButton, MenuList, MenuItem, MenuItemOption, MenuOptionGroup, Tooltip, Switch, FormControl, FormLabel,
  SimpleGrid
} from '@chakra-ui/react';
import { Download, FileText, Printer, Settings, ChevronDown } from 'lucide-react';
import { CUOTA_PATRONAL_RATE, IRTRA_INTECAP_RATE } from '../data/mockData';
import { getNetTotal } from '../utils/payrollPeriod';
import { buildVerificadorPdf } from '../utils/verificadorPdf';
import { buildSolicitudChequesPdf } from '../utils/solicitudChequesPdf';

let JsPdfCtor = null;
let autoTableFn = null;
let pdfToolsPromise = null;

const loadPdfTools = () => {
  if (!pdfToolsPromise) {
    pdfToolsPromise = Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]).then(([pdfModule, tableModule]) => {
      JsPdfCtor = pdfModule.default;
      autoTableFn = tableModule.default;
      return { JsPdfCtor, autoTableFn };
    });
  }
  return pdfToolsPromise;
};

// Inline to avoid circular import issues
const getEmpName = (e) => {
  if (!e) return 'N/A';
  const parts = [e.primer_nombre, e.segundo_nombre, e.otro_nombre, e.primer_apellido, e.segundo_apellido, e.apellido_casada].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return `${e.nombres || ''} ${e.apellidos || ''}`.trim() || 'Empleado';
};

const fmtQ = (n) => `Q ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtN = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const firstNumber = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }
  return undefined;
};

const getDaysWorked = (employee) => firstNumber(employee?.days, employee?.dias) ?? 30;

const getAnticipo1ra = (employee) => firstNumber(
  employee?.calculated?.anticipo1ra,
  employee?.anticipo1ra
) ?? 0;

const getNetPayable = (employee, periodType) => {
  const canonicalPayable = firstNumber(
    employee?.calculated?.netPayable,
    employee?.netPayable
  );
  if (canonicalPayable !== undefined) return canonicalPayable;

  const legacyNet = firstNumber(employee?.calculated?.net, employee?.netTotal) ?? 0;
  return periodType === '2da'
    ? legacyNet - getAnticipo1ra(employee)
    : legacyNet;
};

const getPayrollExtras = (employee) => {
  const extras = employee?.extras || {};
  const calculated = employee?.calculated || {};
  const hours = employee?.hours || {};

  const simplesQty = firstNumber(extras.simplesQty, extras.simpleQty, hours.simple) ?? 0;
  const simplesVal = firstNumber(extras.simplesVal, calculated.simpleExtras) ?? 0;
  const doblesQty = firstNumber(extras.doblesQty, extras.doubleQty, hours.double) ?? 0;
  const doblesVal = firstNumber(extras.doblesVal, calculated.doubleExtras) ?? 0;

  const otherParts = [
    firstNumber(extras.comisiones, extras.commissions),
    firstNumber(extras.otrosIngresos, extras.otherIncome, calculated.otrosIngresos),
    firstNumber(extras.vacacionesVal, calculated.vacacionesVal),
    firstNumber(extras.ventasEconomicas, calculated.ventasEconomicas)
  ];
  const hasDetailedOtherIncome = otherParts.some(value => value !== undefined);
  const otherIncome = hasDetailedOtherIncome
    ? otherParts.reduce((sum, value) => sum + (value ?? 0), 0)
    : Math.max(0, (firstNumber(calculated.extrasTotal) ?? 0) - simplesVal - doblesVal);

  return {
    simplesQty,
    simplesVal,
    doblesQty,
    doblesVal,
    otherIncome,
    septimosVal: firstNumber(extras.septimosVal) ?? 0,
    vacacionesVal: firstNumber(extras.vacacionesVal, calculated.vacacionesVal) ?? 0
  };
};

const getPayrollDeductions = (employee) => {
  const canonical = employee?.calculated?.proratedDeductions || {};
  const legacy = employee?.deductions || {};
  const read = (canonicalKey, ...aliases) => {
    const keys = [canonicalKey, ...aliases];
    for (const source of [canonical, legacy]) {
      for (const key of keys) {
        const value = firstNumber(source?.[key]);
        if (value !== undefined) return value;
      }
    }
    return 0;
  };

  return {
    igss: read('igss'),
    isr: read('isr'),
    cafe: read('cafe', 'cafeteria'),
    cell: read('cell', 'celular'),
    uniform: read('uniform', 'uniforme'),
    shoes: read('shoes', 'calzado'),
    equipo: read('equipo'),
    product: read('product', 'producto'),
    bancos: read('bancos', 'bantrab'),
    otros: read('otros'),
    judiciales: read('judiciales'),
    seguro: read('seguro'),
    parqueo: read('parqueo'),
    boleto_de_ornato: read('boleto_de_ornato', 'ornato'),
    otros_egresos: read('otros_egresos')
  };
};

const getPayrollBonuses = (employee) => {
  const calculated = employee?.calculated || {};
  const operationalBonuses = firstNumber(calculated.bonos, employee?.extras?.bonos) ?? 0;
  const catalogBonuses = firstNumber(calculated.bonusesSum)
    ?? Object.values(employee?.appliedBonuses || {}).reduce(
      (sum, value) => sum + (Number(value) || 0),
      0
    );
  return operationalBonuses + catalogBonuses;
};

const getTotalDeductions = (employee) => {
  const calculatedTotal = firstNumber(employee?.calculated?.ded);
  if (calculatedTotal !== undefined) return calculatedTotal;

  const source = employee?.calculated?.proratedDeductions || employee?.deductions || {};
  return Object.values(source).reduce((sum, value) => sum + (Number(value) || 0), 0);
};

const computePayrollSummary = (employees, periodType) => {
  let grossTotal = 0;
  let dedTotal = 0;
  let patronalTotal = 0;
  let netTotal = 0;

  (employees || []).forEach((e) => {
    const gross = Number(e?.calculated?.gross) || 0;
    const ded = getTotalDeductions(e);
    const net = getNetPayable(e, periodType);
    const patronal = e?.calculated?.patronal != null
      ? (Number(e.calculated.patronal) || 0) + (Number(e.calculated.irtraIntecap) || 0)
      : (Number(e?.calculated?.baseSalary) || 0) * (CUOTA_PATRONAL_RATE + IRTRA_INTECAP_RATE);

    grossTotal += gross;
    dedTotal += ded;
    patronalTotal += patronal;
    netTotal += net;
  });

  return { grossTotal, dedTotal, patronalTotal, netTotal, employeeCount: (employees || []).length };
};

const PDF_COLORS = {
  titleBg: [14, 47, 68],
  headerBg: [27, 79, 114],
  sectionBg: [21, 67, 96],
  altRow: [244, 247, 250],
  totalBg: [212, 230, 241],
  summaryBg: [234, 242, 248],
  white: [255, 255, 255],
  gross: [185, 119, 14],
  ded: [192, 57, 43],
  patronal: [211, 84, 0],
  net: [26, 82, 118],
  muted: [93, 109, 126]
};

const REPORT_TITLES = {
  verificador:  'Verificador de Pago de Nómina',
  cheques:      'Solicitud de Cheques',
  nomina:       'Nómina General',
  igss:         'Recibo e IGSS',
  libro:        'Libro de Salarios',
  promerica:    'Plantilla Banco Promerica',
  industrial:   'Plantilla Banco Industrial',
};

export default function ReportPreviewModal({ isOpen, onClose, reportType, group, data, companies, areas }) {
  // ── All hooks at top level ────────────────────────────────────
  const tdBg             = useColorModeValue('white', 'gray.800');
  const theadBg          = useColorModeValue('gray.100', 'gray.900');
  const borderColor      = useColorModeValue('gray.200', 'whiteAlpha.200');
  const compHeaderBg     = useColorModeValue('blue.50', 'blue.900');
  const subtotalRowBg    = useColorModeValue('gray.50', 'gray.700');
  const totalRowBg       = useColorModeValue('gray.100', 'gray.600');
  const previewBg        = useColorModeValue('gray.100', 'gray.900');

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [groupByArea, setGroupByArea] = useState(false);
  const [colsNomina, setColsNomina] = useState(() => {
    const saved = localStorage.getItem('nomina_cols');
    if (saved) return JSON.parse(saved);
    return [
      'no', 'nombre', 'empresa', 'puesto', 'dias',
      'ordinario', 'bon_incentivo', 'bon_decreto', 'bonos', 'total_dev',
      'hrs_simples', 'val_hrs_simples', 'hrs_dobles', 'val_hrs_dobles', 'otros_ingresos',
      'salario_total', 'igss', 'isr', 'total_egr', 'liquido'
    ];
  });
  const [colsIgss, setColsIgss] = useState(() => {
    const saved = localStorage.getItem('igss_cols');
    if (saved) return JSON.parse(saved);
    return ['no','nombre','cuenta','puesto','dias','ordinario','bonos','total_dev','igss','isr','total_egr','liquido','quinc1','quinc2','no_igss'];
  });

  useEffect(() => { localStorage.setItem('nomina_cols', JSON.stringify(colsNomina)); }, [colsNomina]);
  useEffect(() => { localStorage.setItem('igss_cols', JSON.stringify(colsIgss)); }, [colsIgss]);

  const ALL_COLUMNS_DEF = [
    { id: 'no', label: 'No.', align: 'left' },
    { id: 'nombre', label: 'Nombre', align: 'left' },
    { id: 'empresa', label: 'Empresa', align: 'left' },
    { id: 'puesto', label: 'Puesto', align: 'left' },
    { id: 'cuenta', label: 'No. Cuenta', align: 'left' },
    { id: 'dias', label: 'Días', align: 'left' },
    { id: 'ordinario', label: 'S. Ordinario', align: 'right' },
    { id: 'bon_incentivo', label: 'Bon. Incentivo', align: 'right' },
    { id: 'bon_decreto', label: 'Bono Dec. 37-2001', align: 'right' },
    { id: 'bonos', label: 'Bonos', align: 'right' },
    { id: 'total_dev', label: 'T. Devengado', align: 'right' },
    { id: 'hrs_simples', label: 'Hrs Simples', align: 'right' },
    { id: 'val_hrs_simples', label: 'Val Hrs Simp', align: 'right' },
    { id: 'hrs_dobles', label: 'Hrs Nocturnas', align: 'right' },
    { id: 'val_hrs_dobles', label: 'Val Hrs Noct.', align: 'right' },
    { id: 'otros_ingresos', label: 'Otros Ingr.', align: 'right' },
    { id: 'salario_total', label: 'Salario Total', align: 'right' },
    { id: 'igss', label: 'IGSS', align: 'right' },
    { id: 'isr', label: 'ISR', align: 'right' },
    { id: 'cafeteria', label: 'Cafetería', align: 'right' },
    { id: 'celular', label: 'Celular', align: 'right' },
    { id: 'uniforme', label: 'Uniforme', align: 'right' },
    { id: 'calzado', label: 'Calzado', align: 'right' },
    { id: 'equipo', label: 'Equipo', align: 'right' },
    { id: 'producto', label: 'Producto', align: 'right' },
    { id: 'bancos', label: 'Bancos', align: 'right' },
    { id: 'otros', label: 'Otros', align: 'right' },
    { id: 'judiciales', label: 'Judiciales', align: 'right' },
    { id: 'seguro', label: 'Seguro', align: 'right' },
    { id: 'parqueo', label: 'Parqueo', align: 'right' },
    { id: 'ornato', label: 'Bol. Ornato', align: 'right' },
    { id: 'otros_egr', label: 'Otros Egr.', align: 'right' },
    { id: 'total_egr', label: 'Total Egresos', align: 'right' },
    { id: 'liquido', label: 'Líquido', align: 'right' },
    { id: 'quinc1', label: '1ra Quincena', align: 'right' },
    { id: 'quinc2', label: '2da Quincena', align: 'right' },
    { id: 'no_igss', label: 'No. IGSS', align: 'left' }
  ];

  const renderConfigControls = () => {
    if (reportType !== 'nomina' && reportType !== 'igss') return null;
    const isNomina = reportType === 'nomina';
    const defs = ALL_COLUMNS_DEF;
    const vals = isNomina ? colsNomina : colsIgss;
    const setVals = isNomina ? setColsNomina : setColsIgss;

    return (
      <Flex gap={4} align="center">
        <Menu closeOnSelect={false}>
          <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} leftIcon={<Settings size={14}/>}>
            Columnas
          </MenuButton>
          <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="xl">
            <MenuItem onClick={() => setVals(defs.map(d => d.id))} fontWeight="bold" color="blue.600">
              ✓ TODAS
            </MenuItem>
            <MenuOptionGroup type="checkbox" value={vals} onChange={setVals}>
              {defs.map(d => (
                <MenuItemOption key={d.id} value={d.id} fontSize="sm">{d.label}</MenuItemOption>
              ))}
            </MenuOptionGroup>
          </MenuList>
        </Menu>
        <Tooltip label="Agrupar el reporte por áreas">
          <FormControl display="flex" alignItems="center" w="auto">
            <Switch id="group-area" size="sm" colorScheme="blue" isChecked={groupByArea} onChange={e => setGroupByArea(e.target.checked)} />
            <FormLabel htmlFor="group-area" mb="0" ml={2} fontSize="sm" fontWeight="semibold" cursor="pointer">
              Por Área
            </FormLabel>
          </FormControl>
        </Tooltip>
      </Flex>
    );
  };


  // Helper to generate Libro Doc
  const generateLibroDoc = () => {
    const doc = new JsPdfCtor('landscape', 'pt', 'legal');
    data.forEach((e, index) => {
      if (index > 0) doc.addPage();
      
      const pageW = doc.internal.pageSize.width;
      const margin = 36;
      const usableW = pageW - margin * 2;

      // ── Centered titles ──
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text('ECONACIONAL, SOCIEDAD ANÓNIMA', pageW / 2, 36, { align: 'center' });
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text('LIBRO DE SALARIOS PARA TRABAJADORES PERMANENTES', pageW / 2, 50, { align: 'center' });
      doc.text('AUTORIZADO POR EL MINISTERIO DE TRABAJO Y PREVISION SOCIAL, SEGÚN ARTÍCULO 102 DEL CÓDIGO DE TRABAJO', pageW / 2, 62, { align: 'center' });

      // Folio top-right
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`Folio No. ${index + 1}`, pageW - margin, 36, { align: 'right' });

      // ── Helper: draw a labeled underlined field ──
      const drawField = (label, value, x, y, w) => {
        doc.setFontSize(7); doc.setFont('helvetica', 'normal');
        // Draw the underline
        doc.line(x, y, x + w, y);
        // Label below the line — with more breathing room
        doc.text(label, x, y + 9);
        // Value above the line — with more breathing room
        doc.setFontSize(8);
        const val = value || '';
        doc.text(val, x, y - 6);
      };

      // ── Row 1: 5 fields ──
      const r1y = 88;
      const col5 = usableW / 5;
      drawField('Nombre del Trabajador', getEmpName(e),      margin,                 r1y, col5 * 1.6);
      drawField('Edad',                  e.edad || '',        margin + col5 * 1.7,    r1y, col5 * 0.7);
      drawField('Sexo',                  e.genero || '',      margin + col5 * 2.5,    r1y, col5 * 0.8);
      drawField('Nacionalidad',          e.nacionalidad || 'Guatemalteca', margin + col5 * 3.4, r1y, col5 * 0.9);
      drawField('Ocupación o Puesto',    e.puesto || '',      margin + col5 * 4.35,   r1y, col5 * 0.65);

      // ── Row 2: 4 fields ──
      const r2y = 118;
      const col4 = usableW / 4;
      drawField('No. de Afiliación al IGSS',       e.no_igss || '',  margin,                r2y, col4 * 0.9);
      drawField('No. DPI o Permiso de Trabajo',    e.dpi || '',      margin + col4,         r2y, col4 * 0.9);
      drawField('Fecha de Ingreso',                e.fecha_ingreso ? new Date(e.fecha_ingreso).toLocaleDateString('es-GT') : '', margin + col4 * 2, r2y, col4 * 0.9);
      drawField('Fecha Finalización de Relación Laboral', '', margin + col4 * 3, r2y, col4 * 0.9);

      const calculated = e.calculated || {};
      const extras = getPayrollExtras(e);
      const deductions = getPayrollDeductions(e);
      const bonuses = getPayrollBonuses(e);
      const totalDeductions = getTotalDeductions(e);

      const ord = fmtN(calculated.baseSalary);
      const ext = fmtN(extras.simplesVal + extras.doblesVal);
      const septimos = fmtN(extras.septimosVal);
      const vacaciones = fmtN(extras.vacacionesVal);
      const totalDev = fmtN(calculated.gross);

      const igss = fmtN(deductions.igss);
      const otrasDed = fmtN(totalDeductions - deductions.igss);
      const totalDed = fmtN(totalDeductions);

      const dec4292 = fmtN((Number(calculated.bonusDec) || 0) + bonuses);
      const bonInc = fmtN(calculated.bonusLey);
      const liq = fmtN(getNetTotal(e));

      autoTableFn(doc, {
        startY: r2y + 30,
        head: [
          [
            { content: 'No. de orden', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Período de trabajo', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Salario en\nQuetzales', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Días\ntrabajados', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'HORAS TRABAJADAS', colSpan: 2, styles: { halign: 'center' } },
            { content: 'SALARIO DEVENGADO', colSpan: 5, styles: { halign: 'center' } },
            { content: 'DEDUCCIONES LEGALES', colSpan: 3, styles: { halign: 'center' } },
            { content: 'Decreto 42-92,\nAguinaldo y Otras', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Bonificación\nIncentivo Dec. 37-2001', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Líquido a Recibir', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'FIRMA', rowSpan: 2, styles: { halign: 'center', valign: 'middle', cellWidth: 90 } },
            { content: 'Observaciones', rowSpan: 2, styles: { halign: 'center', valign: 'middle', cellWidth: 80 } }
          ],
          [
            { content: 'Ordinarias', styles: { halign: 'center' } },
            { content: 'Extra ordinarias', styles: { halign: 'center' } },
            { content: 'Ordinario', styles: { halign: 'center' } },
            { content: 'Extra-ordinario', styles: { halign: 'center' } },
            { content: 'Séptimos y Asuetos', styles: { halign: 'center' } },
            { content: 'Vacaciones', styles: { halign: 'center' } },
            { content: 'SALARIO TOTAL', styles: { halign: 'center' } },
            { content: 'IGSS', styles: { halign: 'center' } },
            { content: 'Otras deducciones', styles: { halign: 'center' } },
            { content: 'TOTAL DEDUCCIONES', styles: { halign: 'center' } }
          ]
        ],
        body: [
          [
            1,
            group.title || 'Nómina',
            fmtN(e.sueldo_ordinario || 0),
            getDaysWorked(e),
            '',
            extras.simplesQty + extras.doblesQty,
            ord,
            ext,
            septimos,
            vacaciones,
            totalDev,
            igss,
            otrasDed,
            totalDed,
            dec4292,
            bonInc,
            liq,
            '',
            ''
          ]
        ],
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.5 },
        bodyStyles: { fontSize: 8, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.5 },
        styles: { cellPadding: 4 },
        columnStyles: {
          2:  { halign: 'right' },
          3:  { halign: 'center' },
          4:  { halign: 'center', cellWidth: 38 },   // Ordinarias
          5:  { halign: 'center' },
          6:  { halign: 'right',  cellWidth: 52 },   // Ordinario
          7:  { halign: 'right',  cellWidth: 52 },   // Extra-ordinario
          8:  { halign: 'right' },
          9:  { halign: 'right',  cellWidth: 42 },   // Vacaciones
          10: { halign: 'right' },
          11: { halign: 'right' },
          12: { halign: 'right' },
          13: { halign: 'right' },
          14: { halign: 'right' },
          15: { halign: 'right' },
          16: { halign: 'right',  cellWidth: 50, fontStyle: 'bold' }  // Líquido a Recibir
        }
      });
    });
    return doc;
  };

  useEffect(() => {
    let generateTimer;
    const prepareTimer = setTimeout(() => {
      if (isOpen && ['libro', 'verificador', 'cheques'].includes(reportType) && data && group) {
        setIsGeneratingPdf(true);
        setPdfPreviewUrl(null);
        generateTimer = setTimeout(async () => {
          try {
            await loadPdfTools();
            const doc = reportType === 'verificador'
              ? buildVerificadorPdf({ data, group, companies }, JsPdfCtor)
              : reportType === 'cheques'
                ? buildSolicitudChequesPdf({ data, group, companies }, JsPdfCtor)
                : generateLibroDoc();
            setPdfPreviewUrl(doc.output('datauristring'));
          } catch (err) {
            console.error(err);
          } finally {
            setIsGeneratingPdf(false);
          }
        }, 50);
      } else {
        setIsGeneratingPdf(false);
        setPdfPreviewUrl(null);
      }
    }, 0);

    return () => {
      clearTimeout(prepareTimer);
      clearTimeout(generateTimer);
    };
    // generateLibroDoc consumes the same data/group dependencies listed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reportType, data, group, companies]);

  if (!isOpen || !group || !data) return null;


  const fechaPago = group.closedAt
    ? new Date(group.closedAt).toLocaleDateString('es-GT')
    : new Date().toLocaleDateString('es-GT');

  const cleanName = (name) => {
    if (!name) return '';
    return String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/,/g, '').toUpperCase();
  };

  const getConcept = () =>
    `pago salario de ${group.periodType === '2da' ? '2DA' : '1RA'} quincena ${(group.title || '').replace(/[^a-zA-Z0-9 ]/g, '')}`;


  // Build company groups helper
  const buildCompGroups = () => {
    const comps = {};
    data.forEach(e => {
      const compName = companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa';
      if (!comps[compName]) comps[compName] = { cheques: [], transfers: [], all: [] };
      comps[compName].all.push(e);
      if (String(e.tipo_de_pago).toLowerCase() === 'cheque') comps[compName].cheques.push(e);
      else comps[compName].transfers.push(e);
    });
    return comps;
  };

  // ── PDF exports ──────────────────────────────────────────────
  const handleDownloadPDF = async (action = 'download') => {
    await loadPdfTools();

  const processPdfTable = (doc, reportType, headRow, dataMapFn, colStyles) => {
    let currentY = 100;
    if (groupByArea) {
      const grouped = {};
      data.forEach(e => {
        const areaId = e.areaId || e.area;
        const areaName = areas?.find(a => String(a.id) === String(areaId))?.nombre || 'Sin Área';
        if (!grouped[areaName]) grouped[areaName] = [];
        grouped[areaName].push(e);
      });
      Object.keys(grouped).forEach(area => {
        if (currentY > 500) { doc.addPage(); currentY = 100; }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(41, 128, 185);
        doc.text(`Área: ${area}`, 36, currentY);
        currentY += 10;
        
        const body = grouped[area].map(dataMapFn);
        autoTableFn(doc, {
          startY: currentY, 
          head: [headRow], 
          body, 
          theme: 'grid', 
          headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' }, 
          styles: { fontSize: 7, cellPadding: 3 },
          columnStyles: colStyles,
          horizontalPageBreak: true,
          horizontalPageBreakRepeat: 0
        });
        currentY = doc.lastAutoTable.finalY + 25;
      });
    } else {
      const body = data.map(dataMapFn);
      autoTableFn(doc, {
        startY: currentY, 
        head: [headRow], 
        body, 
        theme: 'grid', 
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' }, 
        styles: { fontSize: 7, cellPadding: 3 },
        columnStyles: colStyles,
        horizontalPageBreak: true,
        horizontalPageBreakRepeat: 0
      });
    }
  };

    const safe   = group.title.replace(/[^a-z0-9]/gi, '_');

    // Header helper for every doc
    const addHeader = (doc, subtitle) => {
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text('GRUPO ECONSA', 40, 38);
      doc.setFontSize(11);
      doc.text(subtitle.toUpperCase(), 40, 56);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`FECHA DE PAGO: ${fechaPago}`, 40, 72);
      doc.text(`NÓMINA: ${group.title}`, 40, 86);
    };

    /** Encabezado + resumen estilo Excel para Nómina General */
    const addNominaGeneralHeader = (doc, subtitle) => {
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 28;
      const usableW = pageW - margin * 2;
      const summary = computePayrollSummary(data, group?.periodType);
      const periodLabel = group?.periodType === '2da' ? '2da Quincena' : '1ra Quincena';
      const statusLabel = group?.status === 'auditoria' ? 'En Auditoría' : 'Cerrada';

      // Barra título
      doc.setFillColor(...PDF_COLORS.titleBg);
      doc.rect(0, 0, pageW, 42, 'F');
      doc.setTextColor(...PDF_COLORS.white);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(`${subtitle.toUpperCase()} — DESGLOSE COMPLETO DE PAGOS`, margin, 20);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('GRUPO ECONSA', margin, 34);

      // Meta
      doc.setFillColor(...PDF_COLORS.sectionBg);
      doc.rect(0, 42, pageW, 22, 'F');
      doc.setFontSize(8);
      doc.text(
        `Periodo: ${group.title || '—'}  |  ${periodLabel}  |  Estado: ${statusLabel}  |  Empleados: ${summary.employeeCount}  |  Fecha de pago: ${fechaPago}`,
        margin,
        56
      );

      doc.setTextColor(...PDF_COLORS.muted);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.text(`Generado: ${new Date().toLocaleString('es-GT')}`, margin, 72);
      doc.setFont('helvetica', 'normal');

      // Resumen KPI
      const cards = [
        { label: 'COSTO BRUTO TOTAL', value: summary.grossTotal, color: PDF_COLORS.gross },
        { label: 'DEDUCCIONES TOTALES', value: summary.dedTotal, color: PDF_COLORS.ded },
        { label: 'CUOTA PATRONAL ESTIMADA', value: summary.patronalTotal, color: PDF_COLORS.patronal },
        { label: 'DESEMBOLSO NETO', value: summary.netTotal, color: PDF_COLORS.net }
      ];
      const gap = 8;
      const cardW = (usableW - gap * 3) / 4;
      const cardY = 80;
      const cardH = 36;

      cards.forEach((card, i) => {
        const x = margin + i * (cardW + gap);
        doc.setFillColor(...PDF_COLORS.summaryBg);
        doc.setDrawColor(197, 208, 220);
        doc.roundedRect(x, cardY, cardW, cardH, 3, 3, 'FD');
        doc.setTextColor(...card.color);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(card.label, x + 8, cardY + 12);
        doc.setFontSize(11);
        doc.text(fmtQ(card.value), x + 8, cardY + 28);
      });

      doc.setTextColor(0, 0, 0);
      return cardY + cardH + 12;
    };

    const buildNominaTotalsRow = (cols) => {
      const moneyIds = new Set([
        'ordinario', 'bon_incentivo', 'bon_decreto', 'bonos', 'total_dev',
        'val_hrs_simples', 'val_hrs_dobles', 'otros_ingresos', 'salario_total',
        'igss', 'isr', 'cafeteria', 'celular', 'uniforme', 'calzado', 'equipo', 'producto',
        'bancos', 'otros', 'judiciales', 'seguro', 'parqueo', 'ornato', 'otros_egr',
        'total_egr', 'liquido', 'quinc1', 'quinc2'
      ]);
      const qtyIds = new Set(['hrs_simples', 'hrs_dobles']);

      const sums = {};
      cols.forEach((c) => {
        if (moneyIds.has(c.id) || qtyIds.has(c.id)) sums[c.id] = 0;
      });

      data.forEach((e, i) => {
        cols.forEach((c) => {
          if (!(c.id in sums)) return;
          const raw = getColValue(e, i, c.id, false);
          sums[c.id] += Number(raw) || 0;
        });
      });

      return cols.map((c) => {
        if (c.id === 'no') return '';
        if (c.id === 'nombre') {
          return { content: 'TOTAL CONSOLIDADO', styles: { fontStyle: 'bold', textColor: PDF_COLORS.titleBg } };
        }
        if (c.id === 'empresa') {
          return { content: `${data.length} empleados`, styles: { fontStyle: 'bold' } };
        }
        if (c.id === 'puesto' || c.id === 'cuenta' || c.id === 'no_igss' || c.id === 'dias') return '';
        if (qtyIds.has(c.id)) {
          return { content: String(sums[c.id] || 0), styles: { halign: 'right', fontStyle: 'bold' } };
        }
        if (moneyIds.has(c.id)) {
          const accent = c.id === 'liquido' || c.id === 'salario_total' || c.id === 'total_dev'
            ? PDF_COLORS.net
            : (c.id === 'total_egr' || ['igss', 'isr'].includes(c.id) ? PDF_COLORS.ded : PDF_COLORS.headerBg);
          return {
            content: fmtQ(sums[c.id] || 0),
            styles: { halign: 'right', fontStyle: 'bold', textColor: accent, fillColor: PDF_COLORS.totalBg }
          };
        }
        return '';
      });
    };

    // ── Verificador ──────────────────────────────────────────
    if (reportType === 'verificador') {
      const doc = buildVerificadorPdf({ data, group, companies }, JsPdfCtor);
      if (action === 'print') {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
      } else {
        doc.save(`Verificador_Pago_${safe}.pdf`);
      }
    }

    // ── Solicitud de Cheques ─────────────────────────────────
    else if (reportType === 'cheques') {
      const doc = buildSolicitudChequesPdf({ data, group, companies }, JsPdfCtor);
      if (action === 'print') {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
      } else {
        doc.save(`Solicitud_Cheques_${safe}.pdf`);
      }
    }

    

    // ── Nómina General / Recibo e IGSS ──────────────────────
    else if (reportType === 'nomina' || reportType === 'igss') {
      const doc = new JsPdfCtor('landscape', 'pt', 'letter');
      const isIgssReport = reportType === 'igss';
      const subtitle = isIgssReport ? 'Recibo e IGSS' : 'Nómina General';
      const selectedColumns = isIgssReport ? colsIgss : colsNomina;
      const cols = ALL_COLUMNS_DEF.filter(c => selectedColumns.includes(c.id));
      const headRow = cols.map(c => c.label);
      const colStyles = {};
      cols.forEach((c, idx) => { if (c.align === 'right') colStyles[idx] = { halign: 'right' }; });

      const dataMapFn = (e, i) => {
        return cols.map(c => {
          const val = getColValue(e, i, c.id, true);
          if (c.id === 'liquido') return { content: val, styles: { fontStyle: 'bold', textColor: PDF_COLORS.net } };
          if (c.id === 'total_dev' || c.id === 'salario_total') {
            return { content: val, styles: { fontStyle: 'bold', textColor: PDF_COLORS.headerBg } };
          }
          if (c.id === 'total_egr') return { content: val, styles: { fontStyle: 'bold', textColor: PDF_COLORS.ded } };
          return val;
        });
      };

      if (isIgssReport) {
        addHeader(doc, subtitle);
        processPdfTable(doc, reportType, headRow, dataMapFn, colStyles);
      } else {
        const startY = addNominaGeneralHeader(doc, subtitle);
        const tableOpts = {
          head: [headRow],
          theme: 'grid',
          headStyles: {
            fillColor: PDF_COLORS.headerBg,
            textColor: PDF_COLORS.white,
            fontStyle: 'bold',
            fontSize: 6.5,
            halign: 'center',
            valign: 'middle'
          },
          bodyStyles: { fontSize: 6.5, cellPadding: 2.5, textColor: [28, 40, 51] },
          alternateRowStyles: { fillColor: PDF_COLORS.altRow },
          styles: { fontSize: 6.5, cellPadding: 2.5, overflow: 'linebreak', lineColor: [197, 208, 220], lineWidth: 0.4 },
          columnStyles: colStyles,
          horizontalPageBreak: true,
          horizontalPageBreakRepeat: 0,
          margin: { left: 28, right: 28 },
          didParseCell: (hookData) => {
            if (hookData.section === 'foot') {
              hookData.cell.styles.fillColor = PDF_COLORS.totalBg;
              hookData.cell.styles.fontStyle = 'bold';
              hookData.cell.styles.fontSize = 6.5;
            }
          }
        };

        const foot = [buildNominaTotalsRow(cols)];

        if (groupByArea) {
          let currentY = startY;
          const grouped = {};
          data.forEach(e => {
            const areaId = e.areaId || e.area;
            const areaName = areas?.find(a => String(a.id) === String(areaId))?.nombre || 'Sin Área';
            if (!grouped[areaName]) grouped[areaName] = [];
            grouped[areaName].push(e);
          });
          const areaNames = Object.keys(grouped);
          areaNames.forEach((area, areaIdx) => {
            if (currentY > 480) { doc.addPage(); currentY = 36; }
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...PDF_COLORS.headerBg);
            doc.text(`Área: ${area}`, 28, currentY);
            currentY += 8;
            const body = grouped[area].map((e, i) => dataMapFn(e, i));
            const isLast = areaIdx === areaNames.length - 1;
            autoTableFn(doc, {
              ...tableOpts,
              startY: currentY,
              body,
              foot: isLast ? foot : undefined,
              showFoot: isLast ? 'lastPage' : 'never'
            });
            currentY = doc.lastAutoTable.finalY + 18;
          });
        } else {
          autoTableFn(doc, {
            ...tableOpts,
            startY,
            body: data.map(dataMapFn),
            foot,
            showFoot: 'lastPage'
          });
        }
      }

      if (action === 'print') {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
      } else {
        doc.save(`${isIgssReport ? 'Recibo_IGSS' : 'Nomina_General'}_${safe}.pdf`);
      }
    }

    // ── Libro de Salarios ────────────────────────────────────
    else if (reportType === 'libro') {
      const doc = generateLibroDoc();
      if (action === 'print') {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
      } else {
        doc.save(`Libro_Salarios_${safe}.pdf`);
      }
    }

    // ── Plantilla Promerica ──────────────────────────────────
    else if (reportType === 'promerica') {
      const doc = new JsPdfCtor('portrait', 'pt', 'letter');
      addHeader(doc, 'Plantilla Banco Promerica');
      const comps = buildCompGroups();
      const body = [];
      const concepto = getConcept();

      Object.keys(comps).forEach(compName => {
        const { cheques, transfers } = comps[compName];
        body.push([{ content: `Empresa: ${compName.toUpperCase()}`, colSpan: 4, styles: { fillColor: [220, 237, 255], fontStyle: 'bold', textColor: [20, 80, 160] } }]);
        let totalPlantilla = 0, totalCheques = 0;
        transfers.forEach(e => {
          const payable = getNetPayable(e, group?.periodType);
          totalPlantilla += payable;
          body.push([e.numero_cuenta || e.no_cuenta || '', cleanName(getEmpName(e)), { content: fmtN(payable), styles: { halign: 'right' } }, concepto]);
        });
        body.push(['', { content: `Total Plantilla ${compName.toUpperCase()}`, styles: { fontStyle: 'bold' } }, { content: fmtN(totalPlantilla), styles: { halign: 'right', fontStyle: 'bold' } }, '']);
        if (cheques.length) {
          cheques.forEach(e => {
            const payable = getNetPayable(e, group?.periodType);
            totalCheques += payable;
            body.push(['CHEQUE', cleanName(getEmpName(e)), { content: fmtN(payable), styles: { halign: 'right' } }, concepto]);
          });
          body.push(['', { content: 'Total Cheques', styles: { fontStyle: 'bold' } }, { content: fmtN(totalCheques), styles: { halign: 'right', fontStyle: 'bold' } }, '']);
        }
        body.push(['', { content: 'Total Nómina', styles: { fontStyle: 'bold' } }, { content: fmtN(totalPlantilla + totalCheques), styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 120, 0] } }, '']);
        body.push([{ content: '', colSpan: 4 }]);
      });

      autoTableFn(doc, { startY: 100, head: [['No. Cuenta', 'Nombre de Colaborador', 'Monto', 'Concepto']], body, theme: 'grid', headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' }, styles: { fontSize: 8, cellPadding: 3 }, columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 200 }, 2: { cellWidth: 80, halign: 'right' }, 3: { cellWidth: 150 } } });
      if (action === 'print') {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
      } else {
        doc.save(`Plantilla_Promerica_${safe}.pdf`);
      }
    }

    // ── Plantilla Industrial ─────────────────────────────────
    else if (reportType === 'industrial') {
      const doc = new JsPdfCtor('portrait', 'pt', 'letter');
      addHeader(doc, 'Plantilla Banco Industrial');
      const comps = buildCompGroups();
      const body = [];
      const concepto = getConcept();

      Object.keys(comps).forEach(compName => {
        const { cheques, transfers } = comps[compName];
        body.push([{ content: `Empresa: ${compName.toUpperCase()}`, colSpan: 5, styles: { fillColor: [220, 237, 255], fontStyle: 'bold', textColor: [20, 80, 160] } }]);
        let totalPlantilla = 0, totalCheques = 0, corr = 1;
        transfers.forEach(e => {
          const payable = getNetPayable(e, group?.periodType);
          totalPlantilla += payable;
          body.push([e.tipo_cuenta?.toLowerCase() === 'ahorro' ? 2 : 1, e.numero_cuenta || e.no_cuenta || '', corr++, cleanName(getEmpName(e)), { content: fmtN(payable), styles: { halign: 'right' } }, concepto]);
        });
        body.push(['', '', { content: 'TOTAL PLANTILLA', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } }, { content: fmtN(totalPlantilla), styles: { halign: 'right', fontStyle: 'bold' } }, '']);
        if (cheques.length) {
          cheques.forEach(e => {
            const payable = getNetPayable(e, group?.periodType);
            totalCheques += payable;
            body.push([1, 'CHEQUE', corr++, cleanName(getEmpName(e)), { content: fmtN(payable), styles: { halign: 'right' } }, concepto]);
          });
          body.push(['', '', { content: 'TOTAL CHEQUES', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } }, { content: fmtN(totalCheques), styles: { halign: 'right', fontStyle: 'bold' } }, '']);
        }
        body.push(['', '', { content: 'TOTAL NÓMINA', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } }, { content: fmtN(totalPlantilla + totalCheques), styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 120, 0] } }, '']);
        body.push([{ content: '', colSpan: 6 }]);
      });

      autoTableFn(doc, { startY: 100, head: [['Tipo', 'No. Cuenta', 'Corr.', 'Nombre', 'Monto', 'Concepto']], body, theme: 'grid', headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' }, styles: { fontSize: 8, cellPadding: 3 }, columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 90 }, 2: { cellWidth: 35 }, 3: { cellWidth: 185 }, 4: { cellWidth: 75, halign: 'right' }, 5: { cellWidth: 100 } } });
      if (action === 'print') {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
      } else {
        doc.save(`Plantilla_Industrial_${safe}.pdf`);
      }
    }
  };

  
  const getColValue = (e, i, colId, format = false) => {
    let val = '';
    let isMoney = false;
    const net = getNetTotal(e);
    const pagoQuincena = getNetPayable(e, group?.periodType);
    const extras = getPayrollExtras(e);
    const deductions = getPayrollDeductions(e);
    
    switch(colId) {
      case 'no': val = i + 1; break;
      case 'nombre': val = getEmpName(e); break;
      case 'empresa': val = e.company || 'N/A'; break;
      case 'puesto': val = e.puesto || 'N/A'; break;
      case 'cuenta': val = e.no_cuenta || ''; break;
      case 'dias': val = getDaysWorked(e); break;
      case 'ordinario': val = e.calculated?.baseSalary || 0; isMoney = true; break;
      case 'bon_incentivo': val = e.calculated?.bonusLey || 0; isMoney = true; break;
      case 'bon_decreto': val = e.calculated?.bonusDec || 0; isMoney = true; break;
      case 'bonos': val = getPayrollBonuses(e); isMoney = true; break;
      case 'total_dev':
        val = (
          (Number(e.calculated?.baseSalary) || 0)
          + (Number(e.calculated?.bonusLey) || 0)
          + (Number(e.calculated?.bonusDec) || 0)
          + getPayrollBonuses(e)
        );
        isMoney = true;
        break;
      case 'hrs_simples': val = extras.simplesQty; break;
      case 'val_hrs_simples': val = extras.simplesVal; isMoney = true; break;
      case 'hrs_dobles': val = extras.doblesQty; break;
      case 'val_hrs_dobles': val = extras.doblesVal; isMoney = true; break;
      case 'otros_ingresos': val = extras.otherIncome; isMoney = true; break;
      case 'salario_total': val = Number(e.calculated?.gross) || 0; isMoney = true; break;
      case 'igss': val = deductions.igss || 0; isMoney = true; break;
      case 'isr': val = deductions.isr || 0; isMoney = true; break;
      case 'cafeteria': val = deductions.cafe || 0; isMoney = true; break;
      case 'celular': val = deductions.cell || 0; isMoney = true; break;
      case 'uniforme': val = deductions.uniform || 0; isMoney = true; break;
      case 'calzado': val = deductions.shoes || 0; isMoney = true; break;
      case 'equipo': val = deductions.equipo || 0; isMoney = true; break;
      case 'producto': val = deductions.product || 0; isMoney = true; break;
      case 'bancos': val = deductions.bancos || 0; isMoney = true; break;
      case 'otros': val = deductions.otros || 0; isMoney = true; break;
      case 'judiciales': val = deductions.judiciales || 0; isMoney = true; break;
      case 'seguro': val = deductions.seguro || 0; isMoney = true; break;
      case 'parqueo': val = deductions.parqueo || 0; isMoney = true; break;
      case 'ornato': val = deductions.boleto_de_ornato || 0; isMoney = true; break;
      case 'otros_egr': val = deductions.otros_egresos || 0; isMoney = true; break;
      case 'total_egr': val = getTotalDeductions(e); isMoney = true; break;
      case 'liquido': val = net; isMoney = true; break;
      case 'quinc1': val = group?.periodType === '2da' ? getAnticipo1ra(e) : net; isMoney = true; break;
      case 'quinc2': val = group?.periodType === '2da' ? pagoQuincena : 0; isMoney = true; break;
      case 'no_igss': val = e.no_igss || ''; break;
    }
    
    return format && isMoney ? fmtQ(val) : val;
  };

  const handlePrint = () => {
    handleDownloadPDF('print');
  };

  // ── HTML Preview ─────────────────────────────────────────────
  const renderPreview = () => {

    const renderDataRows = (dataArr, defs, vals, mapFn) => {
      const cols = defs.filter(c => vals.includes(c.id));
      return dataArr.map((e, i) => (
        <Tr key={e.id || i} bg={tdBg} _hover={{ bg: previewBg }}>
          {cols.map(c => mapFn(e, i, c))}
        </Tr>
      ));
    };

    const renderGroupedTable = (defs, vals, mapFn) => {
      const cols = defs.filter(c => vals.includes(c.id));
      if (!groupByArea) {
        return (
          <Box overflowX="auto">
            <Table size="sm" variant="simple">
              <Thead bg={theadBg}><Tr>{cols.map(c => <Th key={c.id} isNumeric={c.align === 'right'}>{c.label}</Th>)}</Tr></Thead>
              <Tbody>{renderDataRows(data, defs, vals, mapFn)}</Tbody>
            </Table>
          </Box>
        );
      }
      
      const grouped = {};
      data.forEach(e => {
        const areaId = e.areaId || e.area;
        const areaName = areas?.find(a => String(a.id) === String(areaId))?.nombre || 'Sin Área';
        if (!grouped[areaName]) grouped[areaName] = [];
        grouped[areaName].push(e);
      });
      
      return (
        <Box>
          {Object.keys(grouped).map(area => (
            <Box key={area} mb={6}>
              <Heading size="sm" color="blue.500" mb={2}>Área: {area}</Heading>
              <Box overflowX="auto">
                <Table size="sm" variant="simple">
                  <Thead bg={theadBg}><Tr>{cols.map(c => <Th key={c.id} isNumeric={c.align === 'right'}>{c.label}</Th>)}</Tr></Thead>
                  <Tbody>{renderDataRows(grouped[area], defs, vals, mapFn)}</Tbody>
                </Table>
              </Box>
            </Box>
          ))}
        </Box>
      );
    };


    // ── Verificador ──────────────────────────────────────────
    if (reportType === 'verificador') {
      return (
        <Box border="1px solid" borderColor={borderColor} borderRadius="md" overflow="hidden" h="600px" position="relative">
          {isGeneratingPdf || !pdfPreviewUrl ? (
            <Center h="100%" bg={previewBg} flexDirection="column" gap={4}>
              <Spinner size="xl" color="brand.500" thickness="4px" />
              <Text color="gray.500" fontWeight="medium">Generando previsualización del verificador...</Text>
            </Center>
          ) : (
            <embed src={`${pdfPreviewUrl}#toolbar=0`} type="application/pdf" width="100%" height="100%" style={{ border: 'none' }} title="Verificador de Pago" />
          )}
        </Box>
      );
    }

    // ── Solicitud de Cheques ──────────────────────────────────
    if (reportType === 'cheques') {
      const chData = data.filter(e => String(e.tipo_de_pago).toLowerCase() === 'cheque');
      if (!chData.length) return <Text color="gray.500" textAlign="center" py={10}>No hay empleados para pago en Cheque en esta nómina.</Text>;
      return (
        <Box border="1px solid" borderColor={borderColor} borderRadius="md" overflow="hidden" h="600px" position="relative">
          {isGeneratingPdf || !pdfPreviewUrl ? (
            <Center h="100%" bg={previewBg} flexDirection="column" gap={4}>
              <Spinner size="xl" color="brand.500" thickness="4px" />
              <Text color="gray.500" fontWeight="medium">Generando previsualización de la solicitud...</Text>
            </Center>
          ) : (
            <embed src={`${pdfPreviewUrl}#toolbar=0`} type="application/pdf" width="100%" height="100%" style={{ border: 'none' }} title="Solicitud de Cheques" />
          )}
        </Box>
      );
    }

    // ── Nómina General ───────────────────────────────────────

    if (reportType === 'nomina') {
      const summary = computePayrollSummary(data, group?.periodType);
      const periodLabel = group?.periodType === '2da' ? '2da Quincena' : '1ra Quincena';
      const statusLabel = group?.status === 'auditoria' ? 'En Auditoría' : 'Cerrada';

      return (
        <Box>
          <Box
            mb={5}
            p={4}
            borderRadius="lg"
            bg="blue.900"
            color="white"
            _dark={{ bg: 'blue.950' }}
          >
            <Heading size="sm" mb={1}>NÓMINA GENERAL — DESGLOSE COMPLETO DE PAGOS</Heading>
            <Text fontSize="xs" opacity={0.85}>
              Periodo: {safeTitle} · {periodLabel} · Estado: {statusLabel} · Empleados: {summary.employeeCount}
            </Text>
          </Box>

          <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} gap={3} mb={6}>
            <Box p={3} borderRadius="md" borderWidth="1px" borderColor={borderColor} bg={theadBg}>
              <Text fontSize="xs" fontWeight="bold" color="orange.500" textTransform="uppercase">Costo Bruto Total</Text>
              <Text fontSize="lg" fontWeight="bold" color="orange.600">{fmtQ(summary.grossTotal)}</Text>
            </Box>
            <Box p={3} borderRadius="md" borderWidth="1px" borderColor={borderColor} bg={theadBg}>
              <Text fontSize="xs" fontWeight="bold" color="red.500" textTransform="uppercase">Deducciones Totales</Text>
              <Text fontSize="lg" fontWeight="bold" color="red.500">{fmtQ(summary.dedTotal)}</Text>
            </Box>
            <Box p={3} borderRadius="md" borderWidth="1px" borderColor={borderColor} bg={theadBg}>
              <Text fontSize="xs" fontWeight="bold" color="orange.400" textTransform="uppercase">Cuota Patronal Estimada</Text>
              <Text fontSize="lg" fontWeight="bold" color="orange.400">{fmtQ(summary.patronalTotal)}</Text>
            </Box>
            <Box p={3} borderRadius="md" borderWidth="1px" borderColor={borderColor} bg={theadBg}>
              <Text fontSize="xs" fontWeight="bold" color="blue.500" textTransform="uppercase">Desembolso Neto</Text>
              <Text fontSize="lg" fontWeight="bold" color="blue.600">{fmtQ(summary.netTotal)}</Text>
            </Box>
          </SimpleGrid>

          <Heading size="xs" color="gray.500" textTransform="uppercase" mb={3} letterSpacing="wider">
            Desglose Completo de Pagos
          </Heading>

          {renderGroupedTable(ALL_COLUMNS_DEF, colsNomina, (e, i, c) => {
            const val = getColValue(e, i, c.id, true);
            return (
              <Td
                key={c.id}
                fontSize="xs"
                isNumeric={c.align === 'right'}
                fontWeight={c.id === 'liquido' || c.id === 'total_dev' || c.id === 'salario_total' ? 'bold' : 'normal'}
                color={c.id === 'liquido' ? 'green.600' : c.id === 'total_egr' ? 'red.500' : 'inherit'}
              >
                {val}
              </Td>
            );
          })}
        </Box>
      );
    }

    // ── Recibo e IGSS ─────────────────────────────────────────
    if (reportType === 'igss') {
      return renderGroupedTable(ALL_COLUMNS_DEF, colsIgss, (e, i, c) => {
        const val = getColValue(e, i, c.id, true);
        return <Td key={c.id} fontSize="xs" isNumeric={c.align === 'right'} fontWeight={c.id === 'liquido' ? 'bold' : 'normal'} color={c.id === 'liquido' ? 'green.600' : 'inherit'}>
          {val}
        </Td>;
      });
    }

    // ── Libro de Salarios ─────────────────────────────────────
    if (reportType === 'libro') {
      return (
        <Box border="1px solid" borderColor={borderColor} borderRadius="md" overflow="hidden" h="600px" position="relative">
          {isGeneratingPdf || !pdfPreviewUrl ? (
            <Center h="100%" bg={previewBg} flexDirection="column" gap={4}>
              <Spinner size="xl" color="brand.500" thickness="4px" />
              <Text color="gray.500" fontWeight="medium">Generando previsualización del libro...</Text>
            </Center>
          ) : (
            <embed src={`${pdfPreviewUrl}#toolbar=0`} type="application/pdf" width="100%" height="100%" style={{ border: 'none' }} title="Libro de Salarios" />
          )}
        </Box>
      );
    }

    // ── Plantilla Promerica ───────────────────────────────────
    if (reportType === 'promerica') {
      const comps = buildCompGroups();
      const concepto = getConcept();
      return (
        <Box border="1px solid" borderColor={borderColor} borderRadius="md" overflow="hidden">
          <Table size="sm" variant="simple"><Thead bg={theadBg}><Tr><Th>No. Cuenta</Th><Th>Nombre de Colaborador</Th><Th isNumeric>Monto</Th><Th>Concepto</Th></Tr></Thead>
            <Tbody>
              {Object.keys(comps).map((compName, ci) => {
                const { cheques, transfers } = comps[compName];
                let tP = 0, tC = 0;
                const rows = [<Tr key={`ch-${ci}`} bg={compHeaderBg}><Td colSpan={4} fontWeight="bold" fontSize="xs" color="blue.700" _dark={{ color: 'blue.200' }}>Empresa: {compName.toUpperCase()}</Td></Tr>];
                transfers.forEach((e, ei) => { const payable = getNetPayable(e, group?.periodType); tP += payable; rows.push(<Tr key={`tr-${ci}-${ei}`} bg={tdBg}><Td fontSize="xs">{e.numero_cuenta || e.no_cuenta || 'N/A'}</Td><Td fontSize="xs" fontWeight="semibold">{cleanName(getEmpName(e))}</Td><Td isNumeric fontFamily="mono" fontSize="xs">{fmtQ(payable)}</Td><Td fontSize="xs" color="gray.400" isTruncated>{concepto}</Td></Tr>); });
                rows.push(<Tr key={`tP-${ci}`} bg={subtotalRowBg}><Td fontSize="xs"></Td><Td fontSize="xs" fontWeight="bold" textAlign="right">Total Plantilla {compName.toUpperCase()}</Td><Td isNumeric fontFamily="mono" fontSize="xs" fontWeight="bold">{fmtQ(tP)}</Td><Td /></Tr>);
                if (cheques.length) { cheques.forEach((e, ei) => { const payable = getNetPayable(e, group?.periodType); tC += payable; rows.push(<Tr key={`ck-${ci}-${ei}`} bg={tdBg}><Td fontSize="xs" color="orange.500">CHEQUE</Td><Td fontSize="xs" fontWeight="semibold">{cleanName(getEmpName(e))}</Td><Td isNumeric fontFamily="mono" fontSize="xs">{fmtQ(payable)}</Td><Td fontSize="xs" color="gray.400" isTruncated>{concepto}</Td></Tr>); }); rows.push(<Tr key={`tC-${ci}`} bg={subtotalRowBg}><Td fontSize="xs"></Td><Td fontSize="xs" fontWeight="bold" textAlign="right">Total Cheques</Td><Td isNumeric fontFamily="mono" fontSize="xs" fontWeight="bold">{fmtQ(tC)}</Td><Td /></Tr>); }
                rows.push(<Tr key={`tT-${ci}`} bg={totalRowBg}><Td fontSize="xs"></Td><Td fontSize="xs" fontWeight="black" textAlign="right">Total Nómina</Td><Td isNumeric fontFamily="mono" fontSize="xs" fontWeight="black" color="green.700">{fmtQ(tP + tC)}</Td><Td /></Tr>);
                return rows;
              })}
            </Tbody>
          </Table>
        </Box>
      );
    }

    // ── Plantilla Industrial ──────────────────────────────────
    if (reportType === 'industrial') {
      const comps = buildCompGroups();
      const concepto = getConcept();
      return (
        <Box border="1px solid" borderColor={borderColor} borderRadius="md" overflow="hidden">
          <Table size="sm" variant="simple"><Thead bg={theadBg}><Tr><Th>Tipo</Th><Th>No. Cuenta</Th><Th>Corr.</Th><Th>Nombre</Th><Th isNumeric>Monto</Th><Th>Concepto</Th></Tr></Thead>
            <Tbody>
              {Object.keys(comps).map((compName, ci) => {
                const { cheques, transfers } = comps[compName];
                let tP = 0, tC = 0, corr = 1;
                const rows = [<Tr key={`ch-${ci}`} bg={compHeaderBg}><Td colSpan={6} fontWeight="bold" fontSize="xs" color="blue.700" _dark={{ color: 'blue.200' }}>Empresa: {compName.toUpperCase()}</Td></Tr>];
                transfers.forEach((e, ei) => { const payable = getNetPayable(e, group?.periodType); tP += payable; rows.push(<Tr key={`tr-${ci}-${ei}`} bg={tdBg}><Td fontSize="xs">{e.tipo_cuenta?.toLowerCase() === 'ahorro' ? 2 : 1}</Td><Td fontSize="xs">{e.numero_cuenta || e.no_cuenta || 'N/A'}</Td><Td fontSize="xs">{corr++}</Td><Td fontSize="xs" fontWeight="semibold">{cleanName(getEmpName(e))}</Td><Td isNumeric fontFamily="mono" fontSize="xs">{fmtQ(payable)}</Td><Td fontSize="xs" color="gray.400" isTruncated>{concepto}</Td></Tr>); });
                rows.push(<Tr key={`tP-${ci}`} bg={subtotalRowBg}><Td colSpan={3}></Td><Td fontSize="xs" fontWeight="bold" textAlign="right">TOTAL PLANTILLA</Td><Td isNumeric fontFamily="mono" fontSize="xs" fontWeight="bold">{fmtQ(tP)}</Td><Td /></Tr>);
                if (cheques.length) { cheques.forEach((e, ei) => { const payable = getNetPayable(e, group?.periodType); tC += payable; rows.push(<Tr key={`ck-${ci}-${ei}`} bg={tdBg}><Td fontSize="xs">1</Td><Td fontSize="xs" color="orange.500">CHEQUE</Td><Td fontSize="xs">{corr++}</Td><Td fontSize="xs" fontWeight="semibold">{cleanName(getEmpName(e))}</Td><Td isNumeric fontFamily="mono" fontSize="xs">{fmtQ(payable)}</Td><Td fontSize="xs" color="gray.400" isTruncated>{concepto}</Td></Tr>); }); rows.push(<Tr key={`tC-${ci}`} bg={subtotalRowBg}><Td colSpan={3}></Td><Td fontSize="xs" fontWeight="bold" textAlign="right">TOTAL CHEQUES</Td><Td isNumeric fontFamily="mono" fontSize="xs" fontWeight="bold">{fmtQ(tC)}</Td><Td /></Tr>); }
                rows.push(<Tr key={`tT-${ci}`} bg={totalRowBg}><Td colSpan={3}></Td><Td fontSize="xs" fontWeight="black" textAlign="right">TOTAL NÓMINA</Td><Td isNumeric fontFamily="mono" fontSize="xs" fontWeight="black" color="green.700">{fmtQ(tP + tC)}</Td><Td /></Tr>);
                return rows;
              })}
            </Tbody>
          </Table>
        </Box>
      );
    }

    return null;
  };

  const reportTitle = REPORT_TITLES[reportType] || reportType || 'Reporte';
  const safeTitle = group.title || 'Sin Título';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent borderRadius="xl">
        <ModalHeader borderBottom="1px solid" borderColor={borderColor} bg={theadBg} borderTopRadius="xl">
          <Flex align="center" justify="space-between" pr={6}>
            <Flex align="center" gap={3}>
              <Box p={2} bg="brand.100" _dark={{ bg: 'brand.900' }} borderRadius="md" color="brand.600">
                <FileText size={20} />
              </Box>
              <Box>
                <Heading size="md" color="brand.700" _dark={{ color: 'brand.200' }}>
                  Previsualización: {reportTitle}
                </Heading>
                <Text fontSize="sm" color="gray.500" fontWeight="normal">Nómina: {safeTitle}</Text>
              </Box>
            </Flex>
            {renderConfigControls()}
          </Flex>
        </ModalHeader>
        <ModalCloseButton mt={2} />

        <ModalBody py={6} bg={previewBg}>
          <Box bg={tdBg} p={8} boxShadow="lg" borderRadius="sm" minH="600px" mx="auto" maxW="1100px">
            {/* Document header (omitido en nómina: ya trae encabezado + resumen propio) */}
            {reportType !== 'nomina' && reportType !== 'verificador' && reportType !== 'cheques' && reportType !== 'libro' && (
              <Flex justify="space-between" mb={6} borderBottom="2px solid" borderColor={borderColor} pb={4} align="flex-start">
                <Box>
                  <Heading size="md" mb={1} textTransform="uppercase">Grupo ECONSA</Heading>
                  <Text fontSize="md" fontWeight="bold" color="brand.600">{reportTitle.toUpperCase()}</Text>
                  <Badge colorScheme="blue" mt={1} fontSize="xs">{safeTitle}</Badge>
                </Box>
                <Box textAlign="right">
                  <Text fontSize="sm"><b>Fecha de Pago:</b> {fechaPago}</Text>
                  <Text fontSize="sm"><b>Empleados:</b> {data.length}</Text>
                </Box>
              </Flex>
            )}
            {renderPreview()}
          </Box>
        </ModalBody>

        <ModalFooter borderTop="1px solid" borderColor={borderColor} gap={3}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button colorScheme="purple" leftIcon={<Printer size={18} />} onClick={handlePrint}>
            Imprimir
          </Button>
          <Button colorScheme="red" leftIcon={<Download size={18} />} onClick={handleDownloadPDF}>
            Descargar PDF
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
