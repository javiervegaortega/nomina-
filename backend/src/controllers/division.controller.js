const { Division } = require('../models');

const getDivisions = async (req, res) => {
  try {
    const divisions = await Division.findAll();
    res.json(divisions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createDivision = async (req, res) => {
  try {
    const newDiv = await Division.create(req.body);
    res.status(201).json(newDiv);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const updateDivision = async (req, res) => {
  try {
    const div = await Division.findByPk(req.params.id);
    if (!div) return res.status(404).json({ error: 'No encontrado' });
    await div.update(req.body);
    res.json(div);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const deleteDivision = async (req, res) => {
  try {
    const div = await Division.findByPk(req.params.id);
    if (!div) return res.status(404).json({ error: 'No encontrado' });
    await div.destroy();
    res.json({ message: 'Eliminado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  getDivisions,
  createDivision,
  updateDivision,
  deleteDivision
};
