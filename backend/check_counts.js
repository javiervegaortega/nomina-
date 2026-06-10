const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('nomina_db', 'root', '', {
  host: '127.0.0.1',
  port: 3306,
  dialect: 'mysql',
  logging: false
});

async function run() {
  const [results] = await sequelize.query(`
    SELECT 
      (SELECT COUNT(*) FROM employee) as empCount,
      (SELECT COUNT(*) FROM companies) as compCount,
      (SELECT COUNT(*) FROM departamento) as deptCount,
      (SELECT COUNT(*) FROM area) as areaCount,
      (SELECT COUNT(*) FROM division) as divCount,
      (SELECT COUNT(*) FROM sub_division) as subCount
  `);
  console.log(results[0]);
  process.exit();
}

run();
