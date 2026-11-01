const db = require('../config/db');

// Listar materias
exports.getMaterias = async (req, res) => {
  try {
    const { rows: materias } = await db.query(`
      SELECT * FROM materias ORDER BY nombre ASC
    `);
    res.render('materias/index', { title: 'Gestión de Materias', materias });
  } catch (error) {
    console.error('❌ Error en getMaterias:', error);
    res.status(500).send(`Error al obtener materias: ${error.message}`);
  }
};

// Crear nueva materia
exports.crearMateria = async (req, res) => {
  const { nombre, codigo } = req.body;
  try {
    await db.query(`
      INSERT INTO materias (nombre, codigo) VALUES ($1, $2)
    `, [nombre, codigo]);
    res.redirect('/materias');
  } catch (error) {
    console.error('❌ Error al crear materia:', error);
    res.status(500).send(`Error al guardar materia: ${error.message}`);
  }
};