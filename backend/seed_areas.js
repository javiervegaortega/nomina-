const { sequelize, Division, Area } = require('./src/models');

const seed = async () => {
  try {
    // Sincroniza la base de datos (aplica alter table si es necesario)
    await sequelize.sync({ alter: true });
    
    // Create Divisions
    const divisions = [
      { id: 1, nombre: '101010 - GERENCIA GENERAL' },
      { id: 2, nombre: '101020 - PRESIDENCIA' },
      { id: 3, nombre: '101030 - ASESORÍA' },
      { id: 4, nombre: '101040 - PILOTOS' },
    ];
    
    for (const div of divisions) {
      await Division.findOrCreate({ where: { id: div.id }, defaults: div });
    }

    // Insert or update an Area with a division to test the UI (id 22 in screenshot)
    await Area.findOrCreate({ 
      where: { id: 22 }, 
      defaults: { id: 22, nombre: '101000 - PRESIDENCIA', id_estado: 1, divisionId: 2 } 
    });

    console.log('Seeded Divisions and altered DB successfully');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();
