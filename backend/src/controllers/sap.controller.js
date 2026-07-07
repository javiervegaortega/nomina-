const { getSapConnection } = require('../config/sap.config');
const { Department, Area, Division, Subdivision, Dimension5 } = require('../models');

const syncSapCatalogs = async (req, res) => {
  try {
    const pool = await getSapConnection();

    // 1. Fetch Profit Centers from SAP
    const oprcResult = await pool.request().query(`
      SELECT 
          T0.PrcCode AS Codigo,
          T0.PrcName AS Nombre,
          T0.DimCode AS Dimension
      FROM 
          OPRC T0
      WHERE 
          T0.Active = 'Y'
    `);
    
    const profitCenters = oprcResult.recordset;

    // We know from user's DB:
    // Dim 1 = DEPARTAMENTO
    // Dim 2 = AREA
    // Dim 3 = DIVISION
    // Dim 4 = SUB DIVISION
    
    const departments = profitCenters.filter(pc => pc.Dimension === 1);
    const areas = profitCenters.filter(pc => pc.Dimension === 2);
    const divisions = profitCenters.filter(pc => pc.Dimension === 3);
    const subdivisions = profitCenters.filter(pc => pc.Dimension === 4);
    const dimension5List = profitCenters.filter(pc => pc.Dimension === 5);

    // Sync Departments (Dim 1)
    for (const d of departments) {
      const fullString = `${d.Codigo} - ${d.Nombre}`;
      await Department.findOrCreate({
        where: { nombre_dimension: fullString },
        defaults: { nombre_dimension: fullString }
      });
    }

    // Sync Areas (Dim 2)
    for (const a of areas) {
      const fullString = `${a.Codigo} - ${a.Nombre}`;
      await Area.findOrCreate({
        where: { nombre: fullString },
        defaults: { nombre: fullString, id_estado: 1 }
      });
    }

    // Sync Divisions (Dim 3)
    for (const div of divisions) {
      const fullString = `${div.Codigo} - ${div.Nombre}`;
      await Division.findOrCreate({
        where: { nombre: fullString },
        defaults: { nombre: fullString }
      });
    }

    // Sync Subdivisions (Dim 4)
    for (const sub of subdivisions) {
      const fullString = `${sub.Codigo} - ${sub.Nombre}`;
      await Subdivision.findOrCreate({
        where: { nombre: fullString },
        defaults: { nombre: fullString }
      });
    }

    // Sync Dimension 5 (Dim 5)
    for (const dim5 of dimension5List) {
      const fullString = `${dim5.Codigo} - ${dim5.Nombre}`;
      await Dimension5.findOrCreate({
        where: { nombre: fullString },
        defaults: { nombre: fullString }
      });
    }

    res.json({ message: 'Sincronización de catálogos completada exitosamente desde SAP B1.' });
  } catch (error) {
    console.error('Error syncing SAP:', error);
    res.status(500).json({ error: error.message });
  }
};

const checkSapConnection = async (req, res) => {
  try {
    const pool = await getSapConnection();
    // Test simple query
    await pool.request().query('SELECT 1 as Connected');
    res.json({ connected: true, message: 'Conectado a SAP B1' });
  } catch (error) {
    res.json({ connected: false, message: error.message });
  }
};

module.exports = {
  syncSapCatalogs,
  checkSapConnection
};
