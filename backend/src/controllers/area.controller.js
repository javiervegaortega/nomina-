const { Area, Division } = require('../models');

const getAreas = async (req, res) => {
  try {
    const areas = await Area.findAll({
      include: [{ model: Division, as: 'divisionData' }]
    });
    res.json(areas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createArea = async (req, res) => {
  try {
    const newArea = await Area.create(req.body);
    res.status(201).json(newArea);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const updateArea = async (req, res) => {
  try {
    const area = await Area.findByPk(req.params.id);
    if (!area) return res.status(404).json({ error: 'No encontrado' });
    await area.update(req.body);
    res.json(area);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const deleteArea = async (req, res) => {
  try {
    const area = await Area.findByPk(req.params.id);
    if (!area) return res.status(404).json({ error: 'No encontrado' });
    await area.destroy();
    res.json({ message: 'Eliminado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  getAreas,
  createArea,
  updateArea,
  deleteArea
};
