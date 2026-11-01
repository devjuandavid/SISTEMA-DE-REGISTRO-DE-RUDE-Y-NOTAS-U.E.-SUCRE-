const db = require('../config/db');

// Listar todos los cursos
exports.listarCursos = async (req, res) => {
  try {
    const cursosQuery = `
      SELECT 
        c.*, 
        COUNT(i.id) AS total_estudiantes
      FROM cursos c
      LEFT JOIN inscripciones i ON c.id = i.curso_id AND i.estado = 'CONFIRMADA'
      WHERE c.activo = true
      GROUP BY c.id
      ORDER BY c.nivel, c.grado, c.paralelo;
    `;
    const { rows: cursos } = await db.query(cursosQuery);

    res.render('cursos/index', {
      title: 'Gestión de Cursos y Paralelos',
      cursos
    });
  } catch (error) {
    console.error('❌ Error en listarCursos:', error);
    res.status(500).send('Error interno al obtener los cursos.');
  }
};

// Crear un nuevo curso/paralelo
exports.guardarCurso = async (req, res) => {
  try {
    const { nivel, grado, paralelo, turno, gestion, codigo_sie } = req.body;

    await db.query(
      `INSERT INTO cursos (nivel, grado, paralelo, turno, gestion, codigo_sie)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [nivel, parseInt(grado), paralelo.toUpperCase(), turno, parseInt(gestion) || new Date().getFullYear(), codigo_sie || '']
    );

    res.redirect('/cursos');
  } catch (error) {
    console.error('❌ Error en guardarCurso:', error);
    res.status(500).send('Error al registrar el curso. Verifica si ya existe la combinación.');
  }
};