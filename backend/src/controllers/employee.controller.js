const { Op } = require('sequelize');
const { Employee, EmployeeRecord, EmployeeIncidence, Department } = require('../models');

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
    const newEmployee = await Employee.create(req.body);
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
    await employee.update(req.body);
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
