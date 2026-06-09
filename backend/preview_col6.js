const fs = require('fs');
const data = fs.readFileSync('C:\\Users\\jyaxo\\Desktop\\nomina-v2\\nomina-\\Reporte_Completo_2026-06-09_15-48.xls', 'utf-8');
const trRegex = /<tr>(.*?)<\/tr>/gs;
const tdRegex = /<td>(.*?)<\/td>/gs;
let trMatch;
let i = 0;
while ((trMatch = trRegex.exec(data)) !== null && i < 5) {
  const tds = [];
  let tdMatch;
  while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
    tds.push(tdMatch[1].trim());
  }
  if (tds.length >= 15 && tds[0] !== 'ID') {
    console.log(`Empresa: ${tds[5]}, Dist: ${tds[6]}`);
    i++;
  }
}
