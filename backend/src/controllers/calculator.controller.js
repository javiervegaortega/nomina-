const { calculatePayrollBatch } = require('../services/payrollCalculator.service');

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

module.exports = {
  previewCalculation
};
