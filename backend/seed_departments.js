const { sequelize, Department, Area } = require('./src/models');

const seed = async () => {
  try {
    await sequelize.sync({ alter: true });
    
    // Create Areas
    const areas = [
      { id: 31, nombre: '301000 - PRODUCCIÓN' },
      { id: 32, nombre: '302000 - LOGÍSTICA' },
      { id: 33, nombre: '303000 - COMPRAS' },
      { id: 34, nombre: '304000 - CALIDADES' },
      { id: 35, nombre: '305000 - MANTENIMIENTO' },
      { id: 36, nombre: '306000 - ADMINISTRACIÓN OPERACIONES' },
    ];
    
    for (const area of areas) {
      await Area.findOrCreate({ where: { id: area.id }, defaults: area });
    }

    // Create Departments
    const depts = [
      { id: 1, nombre_dimension: '100000 - ADMINISTRACIÓN', gerente: 'GERENTE GENERAL' },
      { id: 2, nombre_dimension: '300000 - OPERACIONES', gerente: 'GERENTE' }
    ];

    for (const dept of depts) {
      await Department.findOrCreate({ where: { nombre_dimension: dept.nombre_dimension }, defaults: dept });
    }

    console.log('Seeded Departments and Areas successfully');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();
