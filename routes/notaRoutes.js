
const express = require('express');
const router = express.Router();

const notaController = require('../controllers/notaController');
const reporteNotasController =
  require('../controllers/reporteNotasController');
// Mostrar centralizador
router.get(
  '/',
  notaController.getNotas
);

// Obtener estudiantes del curso
router.get(
  '/estudiantes/:cursoId',
  notaController.getEstudiantesCurso
);

// Recuperar calificaciones
router.get(
  '/calificaciones',
  notaController.obtenerNotas
);

// Guardar calificaciones
router.post(
  '/calificaciones',
  express.json({ limit: '200kb' }),
  notaController.guardarNotas
);

// Resumen anual
router.get(
  '/resumen-anual',
  notaController.obtenerResumenAnual
);

// Descargar centralizador en Excel
router.get(
  '/exportar/excel',
  reporteNotasController.exportarExcel
);

// Descargar centralizador en PDF
router.get(
  '/exportar/pdf',
  reporteNotasController.exportarPDF
);

module.exports = router;
