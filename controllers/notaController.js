
const db = require('../config/db');

// =====================================================
// CONFIGURACIÓN PROVISIONAL DEL CENTRALIZADOR
// =====================================================
// Las cantidades de casillas deben cotejarse con
// el Excel original antes de utilizar notas oficiales.

const CONFIG = {
  asistencia: 12,
  ser: 5,
  saber: 8,
  hacer: 8,
  autoevaluacion: 1
};

const MAXIMOS = {
  ser: 10,
  saber: 45,
  hacer: 40,
  autoevaluacion: 5
};

function enteroPositivo(valor) {
  return Number.isInteger(valor) && valor > 0;
}

function validarDetalles(detalles) {
  if (!Array.isArray(detalles)) return false;

  const posiciones = new Set();

  return detalles.every(detalle => {
    if (!detalle || typeof detalle !== 'object') {
      return false;
    }

    const { dimension, numero, valor } = detalle;

    if (!Object.prototype.hasOwnProperty.call(CONFIG, dimension)) {
      return false;
    }

    if (dimension === 'asistencia') {
      return false;
    }

    if (
      !enteroPositivo(numero) ||
      numero > CONFIG[dimension]
    ) {
      return false;
    }

    if (
      typeof valor !== 'number' ||
      !Number.isInteger(valor) ||
      valor < 0 ||
      valor > MAXIMOS[dimension]
    ) {
      return false;
    }

    const clave = `${dimension}:${numero}`;

    if (posiciones.has(clave)) {
      return false;
    }

    posiciones.add(clave);

    return true;
  });
}

function validarAsistencias(asistencias) {
  if (!Array.isArray(asistencias)) return false;

  const posiciones = new Set();

  return asistencias.every(asistencia => {
    if (!asistencia || typeof asistencia !== 'object') {
      return false;
    }

    const { numero, valor } = asistencia;

    if (
      !enteroPositivo(numero) ||
      numero > CONFIG.asistencia
    ) {
      return false;
    }

    if (!['A', 'F', 'R', 'L'].includes(valor)) {
      return false;
    }

    if (posiciones.has(numero)) {
      return false;
    }

    posiciones.add(numero);

    return true;
  });
}

// =====================================================
// 1. MOSTRAR CENTRALIZADOR
// =====================================================

exports.getNotas = async (req, res) => {
  try {
    const { rows: cursos } = await db.query(`
      SELECT
        *,
        CONCAT(
          nivel,
          ' - ',
          grado,
          '° ',
          paralelo
        ) AS nombre
      FROM cursos
      ORDER BY
        nivel ASC,
        grado ASC,
        paralelo ASC
    `);

    const { rows: materias } = await db.query(`
      SELECT *
      FROM materias
      ORDER BY nombre ASC
    `);

    res.render('notas/index', {
      title: 'Registro de Calificaciones',
      cursos,
      materias
    });

  } catch (error) {
    console.error('Error en getNotas:', error);

    res.status(500).send(
      'Error al cargar el módulo de notas'
    );
  }
};

// =====================================================
// 2. OBTENER ESTUDIANTES INSCRITOS
// =====================================================

exports.getEstudiantesCurso = async (req, res) => {
  try {
    const cursoId = Number(req.params.cursoId);

    if (!enteroPositivo(cursoId)) {
      return res.status(400).json({
        error: 'El curso seleccionado no es válido'
      });
    }

    const resultado = await db.query(`
      SELECT DISTINCT ON (e.id)
        e.id,
        e.rude,
        e.ci,
        e.nombres,
        e.primer_apellido,
        e.segundo_apellido,
        i.curso_id,
        i.gestion
      FROM inscripciones i
      INNER JOIN estudiantes e
        ON e.id = i.estudiante_id
      INNER JOIN cursos c
        ON c.id = i.curso_id
      WHERE i.curso_id = $1
        AND i.gestion = c.gestion
      ORDER BY
        e.id,
        i.id DESC
    `, [cursoId]);

    const estudiantes = resultado.rows.sort((a, b) => {
      const nombreA = [
        a.primer_apellido,
        a.segundo_apellido,
        a.nombres
      ].filter(Boolean).join(' ');

      const nombreB = [
        b.primer_apellido,
        b.segundo_apellido,
        b.nombres
      ].filter(Boolean).join(' ');

      return nombreA.localeCompare(nombreB, 'es');
    });

    res.json({
      total: estudiantes.length,
      estudiantes
    });

  } catch (error) {
    console.error(
      'Error al cargar estudiantes:',
      error
    );

    res.status(500).json({
      error: 'No se pudieron cargar los estudiantes'
    });
  }
};

