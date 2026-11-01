const db = require('../config/db');

// Vista principal de asistencia
exports.getAsistencia = async (req, res) => {
  try {
    const { rows: cursos } = await db.query('SELECT * FROM cursos ORDER BY nombre ASC');
    res.render('asistencia/index', { 
      title: 'Control de Asistencia', 
      cursos, 
      estudiantes: [], 
      cursoId: null, 
      fecha: new Date().toISOString().split('T')[0] 
    });
  } catch (error) {
    console.error('❌ Error en getAsistencia:', error);
    res.status(500).send(`Error al cargar asistencia: ${error.message}`);
  }
};

// Cargar alumnos por curso para tomar lista
exports.buscarEstudiantes = async (req, res) => {
  const { curso_id, fecha } = req.query;
  try {
    const { rows: cursos } = await db.query('SELECT * FROM cursos ORDER BY nombre ASC');
    const { rows: estudiantes } = await db.query(`
      SELECT e.id, e.nombre, e.apellido 
      FROM estudiantes e
      JOIN inscripciones i ON e.id = i.estudiante_id
      WHERE i.curso_id = $1
      ORDER BY e.apellido ASC
    `, [curso_id]);

    res.render('asistencia/index', { 
      title: 'Control de Asistencia', 
      cursos, 
      estudiantes, 
      cursoId: curso_id, 
      fecha: fecha || new Date().toISOString().split('T')[0] 
    });
  } catch (error) {
    console.error('❌ Error al buscar estudiantes:', error);
    res.status(500).send(`Error al filtrar curso: ${error.message}`);
  }
};