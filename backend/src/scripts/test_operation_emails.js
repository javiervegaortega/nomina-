/**
 * Pruebas de plantillas de correo operativo y validación de operation logs.
 * Uso: node src/scripts/test_operation_emails.js
 */
require('dotenv').config();
const {
  buildOperationEmailHtml,
  getOperationEmailSubject
} = require('../services/email.service');

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  OK: ${message}`);
  } else {
    failed += 1;
    console.error(`  FAIL: ${message}`);
  }
}

console.log('=== Tests: Correos operativos ===\n');

console.log('1. Asunto — solicitud de aprobación');
{
  const subject = getOperationEmailSubject({ count: 3, isRejection: false });
  assert(subject.includes('3 registros'), 'asunto incluye cantidad de registros');
  assert(subject.includes('Aprobación Requerida'), 'asunto de aprobación correcto');
}

console.log('\n2. Asunto — rechazo a gerente');
{
  const subject = getOperationEmailSubject({ count: 2, isRejection: true, batchTitle: 'Lote Julio' });
  assert(subject.includes('Corrección Requerida'), 'asunto de rechazo correcto');
  assert(subject.includes('Lote Julio'), 'asunto incluye título del lote');
}

console.log('\n3. HTML — enlace a operaciones usa FRONTEND_URL');
{
  const html = buildOperationEmailHtml({
    gerenteName: 'Gerente Test',
    solicitanteName: 'Solicitante Test',
    count: 5
  });
  assert(html.includes(`${FRONTEND_URL}/operations`), 'enlace usa FRONTEND_URL configurado');
  assert(html.includes('Reporte Operativo'), 'HTML incluye título operativo');
  assert(html.includes('Solicitante Test'), 'HTML incluye nombre solicitante');
}

console.log('\n4. HTML — rechazo con justificación');
{
  const html = buildOperationEmailHtml({
    gerenteName: 'Gerente Test',
    solicitanteName: 'Solicitante',
    count: 1,
    isRejection: true,
    justification: 'Monto incorrecto en bono',
    batchTitle: 'Lote #42',
    rejectedBy: 'Nómina'
  });
  assert(html.includes('Monto incorrecto en bono'), 'HTML incluye justificación');
  assert(html.includes('Corrección Requerida'), 'HTML indica corrección requerida');
}

console.log(`\n=== Resultado: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
