const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize('nomina_db', 'root', '', {
  host: 'localhost',
  dialect: 'mysql',
  logging: false,
});

async function run() {
  try {
    const Area = sequelize.define('Area', { nombre: DataTypes.STRING }, { tableName: 'area', timestamps: false });
    const Division = sequelize.define('Division', { nombre: DataTypes.STRING }, { tableName: 'division', timestamps: false });
    const Employee = sequelize.define('Employee', { 
      dpi: DataTypes.STRING,
      areaId: DataTypes.INTEGER,
      divisionId: DataTypes.INTEGER
    }, { tableName: 'employee', timestamps: false });

    const area = await Area.findOne({ where: { nombre: '104000 - INFORMÁTICA' } });
    const division = await Division.findOne({ where: { nombre: '104010 - ADMINISTRACIÓN' } });

    console.log("Area ID:", area?.id);
    console.log("Division ID:", division?.id);

    const juan = await Employee.findOne({ where: { id: 153 } });
    if (juan) {
      if (area) juan.areaId = area.id;
      if (division) juan.divisionId = division.id;
      await juan.save();
      console.log("Juan Pablo actualizado correctamente!");
    } else {
      console.log("No se encontro a Juan Pablo.");
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

run();
