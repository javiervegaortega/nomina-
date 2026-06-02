const { sequelize } = require('./src/models');
const fixDB = async () => {
  try {
    const [indexes] = await sequelize.query("SHOW INDEX FROM Users");
    for (const index of indexes) {
      if (index.Key_name !== 'PRIMARY' && (index.Key_name.startsWith('username') || index.Key_name.startsWith('email'))) {
        try {
          await sequelize.query(`ALTER TABLE Users DROP INDEX ${index.Key_name}`);
          console.log('Dropped index:', index.Key_name);
        } catch(e) {}
      }
    }
    await sequelize.sync({ alter: true });
    console.log('Sync complete!');
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
};
fixDB();
