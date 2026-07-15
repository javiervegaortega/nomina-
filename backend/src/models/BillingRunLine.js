const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BillingRunLine = sequelize.define('BillingRunLine', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    runId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'billing_runs', key: 'id' }
    },
    ruleId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    fromCompanyId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    toCompanyId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    areaId: {
      type: DataTypes.INTEGER,
      allowNull: true
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
    }
  }, {
    tableName: 'billing_run_lines',
    timestamps: true
  });

  return BillingRunLine;
};
