const {
  Company,
  Department,
  Area,
  Division,
  Subdivision,
  Dimension5,
  Bonus
} = require('../models');

const getCatalogs = async (_req, res) => {
  try {
    const [
      companies,
      departments,
      areas,
      divisions,
      subdivisions,
      dimension5s,
      bonuses
    ] = await Promise.all([
      Company.findAll(),
      Department.findAll(),
      Area.findAll(),
      Division.findAll(),
      Subdivision.findAll(),
      Dimension5.findAll(),
      Bonus.findAll({ order: [['name', 'ASC']] })
    ]);
    res.set('Cache-Control', 'private, no-cache');
    return res.json({
      companies,
      departments,
      areas,
      divisions,
      subdivisions,
      dimension5s,
      bonuses
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getCatalogs };
