const { Dimension5 } = require('../models');

// Obtener todas las dimensiones 5
const getAllDimension5 = async (req, res) => {
  try {
    const records = await Dimension5.findAll();
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener una dimension 5 por ID
const getDimension5ById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Dimension5.findByPk(id);
    if (!record) {
      return res.status(404).json({ error: 'Dimensión 5 no encontrada' });
    }
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear dimension 5
const createDimension5 = async (req, res) => {
  try {
    const { nombre, id_estado } = req.body;
    const newRecord = await Dimension5.create({ nombre, id_estado });
    res.status(201).json(newRecord);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar dimension 5
const updateDimension5 = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, id_estado } = req.body;

    const record = await Dimension5.findByPk(id);
    if (!record) {
      return res.status(404).json({ error: 'Dimensión 5 no encontrada' });
    }

    await record.update({ nombre, id_estado });
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Eliminar dimension 5
const deleteDimension5 = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Dimension5.findByPk(id);
    if (!record) {
      return res.status(404).json({ error: 'Dimensión 5 no encontrada' });
    }

    await record.destroy();
    res.json({ message: 'Dimensión 5 eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAllDimension5,
  getDimension5ById,
  createDimension5,
  updateDimension5,
  deleteDimension5
};
