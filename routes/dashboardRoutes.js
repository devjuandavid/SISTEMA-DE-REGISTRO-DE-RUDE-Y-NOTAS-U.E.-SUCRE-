const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// Middleware para verificar la sesión de usuario
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login');
};

// Ruta principal del Dashboard
router.get('/', isAuthenticated, dashboardController.getDashboard);

module.exports = router;