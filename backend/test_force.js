const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize('nomina_db', 'root', '', {
  host: '127.0.0.1',
  port: 3306,
  dialect: 'mysql',
  logging: false
});

const PayrollDraft = sequelize.define('PayrollDraft', {
  id: { type: DataTypes.STRING, primaryKey: true },
  title: { type: DataTypes.STRING },
  periodType: { type: DataTypes.STRING }
}, {
  tableName: 'payroll_drafts',
  timestamps: false
});

async function run() {
  await PayrollDraft.update({ periodType: '2da' }, { where: { id: '1780511113297' } });
  console.log("Updated to 2da manually.");
  process.exit();
}

run();
