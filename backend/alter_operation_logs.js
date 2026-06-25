const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('nomina_db', 'root', '', {
  host: 'localhost',
  dialect: 'mysql',
  logging: console.log,
});

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');

    // 1. Add justification column
    try {
        await sequelize.query(`
        ALTER TABLE operation_logs
        ADD COLUMN justification TEXT NULL;
        `);
        console.log('Added justification column.');
    } catch (e) {
        console.log('justification column might already exist:', e.message);
    }

    // 2. Modify status ENUM
    await sequelize.query(`
      ALTER TABLE operation_logs
      MODIFY COLUMN status ENUM('PENDING_MANAGER', 'APPROVED_MANAGER', 'REJECTED', 'PROCESSED_PAYROLL', 'RETURNED') DEFAULT 'PENDING_MANAGER';
    `);
    console.log('Updated status ENUM to include RETURNED.');

  } catch (error) {
    console.error('Unable to alter operation_logs:', error);
  } finally {
    await sequelize.close();
  }
}

run();
