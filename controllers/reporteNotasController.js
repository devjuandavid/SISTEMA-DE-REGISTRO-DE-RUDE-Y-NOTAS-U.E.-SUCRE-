
const db = require('../config/db');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const CONFIG = {
  asistencia: 12,
  ser: 5,
  saber: 8,
  hacer: 8
};

function validarId(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0;
}

function obtenerParametros(req) {
  const { cursoId, materiaId, trimestre } = req.query;

  if (
    !validarId(cursoId) ||
    !validarId(materiaId) ||
    ![1, 2, 3].includes(Number(trimestre))
  ) {
    const error = new Error(
      'Seleccione curso, materia y trimestre válidos'
    );
    error.status = 400;
    throw error;
  }

  return {
    cursoId: Number(cursoId),
    materiaId: Number(materiaId),
    trimestre: Number(trimestre)
  };
}

async function consultarReporte(parametros) {
  const { cursoId, materiaId, trimestre } = parametros;

  const cursoResultado = await db.query(`
    SELECT
      id, nivel, grado, paralelo, turno, gestion
    FROM cursos
    WHERE id = $1
  `, [cursoId]);

  const materiaResultado = await db.query(`
    SELECT id, nombre
    FROM materias
    WHERE id = $1
  `, [materiaId]);

  if (
    cursoResultado.rowCount === 0 ||
    materiaResultado.rowCount === 0
  ) {
    const error = new Error('Curso o materia inexistente');
    error.status = 404;
    throw error;
  }

  const curso = cursoResultado.rows[0];
  const materia = materiaResultado.rows[0];

  // Una fila por estudiante inscrito en la gestión.
  const estudiantesResultado = await db.query(`
    SELECT DISTINCT ON (e.id)
      e.id,
      e.rude,
      e.nombres,
      e.primer_apellido,
      e.segundo_apellido
    FROM inscripciones i
    INNER JOIN estudiantes e
      ON e.id = i.estudiante_id
    WHERE i.curso_id = $1
      AND i.gestion = $2
    ORDER BY e.id, i.id DESC
  `, [cursoId, curso.gestion]);

  const estudiantes = estudiantesResultado.rows.sort(
    (a, b) => {
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
    }
  );

  const notasResultado = await db.query(`
    SELECT
      n.id,
      n.estudiante_id,
      n.nota_final
    FROM notas n
    WHERE n.curso_id = $1
      AND n.materia_id = $2
      AND n.gestion = $3
      AND n.trimestre = $4
  `, [
    cursoId,
    materiaId,
    curso.gestion,
    trimestre
  ]);

  const notas = notasResultado.rows;
  const notasPorEstudiante = new Map(
    notas.map(n => [Number(n.estudiante_id), n])
  );

  const idsNotas = notas.map(n => n.id);

  let detalles = [];
  let asistencias = [];

  if (idsNotas.length > 0) {
    const detalleResultado = await db.query(`
      SELECT
        nota_id,
        dimension,
        numero_evaluacion,
        valor
      FROM nota_detalles
      WHERE nota_id = ANY($1::integer[])
      ORDER BY dimension, numero_evaluacion
    `, [idsNotas]);

    detalles = detalleResultado.rows;

    const asistenciaResultado = await db.query(`
      SELECT
        nota_id,
        numero_casilla,
        valor
      FROM nota_asistencias
      WHERE nota_id = ANY($1::integer[])
      ORDER BY numero_casilla
    `, [idsNotas]);

    asistencias = asistenciaResultado.rows;
  }

  const detallePorNota = new Map();
  const asistenciaPorNota = new Map();

  for (const detalle of detalles) {
    const id = Number(detalle.nota_id);

    if (!detallePorNota.has(id)) {
      detallePorNota.set(id, []);
    }

    detallePorNota.get(id).push(detalle);
  }

  for (const asistencia of asistencias) {
    const id = Number(asistencia.nota_id);

    if (!asistenciaPorNota.has(id)) {
      asistenciaPorNota.set(id, []);
    }

    asistenciaPorNota.get(id).push(asistencia);
  }

  const filas = estudiantes.map((estudiante, indice) => {
    const nota = notasPorEstudiante.get(
      Number(estudiante.id)
    );

    const listaDetalles = nota
      ? detallePorNota.get(Number(nota.id)) || []
      : [];

    const listaAsistencias = nota
      ? asistenciaPorNota.get(Number(nota.id)) || []
      : [];

    const evaluaciones = {};
    const controlAsistencia = {};

    for (const d of listaDetalles) {
      evaluaciones[
        `${d.dimension}_${d.numero_evaluacion}`
      ] = d.valor === null ? null : Number(d.valor);
    }

    for (const a of listaAsistencias) {
      controlAsistencia[a.numero_casilla] = a.valor;
    }

    const conteos = { A: 0, F: 0, R: 0, L: 0 };

    Object.values(controlAsistencia).forEach(valor => {
      if (Object.hasOwn(conteos, valor)) {
        conteos[valor]++;
      }
    });

    return {
      numero: indice + 1,
      rude: estudiante.rude || '',
      nombre: [
        estudiante.primer_apellido,
        estudiante.segundo_apellido,
        estudiante.nombres
      ].filter(Boolean).join(' '),
      evaluaciones,
      controlAsistencia,
      conteos,
      notaFinal: nota?.nota_final == null
        ? null
        : Number(nota.nota_final)
    };
  });

  return {
    curso,
    materia,
    trimestre,
    filas
  };
}

