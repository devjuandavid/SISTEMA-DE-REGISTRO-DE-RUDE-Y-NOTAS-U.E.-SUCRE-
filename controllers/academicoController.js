const db = require('../config/db');
const { generarBoletinExcelCompleto } = require('../services/excelService');

// ==========================================
// VISTAS PRINCIPALES Y ASIGNACIONES
// ==========================================

exports.verCursoDetalle = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Obtener información del curso
    const cursoRes = await db.query('SELECT * FROM cursos WHERE id = $1', [id]);
    if (cursoRes.rows.length === 0) {
      return res.status(404).send('El curso no existe.');
    }
    const curso = cursoRes.rows[0];

    // 2. Obtener materias asignadas al curso
    const asignacionesQuery = `
      SELECT 
        cmd.id AS asignacion_id,
        m.campo,
        m.nombre AS materia_nombre,
        COALESCE(CONCAT_WS(' ', u.nombre, u.apellido), 'Sin Asignar') AS docente_nombre
      FROM curso_materia_docente cmd
      INNER JOIN materias m ON cmd.materia_id = m.id
      LEFT JOIN usuarios u ON cmd.docente_id = u.id
      WHERE cmd.curso_id = $1
    `;
    const { rows: asignaciones } = await db.query(asignacionesQuery, [id]);

    // 3. Obtener catálogo completo de materias
    const { rows: materias } = await db.query('SELECT * FROM materias ORDER BY nombre ASC');

    // 4. Obtener docentes registrados
    const { rows: docentes } = await db.query(`
      SELECT 
        id, 
        CONCAT_WS(' ', nombre, apellido) AS nombre 
      FROM usuarios 
      WHERE UPPER(rol) IN ('DOCENTE', 'ADMIN', 'PROFESOR') AND activo = true
      ORDER BY apellido ASC
    `);

    res.render('cursos/detalle', {
      title: `Asignación - ${curso.grado}° "${curso.paralelo}"`,
      curso,
      asignaciones,
      materias,
      docentes
    });

  } catch (error) {
    console.error('❌ Error detectado:', error);
    res.status(500).send(`Error en la base de datos: ${error.message}`);
  }
};

exports.asignarMateria = async (req, res) => {
  try {
    const { curso_id, materia_id, docente_id, gestion } = req.body;

    await db.query(
      `INSERT INTO curso_materia_docente (curso_id, materia_id, docente_id, gestion)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (curso_id, materia_id, gestion) 
       DO UPDATE SET docente_id = EXCLUDED.docente_id`,
      [curso_id, materia_id, docente_id || null, gestion || 2026]
    );

    res.redirect(`/cursos/${curso_id}`);
  } catch (error) {
    console.error('❌ Error en asignarMateria:', error);
    res.status(500).send(`Error al guardar la asignación: ${error.message}`);
  }
};

// ==========================================
// FUNCIONES AGREGADAS PARA EVITAR ERROR 404/UNDEFINED
// ==========================================

// Vista de Docentes (Requerida por academicoRoutes.js)
exports.getDocentes = async (req, res) => {
  try {
    const { rows: docentes } = await db.query(`
      SELECT id, nombre, apellido, email, celular 
      FROM usuarios 
      WHERE UPPER(rol) IN ('DOCENTE', 'PROFESOR') AND activo = true
      ORDER BY apellido ASC
    `);
    res.render('academico/docentes', { title: 'Gestión de Docentes', docentes });
  } catch (error) {
    console.error('❌ Error en getDocentes:', error);
    res.status(500).send(`Error al obtener docentes: ${error.message}`);
  }
};

// Vista de Materias (Requerida por academicoRoutes.js)
exports.getMaterias = async (req, res) => {
  try {
    const { rows: materias } = await db.query('SELECT * FROM materias ORDER BY nombre ASC');
    res.render('academico/materias', { title: 'Gestión de Materias', materias });
  } catch (error) {
    console.error('❌ Error en getMaterias:', error);
    res.status(500).send(`Error al obtener materias: ${error.message}`);
  }
};

// Vista para el control de asistencia
exports.getAsistencia = async (req, res) => {
  try {
    const { rows: cursos } = await db.query('SELECT * FROM cursos ORDER BY grado, paralelo ASC');
    res.render('asistencia/index', { title: 'Control de Asistencia', cursos });
  } catch (error) {
    console.error('❌ Error en getAsistencia:', error);
    res.status(500).send(`Error al cargar la asistencia: ${error.message}`);
  }
};

// Generar y descargar el Boletín de Notas en Excel
exports.descargarBoletinExcel = async (req, res) => {
  const { estudianteId } = req.params;

  try {
    // 1. Obtener listado de materias
    const materiasRes = await db.query('SELECT id, nombre AS nombre_materia FROM materias ORDER BY id ASC');
    
    // 2. Obtener historial de asistencia
    const asistenciaRes = await db.query(`
      SELECT a.fecha, a.estado, m.nombre AS nombre_materia 
      FROM asistencia a
      LEFT JOIN materias m ON a.materia_id = m.id
      WHERE a.estudiante_id = $1
      ORDER BY a.fecha DESC
    `, [estudianteId]);

    // 3. Obtener notas de trimestres
    const notasRes = await db.query(`
      SELECT n.materia_id, m.nombre AS nombre_materia, n.trimestre, 
             n.ser, n.saber, n.hacer, n.decidir, n.autoeval, n.nota_final
      FROM notas n
      JOIN materias m ON n.materia_id = m.id
      WHERE n.estudiante_id = $1
    `, [estudianteId]);

    const dataAcademic = {
      materias: materiasRes.rows,
      asistencia: asistenciaRes.rows,
      notas: notasRes.rows
    };

    // Llamada al servicio excelService
    const buffer = await generarBoletinExcelCompleto(dataAcademic);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Boletin_Notas_${estudianteId}.xlsx`);

    return res.send(buffer);

  } catch (error) {
    console.error('❌ Error al generar boletín Excel:', error);
    res.status(500).send(`Error interno al generar el archivo Excel: ${error.message}`);
  }
};