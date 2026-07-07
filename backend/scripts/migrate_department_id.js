const { sequelize, Employee, Department } = require('../src/models');
const { QueryTypes } = require('sequelize');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');

    // 1. Add departmentId column if it doesn't exist
    const [columns] = await sequelize.query('SHOW COLUMNS FROM employee LIKE "departmentId"');
    if (columns.length === 0) {
      console.log('Adding departmentId column to employee table...');
      await sequelize.query('ALTER TABLE employee ADD COLUMN departmentId INT DEFAULT NULL');
      console.log('Column added.');
    } else {
      console.log('Column departmentId already exists.');
    }

    // 2. Fetch all departments
    const departments = await Department.findAll({ raw: true });
    console.log(`Found ${departments.length} departments.`);

    // 3. Update employees matching the department name (departamento_laboral == nombre_dimension)
    for (const dept of departments) {
      const result = await sequelize.query(
        'UPDATE employee SET departmentId = :deptId WHERE departamento_laboral = :deptName',
        {
          replacements: { deptId: dept.id, deptName: dept.nombre_dimension },
          type: QueryTypes.UPDATE
        }
      );
      if (result[1] > 0) {
        console.log(`Updated ${result[1]} employees to departmentId ${dept.id} (${dept.nombre_dimension}).`);
      }
    }

    console.log('Migration complete.');

  } catch (error) {
    console.error('Unable to connect to the database or run migration:', error);
  } finally {
    await sequelize.close();
  }
}

migrate();
