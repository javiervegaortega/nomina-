const { getSapConnection } = require('./src/config/sap.config');
const { Division, Subdivision } = require('./src/models');
const { Op } = require('sequelize');

async function inactivateOrphans() {
  try {
    console.log("Iniciando inactivación de registros huérfanos locales...");
    const pool = await getSapConnection();
    const oprcResult = await pool.request().query("SELECT DimCode, PrcCode, PrcName FROM OPRC WHERE Active = 'Y'");
    const sapRecords = oprcResult.recordset;

    async function inactivateDimension(dimCode, Model) {
      const sapItems = sapRecords.filter(r => r.DimCode === dimCode);
      const sapCodes = new Set(sapItems.map(s => s.PrcCode));
      
      const localItems = await Model.findAll();
      let inactivated = 0;

      for (const local of localItems) {
        // Extraer el código local (ej. "101000" de "101000 - Nombre")
        const match = local.nombre.match(/^([A-Z0-9]+)[\s-]/);
        if (match) {
          const localCode = match[1];
          if (!sapCodes.has(localCode)) {
            local.id_estado = 2; // 2 = Inactivo
            await local.save();
            inactivated++;
            console.log(`  Inactivando: [${local.nombre}]`);
          }
        } else {
          // Si no tiene el formato estándar, también lo inactivamos porque no vino de SAP
          local.id_estado = 2;
          await local.save();
          inactivated++;
          console.log(`  Inactivando (sin formato SAP): [${local.nombre}]`);
        }
      }
      console.log(`Total inactivados en Dimensión ${dimCode}: ${inactivated}`);
    }

    await inactivateDimension(3, Division);
    await inactivateDimension(4, Subdivision);

    console.log("\nProceso de inactivación completado.");
    process.exit(0);

  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
}

inactivateOrphans();
