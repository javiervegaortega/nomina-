const { sequelize, Division } = require('./src/models');

const seed = async () => {
  try {
    await sequelize.sync({ alter: true });
    
    const divisions = [
      { id: 1, nombre: '101010 - GERENCIA GENERAL', id_estado: 1 },
      { id: 2, nombre: '101020 - PRESIDENCIA', id_estado: 1 },
      { id: 3, nombre: '101030 - ASESORÍA', id_estado: 1 },
      { id: 4, nombre: '101040 - PILOTOS', id_estado: 1 },
      { id: 5, nombre: '102010 - ADMINISTRATIVO', id_estado: 1 },
      { id: 6, nombre: '102020 - MENSAJERÍA', id_estado: 1 },
      { id: 7, nombre: '102030 - RECEPCIÓN', id_estado: 1 },
      { id: 8, nombre: '102040 - PROYECTOS', id_estado: 1 },
      { id: 9, nombre: '103010 - ADMINISTRACIÓN', id_estado: 1 },
      { id: 10, nombre: '104010 - ADMINISTRACIÓN', id_estado: 1 },
      { id: 11, nombre: '104020 - PROGRAMACIÓN', id_estado: 1 },
      { id: 12, nombre: '105010 - ADMINISTRACIÓN', id_estado: 1 },
      { id: 13, nombre: '106010 - ADMINISTRACIÓN', id_estado: 1 },
      { id: 14, nombre: '106020 - CONTABILIDAD', id_estado: 1 },
      { id: 15, nombre: '106030 - TESORERÍA', id_estado: 1 },
      { id: 16, nombre: '106040 - CRÉDITOS Y COBROS', id_estado: 1 },
      { id: 17, nombre: '106050 - LEGAL', id_estado: 1 },
      { id: 18, nombre: '106060 - COSTOS Y PRESUPUESTOS', id_estado: 1 },
      { id: 19, nombre: '201010 - ADMINISTRACIÓN', id_estado: 1 },
      { id: 20, nombre: '201020 - VENTA TÉCNICA', id_estado: 1 },
      { id: 21, nombre: '201030 - FRANQUICIAS', id_estado: 1 },
      { id: 22, nombre: '201040 - DISTRIBUCIÓN', id_estado: 1 },
      { id: 23, nombre: '201050 - MAYOREO', id_estado: 1 },
      { id: 24, nombre: '201060 - ONLINE', id_estado: 1 },
      { id: 25, nombre: '201070 - EXPORTACIONES', id_estado: 1 },
      { id: 26, nombre: '202010 - ADMINISTRACIÓN', id_estado: 1 },
      { id: 27, nombre: '203010 - ADMINISTRACIÓN', id_estado: 1 },
      { id: 28, nombre: '301010 - ADMINISTRACIÓN', id_estado: 1 },
      { id: 29, nombre: '301020 - FABRICACIÓN SECOS', id_estado: 1 },
      { id: 30, nombre: '301030 - FABRICACIÓN LÍQUIDOS', id_estado: 1 },
      { id: 31, nombre: '301040 - FARICACIÓN LÍQUIDOS MAQUILAS', id_estado: 1 },
      { id: 32, nombre: '301050 - FABRICACIÓN MAQUILAS', id_estado: 1 },
      { id: 33, nombre: '302010 - ADMINISTRACIÓN', id_estado: 1 },
      { id: 34, nombre: '302020 - BODEGA MP', id_estado: 1 },
      { id: 35, nombre: '302030 - BODEGA PT', id_estado: 1 },
      { id: 36, nombre: '302040 - TRANSPORTE TERCERIZADO', id_estado: 1 },
      { id: 37, nombre: '302060 - TRANSPORTE PROPIO', id_estado: 1 },
      { id: 38, nombre: '302050 - DESPACHO EN LÍNEA', id_estado: 1 },
      { id: 39, nombre: '303010 - ADMINISTRACIÓN', id_estado: 1 },
      { id: 40, nombre: '303020 - IMPORTACIONES', id_estado: 1 },
      { id: 41, nombre: '303030 - EXPORTACIONES', id_estado: 1 },
      { id: 42, nombre: '303040 - COMPRAS LOCALES', id_estado: 1 },
      { id: 43, nombre: '303050 - SUMINISTROS Y SERVICIOS', id_estado: 1 },
      { id: 44, nombre: '304010 - ADMINISTRACIÓN', id_estado: 1 },
      { id: 45, nombre: '304020 - ASEGURAMIENTO DE CALIDAD', id_estado: 1 },
      { id: 46, nombre: '304030 - CONTROL DE CALIDAD', id_estado: 1 },
      { id: 47, 'id': 47, 'nombre': '305010 - ADMINISTRACIÓN', 'id_estado': 1 },
      { id: 48, nombre: '305020 - MAQUINARIA', id_estado: 1 },
      { id: 49, nombre: '305030 - EQUIPOS', id_estado: 1 },
      { id: 50, nombre: '305040 - EDIFICIOS', id_estado: 1 },
      { id: 51, nombre: '306010 - ADMINISTRACIÓN', id_estado: 1 },
      { id: 52, nombre: 'Conserjería', id_estado: 2 },
      { id: 53, nombre: 'Conserjería', id_estado: 2 },
      { id: 54, nombre: 'Administración', id_estado: 2 },
      { id: 55, nombre: '301060 PRODUCCION LIMPIEZA', id_estado: 1 },
      { id: 56, nombre: 'Conserjeria', id_estado: 1 }
    ];
    
    for (const div of divisions) {
      await Division.upsert(div);
    }

    console.log('Las 56 divisiones insertadas correctamente');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();
