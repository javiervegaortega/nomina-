const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BillingRule = sequelize.define('BillingRule', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    fromCompany: {
      type: DataTypes.STRING,
      allowNull: false
    },
    toCompany: {
      type: DataTypes.STRING,
      allowNull: false
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
