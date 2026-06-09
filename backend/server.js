require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./src/models');

// Importar rutas
const authRoutes = require('./src/routes/auth.routes');
const companyRoutes = require('./src/routes/company.routes');
const employeeRoutes = require('./src/routes/employee.routes');
const payrollRoutes = require('./src/routes/payroll.routes');
const departmentRoutes = require('./src/routes/department.routes');
const areaRoutes = require('./src/routes/area.routes');
const divisionRoutes = require('./src/routes/division.routes');
const subdivisionRoutes = require('./src/routes/subdivision.routes');
const payrollDraftRoutes = require('./src/routes/payrollDraft.routes');
const commissionRoutes = require('./src/routes/commissions.routes');
const { nestedRouter: empRecordsNested, flatRouter: empRecordsFlat } = require('./src/routes/employeeRecord.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Montar rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/employees/:employeeId/records', empRecordsNested);
app.use('/api/employee-records', empRecordsFlat);
app.use('/api/payrolls', payrollRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/areas', areaRoutes);
app.use('/api/divisions', divisionRoutes);
app.use('/api/subdivisions', subdivisionRoutes);
app.use('/api/payroll-drafts', payrollDraftRoutes);
app.use('/api/commissions', commissionRoutes);

// ======================= INTEGRACION FRONTEND =======================
// Servir la carpeta estática del Build de React
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Cualquier otra ruta no capturada por la API devolverá el index.html de React
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// ======================= INICIO DEL SERVIDOR =======================
const startServer = async () => {
  try {
    // Sincronizar modelos con la base de datos (Crea las tablas si no existen)
    // Evita ALTER automatico para no generar indices duplicados en MySQL.
    await sequelize.sync();
    console.log('Base de datos sincronizada correctamente.');
    
    app.listen(PORT, () => {
      console.log(`Servidor Node.js corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
  }
};

startServer();
