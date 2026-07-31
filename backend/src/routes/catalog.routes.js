const express = require('express');
const authenticateToken = require('../middlewares/auth.middleware');
const { getCatalogs } = require('../controllers/catalog.controller');

const router = express.Router();
router.get('/', authenticateToken, getCatalogs);

module.exports = router;
