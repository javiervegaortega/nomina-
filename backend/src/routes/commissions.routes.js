const express = require('express');
const router = express.Router();
const commissionsController = require('../controllers/commissions.controller');
const authenticateToken = require('../middlewares/auth.middleware');

router.get('/', authenticateToken, commissionsController.getAll);
router.post('/', authenticateToken, commissionsController.create);
router.put('/:id', authenticateToken, commissionsController.update);
router.delete('/:id', authenticateToken, commissionsController.delete);

module.exports = router;
