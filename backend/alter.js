const { sequelize } = require('./src/models');
sequelize.query("ALTER TABLE PayrollHistories ADD COLUMN status VARCHAR(255) DEFAULT 'cerrada';")
  .then(() => { console.log('ok'); process.exit(0); })
  .catch((e) => { console.log(e); process.exit(0); });
