const { sequelize, Area } = require('./src/models');

const seed = async () => {
  try {
    await sequelize.sync();
    
    const areas = [
      { id: 1, nombre: 'Admin', id_estado: 2 },
      { id: 3, nombre: 'PRESIDENCIA', id_estado: 1 },
      { id: 4, nombre: 'ADMINISTRATIVO', id_estado: 1 },
      { id: 5, nombre: 'CONTABILIDAD Y FINANZAS', id_estado: 1 },
      { id: 6, nombre: 'INVESTIGACION Y DESARROLLO', id_estado: 1 },
      { id: 7, nombre: 'CONTROL DE CALIDAD', id_estado: 1 },
      { id: 8, nombre: 'INFORMATICA', id_estado: 1 },
      { id: 9, nombre: 'RECURSOS HUMANOS', id_estado: 1 },
      { id: 10, nombre: 'COMPRAS IMPORTACIONES Y EXPORTACIONES', id_estado: 1 },
      { id: 11, nombre: 'AREA DE OPERACIONES', id_estado: 1 },
      { id: 12, nombre: 'PRODUCCION LIMPIEZA', id_estado: 1 },
      { id: 13, nombre: 'LOGISTICA', id_estado: 1 },
      { id: 14, nombre: 'MANTENIMIENTO', id_estado: 1 },
      { id: 15, nombre: 'AREA DE COMERCIALIZACION', id_estado: 1 },
      { id: 16, nombre: 'DIVISION PROQUIMA', id_estado: 1 },
      { id: 17, nombre: 'DIVISION UNHESA', id_estado: 1 },
      { id: 18, nombre: 'DIVISION POLVOS', id_estado: 1 },
      { id: 19, nombre: 'MERCADEO', id_estado: 1 },
      { id: 20, nombre: 'Informática', id_estado: 2 },
      { id: 21, nombre: 'Comercial', id_estado: 2 },
      { id: 22, nombre: '101000 - PRESIDENCIA', id_estado: 1 },
      { id: 23, nombre: '102000 - ADMINISTRATIVO', id_estado: 1 },
      { id: 24, nombre: '103000 - RECURSOS HUMANOS', id_estado: 1 },
      { id: 25, nombre: '104000 - INFORMATICA', id_estado: 1 },
      { id: 26, nombre: '105000 - AUDITORIA INTERNA', id_estado: 1 },
      { id: 27, nombre: '106000 - CONTABLE FINANCIERO', id_estado: 1 },
      { id: 28, nombre: '201000 - COMERCIAL', id_estado: 1 },
      { id: 29, nombre: '202000 - MERCADEO', id_estado: 1 },
      { id: 30, nombre: '203000 - INVESTIGACIÓN Y DESARROLLO', id_estado: 1 },
      { id: 31, nombre: '301000 - PRODUCCIÓN', id_estado: 1 },
      { id: 32, nombre: '302000 - LOGÍSTICA', id_estado: 1 },
      { id: 33, nombre: '303000 - COMPRAS', id_estado: 1 },
      { id: 34, nombre: '304000 - CALIDADES', id_estado: 1 },
      { id: 35, nombre: '305000 - MANTENIMIENTO', id_estado: 1 },
      { id: 36, nombre: '306000 - ADMINISTRACIÓN OPERACIONES', id_estado: 1 },
      { id: 37, nombre: 'Conserjería', id_estado: 1 }
    ];
    
    for (const area of areas) {
      await Area.upsert(area);
    }

    console.log('Todas las áreas insertadas correctamente');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();
