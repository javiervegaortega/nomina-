const express = require('express');
const router = express.Router();
const BillingController = require('../controllers/billing.controller');
const authenticateToken = require('../middlewares/auth.middleware');
const {
  requireBillingRead,
  requireBillingWrite
} = require('../middlewares/billingAccess.middleware');

router.use(authenticateToken);

// Reglas de facturación
router.get('/rules', requireBillingRead, BillingController.getRules);
router.post('/rules', requireBillingWrite, BillingController.createRule);
router.put('/rules/:id', requireBillingWrite, BillingController.updateRule);
router.delete('/rules/:id', requireBillingWrite, BillingController.deleteRule);

// Vista previa y ejecuciones
router.post('/preview', requireBillingRead, BillingController.preview);
router.post('/runs', requireBillingWrite, BillingController.confirmRun);
router.get('/runs', requireBillingRead, BillingController.getRuns);
router.get('/runs/:id', requireBillingRead, BillingController.getRunById);

// Endpoints legacy (alias)
router.get('/calculate/:payrollId', requireBillingRead, BillingController.calculate);
router.post('/save', requireBillingWrite, BillingController.saveDistribution);
router.get('/history', requireBillingRead, BillingController.getHistory);

module.exports = router;
