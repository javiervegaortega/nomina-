const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OperationLog = sequelize.define('OperationLog', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeId: { type: DataTypes.INTEGER, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    type: { type: DataTypes.ENUM('HORA_EXTRA', 'BONO'), allowNull: false },
    hoursQty: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    hourType: { type: DataTypes.ENUM('SIMPLE', 'NOCTURNA'), allowNull: true },
    bonusQty: { type: DataTypes.INTEGER, defaultValue: 0 },
    bonusAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    taskDescription: { type: DataTypes.TEXT, allowNull: false },
    justification: { type: DataTypes.TEXT, allowNull: true },
    // Workflow: PENDING_MANAGER (Operaciones) -> APPROVED_MANAGER (Gerente).
    // Gerencia o Nómina pueden devolver a RETURNED; la corrección vuelve a PENDING_MANAGER.
    status: { 
      type: DataTypes.ENUM('PENDING_MANAGER', 'APPROVED_MANAGER', 'REJECTED', 'PROCESSED_PAYROLL', 'RETURNED'), 
      defaultValue: 'PENDING_MANAGER' 
    },
    periodAssigned: { type: DataTypes.STRING, allowNull: true }, // To mark which payroll processed it
    companyId: { type: DataTypes.INTEGER, allowNull: true },
    batchId: { type: DataTypes.INTEGER, allowNull: true },
    requesterId: { type: DataTypes.INTEGER, allowNull: true }
  }, {
    tableName: 'operation_logs',
    timestamps: true
  });

  return OperationLog;
};
