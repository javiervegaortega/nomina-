const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('nomina_db', 'root', '', { host: 'localhost', dialect: 'mysql' });

async function migrate() {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS operation_batches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        status ENUM('DRAFT', 'PENDING_MANAGER', 'APPROVED_MANAGER', 'RETURNED') DEFAULT 'DRAFT',
        userId INT NOT NULL,
        justification TEXT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);
    console.log('Created operation_batches table');
  } catch(e) { console.log(e); }

  try {
    await sequelize.query('ALTER TABLE operation_logs ADD COLUMN batchId INT NULL;');
    console.log('Added batchId to operation_logs');
  } catch(e) { console.log('batchId might already exist'); }

  process.exit();
}
migrate();
