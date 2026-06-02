const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PayrollDraftEmployee = sequelize.define('PayrollDraftEmployee', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    draftId: { type: DataTypes.STRING, allowNull: false },
    employeeId: { type: DataTypes.INTEGER, allowNull: true },
    data: { type: DataTypes.JSON, allowNull: false }
  }, {
    tableName: 'payroll_draft_employees',
    timestamps: false
  });

  return PayrollDraftEmployee;
};
