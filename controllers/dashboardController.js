const db = require('../config/db');

exports.getDashboard = async (req, res) => {
  try {
    const gestionActual = 2026;

    // 1. Contadores base
    const estCount = await db.query('SELECT COUNT(*) FROM estudiantes');
    const inscCount = await db.query('SELECT COUNT(*) FROM inscripciones WHERE gestion = $1', [gestionActual]);
    const curCount = await db.query('SELECT COUNT(*) FROM cursos WHERE gestion = $1', [gestionActual]);

    // 2. Estudiantes inscritos agrupados por nivel
    const porNivelRes = await db.query(
      `SELECT c.nivel, COUNT(i.id) AS total
       FROM inscripciones i
       INNER JOIN cursos c ON i.curso_id = c.id
       WHERE i.gestion = $1
       GROUP BY c.nivel`,
      [gestionActual]
    );

    // 3. Últimos 5 estudiantes inscritos
    const ultimosInscritosRes = await db.query(
      `SELECT 
        e.id,
        CONCAT_WS(' ', e.nombres, e.primer_apellido, e.segundo_apellido) AS nombre_completo,
        CONCAT_WS(' ', c.grado || '°', c.paralelo, '-', c.nivel) AS curso,
        i.created_at
       FROM inscripciones i
       INNER JOIN estudiantes e ON i.estudiante_id = e.id
       INNER JOIN cursos c ON i.curso_id = c.id
       WHERE i.gestion = $1
       ORDER BY i.id DESC
       LIMIT 5`,
      [gestionActual]
    );

    res.render('dashboard/index', {
      title: 'Panel Principal',
      stats: {
        totalEstudiantes: parseInt(estCount.rows[0].count),
        inscritosGestion: parseInt(inscCount.rows[0].count),
        totalCursos: parseInt(curCount.rows[0].count)
      },
      porNivel: porNivelRes.rows,
      ultimosInscritos: ultimosInscritosRes.rows,
      gestionActual
    });
  } catch (err) {
    console.error('❌ Error en getDashboard:', err);
    res.status(500).send('Error en el servidor');
  }
};