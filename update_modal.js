const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/ReportPreviewModal.jsx', 'utf8');

// 1. Add imports
code = code.replace(
  /import \{ Download, FileText, Printer \} from 'lucide-react';/,
  "import { Download, FileText, Printer, Settings, LayoutGrid, ChevronDown } from 'lucide-react';"
);
code = code.replace(
  /import \{(.*?)\} from '@chakra-ui\/react';/,
  "import {$1, Menu, MenuButton, MenuList, MenuItemOption, MenuOptionGroup, Tooltip, Switch, FormControl, FormLabel} from '@chakra-ui/react';"
);

// 2. Add state
const stateInjection = `
  const [groupByArea, setGroupByArea] = useState(false);
  const [colsNomina, setColsNomina] = useState(() => {
    const saved = localStorage.getItem('nomina_cols');
    if (saved) return JSON.parse(saved);
    return ['no','nombre','empresa','puesto','dias','ordinario','bon_decreto','total_dev','total_egr','liquido'];
  });
  const [colsIgss, setColsIgss] = useState(() => {
    const saved = localStorage.getItem('igss_cols');
    if (saved) return JSON.parse(saved);
    return ['no','nombre','cuenta','puesto','dias','ordinario','bonos','total_dev','igss','isr','total_egr','liquido','quinc1','quinc2','no_igss'];
  });

  useEffect(() => { localStorage.setItem('nomina_cols', JSON.stringify(colsNomina)); }, [colsNomina]);
  useEffect(() => { localStorage.setItem('igss_cols', JSON.stringify(colsIgss)); }, [colsIgss]);

  const NOMINA_DEF = [
    { id: 'no', label: 'No.', align: 'left' },
    { id: 'nombre', label: 'Nombre', align: 'left' },
    { id: 'empresa', label: 'Empresa', align: 'left' },
    { id: 'puesto', label: 'Puesto', align: 'left' },
    { id: 'dias', label: 'Días', align: 'left' },
    { id: 'ordinario', label: 'S. Ordinario', align: 'right' },
    { id: 'bon_decreto', label: 'Bono Decreto', align: 'right' },
    { id: 'total_dev', label: 'Total Dev.', align: 'right' },
    { id: 'total_egr', label: 'Total Egr.', align: 'right' },
    { id: 'liquido', label: 'Líquido', align: 'right' }
  ];

  const IGSS_DEF = [
    { id: 'no', label: 'No.', align: 'left' },
    { id: 'nombre', label: 'Nombre', align: 'left' },
    { id: 'cuenta', label: 'No. Cuenta', align: 'left' },
    { id: 'puesto', label: 'Puesto', align: 'left' },
    { id: 'dias', label: 'Días', align: 'left' },
    { id: 'ordinario', label: 'S. Ordinario', align: 'right' },
    { id: 'bonos', label: 'Bonos', align: 'right' },
    { id: 'total_dev', label: 'Total Dev.', align: 'right' },
    { id: 'igss', label: 'IGSS', align: 'right' },
    { id: 'isr', label: 'ISR', align: 'right' },
    { id: 'total_egr', label: 'Total Egr.', align: 'right' },
    { id: 'liquido', label: 'Líquido', align: 'right' },
    { id: 'quinc1', label: '1ra Quinc.', align: 'right' },
    { id: 'quinc2', label: '2da Quinc.', align: 'right' },
    { id: 'no_igss', label: 'No. IGSS', align: 'left' }
  ];

  const renderConfigControls = () => {
    if (reportType !== 'nomina' && reportType !== 'igss') return null;
    const isNomina = reportType === 'nomina';
    const defs = isNomina ? NOMINA_DEF : IGSS_DEF;
    const vals = isNomina ? colsNomina : colsIgss;
    const setVals = isNomina ? setColsNomina : setColsIgss;

    return (
      <Flex gap={4} align="center">
        <Menu closeOnSelect={false}>
          <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} leftIcon={<Settings size={14}/>}>
            Columnas
          </MenuButton>
          <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="xl">
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
`;

code = code.replace('const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);', 'const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);\n' + stateInjection);

