const express = require('express');
const nestedRouter = express.Router({ mergeParams: true });
const flatRouter = express.Router();
const authenticateToken = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/employeeRecord.controller');

// /api/employees/:employeeId/records
nestedRouter.get('/', ctrl.getByEmployee);
nestedRouter.post('/', authenticateToken, ctrl.create);

// /api/employee-records/:id
flatRouter.put('/:id', authenticateToken, ctrl.update);
flatRouter.delete('/:id', authenticateToken, ctrl.remove);

module.exports = { nestedRouter, flatRouter };
