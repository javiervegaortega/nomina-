const express = require('express');
const router = express.Router();
const sapController = require('../controllers/sap.controller');
const authenticateToken = require('../middlewares/auth.middleware');

// Protect routes
router.use(authenticateToken);

router.get('/status', sapController.checkSapConnection);
router.post('/sync-catalogs', sapController.syncSapCatalogs);

module.exports = router;
