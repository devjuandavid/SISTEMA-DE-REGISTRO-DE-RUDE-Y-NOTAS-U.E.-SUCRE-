const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

// 1. Inicializar Express
const app = express();
const PORT = process.env.PORT || 3000;

// 2. Importar Rutas Existentes
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const estudianteRoutes = require('./routes/estudianteRoutes');
const cursoRoutes = require('./routes/cursoRoutes');
const academicoRoutes = require('./routes/academicoRoutes');
const docenteRoutes = require('./routes/docenteRoutes');
const materiaRoutes = require('./routes/materiaRoutes');
const asistenciaRoutes = require('./routes/asistenciaRoutes'); // 👈 Registrado
const notaRoutes = require('./routes/notaRoutes');           // 👈 Registrado

// 3. Configuración del Motor de Plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 4. Middlewares Base
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 5. Configuración de Sesiones
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret_sucre',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false, maxAge: 8 * 60 * 60 * 1000 }
}));

// 6. Variables Globales para las Vistas
app.use((req, res, next) => {
  res.locals.user = req.session ? req.session.user : null;
  next();
});

// 7. Redirección Raíz
app.get('/', (req, res) => res.redirect('/login'));

// 8. Declaración de Rutas
app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/estudiantes', estudianteRoutes);
app.use('/cursos', cursoRoutes); 
app.use('/academico', academicoRoutes);
app.use('/docentes', docenteRoutes);
app.use('/materias', materiaRoutes);
app.use('/asistencia', asistenciaRoutes); // 👈 Habilitado /asistencia
app.use('/notas', notaRoutes);           // 👈 Habilitado /notas

// ALIAS / REDIRECCIÓN DIRECTA PARA INSCRIPCIONES
app.get('/inscripciones', (req, res) => res.redirect('/estudiantes/inscripciones'));

// 9. Manejo de Error 404 (Siempre debe ser la última ruta)
app.use((req, res) => res.status(404).render('404', { title: 'Página no encontrada' }));

// 10. Iniciar Servidor
app.listen(PORT, () => console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`));