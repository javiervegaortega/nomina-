const express = require('express');
const authenticateToken = require('../middlewares/auth.middleware');
const {
  getDashboardSummary,
  getDashboardExportData
} = require('../controllers/dashboard.controller');

const router = express.Router();
router.get('/summary', authenticateToken, getDashboardSummary);
router.get('/export-data', authenticateToken, getDashboardExportData);

module.exports = router;
