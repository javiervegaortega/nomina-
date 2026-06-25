const { Sequelize } = require('sequelize');
require('dotenv').config({ path: './.env' });

const dbPort = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
const sequelize = new Sequelize(
  process.env.DB_NAME || 'nomina_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASS || '',
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: dbPort,
    dialect: 'mysql'
  }
);

async function run() {
  try {
    console.log('Adding notes column to payroll_drafts...');
    try {
      await sequelize.query('ALTER TABLE payroll_drafts ADD COLUMN notes TEXT;');
      console.log('Successfully added notes to payroll_drafts.');
    } catch (e) {
      console.log('Error adding to payroll_drafts (might already exist):', e.message);
    }

    console.log('Adding notes column to PayrollHistories...');
    try {
      await sequelize.query('ALTER TABLE PayrollHistories ADD COLUMN notes TEXT;');
      console.log('Successfully added notes to PayrollHistories.');
    } catch (e) {
      console.log('Error adding to PayrollHistories (might already exist):', e.message);
    }
  } catch (err) {
    console.error('Fatal Error:', err.message);
  } finally {
    await sequelize.close();
  }
}

run();
