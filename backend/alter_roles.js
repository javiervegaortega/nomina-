const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    port: process.env.DB_PORT || 3306,
    logging: false
  }
);

async function alterRoles() {
  try {
    console.log('Connecting to DB...');
    await sequelize.authenticate();
    console.log('Connected.');

    // We must redefine the ENUM for the `role` column in `users` table
    const query = `
      ALTER TABLE users 
      MODIFY COLUMN role ENUM('ADMIN', 'NOMINA', 'GERENTE', 'SOLICITANTE', 'DIGITADOR', 'AUDITOR') 
      DEFAULT 'SOLICITANTE';
    `;

    console.log('Executing:', query);
    await sequelize.query(query);

    console.log('Successfully updated roles ENUM in the database.');
  } catch (err) {
    console.error('Error migrating DB:', err);
  } finally {
    await sequelize.close();
  }
}

alterRoles();
