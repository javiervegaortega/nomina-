const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize('nomina_db', 'root', '', {
  host: '127.0.0.1',
  port: 3306,
  dialect: 'mysql',
  logging: false
});

const PayrollHistory = sequelize.define('PayrollHistory', {
  id: { type: DataTypes.STRING, primaryKey: true },
  title: { type: DataTypes.STRING },
  periodType: { type: DataTypes.STRING }
});

async function run() {
  const histories = await PayrollHistory.findAll();
  console.log(histories.map(h => ({ id: h.id, title: h.title, periodType: h.periodType })));
  process.exit();
}

run();
