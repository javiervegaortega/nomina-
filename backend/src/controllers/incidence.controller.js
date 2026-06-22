const { EmployeeIncidence } = require('../models');

const getAll = async (req, res) => {
  try {
    const incidences = await EmployeeIncidence.findAll();
    res.json(incidences);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const incidences = await EmployeeIncidence.findAll({ where: { employeeId } });
    res.json(incidences);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const create = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const payload = { ...req.body, employeeId };
    
    // We ignore ID sent from client if any, let DB autoincrement
    if (payload.id && isNaN(Number(payload.id))) {
      delete payload.id;
    }

    const newIncidence = await EmployeeIncidence.create(payload);
    res.status(201).json(newIncidence);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const incidence = await EmployeeIncidence.findByPk(req.params.id);
    if (!incidence) {
      return res.status(404).json({ error: 'Incidencia no encontrada' });
    }
    await incidence.destroy();
    res.json({ message: 'Incidencia eliminada' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  getAll,
  getByEmployee,
  create,
  remove
};
