const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BillingRun = sequelize.define('BillingRun', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    payrollId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    payrollTitle: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('draft', 'confirmed', 'stale'),
      allowNull: false,
      defaultValue: 'confirmed'
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    costMatrixJson: {
      // La columna real en MySQL es LONGTEXT; se serializa/parsea manualmente.
      type: DataTypes.TEXT('long'),
      allowNull: true,
      get() {
        const raw = this.getDataValue('costMatrixJson');
        if (raw == null || raw === '') return null;
        if (typeof raw === 'object') return raw;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      },
      set(value) {
        if (value == null) {
          this.setDataValue('costMatrixJson', null);
          return;
        }
        this.setDataValue(
          'costMatrixJson',
          typeof value === 'string' ? value : JSON.stringify(value)
        );
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'billing_runs',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['payrollId', 'version'],
        name: 'billing_runs_payroll_version_unique'
      }
    ]
  });

  return BillingRun;
};
