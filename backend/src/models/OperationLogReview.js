const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OperationLogReview = sequelize.define('OperationLogReview', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    operationLogId: { type: DataTypes.INTEGER, allowNull: false },
    actorId: { type: DataTypes.INTEGER, allowNull: true },
    actorRole: { type: DataTypes.STRING(40), allowNull: false },
    action: { type: DataTypes.STRING(48), allowNull: false },
    fromStatus: { type: DataTypes.STRING(40), allowNull: true },
    toStatus: { type: DataTypes.STRING(40), allowNull: true },
    comment: { type: DataTypes.TEXT, allowNull: true }
  }, {
    tableName: 'operation_log_reviews',
    timestamps: true,
    updatedAt: false
  });

  return OperationLogReview;
};
