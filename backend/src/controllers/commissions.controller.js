const { Commission, Employee } = require('../models');

exports.getAll = async (req, res) => {
  try {
    const commissions = await Commission.findAll();
    res.json(commissions);
  } catch (error) {
    console.error('Error fetching commissions:', error);
    res.status(500).json({ error: 'Failed to fetch commissions' });
  }
};

exports.create = async (req, res) => {
  try {
    const data = req.body;
    const newCommission = await Commission.create(data);
    res.status(201).json(newCommission);
  } catch (error) {
    console.error('Error creating commission:', error);
    res.status(500).json({ error: 'Failed to create commission' });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    await Commission.destroy({ where: { id } });
    res.json({ message: 'Commission deleted' });
  } catch (error) {
    console.error('Error deleting commission:', error);
    res.status(500).json({ error: 'Failed to delete commission' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    await Commission.update(req.body, { where: { id } });
    const updated = await Commission.findByPk(id);
    res.json(updated);
  } catch (error) {
    console.error('Error updating commission:', error);
    res.status(500).json({ error: 'Failed to update commission' });
  }
};
