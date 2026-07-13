const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BillingDistribution = sequelize.define('BillingDistribution', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    period: {
      type: DataTypes.STRING,
      allowNull: false
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
    baseAmount: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    marginPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0
    },
    marginAmount: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    ivaAmount: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    totalAmount: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    savedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'billing_distributions',
    timestamps: true
  });

  return BillingDistribution;
};
