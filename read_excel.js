const XLSX = require('xlsx');

try {
  const workbook = XLSX.readFile('NOMINA 30.01.xlsx');
  
  for (const sheetName of workbook.SheetNames) {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const worksheet = workbook.Sheets[sheetName];
    // Convert to JSON to see the keys (columns) of the first few rows
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Print first 5 rows to understand the structure
    for (let i = 0; i < Math.min(5, data.length); i++) {
      console.log(`Row ${i + 1}:`, data[i]);
    }
  }
} catch (error) {
  console.error("Error reading excel:", error);
}
