const { getSapConnection } = require('./src/config/sap.config');
const { Department, Area, Division, Subdivision, Employee } = require('./src/models');

async function generateReport() {
  try {
    const pool = await getSapConnection();
    const oprcResult = await pool.request().query("SELECT DimCode, PrcCode, PrcName FROM OPRC WHERE Active = 'Y'");
    
    // Group SAP names by DimCode
    const sapMaps = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set() };
    oprcResult.recordset.forEach(r => {
      if(sapMaps[r.DimCode]) {
        sapMaps[r.DimCode].add(`${r.PrcCode} - ${r.PrcName}`);
      }
    });

    // Fetch all local records
    const localDepts = await Department.findAll();
    const localAreas = await Area.findAll();
    const localDivs = await Division.findAll();
    const localSubdivs = await Subdivision.findAll();

    // Find which locals are NOT in SAP
    const deptsToInactivate = localDepts.filter(d => !sapMaps[1].has(d.nombre_dimension));
    const areasToInactivate = localAreas.filter(a => !sapMaps[2].has(a.nombre));
    const divsToInactivate = localDivs.filter(d => !sapMaps[3].has(d.nombre));
    const subdivsToInactivate = localSubdivs.filter(s => !sapMaps[4].has(s.nombre));

    // Find affected employees
    // Note: Employee model needs to be checked for correct fields.
    // Usually: departamento_laboral (string name), areaId, divisionId, subdivisionId
    const allEmployees = await Employee.findAll();
    
    let report = "# Reporte de Empleados Afectados por Inactivación de Catálogos\n\n";
    report += "A continuación se muestran los Centros de Costo locales que NO existen en SAP B1 y que serán marcados como Inactivos, junto con los empleados que actualmente los tienen asignados.\n\n";

    // Departments
    report += "## Departamentos que se inactivarán (" + deptsToInactivate.length + ")\n";
    for (const d of deptsToInactivate) {
      const affected = allEmployees.filter(e => e.departamento_laboral === d.nombre_dimension);
      report += `- **${d.nombre_dimension}** (${affected.length} empleados afectados)\n`;
      affected.forEach(e => report += `  - ID: ${e.id} | ${e.nombre_empleado}\n`);
    }

    // Areas
    report += "\n## Áreas que se inactivarán (" + areasToInactivate.length + ")\n";
    for (const a of areasToInactivate) {
      const affected = allEmployees.filter(e => e.areaId === a.id);
      report += `- **${a.nombre}** (${affected.length} empleados afectados)\n`;
      affected.forEach(e => report += `  - ID: ${e.id} | ${e.nombre_empleado}\n`);
    }

    // Divisions
    report += "\n## Divisiones que se inactivarán (" + divsToInactivate.length + ")\n";
    for (const d of divsToInactivate) {
      const affected = allEmployees.filter(e => e.divisionId === d.id);
      report += `- **${d.nombre}** (${affected.length} empleados afectados)\n`;
      affected.forEach(e => report += `  - ID: ${e.id} | ${e.nombre_empleado}\n`);
    }

    // Subdivisions
    report += "\n## Subdivisiones que se inactivarán (" + subdivsToInactivate.length + ")\n";
    for (const s of subdivsToInactivate) {
      const affected = allEmployees.filter(e => e.subdivisionId === s.id);
      report += `- **${s.nombre}** (${affected.length} empleados afectados)\n`;
      affected.forEach(e => report += `  - ID: ${e.id} | ${e.nombre_empleado}\n`);
    }

    const fs = require('fs');
    fs.writeFileSync('../report.md', report);
    console.log('Report saved to ../report.md');

  } catch(e) {
    console.error(e);
  }
}
generateReport();
