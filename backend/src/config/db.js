const { Sequelize } = require('sequelize');
require('dotenv').config();

const dbPort = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: dbPort,
    dialect: 'mysql',
    logging: false, // Cambiar a true si quieres ver las consultas SQL en la consola
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: {
      connectTimeout: 15000,
    },
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

if (process.env.SKIP_DB_CONNECT_TEST !== '1') {
  testConnection();
}

module.exports = sequelize;
