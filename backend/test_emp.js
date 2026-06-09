const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize('nomina_db', 'root', '', {
  host: '127.0.0.1',
  port: 3306,
  dialect: 'mysql',
  logging: false
});

const PayrollDraftEmployee = sequelize.define('PayrollDraftEmployee', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  draftId: { type: DataTypes.STRING },
  employeeId: { type: DataTypes.INTEGER },
  data: { type: DataTypes.JSON }
}, {
  tableName: 'payroll_draft_employees',
  timestamps: false
});

async function run() {
  const empDrafts = await PayrollDraftEmployee.findAll({ limit: 1 });
  if (empDrafts.length > 0) {
    const rawData = empDrafts[0].data;
    console.log("Type of data:", typeof rawData);
    console.log("Is array?", Array.isArray(rawData));
    console.log("Raw Data snippet:", typeof rawData === 'string' ? rawData.substring(0, 100) : rawData);
  } else {
    console.log("No employee drafts found.");
  }
  process.exit();
}

run();
