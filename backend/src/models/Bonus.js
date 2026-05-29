const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Bonus = sequelize.define('Bonus', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    type: {
      type: DataTypes.STRING
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2)
    },
    date: {
      type: DataTypes.STRING
    },
    assignments: {
      type: DataTypes.JSON // Objeto con idEmpleado: montoAsignado
    }
  });

  return Bonus;
};
