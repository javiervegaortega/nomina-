const { Sequelize } = require('sequelize');

// Conexión a la base de datos MySQL local (XAMPP)
// Usuario por defecto en XAMPP es 'root' sin contraseña
const sequelize = new Sequelize('nomina_db', 'root', '', {
  host: 'localhost',
  dialect: 'mysql',
  logging: false, // Cambiar a true si quieres ver las consultas SQL en la consola
});

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado exitosamente a la base de datos MySQL (nomina_db).');
  } catch (error) {
    console.error('❌ Error al conectar con MySQL:', error);
  }
};

testConnection();

module.exports = sequelize;
