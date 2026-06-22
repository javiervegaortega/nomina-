const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EmployeeIncidence = sequelize.define('EmployeeIncidence', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeId: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    daysQuincena: { type: DataTypes.INTEGER, defaultValue: 0 },
    daysTotal: { type: DataTypes.INTEGER, defaultValue: 0 },
    startDate: { type: DataTypes.DATEONLY, allowNull: true },
    endDate: { type: DataTypes.DATEONLY, allowNull: true },
    remove7thDay: { type: DataTypes.BOOLEAN, defaultValue: false },
    observations: { type: DataTypes.TEXT, allowNull: true }
  }, {
    tableName: 'employee_incidences',
    timestamps: true
  });

  return EmployeeIncidence;
};
