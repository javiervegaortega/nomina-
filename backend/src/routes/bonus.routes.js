const express = require('express');
const router = express.Router();
const bonusController = require('../controllers/bonus.controller');
const authenticateToken = require('../middlewares/auth.middleware');

router.get('/', authenticateToken, bonusController.getAll);
router.post('/', authenticateToken, bonusController.create);
router.put('/:id', authenticateToken, bonusController.update);
router.delete('/:id', authenticateToken, bonusController.delete);

module.exports = router;
