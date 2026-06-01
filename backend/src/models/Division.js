const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Division = sequelize.define('Division', {
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
    tableName: 'division',
    timestamps: false
  });

  return Division;
};
