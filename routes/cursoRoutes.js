const express = require('express');
const router = express.Router();

const cursoController = require('../controllers/cursoController');
const academicoController = require('../controllers/academicoController');

// Middleware para verificar sesión activa
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login');
};

// 1. Rutas principales de Cursos
router.get('/', isAuthenticated, cursoController.listarCursos);
router.post('/nuevo', isAuthenticated, cursoController.guardarCurso);

// 2. Rutas para Asignación de Materias y Docentes
// IMPORTANTE: /asignar-materia va ANTES de /:id para que Express no confunda la palabra con un ID
router.post('/asignar-materia', isAuthenticated, academicoController.asignarMateria);
router.get('/:id', isAuthenticated, academicoController.verCursoDetalle);

module.exports = router;