const express = require('express');
const router = express.Router();
const { previewCalculation } = require('../controllers/calculator.controller');

router.post('/preview', previewCalculation);

module.exports = router;
