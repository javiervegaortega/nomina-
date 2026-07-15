const express = require('express');
const router = express.Router();
const BillingController = require('../controllers/billing.controller');
const authenticateToken = require('../middlewares/auth.middleware');

router.use(authenticateToken);

// Reglas de facturación
router.get('/rules', BillingController.getRules);
router.post('/rules', BillingController.createRule);
router.put('/rules/:id', BillingController.updateRule);
router.delete('/rules/:id', BillingController.deleteRule);

// Vista previa y ejecuciones
router.post('/preview', BillingController.preview);
router.post('/runs', BillingController.confirmRun);
router.get('/runs', BillingController.getRuns);
router.get('/runs/:id', BillingController.getRunById);

// Endpoints legacy (alias)
router.get('/calculate/:payrollId', BillingController.calculate);
router.post('/save', BillingController.saveDistribution);
router.get('/history', BillingController.getHistory);

module.exports = router;
