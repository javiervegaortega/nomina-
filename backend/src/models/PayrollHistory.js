const { DataTypes } = require('sequelize');

const parseJsonField = (raw) => {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

module.exports = (sequelize) => {
  const PayrollHistory = sequelize.define('PayrollHistory', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    periodType: {
      type: DataTypes.STRING,
      defaultValue: '1ra'
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'cerrada'
    },
    closedAt: {
      type: DataTypes.STRING
    },
    data: {
      type: DataTypes.JSON,
      get() {
        return parseJsonField(this.getDataValue('data'));
      },
      set(value) {
        if (value == null) {
          this.setDataValue('data', null);
          return;
        }
        this.setDataValue('data', typeof value === 'string' ? value : JSON.stringify(value));
      }
    },
    notes: {
      type: DataTypes.TEXT
    },
    summary: {
      type: DataTypes.JSON,
      allowNull: true,
      get() {
        return parseJsonField(this.getDataValue('summary'));
      },
      set(value) {
        if (value == null) {
          this.setDataValue('summary', null);
          return;
        }
        this.setDataValue('summary', typeof value === 'string' ? value : JSON.stringify(value));
      }
    }
  });

  return PayrollHistory;
};
