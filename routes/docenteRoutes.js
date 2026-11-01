const express = require('express');
const router = express.Router();
const docenteController = require('../controllers/docenteController');

router.get('/', docenteController.getDocentes);
router.get('/nuevo', docenteController.getNuevoDocente);
router.post('/nuevo', docenteController.crearDocente);

module.exports = router;