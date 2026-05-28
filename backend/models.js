const { DataTypes } = require('sequelize');
const sequelize = require('./db');

// Tabla de Empresas
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

// Tabla de Empleados
const Employee = sequelize.define('Employee', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  companyId: { type: DataTypes.INTEGER, references: { model: Company, key: 'id' } },
  estado: { type: DataTypes.STRING, defaultValue: 'Activo' },
  primer_nombre: { type: DataTypes.STRING },
  segundo_nombre: { type: DataTypes.STRING },
  otro_nombre: { type: DataTypes.STRING, defaultValue: '' },
  primer_apellido: { type: DataTypes.STRING },
  segundo_apellido: { type: DataTypes.STRING },
  direccion: { type: DataTypes.STRING },
  estado_civil: { type: DataTypes.STRING },
  fecha_nacimiento: { type: DataTypes.DATE },
  cedula: { type: DataTypes.STRING },
  dpi: { type: DataTypes.STRING },
  no_igss: { type: DataTypes.STRING },
  centro_de_costo: { type: DataTypes.STRING },
  fecha_inicio: { type: DataTypes.DATE },
  fecha_baja: { type: DataTypes.DATE },
  telefono: { type: DataTypes.STRING },
  genero: { type: DataTypes.STRING },
  licencia: { type: DataTypes.STRING },
  tipo_licencia: { type: DataTypes.STRING },
  clase_licencia: { type: DataTypes.STRING },
  horas_extra: { type: DataTypes.BOOLEAN },
  tipo_de_pago: { type: DataTypes.STRING },
  banco: { type: DataTypes.STRING },
  no_cuenta: { type: DataTypes.STRING },
  tipo_cuenta: { type: DataTypes.STRING },
  moneda: { type: DataTypes.STRING, defaultValue: 'GTQ' },
  conyugue: { type: DataTypes.STRING },
  foto: { type: DataTypes.BLOB('long') },
  bon_dec_37_2001: { type: DataTypes.DECIMAL(11, 2), defaultValue: 0 },
  bon_incentivo: { type: DataTypes.DECIMAL(11, 2), defaultValue: 0 },
  horas_extras_dobles: { type: DataTypes.DECIMAL(11, 2), defaultValue: 0 },
  horas_extras_simples: { type: DataTypes.DECIMAL(11, 2), defaultValue: 0 },
  sueldo_ordinario: { type: DataTypes.DECIMAL(11, 2), defaultValue: 0 },
  otro_ingresos: { type: DataTypes.DECIMAL(11, 2), defaultValue: 0 },
  total_igss: { type: DataTypes.DECIMAL(11, 2), defaultValue: 0 },
  vacaciones: { type: DataTypes.DECIMAL(11, 2), defaultValue: 0 },
  anticipo_quincenal: { type: DataTypes.DECIMAL(11, 2), defaultValue: 0 },
  bantrab: { type: DataTypes.DECIMAL(11, 2), defaultValue: 0 },
  boleto_de_ornato: { type: DataTypes.DECIMAL(11, 2), defaultValue: 0 },
  igss_laboral: { type: DataTypes.DECIMAL(11, 2), defaultValue: 0 },
  igss_patronal: { type: DataTypes.DECIMAL(11, 2), defaultValue: 0 },
  isr: { type: DataTypes.DECIMAL(11, 2), defaultValue: 0 },
  otro_descuentos: { type: DataTypes.DECIMAL(11, 2), defaultValue: 0 },
  prestamo_empresa: { type: DataTypes.DECIMAL(11, 2), defaultValue: 0 },
  bancos: { type: DataTypes.DECIMAL(11, 2), defaultValue: 0 },
  judiciales: { type: DataTypes.DECIMAL(11, 2), defaultValue: 0 },
  seguro: { type: DataTypes.DECIMAL(11, 2), defaultValue: 0 },
  parqueo: { type: DataTypes.DECIMAL(11, 2), defaultValue: 0 },
  primaria: { type: DataTypes.BOOLEAN },
  grado_primaria: { type: DataTypes.STRING },
  secundaria: { type: DataTypes.BOOLEAN },
  grado_secundaria: { type: DataTypes.STRING },
  diversificado: { type: DataTypes.BOOLEAN },
  universidad: { type: DataTypes.BOOLEAN },
  titulo_diploma: { type: DataTypes.STRING },
  nacionalidad: { type: DataTypes.STRING },
  region_originario: { type: DataTypes.STRING },
  departamento_originario: { type: DataTypes.STRING },
  municipio_originario: { type: DataTypes.STRING },
  municipio_cedula: { type: DataTypes.STRING },
  municipio_laboral: { type: DataTypes.STRING },
  apellido_casada: { type: DataTypes.STRING },
  apellido_casada_originario: { type: DataTypes.STRING },
  nombre_emergencia: { type: DataTypes.STRING },
  telefono_emergencia: { type: DataTypes.STRING },
  edad_conyuge: { type: DataTypes.STRING },
  ocupacion_conyuge: { type: DataTypes.STRING },
  nombre_padre: { type: DataTypes.STRING },
  edad_padre: { type: DataTypes.STRING },
  ocupacion_padre: { type: DataTypes.STRING },
  nombre_madre: { type: DataTypes.STRING },
  edad_madre: { type: DataTypes.STRING },
  ocupacion_madre: { type: DataTypes.STRING },
  condicion_laboral: { type: DataTypes.STRING },
  codigo_ocupacion: { type: DataTypes.STRING },
  tipo_plantilla: { type: DataTypes.STRING },
  horas_laborales: { type: DataTypes.INTEGER },
  jornada: { type: DataTypes.STRING },
  ventas_economicas: { type: DataTypes.DECIMAL(11, 2) },
  temporal: { type: DataTypes.DATE },
  telefono_celular: { type: DataTypes.STRING },
  edad: { type: DataTypes.STRING },
  emision_dpi: { type: DataTypes.STRING },
  nit: { type: DataTypes.STRING },
  departamento_laboral: { type: DataTypes.STRING },
  dias_laborados: { type: DataTypes.INTEGER, defaultValue: 0 },
  puesto: { type: DataTypes.STRING },
  afiliacion: { type: DataTypes.STRING },
  rol_permisos: { type: DataTypes.STRING, defaultValue: 'empleado' },
  jubilacion: { type: DataTypes.BOOLEAN, defaultValue: false },
  discapacidad: { type: DataTypes.STRING },
  motivo_baja: { type: DataTypes.STRING },
  dist: { type: DataTypes.JSON }
}, {
  tableName: 'employee',
  timestamps: false // The SQL didn't define createdAt/updatedAt
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
