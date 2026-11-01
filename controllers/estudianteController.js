const db = require('../config/db');
const pdfService = require('../services/pdfService');

// 1. Listar Estudiantes (Vista principal)
exports.listarEstudiantes = async (req, res) => {
  try {
    const query = `
      SELECT 
        e.id, 
        e.rude, 
        e.ci, 
        e.nombres, 
        e.primer_apellido, 
        e.segundo_apellido, 
        rd.celular_contacto AS telefono_tutor,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', rd.padre_nombres, rd.padre_apellidos)), ''),
          NULLIF(TRIM(CONCAT_WS(' ', rd.madre_nombres, rd.madre_apellidos)), ''),
          'Sin Registrar'
        ) AS nombre_tutor,
        COALESCE(c.grado, 0) AS grado, 
        COALESCE(c.paralelo, '-') AS paralelo, 
        COALESCE(c.nivel, 'SIN CURSO') AS nivel
      FROM estudiantes e
      LEFT JOIN rude_detalles rd ON e.id = rd.estudiante_id
      LEFT JOIN inscripciones i ON e.id = i.estudiante_id AND i.estado = 'CONFIRMADA'
      LEFT JOIN cursos c ON i.curso_id = c.id
      ORDER BY e.primer_apellido ASC, e.segundo_apellido ASC;
    `;
    const { rows: estudiantes } = await db.query(query);
    const { rows: cursos } = await db.query('SELECT * FROM cursos WHERE activo = true ORDER BY grado, paralelo');

    res.render('estudiantes/index', {
      title: 'Gestión de Estudiantes - RUDE',
      estudiantes,
      cursos
    });
  } catch (error) {
    console.error('❌ Error en listarEstudiantes:', error);
    res.status(500).send(`Error interno en la base de datos: ${error.message}`);
  }
};

