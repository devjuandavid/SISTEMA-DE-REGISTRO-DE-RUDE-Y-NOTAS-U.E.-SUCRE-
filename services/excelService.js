const ExcelJS = require('exceljs');

/**
 * Genera un libro de Excel con las 5 pestañas del sistema académico
 * @param {Object} data - Datos del estudiante, asistencia, notas y materias desde PostgreSQL
 * @returns {Promise<Buffer>} - Buffer del archivo Excel listo para descargar
 */
async function generarBoletinExcelCompleto(data) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema UE Sucre';
  workbook.created = new Date();

  // Estilos base para los encabezados
  const headerStyle = {
    font: { bold: true, color: { argb: 'FFFFFF' }, size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } }, // Azul institucional
    alignment: { horizontal: 'center', vertical: 'middle' }
  };

  // -------------------------------------------------------------
  // PESTAÑA 1: Asistencia
  // -------------------------------------------------------------
  const wsAsistencia = workbook.addWorksheet('Asistencia');
  wsAsistencia.columns = [
    { header: 'N°', key: 'index', width: 8 },
    { header: 'Fecha', key: 'fecha', width: 15 },
    { header: 'Materia', key: 'materia', width: 25 },
    { header: 'Estado', key: 'estado', width: 15 }
  ];
  
  if (data.asistencia && data.asistencia.length > 0) {
    data.asistencia.forEach((item, index) => {
      wsAsistencia.addRow({
        index: index + 1,
        fecha: item.fecha,
        materia: item.nombre_materia,
        estado: item.estado
      });
    });
  }

  // -------------------------------------------------------------
  // PESTAÑAS 2, 3 y 4: Trimestres (1er, 2do, 3er Trimestre)
  // -------------------------------------------------------------
  const trimestres = [1, 2, 3];
  
  trimestres.forEach(t => {
    const ws = workbook.addWorksheet(`${t}° Trimestre`);
    ws.columns = [
      { header: 'Materia', key: 'materia', width: 25 },
      { header: 'SER (10)', key: 'ser', width: 12 },
      { header: 'SABER (35)', key: 'saber', width: 12 },
      { header: 'HACER (35)', key: 'hacer', width: 12 },
      { header: 'DECIDIR (10)', key: 'decidir', width: 12 },
      { header: 'AUTOEVAL. (10)', key: 'autoeval', width: 15 },
      { header: 'NOTA TRIMESTRAL', key: 'nota_trimestral', width: 20 }
    ];

    const notasTrimestre = data.notas ? data.notas.filter(n => n.trimestre === t) : [];
    
    notasTrimestre.forEach((item, idx) => {
      const rowNum = idx + 2;
      const row = ws.addRow({
        materia: item.nombre_materia,
        ser: item.ser || 0,
        saber: item.saber || 0,
        hacer: item.hacer || 0,
        decidir: item.decidir || 0,
        autoeval: item.autoeval || 0
      });

      // Fórmula de cálculo de la nota trimestral sobre 100
      row.getCell('nota_trimestral').value = {
        formula: `SUM(B${rowNum}:F${rowNum})`
      };
    });

    // Aplicar estilos al encabezado
    ws.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));
  });

  // -------------------------------------------------------------
  // PESTAÑA 5: Boletín de Notas (Consolidado Final)
  // -------------------------------------------------------------
  const wsBoletin = workbook.addWorksheet('Boletín de Notas');
  wsBoletin.columns = [
    { header: 'Área / Materia', key: 'materia', width: 30 },
    { header: '1er Trimestre', key: 't1', width: 15 },
    { header: '2do Trimestre', key: 't2', width: 15 },
    { header: '3er Trimestre', key: 't3', width: 15 },
    { header: 'Promedio Final', key: 'promedio', width: 18 }
  ];

  if (data.materias && data.materias.length > 0) {
    data.materias.forEach((mat, idx) => {
      const rowNum = idx + 2;
      
      // Obtener notas por cada trimestre
      const n1 = data.notas.find(n => n.materia_id === mat.id && n.trimestre === 1)?.nota_final || 0;
      const n2 = data.notas.find(n => n.materia_id === mat.id && n.trimestre === 2)?.nota_final || 0;
      const n3 = data.notas.find(n => n.materia_id === mat.id && n.trimestre === 3)?.nota_final || 0;

      const row = wsBoletin.addRow({
        materia: mat.nombre_materia,
        t1: n1,
        t2: n2,
        t3: n3
      });

      // Fórmula para el promedio anual
      row.getCell('promedio').value = {
        formula: `ROUND(AVERAGE(B${rowNum}:D${rowNum}), 0)`
      };
    });
  }

  // Aplicar estilos a las pestañas restantes
  wsAsistencia.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));
  wsBoletin.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));

  // Generar Buffer del archivo para enviar por respuesta HTTP
  return await workbook.xlsx.writeBuffer();
}

module.exports = { generarBoletinExcelCompleto };