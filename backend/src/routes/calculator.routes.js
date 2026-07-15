const express = require('express');
const router = express.Router();
const { previewCalculation, previewIsr } = require('../controllers/calculator.controller');

router.post('/preview', previewCalculation);
router.post('/isr', previewIsr);

module.exports = router;
