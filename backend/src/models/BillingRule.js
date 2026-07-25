const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BillingRule = sequelize.define('BillingRule', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    fromCompanyId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'empresa', key: 'id' }
    },
    toCompanyId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'empresa', key: 'id' }
    },
    fromCompany: {
      type: DataTypes.STRING,
      allowNull: true
    },
    toCompany: {
      type: DataTypes.STRING,
      allowNull: true
    },
    concept: {
      type: DataTypes.STRING,
      allowNull: true
    },
    marginPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0
    },
    applyIva: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    ivaRate: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0.12
    },
    /** Monto fijo que se suma a la BASE antes de margen/IVA (ej. ajuste Excel Unhesa). */
    baseAdjustment: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    tableName: 'billing_rules',
    timestamps: true
  });

  return BillingRule;
};
