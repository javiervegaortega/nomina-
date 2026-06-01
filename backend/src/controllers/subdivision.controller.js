const { Subdivision } = require('../models');

const getSubdivisions = async (req, res) => {
  try {
    const subdivisions = await Subdivision.findAll();
    res.json(subdivisions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createSubdivision = async (req, res) => {
  try {
    const newSubdiv = await Subdivision.create(req.body);
    res.status(201).json(newSubdiv);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const updateSubdivision = async (req, res) => {
  try {
    const subdiv = await Subdivision.findByPk(req.params.id);
    if (!subdiv) return res.status(404).json({ error: 'No encontrado' });
    await subdiv.update(req.body);
    res.json(subdiv);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const deleteSubdivision = async (req, res) => {
  try {
    const subdiv = await Subdivision.findByPk(req.params.id);
    if (!subdiv) return res.status(404).json({ error: 'No encontrado' });
    await subdiv.destroy();
    res.json({ message: 'Eliminado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  getSubdivisions,
  createSubdivision,
  updateSubdivision,
  deleteSubdivision
};
