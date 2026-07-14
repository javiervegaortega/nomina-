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
    justification: { type: DataTypes.TEXT, allowNull: true }
  }, {
    tableName: 'operation_batches',
    timestamps: true
  });

  return OperationBatch;
};
