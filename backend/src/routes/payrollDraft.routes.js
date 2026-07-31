const express = require('express');
const router = express.Router();
const payrollDraftController = require('../controllers/payrollDraft.controller');

const authenticateToken = require('../middlewares/auth.middleware');

router.get('/', authenticateToken, payrollDraftController.getAll);
router.get('/:id', authenticateToken, payrollDraftController.getById);
router.post('/', authenticateToken, payrollDraftController.create);
router.patch('/:id/employees/:employeeId', authenticateToken, payrollDraftController.patchEmployee);
router.patch('/:id', authenticateToken, payrollDraftController.patchMetadata);
router.put('/:id', authenticateToken, payrollDraftController.update);
router.delete('/:id', authenticateToken, payrollDraftController.remove);

module.exports = router;