// 3. Helper to build PDF tables grouped by area or flat
const pdfLogicInjection = `
  const processPdfTable = (doc, reportType, headRow, dataMapFn, colStyles) => {
    let currentY = 100;
    if (groupByArea) {
      const grouped = {};
      data.forEach(e => {
        const area = (companies?.flatMap(c => c.areas)?.find(a => a.id == e.area)?.nombre) || 'Sin Área';
        if (!grouped[area]) grouped[area] = [];
        grouped[area].push(e);
      });
      Object.keys(grouped).forEach(area => {
        if (currentY > 500) { doc.addPage(); currentY = 100; }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(41, 128, 185);
        doc.text(\`Área: \${area}\`, 36, currentY);
        currentY += 10;
        
        const body = grouped[area].map(dataMapFn);
        autoTable(doc, { 
          startY: currentY, 
          head: [headRow], 
          body, 
          theme: 'grid', 
          headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' }, 
          styles: { fontSize: 7, cellPadding: 3 },
          columnStyles: colStyles
        });
        currentY = doc.lastAutoTable.finalY + 25;
      });
    } else {
      const body = data.map(dataMapFn);
      autoTable(doc, { 
        startY: currentY, 
        head: [headRow], 
        body, 
        theme: 'grid', 
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' }, 
        styles: { fontSize: 7, cellPadding: 3 },
        columnStyles: colStyles
      });
    }
  };
`;

code = code.replace('const handleDownloadPDF = () => {', 'const handleDownloadPDF = () => {\n' + pdfLogicInjection);

// 4. Update Nómina PDF
// Find the exact block for Nomina General in the PDF generation
// The comment in the file is: // ── Nómina General ───────────────────────────────────────
const pdfNominaLogic = `
    // ── Nómina General ───────────────────────────────────────
    else if (reportType === 'nomina') {
      const doc = new jsPDF('landscape', 'pt', 'letter');
      addHeader(doc, 'Nómina General');
      
      const cols = NOMINA_DEF.filter(c => colsNomina.includes(c.id));
      const headRow = cols.map(c => c.label);
      const colStyles = {};
      cols.forEach((c, idx) => { if (c.align === 'right') colStyles[idx] = { halign: 'right' }; });

      const dataMapFn = (e, i) => {
        const row = [];
        cols.forEach(c => {
          if (c.id === 'no') row.push(i + 1);
          if (c.id === 'nombre') row.push(getEmpName(e));
          if (c.id === 'empresa') row.push(e.company || 'N/A');
          if (c.id === 'puesto') row.push(e.puesto || 'N/A');
          if (c.id === 'dias') row.push(e.days || 30);
          if (c.id === 'ordinario') row.push(fmtQ(e.calculated.baseSalary));
          if (c.id === 'bon_decreto') row.push(fmtQ(e.calculated.bonusLey + e.calculated.bonusDec));
          if (c.id === 'total_dev') row.push(fmtQ(e.calculated.gross));
          if (c.id === 'total_egr') row.push(fmtQ(e.calculated.ded));
          if (c.id === 'liquido') row.push({ content: fmtQ(e.calculated.net), styles: { fontStyle: 'bold', textColor: [0, 120, 0] } });
        });
        return row;
      };

      processPdfTable(doc, 'nomina', headRow, dataMapFn, colStyles);
      doc.save(\`Nomina_General_\${safe}.pdf\`);
    }
`;
// Target the exact block using string split/replace so we only affect the first match (which is inside handleDownloadPDF)
const parts = code.split('// ── Nómina General ───────────────────────────────────────');
if (parts.length > 2) {
  const rest = parts[1].split('// ── Recibo e IGSS ────────────────────────────────────────');
  parts[1] = '\n' + pdfNominaLogic + '\n    // ── Recibo e IGSS ────────────────────────────────────────' + rest[1];
  code = parts[0] + parts[1] + '// ── Nómina General ───────────────────────────────────────' + parts[2];
}


