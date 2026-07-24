const { calculatePayrollBatch } = require('../services/payrollCalculator.service');
const { calculateMonthlyISR } = require('../services/isr.service');

/**
 * Recibe un array de empleados con sus variables actuales y devuelve el mismo array 
 * con los cálculos exactos generados por el servidor.
 */
const previewCalculation = (req, res) => {
  try {
    const { employees, periodType } = req.body;
    
    if (!Array.isArray(employees)) {
      return res.status(400).json({ error: 'Se esperaba un arreglo de empleados.' });
    }

    const calculatedEmployees = calculatePayrollBatch(employees, periodType);
    
    res.json(calculatedEmployees);
  } catch (err) {
    console.error('Error in previewCalculation:', err);
    res.status(500).json({ error: 'Error al calcular la nómina: ' + err.message });
  }
};

/**
 * Preview ISR mensual (régimen asalariados GT).
 * Body: { baseMonthly, bonusMonthly?, laborIgssRate? }
 */
const previewIsr = (req, res) => {
  try {
    const baseMonthly = Number(req.body.baseMonthly) || 0;
    const bonusMonthly = req.body.bonusMonthly !== undefined ? Number(req.body.bonusMonthly) : 250;
    const laborIgssRate = req.body.laborIgssRate !== undefined
      ? Number(req.body.laborIgssRate)
      : undefined;
    const monthly = calculateMonthlyISR(baseMonthly, bonusMonthly, laborIgssRate);
    res.json({ monthlyIsr: monthly, baseMonthly, bonusMonthly, laborIgssRate });
  } catch (err) {
    console.error('Error in previewIsr:', err);
    res.status(500).json({ error: 'Error al calcular ISR: ' + err.message });
  }
};

module.exports = {
  previewCalculation,
  previewIsr
};
