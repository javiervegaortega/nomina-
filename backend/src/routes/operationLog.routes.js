const express = require('express');
const router = express.Router();
const operationLogController = require('../controllers/operationLog.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/', operationLogController.getAll);
router.post('/', operationLogController.create);
router.put('/:id/status', operationLogController.updateStatus);
router.delete('/:id', operationLogController.remove);

module.exports = router;