// 5. Update IGSS PDF
const pdfIgssLogic = `
    else if (reportType === 'igss') {
      const doc = new jsPDF('landscape', 'pt', 'letter');
      addHeader(doc, 'Recibo e IGSS');
      
      const cols = IGSS_DEF.filter(c => colsIgss.includes(c.id));
      const headRow = cols.map(c => c.label);
      const colStyles = {};
      cols.forEach((c, idx) => { if (c.align === 'right') colStyles[idx] = { halign: 'right' }; });

      const dataMapFn = (e, i) => {
        const net = e.calculated.net;
        const q1 = group.periodType === '2da' ? (e.anticipo1ra || 0) : net;
        const q2 = group.periodType === '2da' ? net - (e.anticipo1ra || 0) : 0;
        
        const row = [];
        cols.forEach(c => {
          if (c.id === 'no') row.push(i + 1);
          if (c.id === 'nombre') row.push(getEmpName(e));
          if (c.id === 'cuenta') row.push(e.no_cuenta || '');
          if (c.id === 'puesto') row.push(e.puesto || 'N/A');
          if (c.id === 'dias') row.push(e.days || 30);
          if (c.id === 'ordinario') row.push(fmtQ(e.calculated.baseSalary));
          if (c.id === 'bonos') row.push(fmtQ(e.calculated.bonusLey + e.calculated.bonusDec + e.calculated.bonos));
          if (c.id === 'total_dev') row.push(fmtQ(e.calculated.gross));
          if (c.id === 'igss') row.push(fmtQ(e.deductions?.igss || 0));
          if (c.id === 'isr') row.push(fmtQ(e.deductions?.isr || 0));
          if (c.id === 'total_egr') row.push(fmtQ(e.calculated.ded));
          if (c.id === 'liquido') row.push({ content: fmtQ(net), styles: { fontStyle: 'bold', textColor: [0, 120, 0] } });
          if (c.id === 'quinc1') row.push(fmtQ(q1));
          if (c.id === 'quinc2') row.push(fmtQ(q2));
          if (c.id === 'no_igss') row.push(e.no_igss || '');
        });
        return row;
      };

      processPdfTable(doc, 'igss', headRow, dataMapFn, colStyles);
      doc.save(\`Recibo_IGSS_\${safe}.pdf\`);
    }
`;
const partsIgss = code.split('// ── Recibo e IGSS ────────────────────────────────────────');
if (partsIgss.length > 2) {
  const rest = partsIgss[1].split('// ── Libro de Salarios ────────────────────────────────────');
  partsIgss[1] = '\n' + pdfIgssLogic + '\n    // ── Libro de Salarios ────────────────────────────────────' + rest[1];
  code = partsIgss[0] + partsIgss[1] + '// ── Recibo e IGSS ────────────────────────────────────────' + partsIgss[2];
}

// 6. Update HTML Previews to respect columns and grouping
const htmlPreviewLogic = `
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
        const area = (companies?.flatMap(c => c.areas)?.find(a => a.id == e.area)?.nombre) || 'Sin Área';
        if (!grouped[area]) grouped[area] = [];
        grouped[area].push(e);
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

`;

code = code.replace('const renderPreview = () => {', 'const renderPreview = () => {\n' + htmlPreviewLogic);

// 7. Update Nomina HTML render
const nominaHtmlLogic = `
    if (reportType === 'nomina') {
      return renderGroupedTable(NOMINA_DEF, colsNomina, (e, i, c) => {
        let val = '';
        let isMoney = false;
        if (c.id === 'no') val = i + 1;
        if (c.id === 'nombre') val = getEmpName(e);
        if (c.id === 'empresa') val = e.company || 'N/A';
        if (c.id === 'puesto') val = e.puesto || 'N/A';
        if (c.id === 'dias') val = e.days || 30;
        if (c.id === 'ordinario') { val = e.calculated.baseSalary; isMoney = true; }
        if (c.id === 'bon_decreto') { val = e.calculated.bonusLey + e.calculated.bonusDec; isMoney = true; }
        if (c.id === 'total_dev') { val = e.calculated.gross; isMoney = true; }
        if (c.id === 'total_egr') { val = e.calculated.ded; isMoney = true; }
        if (c.id === 'liquido') { val = e.calculated.net; isMoney = true; }
        
        return <Td key={c.id} fontSize="xs" isNumeric={c.align === 'right'} fontWeight={c.id === 'liquido' ? 'bold' : 'normal'} color={c.id === 'liquido' ? 'green.600' : 'inherit'}>
          {isMoney ? fmtQ(val) : val}
        </Td>;
      });
    }
`;

