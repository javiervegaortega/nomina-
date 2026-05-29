const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Company = sequelize.define('Company', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nit: { type: DataTypes.STRING },
    nombre_comercial: { type: DataTypes.STRING },
    razon_social: { type: DataTypes.STRING },
    calle: { type: DataTypes.STRING },
    apto: { type: DataTypes.STRING },
    departamento: { type: DataTypes.STRING },
    apartado_postal: { type: DataTypes.STRING },
    telefono: { type: DataTypes.STRING },
    fax: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    nomenclatura: { type: DataTypes.STRING },
    numero: { type: DataTypes.STRING },
    colonia: { type: DataTypes.STRING },
    municipio: { type: DataTypes.STRING },
    direccion: { type: DataTypes.STRING },
    nombre_patrono: { type: DataTypes.STRING },
    direccion_patrono: { type: DataTypes.STRING },
    numero_patrono: { type: DataTypes.STRING },
    nit_patrono: { type: DataTypes.STRING },
    id_estado: { type: DataTypes.INTEGER },
    id_banco: { type: DataTypes.INTEGER },
    color: { type: DataTypes.STRING, defaultValue: '#0ea5e9' },
    gradient: { type: DataTypes.STRING, defaultValue: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)' }
  }, {
    tableName: 'empresa',
    timestamps: false
  });

  return Company;
};
