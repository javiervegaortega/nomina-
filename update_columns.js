const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/ReportPreviewModal.jsx', 'utf8');

// 1. Unified Columns Definition
const ALL_COLUMNS_DEF = `
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
    { id: 'hrs_dobles', label: 'Hrs Dobles', align: 'right' },
    { id: 'val_hrs_dobles', label: 'Val Hrs Dobl', align: 'right' },
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
`;

// Replace the two old consts with the new one
code = code.replace(/const NOMINA_DEF = \[[\s\S]*?\];\n\n  const IGSS_DEF = \[[\s\S]*?\];/, ALL_COLUMNS_DEF.trim());

// 2. Change the default columns for Nomina to match the new IDs if they changed, and use ALL_COLUMNS_DEF
// The old logic:
// const defs = isNomina ? NOMINA_DEF : IGSS_DEF;
code = code.replace(/const defs = isNomina \? NOMINA_DEF : IGSS_DEF;/, 'const defs = ALL_COLUMNS_DEF;');
code = code.replace(/const cols = NOMINA_DEF.filter\(c => colsNomina.includes\(c.id\)\);/g, 'const cols = ALL_COLUMNS_DEF.filter(c => colsNomina.includes(c.id));');
code = code.replace(/const cols = IGSS_DEF.filter\(c => colsIgss.includes\(c.id\)\);/g, 'const cols = ALL_COLUMNS_DEF.filter(c => colsIgss.includes(c.id));');
code = code.replace(/return renderGroupedTable\(NOMINA_DEF, colsNomina,/g, 'return renderGroupedTable(ALL_COLUMNS_DEF, colsNomina,');
code = code.replace(/return renderGroupedTable\(IGSS_DEF, colsIgss,/g, 'return renderGroupedTable(ALL_COLUMNS_DEF, colsIgss,');


// 3. Centralize the data mapper since it's the exact same switch/if logic for both PDF and HTML, Nomina and IGSS!
// We can inject a universal getColValue(e, i, c.id) helper right inside the component body, and use it everywhere.
const getColValueLogic = \`
  const getColValue = (e, i, colId, format = false) => {
    let val = '';
    let isMoney = false;
    const net = e.calculated?.net || 0;
    
    switch(colId) {
      case 'no': val = i + 1; break;
      case 'nombre': val = getEmpName(e); break;
      case 'empresa': val = e.company || 'N/A'; break;
      case 'puesto': val = e.puesto || 'N/A'; break;
      case 'cuenta': val = e.no_cuenta || ''; break;
      case 'dias': val = e.days || 30; break;
      case 'ordinario': val = e.calculated?.baseSalary || 0; isMoney = true; break;
      case 'bon_incentivo': val = e.calculated?.bonusLey || 0; isMoney = true; break;
      case 'bon_decreto': val = e.calculated?.bonusDec || 0; isMoney = true; break;
      case 'bonos': val = e.calculated?.bonos || 0; isMoney = true; break;
      case 'total_dev': val = e.calculated?.gross || 0; isMoney = true; break;
      case 'hrs_simples': val = e.hours?.simple || 0; break;
      case 'val_hrs_simples': val = e.calculated?.simpleExtras || 0; isMoney = true; break;
      case 'hrs_dobles': val = e.hours?.double || 0; break;
      case 'val_hrs_dobles': val = e.calculated?.doubleExtras || 0; isMoney = true; break;
      case 'otros_ingresos': val = e.calculated?.otrosIngresos || 0; isMoney = true; break;
      case 'salario_total': val = (e.calculated?.gross || 0) + (e.calculated?.simpleExtras || 0) + (e.calculated?.doubleExtras || 0) + (e.calculated?.otrosIngresos || 0); isMoney = true; break;
      case 'igss': val = e.deductions?.igss || 0; isMoney = true; break;
      case 'isr': val = e.deductions?.isr || 0; isMoney = true; break;
      case 'cafeteria': val = e.deductions?.cafeteria || 0; isMoney = true; break;
      case 'celular': val = e.deductions?.celular || 0; isMoney = true; break;
      case 'uniforme': val = e.deductions?.uniforme || 0; isMoney = true; break;
      case 'calzado': val = e.deductions?.calzado || 0; isMoney = true; break;
      case 'equipo': val = e.deductions?.equipo || 0; isMoney = true; break;
      case 'producto': val = e.deductions?.producto || 0; isMoney = true; break;
      case 'bancos': val = e.deductions?.bancos || 0; isMoney = true; break;
      case 'otros': val = e.deductions?.otros || 0; isMoney = true; break;
      case 'judiciales': val = e.deductions?.judiciales || 0; isMoney = true; break;
      case 'seguro': val = e.deductions?.seguro || 0; isMoney = true; break;
      case 'parqueo': val = e.deductions?.parqueo || 0; isMoney = true; break;
      case 'ornato': val = e.deductions?.ornato || 0; isMoney = true; break;
      case 'otros_egr': val = e.deductions?.otros_egresos || 0; isMoney = true; break;
      case 'total_egr': val = e.calculated?.ded || 0; isMoney = true; break;
      case 'liquido': val = net; isMoney = true; break;
      case 'quinc1': val = group?.periodType === '2da' ? (e.anticipo1ra || 0) : net; isMoney = true; break;
      case 'quinc2': val = group?.periodType === '2da' ? net - (e.anticipo1ra || 0) : 0; isMoney = true; break;
      case 'no_igss': val = e.no_igss || ''; break;
    }
    
    return format && isMoney ? fmtQ(val) : val;
  };
\`;
// Inject getting value helper right before handlePrint
code = code.replace(/const handlePrint = \(\) => {/, getColValueLogic + '\n  const handlePrint = () => {');

// 4. Update the mapFn for HTML Nomina
const htmlNominaOld = /return renderGroupedTable\(ALL_COLUMNS_DEF, colsNomina, \(e, i, c\) => \{[\s\S]*?return <Td[^>]*>[\s\S]*?<\/Td>;\s*\}\);/;
const htmlNominaNew = \`return renderGroupedTable(ALL_COLUMNS_DEF, colsNomina, (e, i, c) => {
        const val = getColValue(e, i, c.id, true);
        return <Td key={c.id} fontSize="xs" isNumeric={c.align === 'right'} fontWeight={c.id === 'liquido' ? 'bold' : 'normal'} color={c.id === 'liquido' ? 'green.600' : 'inherit'}>
          {val}
        </Td>;
      });\`;
code = code.replace(htmlNominaOld, htmlNominaNew);

// 5. Update the mapFn for HTML IGSS
const htmlIgssOld = /return renderGroupedTable\(ALL_COLUMNS_DEF, colsIgss, \(e, i, c\) => \{[\s\S]*?return <Td[^>]*>[\s\S]*?<\/Td>;\s*\}\);/;
const htmlIgssNew = \`return renderGroupedTable(ALL_COLUMNS_DEF, colsIgss, (e, i, c) => {
        const val = getColValue(e, i, c.id, true);
        return <Td key={c.id} fontSize="xs" isNumeric={c.align === 'right'} fontWeight={c.id === 'liquido' ? 'bold' : 'normal'} color={c.id === 'liquido' ? 'green.600' : 'inherit'}>
          {val}
        </Td>;
      });\`;
code = code.replace(htmlIgssOld, htmlIgssNew);

// 6. Update the mapFn for PDF Nomina
const pdfNominaOld = /const dataMapFn = \(e, i\) => \{[\s\S]*?return row;\s*\};\s*processPdfTable\(doc, 'nomina'/;
const pdfNominaNew = \`const dataMapFn = (e, i) => {
        return cols.map(c => {
          const val = getColValue(e, i, c.id, true);
          if (c.id === 'liquido') return { content: val, styles: { fontStyle: 'bold', textColor: [0, 120, 0] } };
          return val;
        });
      };
      processPdfTable(doc, 'nomina'\`;
code = code.replace(pdfNominaOld, pdfNominaNew);

// 7. Update the mapFn for PDF IGSS
const pdfIgssOld = /const dataMapFn = \(e, i\) => \{[\s\S]*?return row;\s*\};\s*processPdfTable\(doc, 'igss'/;
const pdfIgssNew = \`const dataMapFn = (e, i) => {
        return cols.map(c => {
          const val = getColValue(e, i, c.id, true);
          if (c.id === 'liquido') return { content: val, styles: { fontStyle: 'bold', textColor: [0, 120, 0] } };
          return val;
        });
      };
      processPdfTable(doc, 'igss'\`;
code = code.replace(pdfIgssOld, pdfIgssNew);


fs.writeFileSync('frontend/src/components/ReportPreviewModal.jsx', code);
