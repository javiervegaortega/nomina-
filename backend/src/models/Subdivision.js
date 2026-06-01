const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Subdivision = sequelize.define('Subdivision', {
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
    tableName: 'subdivision',
    timestamps: false
  });

  return Subdivision;
};
