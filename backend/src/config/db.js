const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false, // Cambiar a true si quieres ver las consultas SQL en la consola
  }
);

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log(`Conectado exitosamente a la base de datos MySQL (${process.env.DB_NAME}).`);
  } catch (error) {
    console.error('Error al conectar con MySQL:', error);
  }
};

testConnection();

module.exports = sequelize;
