const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize('nomina_db', 'root', '', {
  host: 'localhost',
  dialect: 'mysql',
  logging: false,
});

const Employee = require('./src/models/Employee')(sequelize);

async function insertJuan() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');

    const newEmp = await Employee.create({
      id: 153,
      companyId: 1,
      estado: 'Activo',
      primer_nombre: 'Juan',
      segundo_nombre: 'Pablo',
      otro_nombre: 'Angel',
      primer_apellido: 'Yaxon',
      segundo_apellido: 'Taquira',
      direccion: 'zona 7 Landivar',
      fecha_nacimiento: '2005-12-15 00:00:00',
      dpi: '3117133110704',
      no_igss: '3117133110704',
      fecha_inicio: '2024-11-04 00:00:00',
      sueldo_ordinario: 4002.28,
      bon_dec_37_2001: 250.00,
      bon_incentivo: 81.77,
      igss_laboral: 96.66,
      igss_patronal: 253.54,
      nacionalidad: 'guatemalteco',
      puesto: 'Analista Programador',
      departamento_laboral: '104020 - PROGRAMACIÓN', 
      dist: JSON.stringify({ 1: 100 }) // Stringified dist as it was saved in the db
    });

    console.log('Employee inserted successfully:', newEmp.id);
    process.exit(0);
  } catch (err) {
    console.error('Error inserting employee:', err);
    process.exit(1);
  }
}

insertJuan();
