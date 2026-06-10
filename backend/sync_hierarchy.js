const fs = require('fs');
const { sequelize, Department, Area, Division, Subdivision, Employee } = require('./src/models');

async function run() {
  try {
    const data = fs.readFileSync('C:\\Users\\jyaxo\\Desktop\\nomina-v2\\nomina-\\Reporte_Completo_2026-06-10_09-10.xls', 'utf-8');
    const trRegex = /<tr>(.*?)<\/tr>/gs;
    const tdRegex = /<td>(.*?)<\/td>/gs;

    // ---- STEP 1: Parse all employees from Excel ----
    const empRows = [];
    const uniqueDepts = new Set();
    const uniqueAreas = new Set();
    const uniqueDivs = new Set();
    const uniqueSubdivs = new Set();

    let match;
    while ((match = trRegex.exec(data)) !== null) {
      const tds = [];
      let tdMatch;
      while ((tdMatch = tdRegex.exec(match[1])) !== null) {
        tds.push(tdMatch[1].trim());
      }
      if (tds.length >= 90 && tds[0] !== 'ID') {
        const dept = tds[32] ? tds[32].trim() : '';
        const area = tds[33] ? tds[33].trim() : '';
        const div  = tds[34] ? tds[34].trim() : '';
        const sub  = tds[35] ? tds[35].trim() : '';
        
        if (dept) uniqueDepts.add(dept);
        if (area) uniqueAreas.add(area);
        if (div)  uniqueDivs.add(div);
        if (sub)  uniqueSubdivs.add(sub);
        
        empRows.push({ id: parseInt(tds[0]), dept, area, div, sub });
      }
    }

    console.log(`Parsed ${empRows.length} employees from Excel`);
    console.log(`Unique: ${uniqueDepts.size} depts, ${uniqueAreas.size} areas, ${uniqueDivs.size} divs, ${uniqueSubdivs.size} subdivs`);

    // ---- STEP 2: Rebuild departments table ----
    console.log('\n--- Rebuilding departments table ---');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await Department.destroy({ where: {}, truncate: true });
    await sequelize.query('ALTER TABLE departamento AUTO_INCREMENT = 1');

    const deptMap = {};
    for (const d of Array.from(uniqueDepts).sort()) {
      const rec = await Department.create({ nombre_dimension: d, gerente: '' });
      deptMap[d] = rec.id;
      console.log(`  Dept: "${d}" -> id=${rec.id}`);
    }

    // ---- STEP 3: Rebuild areas table ----
    console.log('\n--- Rebuilding areas table ---');
    await Area.destroy({ where: {}, truncate: true });
    await sequelize.query('ALTER TABLE area AUTO_INCREMENT = 1');

    const areaMap = {};
    for (const a of Array.from(uniqueAreas).sort()) {
      const rec = await Area.create({ nombre: a, id_estado: 1 });
      areaMap[a] = rec.id;
      console.log(`  Area: "${a}" -> id=${rec.id}`);
    }

    // ---- STEP 4: Rebuild divisions table ----
    console.log('\n--- Rebuilding divisions table ---');
    await Division.destroy({ where: {}, truncate: true });
    await sequelize.query('ALTER TABLE division AUTO_INCREMENT = 1');

    const divMap = {};
    for (const d of Array.from(uniqueDivs).sort()) {
      const rec = await Division.create({ nombre: d, id_estado: 1 });
      divMap[d] = rec.id;
      console.log(`  Div: "${d}" -> id=${rec.id}`);
    }

    // ---- STEP 5: Rebuild subdivisions table ----
    console.log('\n--- Rebuilding subdivisions table ---');
    await Subdivision.destroy({ where: {}, truncate: true });
    await sequelize.query('ALTER TABLE subdivision AUTO_INCREMENT = 1');

    const subdivMap = {};
    for (const s of Array.from(uniqueSubdivs).sort()) {
      const rec = await Subdivision.create({ nombre: s, id_estado: 1 });
      subdivMap[s] = rec.id;
      console.log(`  Subdiv: "${s}" -> id=${rec.id}`);
    }
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    // ---- STEP 6: Update every employee ----
    console.log('\n--- Updating employees ---');
    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const row of empRows) {
      const deptId = deptMap[row.dept] || null;
      const areaId = areaMap[row.area] || null;
      const divId  = divMap[row.div] || null;
      const subId  = subdivMap[row.sub] || null;

      const [affectedRows] = await Employee.update({
        departamento_laboral: row.dept || null,
        areaId: areaId,
        divisionId: divId,
        subdivisionId: subId,
      }, { where: { id: row.id } });

      if (affectedRows > 0) {
        updated++;
      } else {
        skipped++;
        errors.push(`Employee id=${row.id} not found in DB`);
      }
    }

    console.log(`\n=== RESULTS ===`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped (not in DB): ${skipped}`);
    if (errors.length > 0) {
      console.log(`Errors:`);
      errors.forEach(e => console.log(`  - ${e}`));
    }

    // ---- STEP 7: Verify ----
    console.log('\n--- Verification (sample 5) ---');
    const sample = await Employee.findAll({ attributes: ['id','primer_nombre','primer_apellido','departamento_laboral','areaId','divisionId','subdivisionId'], raw: true, limit: 5 });
    for (const emp of sample) {
      const aName = emp.areaId ? (await Area.findByPk(emp.areaId, {raw:true}))?.nombre : null;
      const dName = emp.divisionId ? (await Division.findByPk(emp.divisionId, {raw:true}))?.nombre : null;
      const sName = emp.subdivisionId ? (await Subdivision.findByPk(emp.subdivisionId, {raw:true}))?.nombre : null;
      console.log(`  ${emp.id} ${emp.primer_nombre} ${emp.primer_apellido}: dept="${emp.departamento_laboral}" area="${aName}" div="${dName}" sub="${sName}"`);
    }

    // Count employees with complete hierarchy
    const complete = await Employee.count({ where: { departamento_laboral: { [require('sequelize').Op.not]: null }, areaId: { [require('sequelize').Op.not]: null }, divisionId: { [require('sequelize').Op.not]: null } } });
    const total = await Employee.count();
    console.log(`\nEmployees with Dept+Area+Div: ${complete}/${total}`);

  } catch (err) {
    console.error('FATAL ERROR:', err);
  } finally {
    process.exit();
  }
}
run();
