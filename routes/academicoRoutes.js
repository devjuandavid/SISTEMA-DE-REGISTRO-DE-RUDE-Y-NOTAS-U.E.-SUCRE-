const express = require('express');
const router = express.Router();
const academicoController = require('../controllers/academicoController');

router.get('/docentes', academicoController.getDocentes);
router.get('/materias', academicoController.getMaterias);
router.get('/asistencia', academicoController.getAsistencia);
// Rutas de tu módulo académico
router.get('/curso/:id', academicoController.verCursoDetalle);
router.post('/asignar-materia', academicoController.asignarMateria);

// RUTA PARA LA DESCARGA DEL EXCEL
router.get('/boletin/excel/:estudianteId', academicoController.descargarBoletinExcel);

module.exports = router;