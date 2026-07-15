const { BillingRule, BillingDistribution, Company } = require('../models');
const BillingService = require('../services/billing.service');

const validateRuleBody = async (body, ruleId = null) => {
  const fromCompanyId = Number(body.fromCompanyId);
  const toCompanyId = Number(body.toCompanyId);

  if (!fromCompanyId || !toCompanyId) {
    throw new Error('fromCompanyId y toCompanyId son requeridos');
  }
  if (fromCompanyId === toCompanyId) {
    throw new Error('La empresa emisora y receptora deben ser distintas');
  }

  const fromCo = await Company.findByPk(fromCompanyId);
  const toCo = await Company.findByPk(toCompanyId);
  if (!fromCo || !toCo) {
    throw new Error('Una o ambas empresas no existen');
  }

  return {
    fromCompanyId,
    toCompanyId,
    fromCompany: fromCo.nombre_comercial,
    toCompany: toCo.nombre_comercial,
    concept: body.concept || 'Servicios de RRHH',
    marginPercentage: body.marginPercentage ?? 0,
    applyIva: body.applyIva !== undefined ? !!body.applyIva : true,
    ivaRate: body.ivaRate ?? 0.12,
    isActive: body.isActive !== undefined ? !!body.isActive : true
  };
};

class BillingController {
  static async getRules(req, res) {
    try {
      const rules = await BillingRule.findAll({
        include: [
          { model: Company, as: 'fromCompanyData' },
          { model: Company, as: 'toCompanyData' }
        ],
        order: [['id', 'ASC']]
      });
      res.json(rules);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async createRule(req, res) {
    try {
      const payload = await validateRuleBody(req.body);
      const rule = await BillingRule.create(payload);
      res.status(201).json(rule);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async updateRule(req, res) {
    try {
      const rule = await BillingRule.findByPk(req.params.id);
      if (!rule) return res.status(404).json({ error: 'Regla no encontrada' });
      const payload = await validateRuleBody(req.body, rule.id);
      await rule.update(payload);
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

  static async preview(req, res) {
    try {
      const payrollId = req.body.payrollId || req.params.payrollId;
      if (!payrollId) {
        return res.status(400).json({ error: 'payrollId es requerido' });
      }
      const result = await BillingService.buildPreview(payrollId);
      res.json({
        ...result,
        distributions: result.lines.map((line) => ({
          fromCompany: line.fromCompany,
          toCompany: line.toCompany,
          concept: line.concept,
          baseAmount: line.baseAmount,
          marginPercentage: line.marginPercentage,
          marginAmount: line.marginAmount,
          ivaAmount: line.ivaAmount,
          totalAmount: line.totalAmount
        }))
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async confirmRun(req, res) {
    try {
      const { payrollId, notes } = req.body;
      if (!payrollId) {
        return res.status(400).json({ error: 'payrollId es requerido' });
      }
      const run = await BillingService.confirmRun(payrollId, req.user?.id, notes);
      res.status(201).json(run);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async getRuns(req, res) {
    try {
      const runs = await BillingService.getRuns();
      res.json(runs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async getRunById(req, res) {
    try {
      const run = await BillingService.getRunById(req.params.id);
      if (!run) return res.status(404).json({ error: 'Ejecución no encontrada' });
      res.json(run);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // --- Compatibilidad con endpoints anteriores ---

  static async calculate(req, res) {
    return BillingController.preview(req, res);
  }

  static async saveDistribution(req, res) {
    try {
      const { period, payrollId, notes } = req.body;
      const id = payrollId || period;
      if (!id) {
        return res.status(400).json({ error: 'payrollId o period es requerido' });
      }
      const run = await BillingService.confirmRun(id, req.user?.id, notes);
      res.status(201).json({ message: 'Distribución guardada correctamente', run });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async getHistory(req, res) {
    try {
      const { period } = req.query;
      if (period) {
        const runs = await BillingService.getRuns();
        const filtered = runs.filter((r) => r.payrollId === period);
        if (filtered.length > 0) {
          return res.json(filtered);
        }
        const legacy = await BillingDistribution.findAll({
          where: { period },
          order: [['createdAt', 'DESC']]
        });
        return res.json(legacy);
      }
      const runs = await BillingService.getRuns();
      res.json(runs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = BillingController;
