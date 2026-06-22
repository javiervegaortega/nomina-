const express = require('express');
const router = express.Router();
const incidenceController = require('../controllers/incidence.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/', incidenceController.getAll);
router.get('/employee/:employeeId', incidenceController.getByEmployee);
router.post('/employee/:employeeId', incidenceController.create);
router.delete('/:id', incidenceController.remove);

module.exports = router;