function promedioCompleto(fila, dimension, cantidad) {
  const valores = [];

  for (let i = 1; i <= cantidad; i++) {
    const valor = fila.evaluaciones[
      `${dimension}_${i}`
    ];

    if (valor === undefined || valor === null) {
      return null;
    }

    valores.push(Number(valor));
  }

  return valores.reduce((a, b) => a + b, 0) /
    valores.length;
}

function valorCelda(valor) {
  return valor === null || valor === undefined
    ? ''
    : valor;
}

function nombreArchivo(reporte, extension) {
  const { curso, materia, trimestre } = reporte;

  const limpio = String(materia.nombre)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .slice(0, 40);

  return [
    'Centralizador',
    curso.gestion,
    curso.grado + curso.paralelo,
    limpio,
    'T' + trimestre
  ].join('_') + '.' + extension;
}

function columnasReporte() {
  const columnas = [
    { header: 'N.º', key: 'numero', width: 7 },
    { header: 'RUDE', key: 'rude', width: 19 },
    { header: 'APELLIDOS Y NOMBRES', key: 'nombre', width: 37 }
  ];

  for (let i = 1; i <= CONFIG.asistencia; i++) {
    columnas.push({
      header: 'A' + i,
      key: 'asistencia_' + i,
      width: 6
    });
  }

  for (const tipo of ['A', 'F', 'R', 'L']) {
    columnas.push({
      header: 'TOTAL ' + tipo,
      key: 'conteo_' + tipo,
      width: 10
    });
  }

  for (const dimension of ['ser', 'saber', 'hacer']) {
    for (let i = 1; i <= CONFIG[dimension]; i++) {
      columnas.push({
        header: dimension.toUpperCase() + ' ' + i,
        key: dimension + '_' + i,
        width: 11
      });
    }

    columnas.push({
      header: 'PROM. ' + dimension.toUpperCase(),
      key: 'promedio_' + dimension,
      width: 14
    });
  }

  columnas.push({
    header: 'AUTOEVALUACIÓN',
    key: 'autoevaluacion',
    width: 17
  });

  columnas.push({
    header: 'NOTA FINAL REGISTRADA',
    key: 'nota_final',
    width: 24
  });

  return columnas;
}

// =====================================================
// EXPORTAR EXCEL
// =====================================================