// 2. Registrar Estudiante Nuevo (Creación rápida e inscripción segura con transacción)
exports.guardarEstudiante = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { 
      codigo_rude, ci, nombres, apellido_paterno, apellido_materno, 
      fecha_nacimiento, genero, curso_id, nombre_tutor, telefono_tutor 
    } = req.body;
    
    const usuarioId = (req.session && req.session.user) ? req.session.user.id : 1;

    // 1. Insertar Estudiante
    const estResult = await client.query(
      `INSERT INTO estudiantes (rude, ci, nombres, primer_apellido, segundo_apellido, fecha_nacimiento, genero)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [codigo_rude || null, ci || null, nombres, apellido_paterno || '', apellido_materno || '', fecha_nacimiento || null, genero || 'M']
    );

    const estudianteId = estResult.rows[0].id;

    // 2. Insertar Detalle RUDE Inicial (Tutor y Contacto)
    await client.query(
      `INSERT INTO rude_detalles (estudiante_id, padre_nombres, celular_contacto)
       VALUES ($1, $2, $3)`,
      [estudianteId, nombre_tutor || '', telefono_tutor || '']
    );

    // 3. Crear Inscripción en el Curso (Gestión Actual)
    if (curso_id) {
      await client.query(
        `INSERT INTO inscripciones (estudiante_id, curso_id, gestion, usuario_id, estado)
         VALUES ($1, $2, $3, $4, 'CONFIRMADA')`,
        [estudianteId, curso_id, new Date().getFullYear(), usuarioId]
      );
    }

    await client.query('COMMIT');
    res.redirect('/estudiantes');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en guardarEstudiante:', error);
    res.status(500).send(`Error al guardar el estudiante: ${error.message}`);
  } finally {
    client.release();
  }
};

// 3. Ver Formulario Completo RUDE
exports.verRude = async (req, res) => {
  try {
    const { id } = req.params;
    const estRes = await db.query('SELECT * FROM estudiantes WHERE id = $1', [id]);
    
    if (estRes.rows.length === 0) {
      return res.status(404).send('Estudiante no encontrado');
    }

    const detRes = await db.query('SELECT * FROM rude_detalles WHERE estudiante_id = $1', [id]);
    const detalle = detRes.rows[0] || {};

    res.render('estudiantes/rude', {
      title: 'Ficha RUDE',
      estudiante: estRes.rows[0],
      detalle
    });
  } catch (error) {
    console.error('❌ Error en verRude:', error);
    res.status(500).send(`Error al cargar la ficha RUDE: ${error.message}`);
  }
};

// 4. Guardar/Actualizar Formulario Extendido RUDE
exports.guardarRude = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      depa_residencia, provincia_residencia, municipio_residencia, 
      zona_barrio, avenida_calle, celular_contacto, 
      idioma_niñez, autoidentificacion_cultural,
      servicio_agua, servicio_electricidad, servicio_alcantarillado,
      padre_ci, padre_nombres, padre_apellidos, padre_ocupacion
    } = req.body;

    const query = `
      INSERT INTO rude_detalles (
        estudiante_id, depa_residencia, provincia_residencia, municipio_residencia,
        zona_barrio, avenida_calle, celular_contacto, idioma_niñez,
        autoidentificacion_cultural, servicio_agua, servicio_electricidad,
        servicio_alcantarillado, padre_ci, padre_nombres, padre_apellidos, padre_ocupacion
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (estudiante_id) 
      DO UPDATE SET 
        depa_residencia = EXCLUDED.depa_residencia,
        provincia_residencia = EXCLUDED.provincia_residencia,
        municipio_residencia = EXCLUDED.municipio_residencia,
        zona_barrio = EXCLUDED.zona_barrio,
        avenida_calle = EXCLUDED.avenida_calle,
        celular_contacto = EXCLUDED.celular_contacto,
        idioma_niñez = EXCLUDED.idioma_niñez,
        autoidentificacion_cultural = EXCLUDED.autoidentificacion_cultural,
        servicio_agua = EXCLUDED.servicio_agua,
        servicio_electricidad = EXCLUDED.servicio_electricidad,
        servicio_alcantarillado = EXCLUDED.servicio_alcantarillado,
        padre_ci = EXCLUDED.padre_ci,
        padre_nombres = EXCLUDED.padre_nombres,
        padre_apellidos = EXCLUDED.padre_apellidos,
        padre_ocupacion = EXCLUDED.padre_ocupacion,
        updated_at = CURRENT_TIMESTAMP;
    `;

    await db.query(query, [
      id, depa_residencia, provincia_residencia, municipio_residencia,
      zona_barrio, avenida_calle, celular_contacto, idioma_niñez,
      autoidentificacion_cultural, Boolean(servicio_agua), Boolean(servicio_electricidad),
      Boolean(servicio_alcantarillado), padre_ci, padre_nombres, padre_apellidos, padre_ocupacion
    ]);

    res.redirect('/estudiantes');
  } catch (error) {
    console.error('❌ Error en guardarRude:', error);
    res.status(500).send(`Error al guardar datos extendidos RUDE: ${error.message}`);
  }
};

// 5. Descargar/Ver PDF RUDE
exports.descargarRudePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const estRes = await db.query('SELECT * FROM estudiantes WHERE id = $1', [id]);

    if (estRes.rows.length === 0) {
      return res.status(404).send('Estudiante no encontrado');
    }

    const detRes = await db.query('SELECT * FROM rude_detalles WHERE estudiante_id = $1', [id]);
    const detalle = detRes.rows[0] || {};

    pdfService.generarFichaRudePDF(estRes.rows[0], detalle, res);
  } catch (error) {
    console.error('❌ Error en descargarRudePDF:', error);
    res.status(500).send(`Error interno al generar el PDF: ${error.message}`);
  }
};
// Mostrar la pestaña de Inscripciones
exports.verInscripciones = async (req, res) => {
  try {
    // 1. Obtener todos los cursos activos
    const { rows: cursos } = await db.query(
      'SELECT * FROM cursos WHERE activo = true ORDER BY grado, paralelo'
    );

    // 2. Obtener lista de inscripciones recientes
    const queryInscripciones = `
      SELECT 
        i.id AS inscripcion_id,
        i.gestion,
        i.fecha_inscripcion,
        e.rude,
        e.ci,
        CONCAT_WS(' ', e.nombres, e.primer_apellido, e.segundo_apellido) AS estudiante_nombre,
        CONCAT_WS(' ', c.grado || '°', c.paralelo, '-', c.nivel) AS curso_nombre
      FROM inscripciones i
      INNER JOIN estudiantes e ON i.estudiante_id = e.id
      INNER JOIN cursos c ON i.curso_id = c.id
      ORDER BY i.fecha_inscripcion DESC
      LIMIT 50;
    `;
    const { rows: inscripciones } = await db.query(queryInscripciones);

    res.render('estudiantes/inscripcion', {
      title: 'Inscripciones - Gestión Académica',
      cursos,
      inscripciones
    });
  } catch (error) {
    console.error('❌ Error en verInscripciones:', error);
    res.status(500).send(`Error al cargar módulo de inscripciones: ${error.message}`);
  }
};