// =====================================================
// 3. RECUPERAR CALIFICACIONES GUARDADAS
// =====================================================

exports.obtenerNotas = async (req, res) => {
  try {
    const cursoId = Number(req.query.cursoId);
    const materiaId = Number(req.query.materiaId);
    const trimestre = Number(req.query.trimestre);

    if (
      !enteroPositivo(cursoId) ||
      !enteroPositivo(materiaId) ||
      ![1, 2, 3].includes(trimestre)
    ) {
      return res.status(400).json({
        error: 'Curso, materia o trimestre inválidos'
      });
    }

    const resultado = await db.query(`
      SELECT
        n.id AS nota_id,
        n.estudiante_id,

        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'dimension', d.dimension,
                'numero', d.numero_evaluacion,
                'valor', d.valor
              )
              ORDER BY
                d.dimension,
                d.numero_evaluacion
            )
            FROM nota_detalles d
            WHERE d.nota_id = n.id
          ),
          '[]'::json
        ) AS detalles,

        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'numero', a.numero_casilla,
                'valor', a.valor
              )
              ORDER BY a.numero_casilla
            )
            FROM nota_asistencias a
            WHERE a.nota_id = n.id
          ),
          '[]'::json
        ) AS asistencias

      FROM notas n

      INNER JOIN cursos c
        ON c.id = n.curso_id

      WHERE n.curso_id = $1
        AND n.materia_id = $2
        AND n.trimestre = $3
        AND n.gestion = c.gestion

      ORDER BY n.estudiante_id
    `, [
      cursoId,
      materiaId,
      trimestre
    ]);

    res.json({
      notas: resultado.rows
    });

  } catch (error) {
    console.error(
      'Error al recuperar calificaciones:',
      error
    );

    res.status(500).json({
      error: 'No se pudieron recuperar las calificaciones'
    });
  }
};

// =====================================================
// 4. GUARDAR CALIFICACIONES EN POSTGRESQL
// =====================================================

