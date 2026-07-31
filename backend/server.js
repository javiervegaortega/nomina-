require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const { performance } = require('perf_hooks');
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
const dimension5Routes = require('./src/routes/dimension5.routes');
const payrollDraftRoutes = require('./src/routes/payrollDraft.routes');
const commissionRoutes = require('./src/routes/commissions.routes');
const bonusRoutes = require('./src/routes/bonus.routes');
const incidenceRoutes = require('./src/routes/incidence.routes');
const operationLogRoutes = require('./src/routes/operationLog.routes');
const operationBatchRoutes = require('./src/routes/operationBatch.routes');
const catalogRoutes = require('./src/routes/catalog.routes');
const payrollInputRoutes = require('./src/routes/payrollInput.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const { nestedRouter: empRecordsNested, flatRouter: empRecordsFlat } = require('./src/routes/employeeRecord.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.disable('x-powered-by');
app.use((req, res, next) => {
  const startedAt = performance.now();
  const originalEnd = res.end;
  res.end = function measuredEnd(...args) {
    const duration = performance.now() - startedAt;
    if (!res.headersSent) {
      res.setHeader('Server-Timing', `app;dur=${duration.toFixed(1)}`);
    }
    if (duration >= 250) {
      console.warn(JSON.stringify({
        event: 'slow_request',
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Math.round(duration)
      }));
    }
    return originalEnd.apply(this, args);
  };
  next();
});
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

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
app.use('/api/dimension5', dimension5Routes);
app.use('/api/payroll-drafts', payrollDraftRoutes);
app.use('/api/commissions', commissionRoutes);
app.use('/api/bonuses', bonusRoutes);
app.use('/api/incidences', incidenceRoutes);
app.use('/api/operation-logs', operationLogRoutes);
app.use('/api/operation-batches', operationBatchRoutes);
app.use('/api/catalogs', catalogRoutes);
app.use('/api/payroll-inputs', payrollInputRoutes);
app.use('/api/dashboard', dashboardRoutes);

const userRoutes = require('./src/routes/user.routes');
const sapRoutes = require('./src/routes/sap.routes');
const calculatorRoutes = require('./src/routes/calculator.routes');

app.use('/api/users', userRoutes);
app.use('/api/sap', sapRoutes);
app.use('/api/calculator', calculatorRoutes);

const billingRoutes = require('./src/routes/billing.routes');
app.use('/api/billing', billingRoutes);

// ======================= INTEGRACION FRONTEND =======================
// Servir la carpeta estática del Build de React
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist, {
  setHeaders: (res, filePath) => {
    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (path.basename(filePath) === 'index.html') {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Cualquier otra ruta no capturada por la API devolverá el index.html de React
app.use((req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ======================= INICIO DEL SERVIDOR =======================
const startServer = async () => {
  try {
    // Sincronizar modelos con la base de datos (Crea las tablas si no existen)
    // Evita ALTER automatico para no generar indices duplicados en MySQL.
    await sequelize.sync();
    console.log('Base de datos sincronizada correctamente.');

    const { ensureBillingSchema } = require('./src/config/ensureBillingSchema');
    await ensureBillingSchema(sequelize);
    const { ensurePayrollHistorySchema } = require('./src/config/ensurePayrollHistorySchema');
    await ensurePayrollHistorySchema(sequelize);
    const { ensurePayrollDraftSchema } = require('./src/config/ensurePayrollDraftSchema');
    await ensurePayrollDraftSchema(sequelize);
    const { ensureEmployeeColumns } = require('./src/config/ensureEmployeeSchema');
    await ensureEmployeeColumns(sequelize);
    const { ensureOperationBatchSchema } = require('./src/config/ensureOperationBatchSchema');
    await ensureOperationBatchSchema(sequelize);

    if (process.env.RUN_PERFORMANCE_MIGRATIONS === '1') {
      const { ensurePerformanceIndexes } = require('./src/config/ensureIndexes');
      await ensurePerformanceIndexes(sequelize);
    }
    
    app.listen(PORT, () => {
      console.log(`Servidor Node.js corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
  }
};

startServer();
