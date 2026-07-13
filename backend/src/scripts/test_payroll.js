const { Sequelize } = require('sequelize');
const { PayrollHistory } = require('../models');
require('dotenv').config({ path: '../.env' }); // Make sure to load env

async function test() {
  const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      dialect: 'mysql',
      logging: false,
    }
  );

  const history = await PayrollHistory.findOne({ order: [['createdAt', 'DESC']] });
  if (history) {
    console.log('Found history:', history.id);
    const data = typeof history.data === 'string' ? JSON.parse(history.data) : history.data;
    console.log('Number of records in data:', data.length);
    console.log('Sample record structure:');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('No payroll history found.');
  }
  process.exit(0);
}

test();
