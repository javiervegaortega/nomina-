const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employee.controller');
const authenticateToken = require('../middlewares/auth.middleware');

router.get('/', employeeController.getEmployees);
router.post('/', authenticateToken, employeeController.createEmployee);
router.put('/:id', authenticateToken, employeeController.updateEmployee);
router.delete('/:id', authenticateToken, employeeController.deleteEmployee);

module.exports = router;
