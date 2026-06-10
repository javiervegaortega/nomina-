const fs = require('fs');
const data = fs.readFileSync('C:\\Users\\jyaxo\\Desktop\\nomina-v2\\nomina-\\Reporte_Completo_2026-06-10_09-10.xls', 'utf-8');
const thRegex = /<th>(.*?)<\/th>/g;
let match;
const headers = [];
while ((match = thRegex.exec(data)) !== null) {
  headers.push(match[1]);
}
console.log('Total columns:', headers.length);
headers.forEach((h, i) => console.log(`[${i}]: ${h}`));
