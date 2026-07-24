const { Commission, sequelize } = require('../models');
const {
  syncCommissionTransition
} = require('../services/payrollDraftInputs.service');

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
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const data = req.body;
    const newCommission = await Commission.create(data, { transaction });
    await syncCommissionTransition({
      current: newCommission,
      transaction
    });
    await transaction.commit();
    res.status(201).json(newCommission);
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    console.error('Error creating commission:', error);
    res.status(500).json({ error: 'Failed to create commission' });
  }
};

exports.delete = async (req, res) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { id } = req.params;
    const commission = await Commission.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!commission) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Commission not found' });
    }
    await syncCommissionTransition({
      previous: commission,
      transaction
    });
    await commission.destroy({ transaction });
    await transaction.commit();
    res.json({ message: 'Commission deleted' });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    console.error('Error deleting commission:', error);
    res.status(500).json({ error: 'Failed to delete commission' });
  }
};

exports.update = async (req, res) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { id } = req.params;
    const commission = await Commission.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!commission) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Commission not found' });
    }
    const previous = commission.toJSON();
    await commission.update(req.body, { transaction });
    await syncCommissionTransition({
      previous,
      current: commission,
      transaction
    });
    await transaction.commit();
    const updated = await Commission.findByPk(id);
    res.json(updated);
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    console.error('Error updating commission:', error);
    res.status(500).json({ error: 'Failed to update commission' });
  }
};
