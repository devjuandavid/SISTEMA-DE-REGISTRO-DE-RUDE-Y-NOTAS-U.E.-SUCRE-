const express = require('express');
const router = express.Router();
const materiaController = require('../controllers/materiaController');

router.get('/', materiaController.getMaterias);
router.post('/crear', materiaController.crearMateria);

module.exports = router;