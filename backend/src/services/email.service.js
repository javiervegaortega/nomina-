const nodemailer = require('nodemailer');

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'notificacioneseconsa@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

const sendReactivationEmail = async (gerenteName, recipientEmail, token, details) => {
  const approvalLink = `${BACKEND_URL}/api/payrolls/reactivate-via-get?token=${token}`;
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
  
  const mailOptions = {
    from: `"Sistema Nómina" <${process.env.GMAIL_USER || 'notificacioneseconsa@gmail.com'}>`,
    to: recipientEmail,
    subject: `Aprobación Requerida: ${details.title}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; padding: 40px 20px; min-height: 100vh;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Brand Header -->
          <div style="padding: 20px 30px; font-weight: bold; color: #1e3a8a; font-size: 14px; letter-spacing: 0.5px;">
            GRUPO ECONSA
          </div>
          
          <!-- Blue Banner Header -->
          <div style="background-color: #1e40af; padding: 25px 30px; display: flex; justify-content: center; align-items: center; color: white;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 600;">Reactivación de Nómina</h2>
          </div>
        
          <!-- Body Content -->
          <div style="padding: 30px;">
            <div style="color: #a0aec0; font-size: 12px; margin-bottom: 25px;">
              ${dateStr} a las ${timeStr}
            </div>
            
            <p style="color: #4a5568; font-size: 14px; margin-bottom: 20px;">
              Estimado(a) <strong>${gerenteName}</strong>,
            </p>
            
            <p style="color: #4a5568; font-size: 14px; margin-bottom: 30px;">
              Se ha registrado una solicitud de <strong>reactivación de nómina cerrada</strong> que requiere su revisión y autorización.
            </p>
            
            <!-- Summary Table -->
            <div style="font-size: 11px; font-weight: bold; color: #a0aec0; letter-spacing: 1px; margin-bottom: 10px;">RESUMEN DE LA SOLICITUD</div>
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 30px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr>
                  <td style="padding: 12px 15px; color: #718096; width: 35%; border-bottom: 1px solid #e2e8f0;">Solicitante</td>
                  <td style="padding: 12px 15px; font-weight: 600; color: #2d3748; border-bottom: 1px solid #e2e8f0;">${details.solicitante}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 15px; color: #718096; border-bottom: 1px solid #e2e8f0;">Nómina</td>
                  <td style="padding: 12px 15px; font-weight: 600; color: #2d3748; border-bottom: 1px solid #e2e8f0;">${details.title}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 15px; color: #718096;">Concepto</td>
                  <td style="padding: 12px 15px; color: #4a5568;">${details.concepto || 'SOLICITUD PARA DEVOLVER LA NÓMINA SELECCIONADA A ESTADO DE BORRADOR PARA SU MODIFICACIÓN.'}</td>
                </tr>
              </table>
            </div>
            
            <!-- Additional Info -->
            <div style="font-size: 11px; font-weight: bold; color: #a0aec0; letter-spacing: 1px; margin-bottom: 10px;">INFORMACIÓN ADICIONAL</div>
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 35px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr>
                  <td style="padding: 12px 15px; color: #718096; width: 35%; border-bottom: 1px solid #e2e8f0;">Cantidad de Empleados</td>
                  <td style="padding: 12px 15px; font-weight: 600; color: #2d3748; border-bottom: 1px solid #e2e8f0;">${details.empleados}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 15px; color: #718096; border-bottom: 1px solid #e2e8f0;">Periodo de Nómina</td>
                  <td style="padding: 12px 15px; font-weight: 600; color: #2d3748; border-bottom: 1px solid #e2e8f0;">${details.periodo === '1ra' ? '1ra Quincena' : '2da Quincena'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 15px; color: #718096;">Estado Actual</td>
                  <td style="padding: 12px 15px; font-weight: 600; color: #c53030;">CERRADA</td>
                </tr>
              </table>
            </div>
            
            <!-- Button -->
            <div style="text-align: center; margin-bottom: 35px;">
              <a href="${approvalLink}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 12px 35px; border-radius: 6px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">
                Aprobar solicitud
              </a>
            </div>
            
            <!-- Footer Alert Box -->
            <div style="background-color: #fffbeb; border-left: 4px solid #d97706; padding: 15px 20px; font-size: 12px; color: #92400e;">
              Esta solicitud requiere su aprobación para reactivar la nómina y continuar con el flujo. Por favor revise y tome una decisión.
            </div>
          </div>
          
        </div>
        
        <!-- Email Footer -->
        <div style="max-width: 600px; margin: 20px auto 0; display: flex; justify-content: space-between; align-items: start; font-size: 11px; color: #a0aec0;">
          <div>
            <div style="font-weight: bold; color: #718096; margin-bottom: 3px;">Grupo ECONSA</div>
            <div>Sistema de Gestión de Nóminas</div>
            <div>Este es un mensaje automático — por favor no responda a este correo.</div>
          </div>
          <div>© ${now.getFullYear()}</div>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email enviado a ${recipientEmail} para reactivación de ${details.title}`);
  } catch (error) {
    console.error('Error enviando el correo de reactivación:', error);
    throw new Error('No se pudo enviar el correo de reactivación.');
  }
};

