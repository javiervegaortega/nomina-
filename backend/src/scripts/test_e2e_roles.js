/**
 * Pruebas de permisos por rol (401/403) en rutas protegidas.
 * Uso: node src/scripts/test_e2e_roles.js
 */
require('dotenv').config();
const { sequelize, User } = require('../models');
const { createAssert, getTokenForRole, api } = require('./lib/testHelpers');

const state = { passed: 0, failed: 0 };
const assert = createAssert(state);

async function tryTokenForRole(role) {
  const user = await User.findOne({ where: { role } });
  if (!user) return null;
  return getTokenForRole(role);
}

async function main() {
  console.log('=== E2E Roles: permisos API ===\n');

  console.log('1. Sin token → 401');
  {
    const res = await api('/api/bonuses', {}, null);
    assert(res.status === 401, `GET /api/bonuses sin token → ${res.status}`);
  }

  console.log('\n2. Token válido → acceso');
  {
    const { token } = await getTokenForRole('ADMIN');
    const res = await api('/api/bonuses', {}, token);
    assert(res.status === 200, `GET /api/bonuses con admin → ${res.status}`);
  }

  console.log('\n3. Rutas públicas GET (catálogos)');
  {
    const companies = await api('/api/companies', {}, null);
    assert(companies.status === 200, `GET /api/companies público → ${companies.status}`);
  }

  console.log('\n4. Mutación sin token → 401');
  {
    const res = await api('/api/payroll-drafts', {
      method: 'POST',
      body: JSON.stringify({ id: 'x', title: 'x', companies: ['x'], employees: [] })
    }, null);
    assert(res.status === 401, `POST payroll-drafts sin token → ${res.status}`);
  }

  console.log('\n5. Generar tokens por roles existentes — GET payroll-drafts');
  {
    const roles = ['ADMIN', 'NOMINA', 'AUDITOR', 'GERENTE', 'SOLICITANTE', 'DIGITADOR', 'GERENTE GENERAL'];
    for (const role of roles) {
      const auth = await tryTokenForRole(role);
      if (!auth) {
        console.log(`  SKIP: no hay usuario con rol ${role}`);
        continue;
      }
      const drafts = await api('/api/payroll-drafts', {}, auth.token);
      assert(drafts.status === 200, `GET payroll-drafts rol ${role} → ${drafts.status}`);
    }
  }

  console.log('\n6. Matriz de permisos por rol');
  {
    const adminAuth = await getTokenForRole('ADMIN');
    const auditorAuth = await tryTokenForRole('AUDITOR');
    const gerenteAuth = await tryTokenForRole('GERENTE');
    const ggAuth = await tryTokenForRole('GERENTE GENERAL');

    if (auditorAuth) {
      const getPayrolls = await api('/api/payrolls', {}, auditorAuth.token);
      assert(getPayrolls.status === 200, `AUDITOR GET /api/payrolls → ${getPayrolls.status}`);

      const postDraft = await api('/api/payroll-drafts', {
        method: 'POST',
        body: JSON.stringify({
          id: `role-test-${Date.now()}`,
          title: 'Test AUDITOR',
          companies: ['Test'],
          employees: []
        })
      }, auditorAuth.token);
      assert(postDraft.status === 201 || postDraft.status === 400,
        `AUDITOR POST payroll-drafts → ${postDraft.status} (autenticado)`);
    } else {
      console.log('  SKIP: matriz AUDITOR (sin usuario)');
    }

    if (gerenteAuth) {
      const batches = await api('/api/operation-batches', {}, gerenteAuth.token);
      assert(batches.status === 200, `GERENTE GET operation-batches → ${batches.status}`);

      const billing = await api('/api/billing/preview', {
        method: 'POST',
        body: JSON.stringify({ payrollId: 'nonexistent' })
      }, gerenteAuth.token);
      assert(billing.status === 404 || billing.status === 400 || billing.status === 200,
        `GERENTE POST billing/preview → ${billing.status}`);
    } else {
      console.log('  SKIP: matriz GERENTE (sin usuario)');
    }

    if (ggAuth) {
      const drafts = await api('/api/payroll-drafts', {}, ggAuth.token);
      assert(drafts.status === 200, `GERENTE GENERAL GET payroll-drafts → ${drafts.status}`);
    } else {
      console.log('  SKIP: matriz GERENTE GENERAL (sin usuario)');
    }

    const noTokenBilling = await api('/api/billing/runs', {
      method: 'POST',
      body: JSON.stringify({ payrollId: 'x' })
    }, null);
    assert(noTokenBilling.status === 401, `POST billing/runs sin token → ${noTokenBilling.status}`);

    const adminBilling = await api('/api/billing/rules', {}, adminAuth.token);
    assert(adminBilling.status === 200, `ADMIN GET billing/rules → ${adminBilling.status}`);
  }

  console.log('\n7. SOLICITANTE — acceso operaciones');
  {
    const solAuth = await tryTokenForRole('SOLICITANTE');
    if (solAuth) {
      const batches = await api('/api/operation-batches', {}, solAuth.token);
      assert(batches.status === 200, `SOLICITANTE GET operation-batches → ${batches.status}`);
    } else {
      console.log('  SKIP: SOLICITANTE (sin usuario)');
    }
  }

  await sequelize.close();
  console.log(`\n=== Resultado: ${state.passed} passed, ${state.failed} failed ===`);
  process.exit(state.failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
