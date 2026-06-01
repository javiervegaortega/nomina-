const { Department, Area } = require('../models');

const getDepartments = async (req, res) => {
  try {
    const departments = await Department.findAll({
      include: [{ model: Area, as: 'areaData' }]
    });
    res.json(departments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createDepartment = async (req, res) => {
  try {
    const newDepartment = await Department.create(req.body);
    res.status(201).json(newDepartment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const department = await Department.findByPk(req.params.id);
    if (!department) return res.status(404).json({ error: 'No encontrado' });
    await department.update(req.body);
    res.json(department);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findByPk(req.params.id);
    if (!department) return res.status(404).json({ error: 'No encontrado' });
    await department.destroy();
    res.json({ message: 'Eliminado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment
};
