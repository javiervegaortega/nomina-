const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OperationBatch = sequelize.define('OperationBatch', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false },
    status: { 
      type: DataTypes.ENUM('DRAFT', 'PENDING_MANAGER', 'APPROVED_MANAGER', 'RETURNED'), 
      defaultValue: 'DRAFT' 
    },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    justification: { type: DataTypes.TEXT, allowNull: true },
    companyId: { type: DataTypes.INTEGER, allowNull: true },
    payrollDraftId: { type: DataTypes.STRING, allowNull: true },
    // Mes calendario al que pertenece el acumulado operativo (YYYY-MM).
    periodMonth: { type: DataTypes.STRING(7), allowNull: true },
    // Ciclo independiente del estado individual de cada registro.
    captureState: {
      type: DataTypes.ENUM('OPEN', 'FROZEN', 'CLOSED'),
      allowNull: false,
      defaultValue: 'OPEN'
    },
    purpose: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'GENERAL'
    }
  }, {
    tableName: 'operation_batches',
    timestamps: true
  });

  return OperationBatch;
};
