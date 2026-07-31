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
    benchmark: true,
    logging: (sql, durationMs) => {
      if (!Number.isFinite(durationMs) || durationMs < 250) return;
      const operation = String(sql).match(/\b(SELECT|INSERT|UPDATE|DELETE)\b/i)?.[1]?.toUpperCase()
        || 'QUERY';
      const table = String(sql).match(/\b(?:FROM|INTO|UPDATE)\s+`?([a-zA-Z0-9_]+)/i)?.[1]
        || 'unknown';
      console.warn(JSON.stringify({
        event: 'slow_query',
        operation,
        table,
        durationMs: Math.round(durationMs)
      }));
    },
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
