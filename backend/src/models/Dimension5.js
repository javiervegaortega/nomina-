const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Dimension5 = sequelize.define('Dimension5', {
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
    }
  }, {
    tableName: 'dimension5',
    timestamps: false
  });

  return Dimension5;
};
