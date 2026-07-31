process.env.SKIP_DB_CONNECT_TEST = '1';
require('dotenv').config();

const { sequelize, Employee } = require('../models');
const employeeController = require('../controllers/employee.controller');
const payrollController = require('../controllers/payroll.controller');
const payrollDraftController = require('../controllers/payrollDraft.controller');
const operationBatchController = require('../controllers/operationBatch.controller');
const BillingController = require('../controllers/billing.controller');
const dashboardController = require('../controllers/dashboard.controller');
const payrollInputController = require('../controllers/payrollInput.controller');
const catalogController = require('../controllers/catalog.controller');

const invoke = (handler, req) => new Promise((resolve, reject) => {
  const output = { status: 200, headers: {} };
  const res = {
    status(code) {
      output.status = code;
      return this;
    },
    set(name, value) {
      output.headers[name] = value;
      return this;
    },
    json(body) {
      output.body = body;
      resolve(output);
      return this;
    }
  };
  Promise.resolve(handler(req, res)).catch(reject);
});

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const bodySize = (value) => Buffer.byteLength(JSON.stringify(value));

async function main() {
  const admin = { id: 1, role: 'ADMIN', idDepartamento: null };
  const sampleEmployee = await Employee.findOne({
    attributes: ['empresa_principal'],
    where: { estado: 'ACTIVO' },
    raw: true
  });
  const checks = [
    {
      name: 'catalogs',
      run: () => invoke(catalogController.getCatalogs, {
        query: {},
        user: admin
      }),
      validate: (body) => {
        assert(Array.isArray(body.companies), 'catalogs no devolvió empresas');
        assert(Array.isArray(body.departments), 'catalogs no devolvió departamentos');
        assert(Array.isArray(body.areas), 'catalogs no devolvió áreas');
      }
    },
    {
      name: 'employees-list',
      run: () => invoke(employeeController.getEmployees, {
        query: { view: 'list', page: '1', pageSize: '25' },
        user: admin
      }),
      validate: (body) => {
        assert(Array.isArray(body.items), 'employees-list no devolvió items');
        assert(body.pagination.pageSize === 25, 'employees-list no respetó pageSize');
        assert(body.items.every((row) => row.foto === undefined), 'employees-list incluyó foto');
      }
    },
    {
      name: 'payroll-history-summary',
      run: () => invoke(payrollController.getPayrolls, {
        query: { summary: '1', page: '1', pageSize: '25' },
        user: admin
      }),
      validate: (body) => {
        assert(Array.isArray(body.items), 'history-summary no devolvió items');
        assert(body.items.every((row) => row.data === undefined), 'history-summary incluyó data');
      }
    },
    {
      name: 'payroll-drafts-summary',
      run: () => invoke(payrollDraftController.getAll, {
        query: { summary: '1', page: '1', pageSize: '25' },
        user: admin
      }),
      validate: (body) => {
        assert(Array.isArray(body.items), 'draft-summary no devolvió items');
        assert(body.items.every((row) => row.employees === undefined), 'draft-summary incluyó filas');
      }
    },
    {
      name: 'billing-runs-summary',
      run: () => invoke(BillingController.getRuns, {
        query: { summary: '1', page: '1', pageSize: '25' },
        user: admin
      }),
      validate: (body) => {
        assert(Array.isArray(body.items), 'billing-summary no devolvió items');
        assert(body.items.every((row) => row.costMatrixJson === undefined), 'billing-summary incluyó matriz');
        assert(body.items.every((row) => row.lines === undefined), 'billing-summary incluyó líneas');
      }
    },
    {
      name: 'operation-batches-summary',
      run: () => invoke(operationBatchController.getAll, {
        query: { summary: '1', page: '1', pageSize: '25' },
        user: admin
      }),
      validate: (body) => {
        assert(Array.isArray(body.items), 'operation-summary no devolvió items');
        assert(body.items.every((row) => row.logs === undefined), 'operation-summary incluyó logs');
      }
    },
    {
      name: 'dashboard-summary',
      run: () => invoke(dashboardController.getDashboardSummary, {
        query: { mode: 'latest' },
        user: admin
      }),
      validate: (body) => {
        assert(Array.isArray(body.companyDistribution), 'dashboard no incluyó distribución');
        assert(body.sourceEmployees === undefined, 'dashboard incluyó detalle de empleados');
      }
    },
    {
      name: 'dashboard-summary-limited-role',
      run: () => invoke(dashboardController.getDashboardSummary, {
        query: { mode: 'latest' },
        user: { id: 2, role: 'SOLICITANTE', idDepartamento: 3 }
      }),
      validate: (body) => {
        assert(body.totalGrossPayroll === undefined, 'dashboard expuso bruto sin permiso');
        assert(body.totalNetPay === undefined, 'dashboard expuso neto sin permiso');
        assert(
          body.filteredRecords.every((row) => row.totals === undefined),
          'dashboard expuso totales de nómina sin permiso'
        );
        assert(body.companyDistribution.length === 0, 'dashboard expuso costos por empresa');
        assert(body.deptList.length === 0, 'dashboard expuso costos por departamento');
      }
    }
  ];
  if (sampleEmployee?.empresa_principal) {
    checks.push({
      name: 'payroll-inputs-company',
      run: () => invoke(payrollInputController.getPayrollInputs, {
        query: {
          companyId: String(sampleEmployee.empresa_principal),
          date: new Date().toISOString(),
          periodType: '1ra'
        },
        user: admin
      }),
      validate: (body) => {
        assert(Array.isArray(body.employees), 'payroll-inputs no devolvió empleados');
        assert(body.employees.every(
          (row) => String(row.empresa_principal) === String(sampleEmployee.empresa_principal)
        ), 'payroll-inputs mezcló empresas');
        assert(body.firstQuincena === null, 'payroll-inputs cargó anticipo para la 1ra');
      }
    });
  }

  for (const check of checks) {
    const started = performance.now();
    const result = await check.run();
    assert(result.status < 400, `${check.name} respondió HTTP ${result.status}: ${result.body?.error || ''}`);
    check.validate(result.body);
    const bytes = bodySize(result.body);
    assert(bytes <= 100 * 1024, `${check.name} excede 100 KB (${bytes} bytes)`);
    console.log(JSON.stringify({
      check: check.name,
      status: result.status,
      bytes,
      durationMs: Math.round(performance.now() - started)
    }));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