exports.guardarNotas = async (req, res) => {
  const {
    estudianteId,
    cursoId,
    materiaId,
    trimestre,
    detalles,
    asistencias
  } = req.body || {};

  if (
    !enteroPositivo(estudianteId) ||
    !enteroPositivo(cursoId) ||
    !enteroPositivo(materiaId) ||
    ![1, 2, 3].includes(trimestre)
  ) {
    return res.status(400).json({
      error: 'Los datos académicos no son válidos'
    });
  }

  if (!validarDetalles(detalles)) {
    return res.status(400).json({
      error: 'Hay calificaciones fuera del rango permitido'
    });
  }

  if (!validarAsistencias(asistencias)) {
    return res.status(400).json({
      error: 'Hay registros de asistencia inválidos'
    });
  }

  // Se requiere que config/db.js exporte
  // un Pool de PostgreSQL (pg).

    let cliente;

    try {
      cliente = await db.pool.connect();

      await cliente.query('BEGIN');


    // Verificar inscripción del estudiante
    // y obtener la gestión del curso.
    const inscripcion = await cliente.query(`
      SELECT c.gestion
      FROM inscripciones i

      INNER JOIN cursos c
        ON c.id = i.curso_id

      WHERE i.estudiante_id = $1
        AND i.curso_id = $2
        AND i.gestion = c.gestion

      LIMIT 1
    `, [
      estudianteId,
      cursoId
    ]);

    if (inscripcion.rowCount === 0) {
      await cliente.query('ROLLBACK');

      return res.status(403).json({
        error: 'El estudiante no está inscrito en el curso'
      });
    }

    const gestion = inscripcion.rows[0].gestion;

    // Crear o actualizar cabecera de notas.
    // La restricción UNIQUE evita duplicados.
    const cabecera = await cliente.query(`
      INSERT INTO notas (
        estudiante_id,
        curso_id,
        materia_id,
        gestion,
        trimestre
      )
      VALUES ($1, $2, $3, $4, $5)

      ON CONFLICT (
        estudiante_id,
        curso_id,
        materia_id,
        gestion,
        trimestre
      )

      DO UPDATE SET
        estudiante_id = EXCLUDED.estudiante_id

      RETURNING id
    `, [
      estudianteId,
      cursoId,
      materiaId,
      gestion,
      trimestre
    ]);

    const notaId = cabecera.rows[0].id;

    // Borrar las casillas anteriores de esta nota
    // y reemplazarlas con las enviadas.
    await cliente.query(`
      DELETE FROM nota_detalles
      WHERE nota_id = $1
    `, [notaId]);

    await cliente.query(`
      DELETE FROM nota_asistencias
      WHERE nota_id = $1
    `, [notaId]);

    // Guardar evaluaciones individuales
    for (const detalle of detalles) {
      await cliente.query(`
        INSERT INTO nota_detalles (
          nota_id,
          dimension,
          numero_evaluacion,
          valor
        )
        VALUES ($1, $2, $3, $4)
      `, [
        notaId,
        detalle.dimension,
        detalle.numero,
        detalle.valor
      ]);
    }

    // Guardar asistencias
    for (const asistencia of asistencias) {
      await cliente.query(`
        INSERT INTO nota_asistencias (
          nota_id,
          numero_casilla,
          valor
        )
        VALUES ($1, $2, $3)
      `, [
        notaId,
        asistencia.numero,
        asistencia.valor
      ]);
    }

    // No actualizamos nota_final todavía.
    // Falta confirmar las fórmulas oficiales.
    await cliente.query('COMMIT');

    res.json({
      ok: true,
      mensaje: 'Calificaciones guardadas correctamente',
      notaId
    });

  } catch (error) {
        if (cliente) {
      await cliente.query('ROLLBACK');
    }

    console.error(
      'Error al guardar calificaciones:',
      error
    );

    res.status(500).json({
      error: 'No se pudieron guardar las calificaciones'
    });

 } finally {
  if (cliente) {
    cliente.release();
  }
}
};

// =====================================================
// 5. RESUMEN DE LOS TRES TRIMESTRES
// =====================================================

exports.obtenerResumenAnual = async (req, res) => {
  try {
    const cursoId = Number(req.query.cursoId);
    const materiaId = Number(req.query.materiaId);

    if (
      !enteroPositivo(cursoId) ||
      !enteroPositivo(materiaId)
    ) {
      return res.status(400).json({
        error: 'Curso o materia inválidos'
      });
    }

    const resultado = await db.query(`
      SELECT
        e.id AS estudiante_id,
        n.trimestre,
        n.nota_final

      FROM inscripciones i

      INNER JOIN cursos c
        ON c.id = i.curso_id

      INNER JOIN estudiantes e
        ON e.id = i.estudiante_id

      LEFT JOIN notas n
        ON n.estudiante_id = e.id
        AND n.curso_id = c.id
        AND n.gestion = c.gestion
        AND n.materia_id = $2
        AND n.trimestre BETWEEN 1 AND 3

      WHERE c.id = $1
        AND i.gestion = c.gestion

      ORDER BY
        e.id,
        n.trimestre
    `, [
      cursoId,
      materiaId
    ]);

    const resumen = {};

    resultado.rows.forEach(fila => {
      const id = fila.estudiante_id;

      if (!resumen[id]) {
        resumen[id] = {
          estudianteId: id,
          trimestres: {
            1: null,
            2: null,
            3: null
          }
        };
      }

      if (
        fila.trimestre !== null &&
        fila.nota_final !== null
      ) {
        resumen[id].trimestres[fila.trimestre] =
          Number(fila.nota_final);
      }
    });

    res.json({
      estudiantes: Object.values(resumen)
    });

  } catch (error) {
    console.error(
      'Error en resumen anual:',
      error
    );

    res.status(500).json({
      error: 'No se pudo cargar el resumen anual'
    });
  }
};
