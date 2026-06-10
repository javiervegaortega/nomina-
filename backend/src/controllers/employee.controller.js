const { Employee, EmployeeRecord } = require('../models');

const getEmployees = async (req, res) => {
  try {
    const employees = await Employee.findAll({
      include: [{ model: EmployeeRecord, as: 'records' }]
    });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createEmployee = async (req, res) => {
  try {
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
