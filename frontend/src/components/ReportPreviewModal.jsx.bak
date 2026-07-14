import React, { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  Button, Box, Table, Thead, Tbody, Tr, Th, Td, Heading, Text, Flex, useColorModeValue, Badge, Spinner, Center
} from '@chakra-ui/react';
import { Download, FileText, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Inline to avoid circular import issues
const getEmpName = (e) => {
  if (!e) return 'N/A';
  const parts = [e.primer_nombre, e.segundo_nombre, e.otro_nombre, e.primer_apellido, e.segundo_apellido, e.apellido_casada].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return `${e.nombres || ''} ${e.apellidos || ''}`.trim() || 'Empleado';
};

const fmtQ = (n) => `Q ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtN = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const REPORT_TITLES = {
  verificador:  'Verificador de Pago de Nómina',
  cheques:      'Solicitud de Cheques',
  nomina:       'Nómina General',
  igss:         'Recibo e IGSS',
  libro:        'Libro de Salarios',
  promerica:    'Plantilla Banco Promerica',
  industrial:   'Plantilla Banco Industrial',
};

export default function ReportPreviewModal({ isOpen, onClose, reportType, group, data, companies }) {
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

  // Helper to generate Libro Doc
  const generateLibroDoc = () => {
    const doc = new jsPDF('landscape', 'pt', 'legal');
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

      const ord = fmtN(e.calculated.baseSalary);
      const ext = fmtN((e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0));
      const septimos = fmtN(e.extras?.septimosVal || 0);
      const vacaciones = fmtN(e.extras?.vacacionesVal || 0); 
      const totalDev = fmtN(e.calculated.gross);
      
      const igss = fmtN(e.deductions?.igss || 0);
      const otrasDed = fmtN((e.calculated.ded || 0) - (e.deductions?.igss || 0));
      const totalDed = fmtN(e.calculated.ded);
      
      const dec4292 = fmtN((e.calculated.bonusDec || 0) + (e.calculated.bonos || 0));
      const bonInc = fmtN(e.calculated.bonusLey || 0);
      const liq = fmtN(e.calculated.net);

      autoTable(doc, {
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
            e.days || 30,
            '',
            e.extras?.simplesQty || 0,
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
    if (isOpen && reportType === 'libro' && data && group) {
      setIsGeneratingPdf(true);
      setPdfPreviewUrl(null);
      setTimeout(() => {
        try {
          const doc = generateLibroDoc();
          setPdfPreviewUrl(doc.output('datauristring'));
        } catch (err) {
          console.error(err);
        } finally {
          setIsGeneratingPdf(false);
        }
      }, 50);
    } else {
      setPdfPreviewUrl(null);
    }
  }, [isOpen, reportType, data, group]);

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
  const handleDownloadPDF = () => {
    const title  = REPORT_TITLES[reportType] || reportType;
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

    // ── Verificador ──────────────────────────────────────────
    if (reportType === 'verificador') {
      const doc = new jsPDF('landscape', 'pt', 'letter');
      addHeader(doc, 'Verificador de Pago de Nómina');
      const comps = buildCompGroups();
      const body = [];
      let grandTotal = 0;

      Object.keys(comps).forEach(compName => {
        const { cheques, transfers } = comps[compName];
        if (!cheques.length && !transfers.length) return;
        body.push([{ content: `Empresa: ${compName.toUpperCase()}`, colSpan: 6, styles: { fillColor: [220, 237, 255], fontStyle: 'bold', textColor: [20, 80, 160] } }]);
        if (transfers.length > 0) {
          const sum = transfers.reduce((a, e) => a + e.calculated.net, 0);
          grandTotal += sum;
          body.push(['Varios Plantilla', '', 'Nomina', '', 'Transferencia', { content: fmtQ(sum), styles: { halign: 'right', fontStyle: 'bold' } }]);
        }
        let chSub = 0;
        cheques.forEach(e => { grandTotal += e.calculated.net; chSub += e.calculated.net; body.push([getEmpName(e), compName.toUpperCase(), e.puesto || 'FIJO', '', 'CHEQUE', { content: fmtQ(e.calculated.net), styles: { halign: 'right' } }]); });
        if (cheques.length) body.push(['', '', '', '', { content: 'Subtotal Cheques:', styles: { halign: 'right', fontStyle: 'italic' } }, { content: fmtQ(chSub), styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 120, 0] } }]);
      });
      body.push(['', '', '', '', { content: 'TOTAL GENERAL', styles: { halign: 'right', fontStyle: 'bold', fontSize: 10 } }, { content: fmtQ(grandTotal), styles: { halign: 'right', fontStyle: 'bold', fontSize: 10, textColor: [0, 120, 0] } }]);
      body.push([{ content: '', colSpan: 6 }]);
      body.push([{ content: 'Hecho por: Alejandra Pérez', colSpan: 3 }, { content: 'Revisado por: Iris de Lemus (Recursos Humanos)', colSpan: 3 }]);
      body.push([{ content: 'Revisado por: Walter Mendez (Auditoria)', colSpan: 3 }, { content: 'Autorizado por: Gerardo Estrada (Presidencia)', colSpan: 3 }]);
      body.push([{ content: `Nota: Transferencia programada para ${fechaPago} INMEDIATO`, colSpan: 6, styles: { fontStyle: 'italic', textColor: [100, 100, 100] } }]);

      autoTable(doc, { startY: 100, head: [['Nombre de Colaborador', 'Empresa', 'Soporte', 'Banco de Pago', 'Medio de Pago', 'Monto']], body, theme: 'grid', headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' }, styles: { fontSize: 8, cellPadding: 3 }, columnStyles: { 0: { cellWidth: 155 }, 1: { cellWidth: 105 }, 2: { cellWidth: 75 }, 3: { cellWidth: 75 }, 4: { cellWidth: 85 }, 5: { cellWidth: 85, halign: 'right' } } });
      doc.save(`Verificador_Pago_${safe}.pdf`);
    }

    // ── Solicitud de Cheques ─────────────────────────────────
    else if (reportType === 'cheques') {
      const doc = new jsPDF('portrait', 'pt', 'letter');
      addHeader(doc, 'Solicitud de Cheques');
      const chData = data.filter(e => String(e.tipo_de_pago).toLowerCase() === 'cheque');
      let total = 0;
      const body = chData.map(e => {
        const net = group.periodType === '2da' ? (e.calculated.net - (e.anticipo1ra || 0)) : e.calculated.net;
        total += net;
        const comp = companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa';
        return [getEmpName(e), comp, e.puesto || 'N/A', e.banco || 'N/A', 'Cheque', { content: fmtQ(net), styles: { halign: 'right' } }];
      });
      body.push(['', '', '', '', { content: 'TOTAL', styles: { fontStyle: 'bold', halign: 'right' } }, { content: fmtQ(total), styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 120, 0] } }]);
      autoTable(doc, { startY: 100, head: [['Nombre de Colaborador', 'Empresa', 'Tipo Personal', 'Banco de Pago', 'Medio Pago', 'Monto Total']], body, theme: 'grid', headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' }, styles: { fontSize: 8, cellPadding: 3 } });
      doc.save(`Solicitud_Cheques_${safe}.pdf`);
    }

    // ── Nómina General ───────────────────────────────────────
    else if (reportType === 'nomina') {
      const doc = new jsPDF('landscape', 'pt', 'letter');
      addHeader(doc, 'Nómina General');
      const body = data.map((e, i) => [
        i + 1, getEmpName(e), e.company || 'N/A', e.puesto || 'N/A', e.days || 30,
        fmtQ(e.calculated.baseSalary), fmtQ(e.calculated.bonusLey), fmtQ(e.calculated.bonusDec),
        fmtQ(e.calculated.gross), fmtQ(e.calculated.ded), { content: fmtQ(e.calculated.net), styles: { fontStyle: 'bold', textColor: [0, 120, 0] } }
      ]);
      autoTable(doc, { startY: 100, head: [['No.', 'Nombre', 'Empresa', 'Puesto', 'Días', 'S. Ordinario', 'Bon. Incentivo', 'Bon. Decreto', 'Total Dev.', 'Total Egr.', 'Líquido']], body, theme: 'grid', headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' }, styles: { fontSize: 7, cellPadding: 3 }, columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' } } });
      doc.save(`Nomina_General_${safe}.pdf`);
    }

    // ── Recibo e IGSS ────────────────────────────────────────
    else if (reportType === 'igss') {
      const doc = new jsPDF('landscape', 'pt', 'letter');
      addHeader(doc, 'Recibo e IGSS');
      const body = data.map((e, i) => {
        const net = e.calculated.net;
        const q1 = group.periodType === '2da' ? (e.anticipo1ra || 0) : net;
        const q2 = group.periodType === '2da' ? net - (e.anticipo1ra || 0) : 0;
        return [i + 1, getEmpName(e), e.no_cuenta || '', e.puesto || 'N/A', e.days || 30, fmtQ(e.calculated.baseSalary), fmtQ(e.calculated.bonusLey + e.calculated.bonusDec + e.calculated.bonos), fmtQ(e.calculated.gross), fmtQ(e.deductions?.igss || 0), fmtQ(e.deductions?.isr || 0), fmtQ(e.calculated.ded), { content: fmtQ(net), styles: { fontStyle: 'bold', textColor: [0, 120, 0] } }, fmtQ(q1), fmtQ(q2), e.no_igss || ''];
      });
      autoTable(doc, { startY: 100, head: [['No.', 'Nombre', 'No. Cuenta', 'Puesto', 'Días', 'S. Ordinario', 'Bonos', 'Total Dev.', 'IGSS', 'ISR', 'Total Egr.', 'Líquido', '1ra Quinc.', '2da Quinc.', 'No. IGSS']], body, theme: 'grid', headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' }, styles: { fontSize: 6.5, cellPadding: 2.5 }, columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' }, 11: { halign: 'right' }, 12: { halign: 'right' }, 13: { halign: 'right' } } });
      doc.save(`Recibo_IGSS_${safe}.pdf`);
    }

    // ── Libro de Salarios ────────────────────────────────────
    else if (reportType === 'libro') {
      const doc = generateLibroDoc();
      doc.save(`Libro_Salarios_${safe}.pdf`);
    }

    // ── Plantilla Promerica ──────────────────────────────────
    else if (reportType === 'promerica') {
      const doc = new jsPDF('portrait', 'pt', 'letter');
      addHeader(doc, 'Plantilla Banco Promerica');
      const comps = buildCompGroups();
      const body = [];
      const concepto = getConcept();

      Object.keys(comps).forEach(compName => {
        const { cheques, transfers } = comps[compName];
        body.push([{ content: `Empresa: ${compName.toUpperCase()}`, colSpan: 4, styles: { fillColor: [220, 237, 255], fontStyle: 'bold', textColor: [20, 80, 160] } }]);
        let totalPlantilla = 0, totalCheques = 0;
        transfers.forEach(e => { totalPlantilla += e.calculated.net; body.push([e.numero_cuenta || e.no_cuenta || '', cleanName(getEmpName(e)), { content: fmtN(e.calculated.net), styles: { halign: 'right' } }, concepto]); });
        body.push(['', { content: `Total Plantilla ${compName.toUpperCase()}`, styles: { fontStyle: 'bold' } }, { content: fmtN(totalPlantilla), styles: { halign: 'right', fontStyle: 'bold' } }, '']);
        if (cheques.length) {
          cheques.forEach(e => { totalCheques += e.calculated.net; body.push(['CHEQUE', cleanName(getEmpName(e)), { content: fmtN(e.calculated.net), styles: { halign: 'right' } }, concepto]); });
          body.push(['', { content: 'Total Cheques', styles: { fontStyle: 'bold' } }, { content: fmtN(totalCheques), styles: { halign: 'right', fontStyle: 'bold' } }, '']);
        }
        body.push(['', { content: 'Total Nómina', styles: { fontStyle: 'bold' } }, { content: fmtN(totalPlantilla + totalCheques), styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 120, 0] } }, '']);
        body.push([{ content: '', colSpan: 4 }]);
      });

      autoTable(doc, { startY: 100, head: [['No. Cuenta', 'Nombre de Colaborador', 'Monto', 'Concepto']], body, theme: 'grid', headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' }, styles: { fontSize: 8, cellPadding: 3 }, columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 200 }, 2: { cellWidth: 80, halign: 'right' }, 3: { cellWidth: 150 } } });
      doc.save(`Plantilla_Promerica_${safe}.pdf`);
    }

    // ── Plantilla Industrial ─────────────────────────────────
    else if (reportType === 'industrial') {
      const doc = new jsPDF('portrait', 'pt', 'letter');
      addHeader(doc, 'Plantilla Banco Industrial');
      const comps = buildCompGroups();
      const body = [];
      const concepto = getConcept();

      Object.keys(comps).forEach(compName => {
        const { cheques, transfers } = comps[compName];
        body.push([{ content: `Empresa: ${compName.toUpperCase()}`, colSpan: 5, styles: { fillColor: [220, 237, 255], fontStyle: 'bold', textColor: [20, 80, 160] } }]);
        let totalPlantilla = 0, totalCheques = 0, corr = 1;
        transfers.forEach(e => { totalPlantilla += e.calculated.net; body.push([e.tipo_cuenta?.toLowerCase() === 'ahorro' ? 2 : 1, e.numero_cuenta || e.no_cuenta || '', corr++, cleanName(getEmpName(e)), { content: fmtN(e.calculated.net), styles: { halign: 'right' } }, concepto]); });
        body.push(['', '', { content: 'TOTAL PLANTILLA', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } }, { content: fmtN(totalPlantilla), styles: { halign: 'right', fontStyle: 'bold' } }, '']);
        if (cheques.length) {
          cheques.forEach(e => { totalCheques += e.calculated.net; body.push([1, 'CHEQUE', corr++, cleanName(getEmpName(e)), { content: fmtN(e.calculated.net), styles: { halign: 'right' } }, concepto]); });
          body.push(['', '', { content: 'TOTAL CHEQUES', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } }, { content: fmtN(totalCheques), styles: { halign: 'right', fontStyle: 'bold' } }, '']);
        }
        body.push(['', '', { content: 'TOTAL NÓMINA', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } }, { content: fmtN(totalPlantilla + totalCheques), styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 120, 0] } }, '']);
        body.push([{ content: '', colSpan: 6 }]);
      });

      autoTable(doc, { startY: 100, head: [['Tipo', 'No. Cuenta', 'Corr.', 'Nombre', 'Monto', 'Concepto']], body, theme: 'grid', headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' }, styles: { fontSize: 8, cellPadding: 3 }, columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 90 }, 2: { cellWidth: 35 }, 3: { cellWidth: 185 }, 4: { cellWidth: 75, halign: 'right' }, 5: { cellWidth: 100 } } });
      doc.save(`Plantilla_Industrial_${safe}.pdf`);
    }
  };

  const handlePrint = () => {
    if (reportType === 'libro') {
      const doc = generateLibroDoc();
      doc.autoPrint();
      const blobUrl = doc.output('bloburl');
      window.open(blobUrl, '_blank');
    } else {
      window.print();
    }
  };

  // ── HTML Preview ─────────────────────────────────────────────
  const renderPreview = () => {
    // ── Verificador ──────────────────────────────────────────
    if (reportType === 'verificador') {
      const comps = buildCompGroups();
      let grandTotal = 0;
      const rows = [];
      Object.keys(comps).forEach((compName, ci) => {
        const { cheques, transfers } = comps[compName];
        if (!cheques.length && !transfers.length) return;
        rows.push(<Tr key={`ch-${ci}`} bg={compHeaderBg}><Td colSpan={5} fontWeight="bold" fontSize="xs" color="blue.700" _dark={{ color: 'blue.200' }} py={2}>Empresa: {compName.toUpperCase()}</Td><Td /></Tr>);
        if (transfers.length > 0) {
          const sum = transfers.reduce((a, e) => a + e.calculated.net, 0); grandTotal += sum;
          rows.push(<Tr key={`tr-${ci}`} bg={tdBg}><Td fontSize="xs" fontWeight="semibold">Varios Plantilla</Td><Td fontSize="xs"></Td><Td fontSize="xs">Nomina</Td><Td fontSize="xs"></Td><Td fontSize="xs">Transferencia</Td><Td isNumeric fontFamily="mono" fontSize="xs" fontWeight="bold" color="blue.600">{fmtQ(sum)}</Td></Tr>);
        }
        let chSub = 0;
        cheques.forEach((e, ei) => { grandTotal += e.calculated.net; chSub += e.calculated.net; rows.push(<Tr key={`eq-${ci}-${ei}`} bg={tdBg}><Td fontSize="xs" fontWeight="semibold">{getEmpName(e)}</Td><Td fontSize="xs">{compName.toUpperCase()}</Td><Td fontSize="xs">{e.puesto || 'FIJO'}</Td><Td fontSize="xs"></Td><Td fontSize="xs">CHEQUE</Td><Td isNumeric fontFamily="mono" fontSize="xs">{fmtQ(e.calculated.net)}</Td></Tr>); });
        if (cheques.length > 0) rows.push(<Tr key={`sub-${ci}`} bg={subtotalRowBg}><Td colSpan={5} textAlign="right" fontSize="xs" fontStyle="italic" color="gray.500">Subtotal Cheques:</Td><Td isNumeric fontFamily="mono" fontSize="xs" fontWeight="bold" color="green.600">{fmtQ(chSub)}</Td></Tr>);
      });
      return (
        <Box>
          <Box border="1px solid" borderColor={borderColor} borderRadius="md" overflowX="auto">
            <Table size="sm" variant="simple"><Thead bg={theadBg} position="sticky" top={0} zIndex={5}><Tr><Th>Nombre de Colaborador</Th><Th>Empresa</Th><Th>Soporte</Th><Th>Banco</Th><Th>Medio Pago</Th><Th isNumeric>Monto</Th></Tr></Thead>
              <Tbody>{rows}<Tr bg={totalRowBg} borderTop="2px solid" borderColor="brand.400"><Td colSpan={5} textAlign="right" fontWeight="black" fontSize="sm">TOTAL GENERAL</Td><Td isNumeric fontFamily="mono" fontWeight="black" fontSize="sm" color="green.700">{fmtQ(grandTotal)}</Td></Tr></Tbody>
            </Table>
          </Box>
          <Box mt={8} pt={4} borderTop="1px dashed" borderColor={borderColor}>
            <Flex justify="space-between" mb={6}>
              <Box><Box borderBottom="1px solid" borderColor="gray.400" w="200px" mb={1} /><Text fontSize="xs" color="gray.500">Hecho por: Alejandra Pérez</Text></Box>
              <Box><Box borderBottom="1px solid" borderColor="gray.400" w="200px" mb={1} /><Text fontSize="xs" color="gray.500">Revisado por: Iris de Lemus (RR.HH.)</Text></Box>
            </Flex>
            <Flex justify="space-between" mb={4}>
              <Box><Box borderBottom="1px solid" borderColor="gray.400" w="200px" mb={1} /><Text fontSize="xs" color="gray.500">Revisado por: Walter Mendez (Auditoria)</Text></Box>
              <Box><Box borderBottom="1px solid" borderColor="gray.400" w="200px" mb={1} /><Text fontSize="xs" color="gray.500">Autorizado por: Gerardo Estrada (Presidencia)</Text></Box>
            </Flex>
            <Text fontSize="xs" color="gray.400" fontStyle="italic">Nota: Transferencia programada para {fechaPago} INMEDIATO</Text>
          </Box>
        </Box>
      );
    }

    // ── Solicitud de Cheques ──────────────────────────────────
    if (reportType === 'cheques') {
      const chData = data.filter(e => String(e.tipo_de_pago).toLowerCase() === 'cheque');
      if (!chData.length) return <Text color="gray.500" textAlign="center" py={10}>No hay empleados para pago en Cheque en esta nómina.</Text>;
      let total = 0;
      return (
        <Box border="1px solid" borderColor={borderColor} borderRadius="md" overflow="hidden">
          <Table size="sm" variant="simple"><Thead bg={theadBg}><Tr><Th>Nombre Colaborador</Th><Th>Empresa</Th><Th>Puesto</Th><Th>Banco</Th><Th isNumeric>Monto</Th></Tr></Thead>
            <Tbody bg={tdBg}>
              {chData.map((e, i) => { const net = group.periodType === '2da' ? (e.calculated.net - (e.anticipo1ra || 0)) : e.calculated.net; total += net; const comp = companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa'; return (<Tr key={i}><Td fontSize="xs" fontWeight="semibold">{getEmpName(e)}</Td><Td fontSize="xs">{comp}</Td><Td fontSize="xs">{e.puesto || 'N/A'}</Td><Td fontSize="xs">{e.banco || 'N/A'}</Td><Td isNumeric fontFamily="mono" fontSize="xs" fontWeight="bold">{fmtQ(net)}</Td></Tr>); })}
              <Tr bg={totalRowBg}><Td colSpan={4} textAlign="right" fontWeight="bold" fontSize="xs">TOTAL</Td><Td isNumeric fontFamily="mono" fontWeight="black" color="green.700">{fmtQ(total)}</Td></Tr>
            </Tbody>
          </Table>
        </Box>
      );
    }

    // ── Nómina General ─────────────────────────────────────────
    if (reportType === 'nomina') {
      let tDev = 0, tEgr = 0, tNet = 0;
      return (
        <Box border="1px solid" borderColor={borderColor} borderRadius="md" overflowX="auto">
          <Table size="sm" variant="simple"><Thead bg={theadBg}><Tr><Th>No.</Th><Th>Nombre</Th><Th>Empresa</Th><Th>Puesto</Th><Th>Días</Th><Th isNumeric>S. Ordinario</Th><Th isNumeric>Bon. Inc.</Th><Th isNumeric>Bon. Dec.</Th><Th isNumeric>Total Dev.</Th><Th isNumeric>Total Egr.</Th><Th isNumeric>Líquido</Th></Tr></Thead>
            <Tbody bg={tdBg}>
              {data.map((e, i) => { tDev += e.calculated.gross; tEgr += e.calculated.ded; tNet += e.calculated.net; return (<Tr key={i}><Td fontSize="xs">{i+1}</Td><Td fontSize="xs" fontWeight="semibold">{getEmpName(e)}</Td><Td fontSize="xs">{e.company || 'N/A'}</Td><Td fontSize="xs">{e.puesto || 'N/A'}</Td><Td fontSize="xs">{e.days || 30}</Td><Td isNumeric fontFamily="mono" fontSize="xs">{fmtQ(e.calculated.baseSalary)}</Td><Td isNumeric fontFamily="mono" fontSize="xs">{fmtQ(e.calculated.bonusLey)}</Td><Td isNumeric fontFamily="mono" fontSize="xs">{fmtQ(e.calculated.bonusDec)}</Td><Td isNumeric fontFamily="mono" fontSize="xs" fontWeight="bold">{fmtQ(e.calculated.gross)}</Td><Td isNumeric fontFamily="mono" fontSize="xs" color="red.500">{fmtQ(e.calculated.ded)}</Td><Td isNumeric fontFamily="mono" fontSize="xs" fontWeight="bold" color="green.600">{fmtQ(e.calculated.net)}</Td></Tr>); })}
              <Tr bg={totalRowBg}><Td colSpan={8} textAlign="right" fontWeight="bold" fontSize="xs">TOTALES</Td><Td isNumeric fontFamily="mono" fontSize="xs" fontWeight="bold">{fmtQ(tDev)}</Td><Td isNumeric fontFamily="mono" fontSize="xs" fontWeight="bold" color="red.600">{fmtQ(tEgr)}</Td><Td isNumeric fontFamily="mono" fontSize="xs" fontWeight="black" color="green.700">{fmtQ(tNet)}</Td></Tr>
            </Tbody>
          </Table>
        </Box>
      );
    }

    // ── Recibo e IGSS ─────────────────────────────────────────
    if (reportType === 'igss') {
      return (
        <Box border="1px solid" borderColor={borderColor} borderRadius="md" overflowX="auto">
          <Table size="sm" variant="simple"><Thead bg={theadBg}><Tr><Th>No.</Th><Th>Nombre</Th><Th>No. Cuenta</Th><Th>Puesto</Th><Th isNumeric>Días</Th><Th isNumeric>S. Ordinario</Th><Th isNumeric>Bonos</Th><Th isNumeric>Total Dev.</Th><Th isNumeric>IGSS</Th><Th isNumeric>ISR</Th><Th isNumeric>Total Egr.</Th><Th isNumeric>Líquido</Th><Th>No. IGSS</Th></Tr></Thead>
            <Tbody bg={tdBg}>
              {data.map((e, i) => { const net = e.calculated.net; const bonos = e.calculated.bonusLey + e.calculated.bonusDec + e.calculated.bonos; return (<Tr key={i}><Td fontSize="xs">{i+1}</Td><Td fontSize="xs" fontWeight="semibold">{getEmpName(e)}</Td><Td fontSize="xs">{e.no_cuenta || 'N/A'}</Td><Td fontSize="xs">{e.puesto || 'N/A'}</Td><Td isNumeric fontSize="xs">{e.days || 30}</Td><Td isNumeric fontFamily="mono" fontSize="xs">{fmtQ(e.calculated.baseSalary)}</Td><Td isNumeric fontFamily="mono" fontSize="xs">{fmtQ(bonos)}</Td><Td isNumeric fontFamily="mono" fontSize="xs" fontWeight="bold">{fmtQ(e.calculated.gross)}</Td><Td isNumeric fontFamily="mono" fontSize="xs" color="orange.500">{fmtQ(e.deductions?.igss || 0)}</Td><Td isNumeric fontFamily="mono" fontSize="xs" color="red.500">{fmtQ(e.deductions?.isr || 0)}</Td><Td isNumeric fontFamily="mono" fontSize="xs" color="red.500">{fmtQ(e.calculated.ded)}</Td><Td isNumeric fontFamily="mono" fontSize="xs" fontWeight="bold" color="green.600">{fmtQ(net)}</Td><Td fontSize="xs">{e.no_igss || 'N/A'}</Td></Tr>); })}
            </Tbody>
          </Table>
        </Box>
      );
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
                transfers.forEach((e, ei) => { tP += e.calculated.net; rows.push(<Tr key={`tr-${ci}-${ei}`} bg={tdBg}><Td fontSize="xs">{e.numero_cuenta || e.no_cuenta || 'N/A'}</Td><Td fontSize="xs" fontWeight="semibold">{cleanName(getEmpName(e))}</Td><Td isNumeric fontFamily="mono" fontSize="xs">{fmtQ(e.calculated.net)}</Td><Td fontSize="xs" color="gray.400" isTruncated>{concepto}</Td></Tr>); });
                rows.push(<Tr key={`tP-${ci}`} bg={subtotalRowBg}><Td fontSize="xs"></Td><Td fontSize="xs" fontWeight="bold" textAlign="right">Total Plantilla {compName.toUpperCase()}</Td><Td isNumeric fontFamily="mono" fontSize="xs" fontWeight="bold">{fmtQ(tP)}</Td><Td /></Tr>);
                if (cheques.length) { cheques.forEach((e, ei) => { tC += e.calculated.net; rows.push(<Tr key={`ck-${ci}-${ei}`} bg={tdBg}><Td fontSize="xs" color="orange.500">CHEQUE</Td><Td fontSize="xs" fontWeight="semibold">{cleanName(getEmpName(e))}</Td><Td isNumeric fontFamily="mono" fontSize="xs">{fmtQ(e.calculated.net)}</Td><Td fontSize="xs" color="gray.400" isTruncated>{concepto}</Td></Tr>); }); rows.push(<Tr key={`tC-${ci}`} bg={subtotalRowBg}><Td fontSize="xs"></Td><Td fontSize="xs" fontWeight="bold" textAlign="right">Total Cheques</Td><Td isNumeric fontFamily="mono" fontSize="xs" fontWeight="bold">{fmtQ(tC)}</Td><Td /></Tr>); }
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
                transfers.forEach((e, ei) => { tP += e.calculated.net; rows.push(<Tr key={`tr-${ci}-${ei}`} bg={tdBg}><Td fontSize="xs">{e.tipo_cuenta?.toLowerCase() === 'ahorro' ? 2 : 1}</Td><Td fontSize="xs">{e.numero_cuenta || e.no_cuenta || 'N/A'}</Td><Td fontSize="xs">{corr++}</Td><Td fontSize="xs" fontWeight="semibold">{cleanName(getEmpName(e))}</Td><Td isNumeric fontFamily="mono" fontSize="xs">{fmtQ(e.calculated.net)}</Td><Td fontSize="xs" color="gray.400" isTruncated>{concepto}</Td></Tr>); });
                rows.push(<Tr key={`tP-${ci}`} bg={subtotalRowBg}><Td colSpan={3}></Td><Td fontSize="xs" fontWeight="bold" textAlign="right">TOTAL PLANTILLA</Td><Td isNumeric fontFamily="mono" fontSize="xs" fontWeight="bold">{fmtQ(tP)}</Td><Td /></Tr>);
                if (cheques.length) { cheques.forEach((e, ei) => { tC += e.calculated.net; rows.push(<Tr key={`ck-${ci}-${ei}`} bg={tdBg}><Td fontSize="xs">1</Td><Td fontSize="xs" color="orange.500">CHEQUE</Td><Td fontSize="xs">{corr++}</Td><Td fontSize="xs" fontWeight="semibold">{cleanName(getEmpName(e))}</Td><Td isNumeric fontFamily="mono" fontSize="xs">{fmtQ(e.calculated.net)}</Td><Td fontSize="xs" color="gray.400" isTruncated>{concepto}</Td></Tr>); }); rows.push(<Tr key={`tC-${ci}`} bg={subtotalRowBg}><Td colSpan={3}></Td><Td fontSize="xs" fontWeight="bold" textAlign="right">TOTAL CHEQUES</Td><Td isNumeric fontFamily="mono" fontSize="xs" fontWeight="bold">{fmtQ(tC)}</Td><Td /></Tr>); }
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
        </ModalHeader>
        <ModalCloseButton mt={2} />

        <ModalBody py={6} bg={previewBg}>
          <Box bg={tdBg} p={8} boxShadow="lg" borderRadius="sm" minH="600px" mx="auto" maxW="1100px">
            {/* Document header */}
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
