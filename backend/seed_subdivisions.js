const { sequelize, Subdivision } = require('./src/models');

const seed = async () => {
  try {
    await sequelize.sync({ alter: true });
    
    const subdivs = [
      { id: 1, nombre: 'R01 - RUTA ADMINISTRATIVA', id_estado: 1 },
      { id: 2, nombre: 'R02 - RUTA AGROINDUSTRIA', id_estado: 1 },
      { id: 3, nombre: 'R03 - RUTA INDUSTRIA 1', id_estado: 1 },
      { id: 4, nombre: 'R04 - RUTA INDUSTRIA 2', id_estado: 1 },
      { id: 5, nombre: 'V01 - PREMEZCLAS', id_estado: 1 },
      { id: 6, nombre: 'V02 - MATERIAS PRIMAS', id_estado: 1 },
      { id: 7, nombre: 'V03 - MAQUILA', id_estado: 1 },
      { id: 8, nombre: 'F01 - MEZCLAS', id_estado: 1 },
      { id: 9, nombre: 'F02 - BOTES', id_estado: 1 },
      { id: 10, nombre: 'F03 - SOBRES', id_estado: 1 },
      { id: 11, nombre: 'F04 - SALADOS', id_estado: 1 },
      { id: 12, nombre: 'F05 - DULCES', id_estado: 1 },
      { id: 13, nombre: 'R10 - RUTA FRANQUICIAS 1', id_estado: 1 },
      { id: 14, nombre: 'R11 - RUTA FRANQUICIAS 2', id_estado: 1 },
      { id: 15, nombre: 'R05 - RUTA MAYOREO 1', id_estado: 1 },
      { id: 16, nombre: 'R06 - RUTA MAYOREO 2', id_estado: 1 },
      { id: 17, nombre: 'R07 - RUTA MAYOREO 3', id_estado: 1 },
      { id: 18, nombre: 'R08 - RUTA MAYOREO 4', id_estado: 1 },
      { id: 19, nombre: 'R09 - RUTA MAYOREO 5', id_estado: 1 },
      { id: 20, nombre: 'R12 - RUTA ON LINE 1', id_estado: 1 },
      { id: 21, nombre: 'R13 - RUTA ON LINE 2', id_estado: 1 },
      { id: 22, nombre: 'Ruta Online 3', id_estado: 1 },
      { id: 23, nombre: 'RUTA TELEMARKETING 1', id_estado: 2 },
      { id: 24, nombre: 'Prueba', id_estado: 2 },
      { id: 25, nombre: 'RUTA TELEMARKETING 1', id_estado: 1 },
      { id: 26, nombre: 'RUTA MAYORISTA JUNIOR NORORIENTE', id_estado: 1 },
      { id: 27, nombre: 'Pilotos', id_estado: 1 },
      { id: 28, nombre: 'Conserjería ', id_estado: 1 },
      { id: 29, nombre: '118 Ruta Sur-Occidente', id_estado: 1 },
      { id: 30, nombre: '101-Ruta Administración', id_estado: 1 },
      { id: 31, nombre: '127-Ruta Fri-Oso Mercado 2', id_estado: 1 },
      { id: 32, nombre: '129-Ruta Telemarketing', id_estado: 1 },
      { id: 33, nombre: 'Distribución', id_estado: 1 },
      { id: 34, nombre: '130-Ruta Mayorista Junior Capital', id_estado: 1 },
      { id: 35, nombre: '107-Ruta Capital', id_estado: 1 },
      { id: 36, nombre: '116-Ruta Ventas Online 3', id_estado: 1 },
      { id: 37, nombre: '128-Ruta Telemarketing 2', id_estado: 1 },
      { id: 38, nombre: '119-Ruta Ventas Online 1', id_estado: 1 },
      { id: 39, nombre: 'MKT1 Hidroxón', id_estado: 1 }
    ];
    
    for (const div of subdivs) {
      await Subdivision.upsert(div);
    }

    console.log('Las 39 subdivisiones insertadas correctamente');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();
