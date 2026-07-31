const express = require('express');
const authenticateToken = require('../middlewares/auth.middleware');
const { getPayrollInputs } = require('../controllers/payrollInput.controller');

const router = express.Router();
router.get('/', authenticateToken, getPayrollInputs);

module.exports = router;
