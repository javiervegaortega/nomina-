const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PayrollDraft = sequelize.define('PayrollDraft', {
    id: { type: DataTypes.STRING, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false },
    periodType: { type: DataTypes.STRING, defaultValue: '1ra' },
    companies: { type: DataTypes.JSON, allowNull: true },
    employeesCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    notes: { type: DataTypes.TEXT, allowNull: true },
    isApproved: { type: DataTypes.BOOLEAN, defaultValue: false },
    correctionNote: { type: DataTypes.TEXT, allowNull: true },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'payroll_drafts',
    timestamps: false
  });

  return PayrollDraft;
};
