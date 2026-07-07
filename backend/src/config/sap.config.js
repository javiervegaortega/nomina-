const sql = require('mssql');
require('dotenv').config();

const sapDbConfig = {
  user: process.env.SAP_DB_USER || 'sa',
  password: process.env.SAP_DB_PASSWORD || '',
  server: process.env.SAP_DB_SERVER || 'localhost', 
  database: process.env.SAP_DB_NAME || 'SBO_COMPANY',
  options: {
    encrypt: false, 
    trustServerCertificate: true 
  }
};

const getSapConnection = async () => {
  try {
    const pool = await sql.connect(sapDbConfig);
    return pool;
  } catch (err) {
    console.error('Error connecting to SAP SQL Server:', err);
    throw err;
  }
};

module.exports = {
  getSapConnection
};
