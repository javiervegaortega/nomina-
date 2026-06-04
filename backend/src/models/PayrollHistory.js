const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PayrollHistory = sequelize.define('PayrollHistory', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    periodType: {
      type: DataTypes.STRING,
      defaultValue: '1ra'
    },
    closedAt: {
      type: DataTypes.STRING
    },
    data: {
      type: DataTypes.JSON
    }
  });

  return PayrollHistory;
};
