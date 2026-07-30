const express = require('express');
const router = express.Router();
const operationLogController = require('../controllers/operationLog.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/', operationLogController.getAll);
router.post('/', operationLogController.create);
router.post('/notify', operationLogController.notifyManager);
router.put('/:id/correct-and-resubmit', operationLogController.correctAndResubmit);
router.put('/:id', operationLogController.update);
router.put('/:id/status', operationLogController.updateStatus);
router.delete('/:id', operationLogController.remove);

module.exports = router;
