const express = require('express');
const router = express.Router();
router.get('/', (req, res) => res.send('Módulo de Asistencia listo'));
module.exports = router;