const { PayrollHistory } = require('../models');

const getPayrolls = async (req, res) => {
  try {
    const payrolls = await PayrollHistory.findAll();
    res.json(payrolls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createPayroll = async (req, res) => {
  try {
    const newPayroll = await PayrollHistory.create(req.body);
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

module.exports = {
  getPayrolls,
  createPayroll,
  deletePayroll
};
