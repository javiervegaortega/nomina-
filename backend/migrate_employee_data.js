const fs = require('fs');
const { Employee, Company } = require('./src/models');
const { Sequelize } = require('sequelize');

const sequelize = require('./src/models').sequelize; // Uses the instance from index.js

async function run() {
  try {
    // 1. Fetch companies to build a map
    const companies = await Company.findAll();
    const companyMap = {};
    companies.forEach(c => {
      companyMap[c.nombre_comercial.trim().toUpperCase()] = c.id;
      companyMap[c.razon_social.trim().toUpperCase()] = c.id;
    });

    console.log("Loaded Companies:", companyMap);

    // 2. Read the file
    const data = fs.readFileSync('C:\\Users\\jyaxo\\Desktop\\nomina-v2\\nomina-\\Reporte_Completo_2026-06-09_15-16.xls', 'utf-8');
    
    // 3. Parse HTML Table Rows
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
      
      // Skip header or incomplete rows
      if (tds.length < 15) continue;
      if (tds[0] === 'ID') continue;
      
      const empIdStr = tds[0];
      const empresaStr = tds[5];
      const deptoStr = tds[6];
      const centroCostoStr = tds[12];
      
      const empId = parseInt(empIdStr, 10);
      if (isNaN(empId)) continue;
      
      const empresaKey = empresaStr.toUpperCase();
      const mappedCompanyId = companyMap[empresaKey] || null;
      
      // Update employee
      const [updatedRows] = await Employee.update({
        empresa_principal: mappedCompanyId,
        departamento_laboral: deptoStr,
        centro_de_costo: centroCostoStr
      }, {
        where: { id: empId }
      });
      
      if (updatedRows > 0) {
        updateCount++;
      } else {
        console.log(`Employee ID ${empId} not found in DB or no change needed.`);
      }
    }
    
    console.log(`Migration completed successfully. Updated ${updateCount} employees.`);
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    process.exit();
  }
}

run();
