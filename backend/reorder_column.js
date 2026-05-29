const { sequelize } = require('./models');

async function reorderColumn() {
  try {
    // Modify column order in MySQL
    await sequelize.query('ALTER TABLE Users MODIFY username VARCHAR(255) AFTER name;');
    console.log('Columna username movida exitosamente antes de email (después de name).');
    process.exit(0);
  } catch (err) {
    console.error('Error moviendo columna:', err);
    process.exit(1);
  }
}

reorderColumn();
