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
  const drafts = await PayrollDraft.findAll();
  console.log(drafts.map(d => ({ id: d.id, title: d.title, periodType: d.periodType })));
  process.exit();
}

run();
