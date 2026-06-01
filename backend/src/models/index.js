const sequelize = require('../config/db');

// Importar modelos
const Company = require('./Company')(sequelize);
const Employee = require('./Employee')(sequelize);
const Bonus = require('./Bonus')(sequelize);
const PayrollHistory = require('./PayrollHistory')(sequelize);
const User = require('./User')(sequelize);
const Area = require('./Area')(sequelize);
const Department = require('./Department')(sequelize);
const Division = require('./Division')(sequelize);
const Subdivision = require('./Subdivision')(sequelize);

// Definir asociaciones
Company.hasMany(Employee, { foreignKey: 'companyId' });
Employee.belongsTo(Company, { foreignKey: 'companyId', as: 'companyData' });

Area.hasMany(Department, { foreignKey: 'areaId' });
Department.belongsTo(Area, { foreignKey: 'areaId', as: 'areaData' });

Division.hasMany(Area, { foreignKey: 'divisionId' });
Area.belongsTo(Division, { foreignKey: 'divisionId', as: 'divisionData' });

// Exportar modelos y conexión
module.exports = {
  sequelize,
  Company,
  Employee,
  Bonus,
  PayrollHistory,
  User,
  Area,
  Department,
  Division,
  Subdivision
};
