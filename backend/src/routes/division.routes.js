const express = require('express');
const router = express.Router();
const divisionController = require('../controllers/division.controller');
const authenticateToken = require('../middlewares/auth.middleware');

router.get('/', divisionController.getDivisions);
router.post('/', authenticateToken, divisionController.createDivision);
router.put('/:id', authenticateToken, divisionController.updateDivision);
router.delete('/:id', authenticateToken, divisionController.deleteDivision);

module.exports = router;
