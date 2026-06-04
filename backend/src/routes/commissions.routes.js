const express = require('express');
const router = express.Router();
const commissionsController = require('../controllers/commissions.controller');

router.get('/', commissionsController.getAll);
router.post('/', commissionsController.create);
router.put('/:id', commissionsController.update);
router.delete('/:id', commissionsController.delete);

module.exports = router;
