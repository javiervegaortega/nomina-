const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/department.controller');
const authenticateToken = require('../middlewares/auth.middleware');

router.get('/', departmentController.getDepartments);
router.post('/', authenticateToken, departmentController.createDepartment);
router.put('/:id', authenticateToken, departmentController.updateDepartment);
router.delete('/:id', authenticateToken, departmentController.deleteDepartment);

module.exports = router;
