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
const EmployeeRecord = require('./EmployeeRecord')(sequelize);
const PayrollDraft = require('./PayrollDraft')(sequelize);
const PayrollDraftEmployee = require('./PayrollDraftEmployee')(sequelize);
const Commission = require('./Commission')(sequelize);
const EmployeeIncidence = require('./EmployeeIncidence')(sequelize);
const OperationLog = require('./OperationLog')(sequelize);
const OperationBatch = require('./OperationBatch')(sequelize);
const Dimension5 = require('./Dimension5')(sequelize);
const BillingRule = require('./BillingRule')(sequelize);
const BillingDistribution = require('./BillingDistribution')(sequelize);

// Definir asociaciones
Company.hasMany(Employee, { foreignKey: 'companyId' });
Employee.belongsTo(Company, { foreignKey: 'companyId', as: 'companyData' });

Area.hasMany(Department, { foreignKey: 'areaId' });
Department.belongsTo(Area, { foreignKey: 'areaId', as: 'areaData' });

Department.hasMany(Employee, { foreignKey: 'departmentId' });
Employee.belongsTo(Department, { foreignKey: 'departmentId', as: 'departmentData' });

Division.hasMany(Area, { foreignKey: 'divisionId' });
Area.belongsTo(Division, { foreignKey: 'divisionId', as: 'divisionData' });

Employee.hasMany(EmployeeRecord, { foreignKey: 'employeeId', as: 'records' });
EmployeeRecord.belongsTo(Employee, { foreignKey: 'employeeId' });

Employee.hasMany(EmployeeIncidence, { foreignKey: 'employeeId', as: 'incidences' });
EmployeeIncidence.belongsTo(Employee, { foreignKey: 'employeeId' });

Employee.hasMany(OperationLog, { foreignKey: 'employeeId', as: 'operationLogs' });
OperationLog.belongsTo(Employee, { foreignKey: 'employeeId' });

Company.hasMany(OperationLog, { foreignKey: 'companyId' });
OperationLog.belongsTo(Company, { foreignKey: 'companyId', as: 'companyData' });

OperationBatch.hasMany(OperationLog, { foreignKey: 'batchId', as: 'logs' });
OperationLog.belongsTo(OperationBatch, { foreignKey: 'batchId', as: 'batch' });

OperationBatch.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(OperationBatch, { foreignKey: 'userId' });

PayrollDraft.hasMany(PayrollDraftEmployee, { foreignKey: 'draftId', as: 'draftEmployees', onDelete: 'CASCADE' });
PayrollDraftEmployee.belongsTo(PayrollDraft, { foreignKey: 'draftId' });

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
  Subdivision,
  EmployeeRecord,
  PayrollDraft,
  PayrollDraftEmployee,
  Commission,
  EmployeeIncidence,
  OperationLog,
  OperationBatch,
  Dimension5,
  BillingRule,
  BillingDistribution
};
