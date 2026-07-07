const { getSapConnection } = require('./src/config/sap.config');
const { Department, Area, Division, Subdivision, Employee } = require('./src/models');
const { Op } = require('sequelize');

async function runMerge() {
  try {
    console.log("Iniciando fusión automática de catálogos (Opción C)...");
    const pool = await getSapConnection();
    const oprcResult = await pool.request().query("SELECT DimCode, PrcCode, PrcName FROM OPRC WHERE Active = 'Y'");
    
    const sapRecords = oprcResult.recordset;

    // Helper to process a specific dimension
    async function processDimension(dimCode, Model, nameField, isStringKey = false) {
      console.log(`\nProcesando Dimensión ${dimCode}...`);
      const sapItems = sapRecords.filter(r => r.DimCode === dimCode);
      
      const localItems = await Model.findAll();

      for (const sap of sapItems) {
        const correctString = `${sap.PrcCode} - ${sap.PrcName}`;
        
        // Find local items that start with the exact PrcCode (ignoring the exact name casing/accents)
        // e.g. "100000 - ADMINISTRACIÓN" or "100000-ADMINISTRACION"
        const matches = localItems.filter(local => {
          const name = local[nameField];
          return name.startsWith(sap.PrcCode + ' -') || name.startsWith(sap.PrcCode + '-');
        });

        if (matches.length > 0) {
          // If there are multiple matches (e.g. the old uppercase one AND the new properly cased one from a recent sync)
          // We keep the OLDEST one (which usually has the employees attached to it) and update its name.
          // Then we delete the newer duplicates.
          
          matches.sort((a, b) => a.id - b.id); // Oldest first
          const primary = matches[0];
          
          if (primary[nameField] !== correctString) {
            console.log(`  Actualizando nombre: [${primary[nameField]}] -> [${correctString}]`);
            
            // If it's Dim 1 (Department), we must also update the employees!
            if (isStringKey) {
              const affectedEmps = await Employee.update(
                { departamento_laboral: correctString },
                { where: { departamento_laboral: primary[nameField] } }
              );
              console.log(`    -> Empleados reasignados: ${affectedEmps[0]}`);
            }

            // Update the primary record's name
            primary[nameField] = correctString;
            await primary.save();
          }

          // Delete duplicates
          for (let i = 1; i < matches.length; i++) {
            const dup = matches[i];
            console.log(`  Borrando duplicado recién creado: [${dup[nameField]}] (ID: ${dup.id})`);
            await dup.destroy();
          }
        }
      }
    }

    await processDimension(1, Department, 'nombre_dimension', true);
    await processDimension(2, Area, 'nombre', false);
    await processDimension(3, Division, 'nombre', false);
    await processDimension(4, Subdivision, 'nombre', false);

    console.log("\n¡Fusión completada con éxito!");
    process.exit(0);

  } catch (e) {
    console.error("Error durante la fusión:", e);
    process.exit(1);
  }
}

runMerge();
