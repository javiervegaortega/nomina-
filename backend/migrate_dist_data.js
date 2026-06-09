const fs = require('fs');
const { Employee, Company } = require('./src/models');
const { Sequelize } = require('sequelize');

const sequelize = require('./src/models').sequelize;

async function run() {
  try {
    const companies = await Company.findAll();
    const companyMap = {};
    companies.forEach(c => {
      companyMap[c.nombre_comercial.trim().toUpperCase()] = c.id;
      companyMap[c.razon_social.trim().toUpperCase()] = c.id;
      // Some mappings just in case of weird whitespace
      companyMap[c.nombre_comercial.replace(/\s+/g, '').toUpperCase()] = c.id;
    });

    const data = fs.readFileSync('C:\\Users\\jyaxo\\Desktop\\nomina-v2\\nomina-\\Reporte_Completo_2026-06-09_15-48.xls', 'utf-8');
    const trRegex = /<tr>(.*?)<\/tr>/gs;
    const tdRegex = /<td>(.*?)<\/td>/gs;
    
    let trMatch;
    let updateCount = 0;
    
    while ((trMatch = trRegex.exec(data)) !== null) {
      const tds = [];
      let tdMatch;
      while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
        tds.push(tdMatch[1].trim());
      }
      
      if (tds.length < 15 || tds[0] === 'ID') continue;
      
      const empIdStr = tds[0];
      const distStr = tds[6];
      
      const empId = parseInt(empIdStr, 10);
      if (isNaN(empId) || !distStr) continue;

      // Parse dist string: CLEARTEC, S. A.: 0.00% | ECONACIONAL,S.A.: 0.00%
      const distObj = {};
      const parts = distStr.split('|');
      parts.forEach(p => {
        const [compName, pctStr] = p.split(':');
        if (compName && pctStr) {
          const cleanName = compName.trim().toUpperCase();
          const cleanNameNoSpace = cleanName.replace(/\s+/g, '');
          const id = companyMap[cleanName] || companyMap[cleanNameNoSpace];
          if (id) {
            const val = parseFloat(pctStr.replace('%', '').trim());
            distObj[id] = val;
          } else {
             console.log("Unmapped company in dist string:", cleanName);
          }
        }
      });
      
      if (Object.keys(distObj).length > 0) {
        const [updatedRows] = await Employee.update({ dist: distObj }, { where: { id: empId } });
        if (updatedRows > 0) updateCount++;
      }
    }
    
    console.log(`Migration completed successfully. Updated ${updateCount} employees' distributions.`);
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    process.exit();
  }
}

run();
