const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    username: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('ADMIN', 'NOMINA', 'GERENTE', 'SOLICITANTE', 'DIGITADOR', 'AUDITOR'),
      defaultValue: 'SOLICITANTE'
    },
    idDepartamento: {
      type: DataTypes.STRING,
      allowNull: true
    }
  });

  return User;
};
