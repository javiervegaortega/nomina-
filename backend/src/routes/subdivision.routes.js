const express = require('express');
const router = express.Router();
const subdivisionController = require('../controllers/subdivision.controller');
const authenticateToken = require('../middlewares/auth.middleware');

router.get('/', subdivisionController.getSubdivisions);
router.post('/', authenticateToken, subdivisionController.createSubdivision);
router.put('/:id', authenticateToken, subdivisionController.updateSubdivision);
router.delete('/:id', authenticateToken, subdivisionController.deleteSubdivision);

module.exports = router;
