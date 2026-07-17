/**
 * Smoke test de conexión Nodemailer (Gmail).
 * Uso: node src/scripts/test_email.js [--send test@example.com]
 */
require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'notificacioneseconsa@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

async function main() {
  if (!process.env.GMAIL_APP_PASSWORD) {
    console.error('FAIL: GMAIL_APP_PASSWORD no está configurado en .env');
    process.exit(1);
  }

  console.log('Verificando conexión SMTP con', process.env.GMAIL_USER || '(default)...');
  try {
    await transporter.verify();
    console.log('OK: Conexión SMTP verificada.');
  } catch (err) {
    console.error('FAIL: No se pudo verificar la conexión SMTP:', err.message);
    process.exit(1);
  }

  const sendArg = process.argv.find((a) => a.startsWith('--send='));
  const sendIdx = process.argv.indexOf('--send');
  const recipient = sendArg
    ? sendArg.split('=')[1]
    : (sendIdx >= 0 ? process.argv[sendIdx + 1] : null);

  if (recipient && !recipient.startsWith('-')) {
    console.log(`Enviando correo de prueba a ${recipient}...`);
    try {
      await transporter.sendMail({
        from: `"Sistema Nómina" <${process.env.GMAIL_USER}>`,
        to: recipient,
        subject: 'Prueba — Sistema Nómina',
        html: '<p>Este es un correo de prueba del sistema de nómina. Si lo recibió, la configuración de Gmail es correcta.</p>'
      });
      console.log('OK: Correo de prueba enviado.');
    } catch (err) {
      console.error('FAIL: Error enviando correo de prueba:', err.message);
      process.exit(1);
    }
  } else {
    console.log('Tip: agregue --send correo@destino.com para enviar un correo de prueba.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
