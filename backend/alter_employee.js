const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('nomina_db', 'root', '', {
  host: 'localhost',
  dialect: 'mysql',
  logging: false,
});

const Employee = require('./src/models/Employee')(sequelize);

async function alterTable() {
  try {
    await sequelize.authenticate();
    await Employee.sync({ alter: true });
    console.log('Employee table altered successfully!');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

alterTable();
