const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Department = sequelize.define('Department', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre_dimension: {
      type: DataTypes.STRING,
      allowNull: false
    },
    gerente: {
      type: DataTypes.STRING
    },
    areaId: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'departamento',
    timestamps: false
  });

  return Department;
};
