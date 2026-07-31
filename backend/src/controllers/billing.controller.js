const {
  BillingRule,
  BillingDistribution,
  BillingRun,
  BillingRunLine,
  Company,
  sequelize
} = require('../models');
const BillingService = require('../services/billing.service');
const { getPagination, toPagedResponse, wantsPagination } = require('../utils/pagination');

const EXCEL_ROUTE_FORMULAS = {
  '1->2': { marginPercentage: 0, applyIva: true, ivaRate: 0.12, baseAdjustment: 0 },
  '1->3': { marginPercentage: 0, applyIva: true, ivaRate: 0.12, baseAdjustment: 0 },
  '2->1': { marginPercentage: 0, applyIva: true, ivaRate: 0.12, baseAdjustment: 0 },
  '2->3': { marginPercentage: 0, applyIva: true, ivaRate: 0.12, baseAdjustment: 0 },
  '3->1': { marginPercentage: 4, applyIva: true, ivaRate: 0.12, baseAdjustment: 0 },
  '3->2': { marginPercentage: 4, applyIva: true, ivaRate: 0.12, baseAdjustment: 0 },
  '3->4': { marginPercentage: 4, applyIva: false, ivaRate: 0, baseAdjustment: 0 }
};

const validateRuleBody = async (body, ruleId = null) => {
  const fromCompanyId = Number(body.fromCompanyId);
  const toCompanyId = Number(body.toCompanyId);

  if (!fromCompanyId || !toCompanyId) {
    throw new Error('fromCompanyId y toCompanyId son requeridos');
  }
  if (fromCompanyId === toCompanyId) {
    throw new Error('La empresa emisora y receptora deben ser distintas');
  }
  if (!BillingService.isAllowedBillingRoute(fromCompanyId, toCompanyId)) {
    throw new Error('La relación emisora → receptora no está habilitada según los Excel de facturación');
  }
  const routeFormula = EXCEL_ROUTE_FORMULAS[`${fromCompanyId}->${toCompanyId}`];

  const duplicate = await BillingRule.findOne({
    where: { fromCompanyId, toCompanyId }
  });
  if (duplicate && String(duplicate.id) !== String(ruleId || '')) {
    throw new Error('Ya existe una regla para esa relación entre empresas');
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
    // Margen e IVA son parte de la fórmula conciliada, no parámetros libres.
    marginPercentage: routeFormula.marginPercentage,
    applyIva: routeFormula.applyIva,
    ivaRate: routeFormula.ivaRate,
    // La base siempre se calcula desde el detalle distribuido.
    baseAdjustment: routeFormula.baseAdjustment || 0,
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
      await rule.update({ isActive: false });
      res.json({ message: 'Regla desactivada' });
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
          subtotalAmount: line.subtotalAmount,
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
      const summaryOnly = req.query.summary === '1' || req.query.summary === 'true';
      if (summaryOnly) {
        const paged = wantsPagination(req.query);
        const pagination = paged ? getPagination(req.query) : null;
        const query = {
          attributes: { exclude: ['costMatrixJson'] },
          order: [['createdAt', 'DESC']],
          ...(pagination ? { limit: pagination.limit, offset: pagination.offset } : {})
        };
        const result = paged
          ? await BillingRun.findAndCountAll(query)
          : { rows: await BillingRun.findAll(query), count: null };
        const ids = result.rows.map((run) => run.id);
        const totals = ids.length
          ? await BillingRunLine.findAll({
              where: { runId: ids },
              attributes: [
                'runId',
                [sequelize.fn('COUNT', sequelize.col('id')), 'linesCount'],
                [sequelize.fn('SUM', sequelize.col('totalAmount')), 'totalAmount']
              ],
              group: ['runId'],
              raw: true
            })
          : [];
        const totalsById = new Map(totals.map((row) => [String(row.runId), row]));
        const rows = result.rows.map((run) => {
          const value = run.toJSON();
          const aggregate = totalsById.get(String(run.id)) || {};
          return {
            ...value,
            linesCount: Number(aggregate.linesCount) || 0,
            totalAmount: Number(aggregate.totalAmount) || 0
          };
        });
        return res.json(paged
          ? toPagedResponse(rows, result.count, pagination.page, pagination.pageSize)
          : rows);
      }
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
