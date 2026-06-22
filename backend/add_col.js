const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('nomina_db', 'root', '', {
  host: '127.0.0.1',
  dialect: 'mysql'
});

async function run() {
  try {
    await sequelize.query('ALTER TABLE Users ADD COLUMN idDepartamento VARCHAR(255);');
    console.log('Column added successfully.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sequelize.close();
  }
}
run();
