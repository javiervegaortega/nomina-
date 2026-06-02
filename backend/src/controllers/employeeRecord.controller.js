const { EmployeeRecord } = require('../models');

const getByEmployee = async (req, res) => {
  try {
    const where = { employeeId: req.params.employeeId };
    if (req.query.type) where.type = req.query.type;
    const records = await EmployeeRecord.findAll({ where });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const create = async (req, res) => {
  try {
    const record = await EmployeeRecord.create({
      employeeId: req.params.employeeId,
      type: req.body.type,
      data: req.body.data
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const update = async (req, res) => {
  try {
    const record = await EmployeeRecord.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'No encontrado' });
    await record.update({ data: req.body.data });
    res.json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const record = await EmployeeRecord.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'No encontrado' });
    await record.destroy();
    res.json({ message: 'Eliminado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = { getByEmployee, create, update, remove };
