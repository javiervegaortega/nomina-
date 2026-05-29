const express = require('express');
const router = express.Router();
const companyController = require('../controllers/company.controller');
const authenticateToken = require('../middlewares/auth.middleware');

router.get('/', companyController.getCompanies);
router.post('/', authenticateToken, companyController.createCompany);
router.put('/:id', authenticateToken, companyController.updateCompany);
router.delete('/:id', authenticateToken, companyController.deleteCompany);

module.exports = router;
