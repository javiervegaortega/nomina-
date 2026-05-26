const { sequelize, Company, Employee, Bonus, PayrollHistory, User } = require('./models');
const bcrypt = require('bcryptjs');
const { COMPANIES, EMPLOYEES } = require('../frontend/src/data/mockData');

const seedDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión establecida. Iniciando Seeder...');
    
    // Forzamos la recreación de las tablas
    await sequelize.sync({ force: true });
    
    console.log('📦 Creando Usuario Administrador por defecto...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    await User.create({
      name: 'Administrador del Sistema',
      email: 'admin@nomina.com',
      password: hashedPassword,
      role: 'admin'
    });

    console.log('📦 Insertando Empresas...');
    for (let c of COMPANIES) {
      await Company.create({
        id: c.id,
        name: c.name,
        color: c.color,
        gradient: c.gradient
      });
    }

    console.log('📦 Insertando Empleados...');
    for (let e of EMPLOYEES) {
      // Necesitamos mapear el company del frontend (String nombre) al companyId
      const companyRecord = await Company.findOne({ where: { name: e.company } });
      const companyId = companyRecord ? companyRecord.id : null;

      await Employee.create({
        name: e.name,
        role: e.role,
        dept: e.dept,
        companyId: companyId,
        base: e.base,
        bonus: e.bonus,
        status: e.status,
        bankAccount: e.bankAccount,
        bankName: e.bankName,
        igssNumber: e.igssNumber,
        dist: e.dist,
        deductions: e.deductions,
        extras: e.extras
      });
    }

    console.log('✅ ¡Base de datos poblada exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al poblar la base de datos:', error);
    process.exit(1);
  }
};

seedDatabase();
