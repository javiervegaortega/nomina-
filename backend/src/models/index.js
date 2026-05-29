const sequelize = require('../config/db');

// Importar modelos
const Company = require('./Company')(sequelize);
const Employee = require('./Employee')(sequelize);
const Bonus = require('./Bonus')(sequelize);
const PayrollHistory = require('./PayrollHistory')(sequelize);
const User = require('./User')(sequelize);

// Definir asociaciones
Company.hasMany(Employee, { foreignKey: 'companyId' });
Employee.belongsTo(Company, { foreignKey: 'companyId', as: 'companyData' });

// Exportar modelos y conexión
module.exports = {
  sequelize,
  Company,
  Employee,
  Bonus,
  PayrollHistory,
  User
};
