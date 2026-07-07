const { getSapConnection } = require('./src/config/sap.config');
const { Department, Area, Division, Subdivision } = require('./src/models');

async function compare() {
  try {
    const pool = await getSapConnection();
    
    // SAP
    const oprcResult = await pool.request().query("SELECT DimCode, COUNT(*) as count FROM OPRC WHERE Active = 'Y' GROUP BY DimCode");
    const sapCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    oprcResult.recordset.forEach(r => {
      sapCounts[r.DimCode] = r.count;
    });

    // Local
    const localDepts = await Department.count();
    const localAreas = await Area.count();
    const localDivs = await Division.count();
    const localSubdivs = await Subdivision.count();

    console.log("=== COMPARACIÓN ===");
    console.log(`Dim 1 (Departamentos) -> SAP: ${sapCounts[1]} | Local: ${localDepts}`);
    console.log(`Dim 2 (Áreas)         -> SAP: ${sapCounts[2]} | Local: ${localAreas}`);
    console.log(`Dim 3 (Divisiones)    -> SAP: ${sapCounts[3]} | Local: ${localDivs}`);
    console.log(`Dim 4 (Subdivisiones) -> SAP: ${sapCounts[4]} | Local: ${localSubdivs}`);
    console.log(`Dim 5 (Ignorado)      -> SAP: ${sapCounts[5]}`);
    
    // Let's see some samples of local vs sap
    const sapDepts = await pool.request().query("SELECT PrcCode, PrcName FROM OPRC WHERE Active = 'Y' AND DimCode = 1");
    const localDeptsData = await Department.findAll({ attributes: ['nombre_dimension'] });
    
    console.log("\nEjemplo SAP Dim 1:", sapDepts.recordset.slice(0, 3));
    console.log("Ejemplo Local Dim 1:", localDeptsData.map(d => d.nombre_dimension).slice(0, 3));

  } catch(e) {
    console.error(e);
  }
}
compare();
