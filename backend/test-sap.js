const { getSapConnection } = require('./src/config/sap.config');

async function test() {
  try {
    const pool = await getSapConnection();
    console.log('Connected');
    const res = await pool.request().query("SELECT * FROM OPRC WHERE Active = 'Y'");
    console.log('Records:', res.recordset.length);
    console.log(res.recordset);
  } catch(e) {
    console.log('Error:', e.message);
  }
}
test();
