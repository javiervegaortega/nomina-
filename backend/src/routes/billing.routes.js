const express = require('express');
const router = express.Router();
const BillingController = require('../controllers/billing.controller');
const authenticateToken = require('../middlewares/auth.middleware');

router.use(authenticateToken);

// Configuración de reglas
router.get('/rules', BillingController.getRules);
router.post('/rules', BillingController.createRule);
router.put('/rules/:id', BillingController.updateRule);
router.delete('/rules/:id', BillingController.deleteRule);

// Distribución / Cálculos
router.get('/calculate/:payrollId', BillingController.calculate);
router.post('/save', BillingController.saveDistribution);
router.get('/history', BillingController.getHistory);

module.exports = router;
