const { DataTypes } = require('sequelize');
const sequelize = require('./db');

// Tabla de Empresas
const Company = sequelize.define('Company', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  color: {
    type: DataTypes.STRING
  },
  gradient: {
    type: DataTypes.STRING
  }
});

// Tabla de Empleados
const Employee = sequelize.define('Employee', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.STRING
  },
  dept: {
    type: DataTypes.STRING
  },
  companyId: {
    type: DataTypes.STRING,
    references: {
      model: Company,
      key: 'id'
    }
  },
  base: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  bonus: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 250 // Bono Decreto
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active'
  },
  bankAccount: {
    type: DataTypes.STRING
  },
  bankName: {
    type: DataTypes.STRING
  },
  igssNumber: {
    type: DataTypes.STRING
  },
  // Almacenamos la distribución y deducciones como JSON para máxima flexibilidad
  dist: {
    type: DataTypes.JSON
  },
  deductions: {
    type: DataTypes.JSON
  },
  extras: {
    type: DataTypes.JSON
  }
});

// Relación Empresa -> Empleados
Company.hasMany(Employee, { foreignKey: 'companyId' });
Employee.belongsTo(Company, { foreignKey: 'companyId', as: 'companyData' });

// Tabla de Bonos Especiales
const Bonus = sequelize.define('Bonus', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2)
  },
  date: {
    type: DataTypes.STRING
  },
  assignments: {
    type: DataTypes.JSON // Objeto con idEmpleado: montoAsignado
  }
});

// Tabla del Historial de Nóminas
const PayrollHistory = sequelize.define('PayrollHistory', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  closedAt: {
    type: DataTypes.STRING
  },
  // "Fotografía" inmutable de toda la nómina en formato JSON
  data: {
    type: DataTypes.JSON
  }
});

// Tabla de Usuarios (Auth)
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
    type: DataTypes.STRING,
    defaultValue: 'admin' // admin, hr, etc.
  }
});

module.exports = {
  sequelize,
  Company,
  Employee,
  Bonus,
  PayrollHistory,
  User
};
