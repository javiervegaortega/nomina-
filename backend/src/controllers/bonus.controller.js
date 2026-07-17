const { Bonus } = require('../models');

exports.getAll = async (req, res) => {
  try {
    const bonuses = await Bonus.findAll({ order: [['name', 'ASC']] });
    res.json(bonuses);
  } catch (error) {
    console.error('Error fetching bonuses:', error);
    res.status(500).json({ error: 'Failed to fetch bonuses' });
  }
};

exports.create = async (req, res) => {
  try {
    const data = {
      id: req.body.id || Date.now().toString(),
      name: req.body.name,
      type: req.body.type || 'fijo',
      amount: req.body.amount ?? null,
      date: req.body.date || null,
      assignments: req.body.assignments || {}
    };
    if (!data.name) {
      return res.status(400).json({ error: 'El nombre del bono es requerido.' });
    }
    const bonus = await Bonus.create(data);
    res.status(201).json(bonus);
  } catch (error) {
    console.error('Error creating bonus:', error);
    res.status(500).json({ error: 'Failed to create bonus' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const bonus = await Bonus.findByPk(id);
    if (!bonus) return res.status(404).json({ error: 'Bono no encontrado' });

    await bonus.update({
      name: req.body.name ?? bonus.name,
      type: req.body.type ?? bonus.type,
      amount: req.body.amount !== undefined ? req.body.amount : bonus.amount,
      date: req.body.date !== undefined ? req.body.date : bonus.date,
      assignments: req.body.assignments !== undefined ? req.body.assignments : bonus.assignments
    });
    res.json(bonus);
  } catch (error) {
    console.error('Error updating bonus:', error);
    res.status(500).json({ error: 'Failed to update bonus' });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Bonus.destroy({ where: { id } });
    if (!deleted) return res.status(404).json({ error: 'Bono no encontrado' });
    res.json({ message: 'Bonus deleted' });
  } catch (error) {
    console.error('Error deleting bonus:', error);
    res.status(500).json({ error: 'Failed to delete bonus' });
  }
};
