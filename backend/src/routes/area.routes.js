const express = require('express');
const router = express.Router();
const areaController = require('../controllers/area.controller');
const authenticateToken = require('../middlewares/auth.middleware');

router.get('/', areaController.getAreas);
router.post('/', authenticateToken, areaController.createArea);
router.put('/:id', authenticateToken, areaController.updateArea);
router.delete('/:id', authenticateToken, areaController.deleteArea);

module.exports = router;
