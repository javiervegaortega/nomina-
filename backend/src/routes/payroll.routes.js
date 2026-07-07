const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payroll.controller');
const authenticateToken = require('../middlewares/auth.middleware');

router.get('/', payrollController.getPayrolls);
router.post('/', authenticateToken, payrollController.createPayroll);
router.delete('/:id', authenticateToken, payrollController.deletePayroll);
router.post('/request-reactivation', authenticateToken, payrollController.requestReactivation);
router.post('/reactivate', authenticateToken, payrollController.reactivate);
router.get('/reactivate-via-get', payrollController.reactivateViaGet);

module.exports = router;
