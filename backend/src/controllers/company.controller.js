const { Company } = require('../models');

const getCompanies = async (req, res) => {
  try {
    const companies = await Company.findAll();
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createCompany = async (req, res) => {
  try {
    const newCompany = await Company.create(req.body);
    res.status(201).json(newCompany);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const updateCompany = async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) return res.status(404).json({ error: 'No encontrado' });
    await company.update(req.body);
    res.json(company);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const deleteCompany = async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) return res.status(404).json({ error: 'No encontrado' });
    await company.destroy();
    res.json({ message: 'Eliminado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany
};