exports.exportarExcel = async (req, res) => {
  try {
    const parametros = obtenerParametros(req);
    const reporte = await consultarReporte(parametros);

    const libro = new ExcelJS.Workbook();
    libro.creator = 'Sistema de Registro Académico';

    const hoja = libro.addWorksheet('Centralizador', {
      views: [{
        state: 'frozen',
        xSplit: 3,
        ySplit: 5
      }]
    });

    const columnas = columnasReporte();
    const totalColumnas = columnas.length;

    hoja.mergeCells(1, 1, 1, totalColumnas);
    hoja.getCell(1, 1).value =
      'CENTRALIZADOR DE CALIFICACIONES';

    hoja.mergeCells(2, 1, 2, totalColumnas);
    hoja.getCell(2, 1).value =
      `Curso: ${reporte.curso.nivel} ` +
      `${reporte.curso.grado}° ${reporte.curso.paralelo}` +
      ` | Gestión: ${reporte.curso.gestion}` +
      ` | Trimestre: ${reporte.trimestre}`;

    hoja.mergeCells(3, 1, 3, totalColumnas);
    hoja.getCell(3, 1).value =
      `Materia: ${reporte.materia.nombre}`;

    hoja.mergeCells(4, 1, 4, totalColumnas);
    hoja.getCell(4, 1).value =
      'Promedios referenciales. ' +
      'La nota final solo se muestra si ya existe ' +
      'en la base de datos.';

    hoja.columns = columnas.map(columna => ({
      key: columna.key,
      width: columna.width
    }));

    const encabezados = hoja.getRow(5);

    columnas.forEach((columna, indice) => {
      encabezados.getCell(indice + 1).value =
        columna.header;
    });

    encabezados.height = 32;

    encabezados.eachCell(celda => {
      celda.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };

      celda.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF17365D' }
      };

      celda.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true
      };
    });

    for (const fila of reporte.filas) {
      const datos = {
        numero: fila.numero,
        rude: String(fila.rude),
        nombre: fila.nombre
      };

      for (let i = 1; i <= CONFIG.asistencia; i++) {
        datos['asistencia_' + i] =
          fila.controlAsistencia[i] || '';
      }

      for (const tipo of ['A', 'F', 'R', 'L']) {
        datos['conteo_' + tipo] =
          fila.conteos[tipo];
      }

      for (const dimension of ['ser', 'saber', 'hacer']) {
        for (let i = 1; i <= CONFIG[dimension]; i++) {
          datos[dimension + '_' + i] = valorCelda(
            fila.evaluaciones[dimension + '_' + i]
          );
        }

        datos['promedio_' + dimension] = valorCelda(
          promedioCompleto(
            fila,
            dimension,
            CONFIG[dimension]
          )
        );
      }

      datos.autoevaluacion = valorCelda(
        fila.evaluaciones.autoevaluacion_1
      );

      datos.nota_final = valorCelda(fila.notaFinal);

      const nuevaFila = hoja.addRow(datos);

      nuevaFila.eachCell({ includeEmpty: true }, celda => {
        celda.border = {
          bottom: {
            style: 'thin',
            color: { argb: 'FFD1D5DB' }
          },
          right: {
            style: 'thin',
            color: { argb: 'FFE5E7EB' }
          }
        };

        celda.alignment = {
          vertical: 'middle',
          horizontal: 'center'
        };
      });

      nuevaFila.getCell(3).alignment = {
        horizontal: 'left',
        vertical: 'middle'
      };
    }

    hoja.getCell('A1').font = {
      size: 17,
      bold: true,
      color: { argb: 'FF17365D' }
    };

    hoja.getCell('A4').font = {
      italic: true,
      color: { argb: 'FF9A6700' }
    };

    hoja.autoFilter = {
      from: { row: 5, column: 1 },
      to: { row: 5, column: totalColumnas }
    };

    hoja.pageSetup.orientation = 'landscape';
    hoja.pageSetup.fitToPage = true;
    hoja.pageSetup.fitToWidth = 1;
    hoja.pageSetup.fitToHeight = 0;

    const archivo = nombreArchivo(reporte, 'xlsx');

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.' +
      'spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${archivo}"`
    );

    await libro.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error al exportar Excel:', error);

    if (!res.headersSent) {
      res.status(error.status || 500).json({
        error: error.status
          ? error.message
          : 'No se pudo generar el reporte Excel'
      });
    } else {
      res.destroy(error);
    }
  }
};

// =====================================================
// EXPORTAR PDF
// =====================================================
// Se utiliza una ficha por estudiante para que las
// numerosas casillas se puedan leer correctamente.


