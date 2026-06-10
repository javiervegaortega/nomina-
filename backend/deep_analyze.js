const fs = require('fs');

const filePath = 'C:\\Users\\jyaxo\\Desktop\\nomina-v2\\nomina-\\Reporte_Completo_2026-06-10_09-10.xls';
const data = fs.readFileSync(filePath, 'utf-8');

// Extract headers
const thRegex = /<th>(.*?)<\/th>/g;
let match;
const headers = [];
while ((match = thRegex.exec(data)) !== null) {
  headers.push(match[1]);
}

console.log('=== HEADERS (' + headers.length + ' columns) ===');
headers.forEach((h, i) => console.log(`  [${i}]: ${h}`));

// Extract first 3 rows for sample data
const trRegex = /<tr>(.*?)<\/tr>/gs;
const tdRegex = /<td>(.*?)<\/td>/gs;
let trMatch;
let rowIndex = 0;

console.log('\n=== SAMPLE DATA (first 3 rows) ===');
while ((trMatch = trRegex.exec(data)) !== null && rowIndex < 4) {
  const tds = [];
  let tdMatch;
  while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
    tds.push(tdMatch[1].trim());
  }
  if (tds.length >= 5 && tds[0] !== 'ID') {
    console.log(`\n--- Row ${rowIndex + 1} (ID: ${tds[0]}) ---`);
    tds.forEach((val, i) => {
      const header = headers[i] || `Col ${i}`;
      console.log(`  [${i}] ${header}: ${val.substring(0, 120)}`);
    });
    rowIndex++;
  }
}

// Count total rows
let totalRows = 0;
const trRegex2 = /<tr>(.*?)<\/tr>/gs;
while (trRegex2.exec(data) !== null) totalRows++;
console.log(`\n=== TOTAL ROWS: ${totalRows - 1} (excluding header) ===`);
