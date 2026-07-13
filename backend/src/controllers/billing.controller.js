const { BillingRule, BillingDistribution, PayrollHistory } = require('../models');
const BillingService = require('../services/billing.service');

class BillingController {
  // Rules Configuration
  static async getRules(req, res) {
    try {
      const rules = await BillingRule.findAll();
      res.json(rules);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async createRule(req, res) {
    try {
      const rule = await BillingRule.create(req.body);
      res.status(201).json(rule);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async updateRule(req, res) {
    try {
      const rule = await BillingRule.findByPk(req.params.id);
      if (!rule) return res.status(404).json({ error: 'Regla no encontrada' });
      await rule.update(req.body);
      res.json(rule);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async deleteRule(req, res) {
    try {
      const rule = await BillingRule.findByPk(req.params.id);
      if (!rule) return res.status(404).json({ error: 'Regla no encontrada' });
      await rule.destroy();
      res.json({ message: 'Regla eliminada' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // Distribution Calculation
  static async calculate(req, res) {
    try {
      const { payrollId } = req.params;
      const result = await BillingService.calculateDistribution(payrollId);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async saveDistribution(req, res) {
    try {
      const { period, distributions } = req.body;
      if (!period || !distributions || !distributions.length) {
        return res.status(400).json({ error: 'Faltan datos de distribución' });
      }

      // Eliminar historial anterior para el mismo periodo si se recalcula
      await BillingDistribution.destroy({ where: { period } });

      const records = distributions.map(d => ({
        period,
        fromCompany: d.fromCompany,
        toCompany: d.toCompany,
        concept: d.concept,
        baseAmount: d.baseAmount,
        marginPercentage: d.marginPercentage,
        marginAmount: d.marginAmount,
        ivaAmount: d.ivaAmount,
        totalAmount: d.totalAmount
      }));

      await BillingDistribution.bulkCreate(records);
      res.status(201).json({ message: 'Distribución guardada correctamente' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async getHistory(req, res) {
    try {
      const { period } = req.query;
      const where = period ? { period } : {};
      const history = await BillingDistribution.findAll({ where, order: [['createdAt', 'DESC']] });
      res.json(history);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = BillingController;
