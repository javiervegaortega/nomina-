const XLSX = require('xlsx');
const fs = require('fs');

const workbook = XLSX.readFile('C:/Users/jyaxo/Desktop/nomina-v2/nomina-/BONOS  ABRIL 2026.xlsx');
let result = {};

workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // read as array of arrays
  // Get first 15 rows to see structure
  result[sheetName] = json.slice(0, 15);
});

fs.writeFileSync('excel_data.json', JSON.stringify(result, null, 2));
