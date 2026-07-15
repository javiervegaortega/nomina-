const express = require('express');
const router = express.Router();
const operationBatchController = require('../controllers/operationBatch.controller');
const authenticateToken = require('../middlewares/auth.middleware');

router.get('/', authenticateToken, operationBatchController.getAll);
router.get('/:id/email-preview', authenticateToken, operationBatchController.getEmailPreview);
router.post('/:id/notify', authenticateToken, operationBatchController.notifyBatch);
router.get('/:id', authenticateToken, operationBatchController.getById);
router.post('/', authenticateToken, operationBatchController.create);
router.patch('/:id/status', authenticateToken, operationBatchController.updateStatus);
router.delete('/:id', authenticateToken, operationBatchController.remove);

module.exports = router;
