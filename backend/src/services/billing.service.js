const { PayrollHistory, BillingRule, BillingDistribution, Company } = require('../models');

class BillingService {
  /**
   * Calculates the billing distribution for a given payroll period.
   * @param {string} payrollId - ID of the PayrollHistory record
   */
  static async calculateDistribution(payrollId) {
    const payroll = await PayrollHistory.findByPk(payrollId);
    if (!payroll) {
      throw new Error('Nómina no encontrada');
    }

    const employees = typeof payroll.data === 'string' ? JSON.parse(payroll.data) : (payroll.data || []);
    
    // 1. Fetch all companies to map IDs to Names
    const companies = await Company.findAll();
    const companyMap = {};
    companies.forEach(c => {
      companyMap[c.id] = c.nombre_comercial;
    });

    // 2. Aggregate gross cost using the 'dist' distribution field
    const intercompanyCosts = {};

    employees.forEach(e => {
      const payingCompId = e.empresa_principal || e.companyId || e.id_empresa || (e.companyData && e.companyData.id);
      const payingCompName = companyMap[payingCompId] || 'DESCONOCIDA';
      
      if (!intercompanyCosts[payingCompName]) {
        intercompanyCosts[payingCompName] = {};
      }

      let totalCost = 0;
      if (e.calculated) {
        // En una empresa real, el costo empresa es Gross + Patronal (y a veces provisones)
        // Por simplificación usaremos lo que define el excel, usualmente es Gross + Patronal
        totalCost = (e.calculated.gross || 0) + (e.calculated.igss_patronal || 0);
      } else {
        const baseFactor = (e.days || 30) / 30;
        const sueldoOrd = Number(e.sueldo_ordinario) || 0;
        const bonInc = Number(e.bon_incentivo) || 0;
        const bonDec = Number(e.bon_dec_37_2001) || 0;
        const bonos = Number(e.extras?.bonos) || 0;
        const extrasTotal = (e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0) + (e.extras?.comisiones || 0) + (e.extras?.otrosIngresos || 0);
        const bonusesSum = Object.values(e.appliedBonuses || {}).reduce((a, b) => a + b, 0);
        const gross = (sueldoOrd * baseFactor) + (bonInc * baseFactor) + (bonDec * baseFactor) + bonos + extrasTotal + bonusesSum;
        const igssPatronal = (sueldoOrd * baseFactor + extrasTotal) * 0.1067;
        totalCost = gross + igssPatronal;
      }

      // Check distribution percentages
      let distObj = {};
      try {
        if (e.dist) distObj = typeof e.dist === 'string' ? JSON.parse(e.dist) : e.dist;
      } catch (err) {}

      const distKeys = Object.keys(distObj);
      if (distKeys.length > 0) {
        distKeys.forEach(targetId => {
          const targetCompName = companyMap[targetId] || 'DESCONOCIDA';
          const percentage = Number(distObj[targetId]) || 0;
          const splitCost = totalCost * (percentage / 100);
          
          if (!intercompanyCosts[payingCompName][targetCompName]) {
            intercompanyCosts[payingCompName][targetCompName] = 0;
          }
          intercompanyCosts[payingCompName][targetCompName] += splitCost;
        });
      } else {
        // If no dist, 100% belongs to the paying company itself
        if (!intercompanyCosts[payingCompName][payingCompName]) {
          intercompanyCosts[payingCompName][payingCompName] = 0;
        }
        intercompanyCosts[payingCompName][payingCompName] += totalCost;
      }
    });

    // 3. Apply Billing Rules
    const activeRules = await BillingRule.findAll({ where: { isActive: true } });
    const results = [];

    activeRules.forEach(rule => {
      const payingComp = rule.fromCompany;
      const targetComp = rule.toCompany;

      const baseAmount = intercompanyCosts[payingComp] && intercompanyCosts[payingComp][targetComp]
                         ? intercompanyCosts[payingComp][targetComp]
                         : 0;
      
      if (baseAmount > 0) {
        const marginPerc = Number(rule.marginPercentage) || 0;
        const marginAmount = baseAmount * (marginPerc / 100);
        const subtotal = baseAmount + marginAmount;
        
        let ivaAmount = 0;
        if (rule.applyIva) {
          ivaAmount = subtotal * 0.12; // 12% IVA for Guatemala
        }
        
        const totalAmount = subtotal + ivaAmount;

        results.push({
          ruleId: rule.id,
          fromCompany: rule.fromCompany,
          toCompany: rule.toCompany,
          concept: rule.concept || `Servicios de RRHH ${payroll.title}`,
          baseAmount: Number(baseAmount.toFixed(4)),
          marginPercentage: marginPerc,
          marginAmount: Number(marginAmount.toFixed(4)),
          ivaAmount: Number(ivaAmount.toFixed(4)),
          totalAmount: Number(totalAmount.toFixed(4))
        });
      }
    });

    return {
      payrollTitle: payroll.title,
      period: payroll.id,
      companyCosts: intercompanyCosts,
      distributions: results
    };
  }
}

module.exports = BillingService;