// Target the second occurrence of `if (reportType === 'nomina')` which is inside renderPreview
const partsHtml = code.split('// ── Nómina General ───────────────────────────────────────');
if (partsHtml.length > 2) {
  const rest = partsHtml[2].split('// ── Recibo e IGSS ────────────────────────────────────────');
  partsHtml[2] = '\n' + nominaHtmlLogic + '\n    // ── Recibo e IGSS ────────────────────────────────────────' + rest[1];
  code = partsHtml[0] + '// ── Nómina General ───────────────────────────────────────' + partsHtml[1] + '// ── Nómina General ───────────────────────────────────────' + partsHtml[2];
}

// 8. Update IGSS HTML render
const igssHtmlLogic = `
    if (reportType === 'igss') {
      return renderGroupedTable(IGSS_DEF, colsIgss, (e, i, c) => {
        const net = e.calculated.net;
        const q1 = group.periodType === '2da' ? (e.anticipo1ra || 0) : net;
        const q2 = group.periodType === '2da' ? net - (e.anticipo1ra || 0) : 0;
        
        let val = '';
        let isMoney = false;
        if (c.id === 'no') val = i + 1;
        if (c.id === 'nombre') val = getEmpName(e);
        if (c.id === 'cuenta') val = e.no_cuenta || '';
        if (c.id === 'puesto') val = e.puesto || 'N/A';
        if (c.id === 'dias') val = e.days || 30;
        if (c.id === 'ordinario') { val = e.calculated.baseSalary; isMoney = true; }
        if (c.id === 'bonos') { val = e.calculated.bonusLey + e.calculated.bonusDec + e.calculated.bonos; isMoney = true; }
        if (c.id === 'total_dev') { val = e.calculated.gross; isMoney = true; }
        if (c.id === 'igss') { val = e.deductions?.igss || 0; isMoney = true; }
        if (c.id === 'isr') { val = e.deductions?.isr || 0; isMoney = true; }
        if (c.id === 'total_egr') { val = e.calculated.ded; isMoney = true; }
        if (c.id === 'liquido') { val = net; isMoney = true; }
        if (c.id === 'quinc1') { val = q1; isMoney = true; }
        if (c.id === 'quinc2') { val = q2; isMoney = true; }
        if (c.id === 'no_igss') val = e.no_igss || '';
        
        return <Td key={c.id} fontSize="xs" isNumeric={c.align === 'right'} fontWeight={c.id === 'liquido' ? 'bold' : 'normal'} color={c.id === 'liquido' ? 'green.600' : 'inherit'}>
          {isMoney ? fmtQ(val) : val}
        </Td>;
      });
    }
`;

const partsHtmlIgss = code.split('// ── Recibo e IGSS ────────────────────────────────────────');
if (partsHtmlIgss.length > 2) {
  const rest = partsHtmlIgss[2].split('// ── Libro de Salarios ────────────────────────────────────');
  partsHtmlIgss[2] = '\n' + igssHtmlLogic + '\n    // ── Libro de Salarios ────────────────────────────────────' + rest[1];
  code = partsHtmlIgss[0] + '// ── Recibo e IGSS ────────────────────────────────────────' + partsHtmlIgss[1] + '// ── Recibo e IGSS ────────────────────────────────────────' + partsHtmlIgss[2];
}

// 9. Add config controls to ModalHeader
code = code.replace(
  /<ModalHeader>([^<]*)<\/ModalHeader>/,
  "<ModalHeader><Flex justify=\"space-between\" align=\"center\" mr={8}><Text>$1</Text>{renderConfigControls()}</Flex></ModalHeader>"
);

fs.writeFileSync('frontend/src/components/ReportPreviewModal.jsx', code);
