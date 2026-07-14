const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/ReportPreviewModal.jsx', 'utf8');

const getColValueLogic = `
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
`;

code = code.replace(/const handlePrint = \(\) => {/, getColValueLogic + '\n  const handlePrint = () => {');

// 4. Update the mapFn for HTML Nomina
const htmlNominaOld = /return renderGroupedTable\(ALL_COLUMNS_DEF, colsNomina, \(e, i, c\) => \{[\s\S]*?return <Td[^>]*>[\s\S]*?<\/Td>;\s*\}\);/;
const htmlNominaNew = `return renderGroupedTable(ALL_COLUMNS_DEF, colsNomina, (e, i, c) => {
        const val = getColValue(e, i, c.id, true);
        return <Td key={c.id} fontSize="xs" isNumeric={c.align === 'right'} fontWeight={c.id === 'liquido' ? 'bold' : 'normal'} color={c.id === 'liquido' ? 'green.600' : 'inherit'}>
          {val}
        </Td>;
      });`;
code = code.replace(htmlNominaOld, htmlNominaNew);

// 5. Update the mapFn for HTML IGSS
const htmlIgssOld = /return renderGroupedTable\(ALL_COLUMNS_DEF, colsIgss, \(e, i, c\) => \{[\s\S]*?return <Td[^>]*>[\s\S]*?<\/Td>;\s*\}\);/;
const htmlIgssNew = `return renderGroupedTable(ALL_COLUMNS_DEF, colsIgss, (e, i, c) => {
        const val = getColValue(e, i, c.id, true);
        return <Td key={c.id} fontSize="xs" isNumeric={c.align === 'right'} fontWeight={c.id === 'liquido' ? 'bold' : 'normal'} color={c.id === 'liquido' ? 'green.600' : 'inherit'}>
          {val}
        </Td>;
      });`;
code = code.replace(htmlIgssOld, htmlIgssNew);

// 6. Update the mapFn for PDF Nomina
const pdfNominaOld = /const dataMapFn = \(e, i\) => \{[\s\S]*?return row;\s*\};\s*processPdfTable\(doc, 'nomina'/;
const pdfNominaNew = `const dataMapFn = (e, i) => {
        return cols.map(c => {
          const val = getColValue(e, i, c.id, true);
          if (c.id === 'liquido') return { content: val, styles: { fontStyle: 'bold', textColor: [0, 120, 0] } };
          return val;
        });
      };
      processPdfTable(doc, 'nomina'`;
code = code.replace(pdfNominaOld, pdfNominaNew);

// 7. Update the mapFn for PDF IGSS
const pdfIgssOld = /const dataMapFn = \(e, i\) => \{[\s\S]*?return row;\s*\};\s*processPdfTable\(doc, 'igss'/;
const pdfIgssNew = `const dataMapFn = (e, i) => {
        return cols.map(c => {
          const val = getColValue(e, i, c.id, true);
          if (c.id === 'liquido') return { content: val, styles: { fontStyle: 'bold', textColor: [0, 120, 0] } };
          return val;
        });
      };
      processPdfTable(doc, 'igss'`;
code = code.replace(pdfIgssOld, pdfIgssNew);

fs.writeFileSync('frontend/src/components/ReportPreviewModal.jsx', code);
