const express = require('express');
const router = express.Router();
const estudianteController = require('../controllers/estudianteController');

const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login');
};

// 1. Vista principal de estudiantes
router.get('/', isAuthenticated, estudianteController.listarEstudiantes);

// 2. Pestaña / Vista de inscripciones
router.get('/inscripciones', isAuthenticated, estudianteController.verInscripciones);

// 3. Guardar nuevo estudiante
router.post('/nuevo', isAuthenticated, estudianteController.guardarEstudiante);

// 4. Formulario RUDE extendido
router.get('/rude/:id', isAuthenticated, estudianteController.verRude);
router.post('/rude/:id', isAuthenticated, estudianteController.guardarRude);

// 5. Descargar PDF del RUDE
router.get('/rude/:id/pdf', isAuthenticated, estudianteController.descargarRudePDF);

module.exports = router;