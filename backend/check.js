const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('nomina_db', 'root', '', { host: '127.0.0.1', dialect: 'mysql' });
async function check() {
  const [results] = await sequelize.query('SELECT id, primer_nombre, departamento_laboral, departamento_originario, centro_de_costo FROM employee LIMIT 5;');
  console.log(results);
  process.exit();
}
check();