const buildOperationEmailHtml = (details) => {
  const approvalLink = `${FRONTEND_URL}/operations`;
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });

  const {
    gerenteName = 'Gerente',
    solicitanteName = 'Solicitante',
    count = 0,
    justification,
    isRejection = false,
    batchTitle,
    rejectedBy
  } = details;

  const headerColor = isRejection ? '#dc2626' : '#0d9488';
  const headerTitle = isRejection ? 'Corrección Requerida — Reporte Operativo' : 'Reporte Operativo (Bonos / Horas Extra)';
  const introText = isRejection
    ? `El área de <strong>${rejectedBy || 'Nómina'}</strong> ha devuelto el lote <strong>${batchTitle || 'de operaciones'}</strong> para su revisión. Se requiere su atención sobre <strong>${count}</strong> registro(s).`
    : `El usuario <strong>${solicitanteName}</strong> ha registrado <strong>${count}</strong> nueva(s) solicitud(es) de bonos/horas extra que requiere(n) su revisión y autorización.`;

  const alertText = isRejection
    ? 'Por favor revise la justificación indicada, corrija lo necesario y vuelva a aprobar el lote.'
    : 'Estas solicitudes requieren su aprobación para ser procesadas en la nómina.';

  const justificationBlock = isRejection && justification ? `
    <div style="font-size: 11px; font-weight: bold; color: #a0aec0; letter-spacing: 1px; margin-bottom: 10px;">JUSTIFICACIÓN DEL RECHAZO</div>
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin-bottom: 20px; font-size: 13px; color: #991b1b;">
      ${justification}
    </div>
  ` : '';

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="padding: 15px 20px; font-weight: bold; color: #1e3a8a; font-size: 14px; letter-spacing: 0.5px;">
          GRUPO ECONSA
        </div>
        <div style="background-color: ${headerColor}; padding: 15px 20px; display: flex; justify-content: center; align-items: center; color: white;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 600;">${headerTitle}</h2>
        </div>
        <div style="padding: 20px;">
          <div style="color: #a0aec0; font-size: 12px; margin-bottom: 15px;">
            ${dateStr} a las ${timeStr}
          </div>
          <p style="color: #4a5568; font-size: 14px; margin-bottom: 15px;">
            Estimado(a) <strong>${gerenteName}</strong>,
          </p>
          <p style="color: #4a5568; font-size: 14px; margin-bottom: 20px;">
            ${introText}
          </p>
          ${justificationBlock}
          <div style="text-align: center; margin-bottom: 20px;">
            <a href="${approvalLink}" style="display: inline-block; background-color: ${headerColor}; color: white; text-decoration: none; padding: 10px 25px; border-radius: 6px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(13, 148, 136, 0.2);">
              Revisar en el Sistema
            </a>
          </div>
          <div style="background-color: #fffbeb; border-left: 4px solid #d97706; padding: 10px 15px; font-size: 12px; color: #92400e;">
            ${alertText}
          </div>
        </div>
      </div>
    </div>
  `;
};

const getOperationEmailSubject = (details) => {
  const { count = 0, isRejection = false, batchTitle } = details;
  if (isRejection) {
    return `Corrección Requerida: Reporte Operativo${batchTitle ? ` — ${batchTitle}` : ''}`;
  }
  return `Aprobación Requerida: Reporte Operativo (${count} registros)`;
};

const sendOperationLogEmail = async (gerenteName, recipientEmail, solicitanteName, count) => {
  const details = { gerenteName, solicitanteName, count };
  const mailOptions = {
    from: `"Sistema Nómina" <${process.env.GMAIL_USER || 'notificacioneseconsa@gmail.com'}>`,
    to: recipientEmail,
    subject: getOperationEmailSubject(details),
    html: buildOperationEmailHtml(details)
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email enviado a ${recipientEmail} para reporte operativo`);
  } catch (error) {
    console.error('Error enviando el correo de reporte operativo:', error);
    throw new Error('No se pudo enviar el correo de reporte operativo.');
  }
};

const sendOperationRejectToManagerEmail = async (gerenteName, recipientEmail, details) => {
  const emailDetails = { ...details, gerenteName, isRejection: true };
  const mailOptions = {
    from: `"Sistema Nómina" <${process.env.GMAIL_USER || 'notificacioneseconsa@gmail.com'}>`,
    to: recipientEmail,
    subject: getOperationEmailSubject(emailDetails),
    html: buildOperationEmailHtml(emailDetails)
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email de rechazo enviado a ${recipientEmail} para reporte operativo`);
  } catch (error) {
    console.error('Error enviando el correo de rechazo a gerente:', error);
    throw new Error('No se pudo enviar el correo de rechazo al gerente.');
  }
};

module.exports = {
  sendReactivationEmail,
  buildOperationEmailHtml,
  getOperationEmailSubject,
  sendOperationLogEmail,
  sendOperationRejectToManagerEmail
};
