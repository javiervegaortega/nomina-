const { Op } = require('sequelize');
const { Employee, EmployeeRecord, EmployeeIncidence, Department } = require('../models');
const { calculateMonthlyISR } = require('../services/isr.service');

const CUOTA_LABORAL = 0.0483;
const CUOTA_LABORAL_JUBILADO = 0.03;
const CUOTA_PATRONAL = 0.1067;

/**
 * Sincroniza IGSS automático desde sueldo / jubilación.
 * ISR: se respeta el valor manual si viene en el payload (retención definida por
 * contabilidad, como en el Excel); la fórmula 5%-7% solo se usa si no se envía.
 */
const applyAutoPayrollFields = (body) => {
  if (!body || typeof body !== 'object') return body;
  const next = { ...body };
  const hasSueldo = next.sueldo_ordinario !== undefined && next.sueldo_ordinario !== null;
  const hasBono = next.bon_dec_37_2001 !== undefined && next.bon_dec_37_2001 !== null;
  const hasJub = next.jubilacion !== undefined && next.jubilacion !== null;
  if (!hasSueldo && !hasBono && !hasJub) return next;

  const base = Number(next.sueldo_ordinario) || 0;
  const bonus = Number(next.bon_dec_37_2001) || 0;
  const jubilado = !!(next.jubilacion === true || next.jubilacion === 1);
  const laboralRate = jubilado ? CUOTA_LABORAL_JUBILADO : CUOTA_LABORAL;

  const hasManualIsr = next.isr !== undefined && next.isr !== null && next.isr !== '';
  next.isr = hasManualIsr ? (Number(next.isr) || 0) : calculateMonthlyISR(base, bonus);
  next.igss_laboral = Number((base * laboralRate).toFixed(2));
  next.igss_patronal = jubilado ? 0 : Number((base * CUOTA_PATRONAL).toFixed(2));
  return next;
};

const validateDist = (dist) => {
  if (dist === undefined || dist === null) return null;

  let distObj = dist;
  if (typeof dist === 'string') {
    try { distObj = JSON.parse(dist); } catch { return 'Distribución intercompañía inválida (JSON mal formado).'; }
  }
  if (typeof distObj !== 'object' || Array.isArray(distObj)) {
    return 'Distribución intercompañía inválida.';
  }

  const keys = Object.keys(distObj);
  if (keys.length === 0) return null;

  const values = keys.map((k) => Number(distObj[k]) || 0);
  const allZero = values.every((v) => v === 0);
  if (allZero) return null;

  const sum = values.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.01) {
    return `La distribución intercompañía debe sumar 100% (actual: ${sum.toFixed(2)}%). Deje todos en 0 para asignar 100% a la empresa principal.`;
  }
  return null;
};

const getEmployees = async (req, res) => {
  try {
    const employees = await Employee.findAll({
      // foto (BLOB) no se usa en el frontend y infla masivamente el JSON de arranque
      attributes: { exclude: ['foto'] },
      include: [
        { model: Department, as: 'departmentData' },
        // separate evita producto cartesiano records×incidences
        { model: EmployeeRecord, as: 'records', separate: true },
        { model: EmployeeIncidence, as: 'incidences', separate: true }
      ]
    });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createEmployee = async (req, res) => {
  try {
    const distError = validateDist(req.body.dist);
    if (distError) return res.status(400).json({ error: distError });
    const payload = applyAutoPayrollFields(req.body);
    const newEmployee = await Employee.create(payload);
    res.status(201).json(newEmployee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ error: 'No encontrado' });
    if (req.body.dist !== undefined) {
      const distError = validateDist(req.body.dist);
      if (distError) return res.status(400).json({ error: distError });
    }
    const merged = {
      sueldo_ordinario: employee.sueldo_ordinario,
      bon_dec_37_2001: employee.bon_dec_37_2001,
      jubilacion: employee.jubilacion,
      // Preserva la retención ISR manual si el payload no la trae
      isr: employee.isr,
      ...req.body
    };
    const payload = applyAutoPayrollFields(merged);
    await employee.update(payload);
    res.json(employee);
  } catch (err) {
    console.error('Update error:', err);
    res.status(400).json({ error: err.message });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ error: 'No encontrado' });
    await employee.destroy();
    res.json({ message: 'Eliminado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee
};
