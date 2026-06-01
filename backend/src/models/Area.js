const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Area = sequelize.define('Area', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false
    },
    id_estado: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    divisionId: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'area',
    timestamps: false
  });

  return Area;
};
