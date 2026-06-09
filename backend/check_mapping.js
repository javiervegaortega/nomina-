const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');

const sequelize = new Sequelize('nomina_db', 'root', '', {
  host: '127.0.0.1',
  port: 3306,
  dialect: 'mysql',
  logging: false
});

const Employee = sequelize.define('Employee', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  primer_nombre: { type: DataTypes.STRING },
  primer_apellido: { type: DataTypes.STRING }
}, { tableName: 'employee', timestamps: false });

const Company = sequelize.define('Company', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  name: { type: DataTypes.STRING }
}, { tableName: 'companies', timestamps: false });

async function run() {
  const employees = await Employee.findAll({ limit: 5 });
  console.log("DB Employees:", employees.map(e => ({ id: e.id, name: `${e.primer_nombre} ${e.primer_apellido}` })));
  
  const companies = await Company.findAll();
  console.log("DB Companies:", companies.map(c => ({ id: c.id, name: c.name })));
  
  process.exit();
}

run();
