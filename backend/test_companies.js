const { Company } = require('./src/models');
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('nomina_db', 'root', '', {
  host: '127.0.0.1',
  port: 3306,
  dialect: 'mysql',
  logging: false
});

const companyModel = require('./src/models/Company')(sequelize);

async function run() {
  const comps = await companyModel.findAll();
  console.log(comps.map(c => ({ id: c.id, nombre: c.nombre_comercial, razon: c.razon_social })));
  process.exit();
}

run();
