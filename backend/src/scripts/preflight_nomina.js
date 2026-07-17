/**
 * Inventario pre-vuelo: empresas, empleados, roles, billing_rules, SMTP.
 * Uso: node src/scripts/preflight_nomina.js
 */
require('dotenv').config();
const { sequelize, Company, Employee, User, BillingRule } = require('../models');
const { Op } = require('sequelize');
const { checkServer } = require('./lib/testHelpers');

const REQUIRED_ROLES = [
  'ADMIN',
  'GERENTE GENERAL',
  'NOMINA',
  'GERENTE',
  'SOLICITANTE',
  'AUDITOR',
  'DIGITADOR'
];

async function main() {
  console.log('=== Pre-vuelo: Sistema de Nómina ===\n');

  const serverUp = await checkServer();
  console.log(`Backend accesible: ${serverUp ? 'SÍ' : 'NO (iniciar npm start)'}`);

  const smtpOk = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  console.log(`SMTP configurado: ${smtpOk ? 'SÍ' : 'NO (tests de email real se omitirán)'}`);
  console.log(`JWT_SECRET: ${process.env.JWT_SECRET ? 'configurado' : 'FALTA'}`);
  console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL || '(default localhost:5173)'}`);
  console.log(`BACKEND_URL: ${process.env.BACKEND_URL || '(default localhost:3000)'}\n`);

  const companies = await Company.findAll({ order: [['id', 'ASC']] });
  console.log(`Empresas (${companies.length}):`);
  let totalEmployees = 0;
  for (const c of companies) {
    const withSalary = await Employee.count({
      where: { empresa_principal: c.id, sueldo_ordinario: { [Op.gt]: 0 } }
    });
    const active = await Employee.count({
      where: {
        empresa_principal: c.id,
        sueldo_ordinario: { [Op.gt]: 0 },
        estado: { [Op.like]: '%activo%' }
      }
    });
    totalEmployees += withSalary;
    console.log(`  [${c.id}] ${c.nombre_comercial || c.razon_social} | NIT: ${c.nit || 'N/A'} — empleados nómina: ${withSalary} (activos: ${active})`);
    if (withSalary === 0) {
      console.log(`       ⚠ Sin empleados con empresa_principal=${c.id}; no se puede generar nómina hasta asignarlos.`);
    }
  }
  console.log(`  TOTAL empleados en nómina: ${totalEmployees}\n`);

  console.log('Usuarios por rol:');
  const missingRoles = [];
  for (const role of REQUIRED_ROLES) {
    const count = await User.count({ where: { role } });
    const alt = role === 'ADMIN'
      ? await User.count({ where: { role: 'admin' } })
      : 0;
    const total = count + alt;
    const status = total > 0 ? 'OK' : 'FALTA';
    if (total === 0) missingRoles.push(role);
    console.log(`  ${role}: ${total} (${status})`);
  }
  if (missingRoles.length) {
    console.log(`\n  ADVERTENCIA: Crear usuarios para roles: ${missingRoles.join(', ')}`);
  }

  const billingRules = await BillingRule.count();
  console.log(`\nReglas billing_rules: ${billingRules}${billingRules === 0 ? ' (configurar en /billing/rules)' : ''}`);

  await sequelize.close();
  const ok = serverUp && totalEmployees > 0 && missingRoles.filter((r) => r === 'GERENTE GENERAL').length === 0;
  console.log(`\nPre-vuelo: ${ok ? 'LISTO' : 'REVISAR ADVERTENCIAS'}`);
  process.exit(ok ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