exports.exportarPDF = async (req, res) => {
  try {
    const parametros = obtenerParametros(req);
    const reporte = await consultarReporte(parametros);

    const doc = new PDFDocument({
      size: 'A3',
      layout: 'landscape',
      margin: 22,
      autoFirstPage: false,
      bufferPages: true
    });

    const archivo = nombreArchivo(reporte, 'pdf');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${archivo}"`
    );

    doc.pipe(res);

    // Columnas fijas que se repiten en cada bloque.
    const fijas = [
      { titulo: 'N.º', ancho: 25, key: 'numero' },
      { titulo: 'RUDE', ancho: 87, key: 'rude' },
      { titulo: 'APELLIDOS Y NOMBRES', ancho: 175, key: 'nombre' }
    ];

    const grupos = [];

    const agregarGrupo = (titulo, color, columnas) => {
      grupos.push({ titulo, color, columnas });
    };

    const asistencia = [];

    for (let i = 1; i <= CONFIG.asistencia; i++) {
      asistencia.push({
        titulo: 'A' + i,
        ancho: 25,
        key: 'asistencia_' + i
      });
    }

    ['A', 'F', 'R', 'L'].forEach(tipo => {
      asistencia.push({
        titulo: tipo,
        ancho: 28,
        key: 'conteo_' + tipo
      });
    });

    agregarGrupo(
      'CONTROL DE ASISTENCIA',
      '#C9E0F1',
      asistencia
    );

    [
      ['ser', 'SER / 10', '#CFE4B0'],
      ['saber', 'SABER / 45', '#CFE4F5'],
      ['hacer', 'HACER / 40', '#FFE3A3']
    ].forEach(([dimension, titulo, color]) => {
      const columnas = [];

      for (let i = 1; i <= CONFIG[dimension]; i++) {
        columnas.push({
          titulo: 'N' + i,
          ancho: 32,
          key: dimension + '_' + i
        });
      }

      columnas.push({
        titulo: 'PROM.',
        ancho: 42,
        key: 'promedio_' + dimension
      });

      agregarGrupo(titulo, color, columnas);
    });

    agregarGrupo(
      'AUTOEVALUACIÓN',
      '#E5E7EB',
      [{
        titulo: 'SER / 5',
        ancho: 55,
        key: 'autoevaluacion'
      }]
    );

    agregarGrupo(
      'RESULTADOS',
      '#DDE8F4',
      [{
        titulo: 'NOTA FINAL',
        ancho: 68,
        key: 'nota_final'
      }]
    );

    // A3 horizontal en PDFKit:
    // aproximadamente 1191 x 842 puntos.
    const margen = 22;
    const anchoPagina = 1190;
    const anchoDisponible = anchoPagina - margen * 2;

    const anchoFijo = fijas.reduce(
      (suma, columna) => suma + columna.ancho,
      0
    );

    const anchoVariable = anchoDisponible - anchoFijo;

    // Separar grupos completos, evitando cortar
    // SER, SABER o HACER por la mitad.
    const bloques = [];
    let bloque = [];
    let anchoBloque = 0;

    for (const grupo of grupos) {
      const anchoGrupo = grupo.columnas.reduce(
        (suma, columna) => suma + columna.ancho,
        0
      );

      if (
        bloque.length > 0 &&
        anchoBloque + anchoGrupo > anchoVariable
      ) {
        bloques.push(bloque);
        bloque = [];
        anchoBloque = 0;
      }

      bloque.push(grupo);
      anchoBloque += anchoGrupo;
    }

    if (bloque.length > 0) {
      bloques.push(bloque);
    }

    const dibujarCelda = (
      texto,
      x,
      y,
      ancho,
      alto,
      opciones = {}
    ) => {
      const {
        fondo = '#FFFFFF',
        negrita = false,
        tamano = 7,
        alineacion = 'center'
      } = opciones;

      doc.rect(x, y, ancho, alto)
        .fillAndStroke(fondo, '#A0A0A0');

      doc.fillColor('#17212F')
        .font(negrita ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(tamano);

      doc.text(
        String(texto ?? ''),
        x + 3,
        y + 4,
        {
          width: ancho - 6,
          height: alto - 6,
          align: alineacion,
          ellipsis: true,
          lineBreak: false
        }
      );
    };

    const valorDe = (fila, key) => {
      if (key === 'numero') return fila.numero;
      if (key === 'rude') return fila.rude;
      if (key === 'nombre') return fila.nombre;

      if (key.startsWith('asistencia_')) {
        const numero = Number(key.split('_')[1]);
        return fila.controlAsistencia[numero] || '';
      }

      if (key.startsWith('conteo_')) {
        return fila.conteos[key.split('_')[1]];
      }

      if (key.startsWith('promedio_')) {
        const dimension = key.replace('promedio_', '');

        const promedio = promedioCompleto(
          fila,
          dimension,
          CONFIG[dimension]
        );

        return promedio === null
          ? ''
          : promedio.toFixed(2);
      }

      if (key === 'autoevaluacion') {
        return fila.evaluaciones.autoevaluacion_1 ?? '';
      }

      if (key === 'nota_final') {
        return fila.notaFinal ?? '';
      }

      return fila.evaluaciones[key] ?? '';
    };

    const altoGrupo = 27;
    const altoColumna = 27;
    const altoFila = 22;
    const inicioTabla = 135;
    const limiteInferior = 765;

    const dibujarPagina = (
      bloqueActual,
      numeroBloque,
      inicio,
      fin
    ) => {
      doc.addPage();

      doc.fillColor('#17365D')
        .font('Helvetica-Bold')
        .fontSize(15)
        .text(
          'CENTRALIZADOR DE CALIFICACIONES',
          margen,
          25,
          { align: 'center' }
        );

      doc.fillColor('#243447')
        .font('Helvetica')
        .fontSize(10);

      doc.text(
        `CURSO: ${reporte.curso.nivel} ` +
        `${reporte.curso.grado}° ${reporte.curso.paralelo}` +
        `     GESTIÓN: ${reporte.curso.gestion}` +
        `     TRIMESTRE: ${reporte.trimestre}`,
        margen,
        60
      );

      doc.text(
        `ÁREA / MATERIA: ${reporte.materia.nombre}`,
        margen,
        80
      );

      doc.fontSize(8)
        .fillColor('#64748B')
        .text(
          `Bloque ${numeroBloque + 1} de ${bloques.length}`,
          margen,
          102
        );

      let x = margen;
      const yGrupo = inicioTabla;
      const yColumnas = yGrupo + altoGrupo;

      // Encabezado de datos, repetido en cada bloque.
      const anchoDatos = anchoFijo;

      dibujarCelda(
        'DATOS DEL ESTUDIANTE',
        x,
        yGrupo,
        anchoDatos,
        altoGrupo,
        { fondo: '#E5E7EB', negrita: true }
      );

      for (const columna of fijas) {
        dibujarCelda(
          columna.titulo,
          x,
          yColumnas,
          columna.ancho,
          altoColumna,
          { fondo: '#E5E7EB', negrita: true }
        );

        x += columna.ancho;
      }

      // Encabezados agrupados como en Excel.
      for (const grupo of bloqueActual) {
        const anchoGrupo = grupo.columnas.reduce(
          (suma, columna) => suma + columna.ancho,
          0
        );

        dibujarCelda(
          grupo.titulo,
          x,
          yGrupo,
          anchoGrupo,
          altoGrupo,
          {
            fondo: grupo.color,
            negrita: true,
            tamano: 8
          }
        );

        let xColumna = x;

        for (const columna of grupo.columnas) {
          dibujarCelda(
            columna.titulo,
            xColumna,
            yColumnas,
            columna.ancho,
            altoColumna,
            {
              fondo: grupo.color,
              negrita: true,
              tamano: 7
            }
          );

          xColumna += columna.ancho;
        }

        x += anchoGrupo;
      }

      let y = yColumnas + altoColumna;

      for (let indice = inicio; indice < fin; indice++) {
        const fila = reporte.filas[indice];

        let xFila = margen;

        for (const columna of fijas) {
          dibujarCelda(
            valorDe(fila, columna.key),
            xFila,
            y,
            columna.ancho,
            altoFila,
            {
              tamano: columna.key === 'nombre' ? 6.5 : 7,
              alineacion:
                columna.key === 'nombre'
                  ? 'left'
                  : 'center'
            }
          );

          xFila += columna.ancho;
        }

        for (const grupo of bloqueActual) {
          for (const columna of grupo.columnas) {
            dibujarCelda(
              valorDe(fila, columna.key),
              xFila,
              y,
              columna.ancho,
              altoFila,
              {
                fondo: '#FFFFFF',
                tamano: 7
              }
            );

            xFila += columna.ancho;
          }
        }

        y += altoFila;
      }

      doc.fillColor('#92400E')
        .font('Helvetica')
        .fontSize(8)
        .text(
          'Promedios referenciales. ' +
          'Las fórmulas oficiales están pendientes ' +
          'de verificación.',
          margen,
          793
        );
    };

    const filasPorPagina = Math.max(
      1,
      Math.floor(
        (
          limiteInferior -
          inicioTabla -
          altoGrupo -
          altoColumna
        ) / altoFila
      )
    );

    for (
      let numeroBloque = 0;
      numeroBloque < bloques.length;
      numeroBloque++
    ) {
      const bloqueActual = bloques[numeroBloque];

      if (reporte.filas.length === 0) {
        dibujarPagina(
          bloqueActual,
          numeroBloque,
          0,
          0
        );
        continue;
      }

      for (
        let inicio = 0;
        inicio < reporte.filas.length;
        inicio += filasPorPagina
      ) {
        dibujarPagina(
          bloqueActual,
          numeroBloque,
          inicio,
          Math.min(
            inicio + filasPorPagina,
            reporte.filas.length
          )
        );
      }
    }

    doc.end();

  } catch (error) {
    console.error('Error al exportar PDF:', error);

    if (!res.headersSent) {
      res.status(error.status || 500).json({
        error: error.status
          ? error.message
          : 'No se pudo generar el PDF'
      });
    } else {
      res.destroy(error);
    }
  }
};

