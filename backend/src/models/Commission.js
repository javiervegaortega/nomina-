const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Commission = sequelize.define('Commission', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employee_id: { type: DataTypes.INTEGER, allowNull: false },
    empresa_id: { type: DataTypes.INTEGER },
    autorizado_cenas: { type: DataTypes.BOOLEAN, defaultValue: false },
    fecha: { type: DataTypes.STRING }, // "YYYY-MM-DD"
    mes: { type: DataTypes.STRING }, // "Enero", "Febrero", etc.
    horas: { type: DataTypes.FLOAT, defaultValue: 0 },
    tipo_hora: { type: DataTypes.STRING }, // 'D' or 'N'
    jornada_trabajo: { type: DataTypes.STRING },
    bono_unidades: { type: DataTypes.FLOAT, defaultValue: 0 },
    monto_bono: { type: DataTypes.FLOAT, defaultValue: 0 },
    tarea_realizada: { type: DataTypes.TEXT },
    solicitante: { type: DataTypes.STRING },
    estado: { type: DataTypes.STRING, defaultValue: 'Pendiente' } // Pendiente, Aplicado
  });

  return Commission;
};
