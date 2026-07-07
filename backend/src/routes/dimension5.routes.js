const express = require('express');
const router = express.Router();
const dimension5Controller = require('../controllers/dimension5.controller');

// Rutas base: /api/dimension5
router.get('/', dimension5Controller.getAllDimension5);
router.get('/:id', dimension5Controller.getDimension5ById);
router.post('/', dimension5Controller.createDimension5);
router.put('/:id', dimension5Controller.updateDimension5);
router.delete('/:id', dimension5Controller.deleteDimension5);

module.exports = router;
