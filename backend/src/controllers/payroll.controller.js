const { PayrollHistory, User, PayrollDraft, PayrollDraftEmployee, sequelize } = require('../models');
const jwt = require('jsonwebtoken');
const { sendReactivationEmail } = require('../services/email.service');

const getPayrolls = async (req, res) => {
  try {
    const payrolls = await PayrollHistory.findAll();
    
    const formattedPayrolls = payrolls.map(p => {
      const payrollObj = p.toJSON();
      let emps = typeof payrollObj.data === 'string' ? JSON.parse(payrollObj.data) : payrollObj.data;
      emps = calculatePayrollBatch(emps, payrollObj.periodType);
      payrollObj.data = emps;
      return payrollObj;
    });

    res.json(formattedPayrolls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const { calculatePayrollBatch } = require('../services/payrollCalculator.service');

const createPayroll = async (req, res) => {
  try {
    const payload = req.body;
    
    // SERVER-SIDE CALCULATION ENFORCEMENT
    let emps = typeof payload.data === 'string' ? JSON.parse(payload.data) : payload.data;
    if (emps && emps.length > 0) {
      emps = calculatePayrollBatch(emps, payload.periodType);
      payload.data = typeof payload.data === 'string' ? JSON.stringify(emps) : emps;
    }

    const newPayroll = await PayrollHistory.create(payload);
    res.status(201).json(newPayroll);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const deletePayroll = async (req, res) => {
  try {
    const payroll = await PayrollHistory.findByPk(req.params.id);
    if (!payroll) return res.status(404).json({ error: 'No encontrado' });
    await payroll.destroy();
    res.json({ message: 'Eliminado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const requestReactivation = async (req, res) => {
  try {
    const { payrollIds, concepto } = req.body;
    if (!Array.isArray(payrollIds) || payrollIds.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron IDs de nómina' });
    }

    // Combine data from all requested payrolls
    let totalGross = 0;
    let totalEmployees = 0;
    let payrollTitle = "Varias Nóminas";
    let periodType = "N/A";
    let companies = new Set();

    const firstPayroll = await PayrollHistory.findByPk(payrollIds[0]);
    if (firstPayroll) {
      payrollTitle = firstPayroll.title;
      periodType = firstPayroll.periodType;
    }

    for (const id of payrollIds) {
      const payroll = await PayrollHistory.findByPk(id);
      if (!payroll) continue;
      
      const emps = typeof payroll.data === 'string' ? JSON.parse(payroll.data) : (payroll.data || []);
      totalEmployees += emps.length;
      
      emps.forEach(e => {
        // The data is already calculated by the backend!
        if (e.calculated && e.calculated.gross) {
          totalGross += e.calculated.gross;
        } else {
          // Fallback if it's an older payroll without e.calculated
          const baseFactor = (e.days || 30) / 30;
          const sueldoOrd = Number(e.sueldo_ordinario) || 0;
          const bonInc = Number(e.bon_incentivo) || 0;
          const bonDec = Number(e.bon_dec_37_2001) || 0;
          const bonos = Number(e.extras?.bonos) || 0;
          const extrasTotal = (e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0) + (e.extras?.comisiones || 0) + (e.extras?.otrosIngresos || 0);
          const bonusesSum = Object.values(e.appliedBonuses || {}).reduce((a, b) => a + b, 0);
  
          totalGross += (sueldoOrd * baseFactor) + (bonInc * baseFactor) + (bonDec * baseFactor) + bonos + extrasTotal + bonusesSum;
        }
      });
    }

    const details = {
      title: payrollTitle,
      solicitante: req.user ? req.user.name : 'Usuario del Sistema',
      monto: totalGross.toLocaleString('es-GT', { style: 'currency', currency: 'GTQ' }),
      empleados: totalEmployees,
      periodo: periodType,
      concepto: concepto || null
    };

    // Generate JWT token
    const token = jwt.sign({ payrollIds }, process.env.JWT_SECRET || 'secretkey', { expiresIn: '24h' });

    // Find all users with GERENTE GENERAL role
    const gerentes = await User.findAll({ where: { role: 'GERENTE GENERAL' } });
    if (gerentes.length === 0) {
      return res.status(400).json({ error: 'No hay usuarios con el rol GERENTE GENERAL para aprobar la solicitud.' });
    }

    // Send email to all GERENTE GENERAL users
    for (const gerente of gerentes) {
      await sendReactivationEmail(gerente.name, gerente.email, token, details);
    }

    res.json({ message: 'Solicitud de reactivación enviada por correo a los Gerentes Generales.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

const reactivate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token no proporcionado' });

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
    const { payrollIds } = decoded;

    if (!Array.isArray(payrollIds)) {
      await t.rollback();
      return res.status(400).json({ error: 'Token inválido: no contiene IDs de nómina' });
    }

    for (const payrollId of payrollIds) {
      // Check if it exists in history
      const historyRecord = await PayrollHistory.findByPk(payrollId, { transaction: t });
      if (!historyRecord) continue;

      const data = typeof historyRecord.data === 'string' ? JSON.parse(historyRecord.data) : historyRecord.data;

      // We will recreate the PayrollDraft
      const draftId = `draft_${Date.now()}_${Math.floor(Math.random()*1000)}`;
      await PayrollDraft.create({
        id: draftId,
        title: historyRecord.title,
        periodType: historyRecord.periodType,
        companies: [], // we will get this from employees or if it was saved
        employeesCount: data ? data.length : 0,
        notes: historyRecord.notes,
        createdAt: new Date()
      }, { transaction: t });

      if (data && data.length > 0) {
        const employeeRecords = data.map(emp => ({
          draftId: draftId,
          employeeId: emp.id,
          data: emp
        }));
        await PayrollDraftEmployee.bulkCreate(employeeRecords, { transaction: t });
      }

      // Delete from history
      await historyRecord.destroy({ transaction: t });
    }

    await t.commit();
    res.json({ message: 'Nómina reactivada exitosamente.' });
  } catch (err) {
    await t.rollback();
    res.status(400).json({ error: err.message });
  }
};

const reactivateViaGet = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send('<h1>Error: Token no proporcionado</h1>');

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
    const { payrollIds } = decoded;

    if (!Array.isArray(payrollIds)) {
      await t.rollback();
      return res.status(400).send('<h1>Error: Token inválido</h1>');
    }

    let reactivated = false;

    for (const payrollId of payrollIds) {
      const historyRecord = await PayrollHistory.findByPk(payrollId, { transaction: t });
      if (!historyRecord) continue;

      const data = typeof historyRecord.data === 'string' ? JSON.parse(historyRecord.data) : historyRecord.data;

      const draftId = `draft_${Date.now()}_${Math.floor(Math.random()*1000)}`;
      await PayrollDraft.create({
        id: draftId,
        title: historyRecord.title,
        periodType: historyRecord.periodType,
        companies: [],
        employeesCount: data ? data.length : 0,
        notes: historyRecord.notes,
        createdAt: new Date()
      }, { transaction: t });

      if (data && data.length > 0) {
        const employeeRecords = data.map(emp => ({
          draftId: draftId,
          employeeId: emp.id,
          data: emp
        }));
        await PayrollDraftEmployee.bulkCreate(employeeRecords, { transaction: t });
      }

      await historyRecord.destroy({ transaction: t });
      reactivated = true;
    }

    await t.commit();
    
    if (reactivated) {
      res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reactivación Exitosa</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
            body { font-family: 'Plus Jakarta Sans', Tahoma, Geneva, Verdana, sans-serif; background-color: #1a202c; color: #e2e8f0; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .card { background-color: #2d3748; padding: 50px 40px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5); text-align: center; max-width: 500px; width: 90%; border: 1px solid #4a5568; }
            .icon { color: #48bb78; font-size: 72px; margin-bottom: 20px; line-height: 1; }
            h1 { color: #ffffff; margin-top: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
            p { color: #a0aec0; margin-bottom: 35px; line-height: 1.6; font-size: 15px; }
            a { display: inline-block; background-color: #3182ce; color: white; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-weight: 700; transition: all 0.2s; box-shadow: 0 4px 6px rgba(49, 130, 206, 0.3); }
            a:hover { background-color: #2b6cb0; transform: translateY(-1px); box-shadow: 0 6px 8px rgba(49, 130, 206, 0.4); }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✓</div>
            <h1>¡Reactivación Aprobada!</h1>
            <p>La nómina ha sido reactivada exitosamente. Ahora se encuentra en estado de borrador y puede ser modificada desde el sistema.</p>
            <a href="http://localhost:5173/dashboard">Volver al Sistema</a>
          </div>
        </body>
        </html>
      `);
    } else {
      res.status(400).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Nómina no encontrada</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
            body { font-family: 'Plus Jakarta Sans', Tahoma, Geneva, Verdana, sans-serif; background-color: #1a202c; color: #e2e8f0; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .card { background-color: #2d3748; padding: 50px 40px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5); text-align: center; max-width: 500px; width: 90%; border: 1px solid #4a5568; }
            .icon { color: #d69e2e; font-size: 72px; margin-bottom: 20px; line-height: 1; }
            h1 { color: #ffffff; margin-top: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
            p { color: #a0aec0; margin-bottom: 35px; line-height: 1.6; font-size: 15px; }
            a { display: inline-block; background-color: #4a5568; color: white; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; transition: all 0.2s; }
            a:hover { background-color: #2d3748; border: 1px solid #718096; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">⚠</div>
            <h1>Nómina no encontrada</h1>
            <p>Es posible que esta nómina ya haya sido reactivada previamente o el enlace haya expirado.</p>
            <a href="http://localhost:5173/dashboard">Ir al Sistema</a>
          </div>
        </body>
        </html>
      `);
    }
  } catch (err) {
    await t.rollback();
    res.status(400).send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
          body { font-family: 'Plus Jakarta Sans', Tahoma, Geneva, Verdana, sans-serif; background-color: #1a202c; color: #e2e8f0; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .card { background-color: #2d3748; padding: 50px 40px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5); text-align: center; max-width: 500px; width: 90%; border: 1px solid #4a5568; }
          .icon { color: #e53e3e; font-size: 72px; margin-bottom: 20px; line-height: 1; }
          h1 { color: #ffffff; margin-top: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
          p { color: #a0aec0; margin-bottom: 35px; line-height: 1.6; font-size: 15px; }
          a { display: inline-block; background-color: #4a5568; color: white; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; transition: all 0.2s; }
          a:hover { background-color: #2d3748; border: 1px solid #718096; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✕</div>
          <h1>Error al Reactivar</h1>
          <p>${err.message}</p>
          <a href="http://localhost:5173/dashboard">Volver al Sistema</a>
        </div>
      </body>
      </html>
    `);
  }
};

const auditorApprove = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const historyRecord = await PayrollHistory.findByPk(req.params.id, { transaction: t });
    if (!historyRecord) {
      await t.rollback();
      return res.status(404).json({ error: 'Nómina no encontrada' });
    }

    const data = typeof historyRecord.data === 'string' ? JSON.parse(historyRecord.data) : historyRecord.data;

    const draftId = `draft_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    await PayrollDraft.create({
      id: draftId,
      title: historyRecord.title,
      periodType: historyRecord.periodType,
      companies: historyRecord.companies,
      employeesCount: data ? data.length : 0,
      notes: historyRecord.notes,
      isApproved: true,
      createdAt: new Date()
    }, { transaction: t });

    if (data && data.length > 0) {
      const employeeRecords = data.map(emp => ({ draftId, employeeId: emp.id, data: emp }));
      await PayrollDraftEmployee.bulkCreate(employeeRecords, { transaction: t });
    }

    await historyRecord.destroy({ transaction: t });
    await t.commit();
    res.json({ message: 'Nómina devuelta a borradores como aprobada.' });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
};

const auditorReject = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { note } = req.body;
    const historyRecord = await PayrollHistory.findByPk(req.params.id, { transaction: t });
    if (!historyRecord) {
      await t.rollback();
      return res.status(404).json({ error: 'Nómina no encontrada' });
    }

    const data = typeof historyRecord.data === 'string' ? JSON.parse(historyRecord.data) : historyRecord.data;

    const draftId = `draft_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    await PayrollDraft.create({
      id: draftId,
      title: historyRecord.title,
      periodType: historyRecord.periodType,
      companies: historyRecord.companies,
      employeesCount: data ? data.length : 0,
      notes: historyRecord.notes,
      isApproved: false,
      correctionNote: note || 'Requiere correcciones',
      createdAt: new Date()
    }, { transaction: t });

    if (data && data.length > 0) {
      const employeeRecords = data.map(emp => ({ draftId, employeeId: emp.id, data: emp }));
      await PayrollDraftEmployee.bulkCreate(employeeRecords, { transaction: t });
    }

    await historyRecord.destroy({ transaction: t });
    await t.commit();
    res.json({ message: 'Nómina rebotada a borradores para corrección.' });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const payroll = await PayrollHistory.findByPk(req.params.id);
    if (!payroll) return res.status(404).json({ error: 'No encontrado' });
    
    payroll.status = status;
    await payroll.save();
    
    res.json(payroll);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  getPayrolls,
  updateStatus,
  createPayroll,
  deletePayroll,
  requestReactivation,
  reactivate,
  reactivateViaGet,
  auditorApprove,
  auditorReject
};
