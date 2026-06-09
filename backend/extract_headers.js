const fs = require('fs');

const data = fs.readFileSync('C:\\Users\\jyaxo\\Desktop\\nomina-v2\\nomina-\\Reporte_Completo_2026-06-09_15-16.xls', 'utf-8');

const thRegex = /<th>(.*?)<\/th>/g;
let match;
const headers = [];
while ((match = thRegex.exec(data)) !== null) {
  headers.push(match[1]);
}

console.log('Headers:');
headers.forEach((h, i) => console.log(`${i}: ${h}`));
