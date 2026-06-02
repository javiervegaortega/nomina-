const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EmployeeRecord = sequelize.define('EmployeeRecord', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeId: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    data: { type: DataTypes.JSON, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'employee_records',
    timestamps: false
  });

  return EmployeeRecord;
};
