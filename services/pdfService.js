const PDFDocument = require('pdfkit');

exports.generarFichaRudePDF = (estudiante, detalle, res) => {
  const doc = new PDFDocument({ size: 'LETTER', margin: 30 });

  doc.on('error', (err) => {
    console.error('❌ Error interno en PDFKit:', err);
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="RUDE_${estudiante.rude || 'ESTUDIANTE'}.pdf"`);

  doc.pipe(res);

  // Encabezado
  doc.fontSize(14).font('Helvetica-Bold').text('UNIDAD EDUCATIVA ANTONIO JOSÉ DE SUCRE', { align: 'center' });
  doc.fontSize(10).font('Helvetica').text('FORMULARIO DE REGISTRO ÚNICO DE ESTUDIANTES (RUDE)', { align: 'center' });
  doc.text('R.M. 0684/2025 - GESTIÓN ACADÉMICA 2026', { align: 'center' });
  doc.moveDown(1);

  // Marco Principal
  doc.rect(30, 85, 552, 680).stroke();

  // 1. DATOS DE IDENTIFICACIÓN
  doc.fillColor('#1e3a8a').rect(30, 85, 552, 18).fill();
  doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text('1. DATOS GENERALES DEL ESTUDIANTE', 35, 90);

  const fechaFormateada = estudiante.fecha_nacimiento 
    ? new Date(estudiante.fecha_nacimiento).toLocaleDateString('es-BO')
    : 'S/R';

  doc.fillColor('#000000').font('Helvetica').fontSize(9);
  doc.text(`Código RUDE: ${estudiante.rude || 'S/R'}`, 40, 110);
  doc.text(`C.I.: ${estudiante.ci || 'S/C'}`, 300, 110);
  doc.text(`Apellidos: ${estudiante.primer_apellido || ''} ${estudiante.segundo_apellido || ''}`, 40, 125);
  doc.text(`Nombres: ${estudiante.nombres || ''}`, 300, 125);
  doc.text(`Fecha Nacimiento: ${fechaFormateada}`, 40, 140);
  doc.text(`Género: ${estudiante.genero === 'M' ? 'Masculino' : 'Femenino'}`, 300, 140);

  // 2. DIRECCIÓN Y RESIDENCIA
  doc.fillColor('#1e3a8a').rect(30, 165, 552, 18).fill();
  doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text('2. DIRECCIÓN ACTUAL DE RESIDENCIA', 35, 170);

  doc.fillColor('#000000').font('Helvetica').fontSize(9);
  doc.text(`Departamento: ${detalle.depa_residencia || 'S/R'}`, 40, 190);
  doc.text(`Provincia: ${detalle.provincia_residencia || 'S/R'}`, 200, 190);
  doc.text(`Municipio: ${detalle.municipio_residencia || 'S/R'}`, 380, 190);
  doc.text(`Zona / Barrio: ${detalle.zona_barrio || 'S/R'}`, 40, 205);
  doc.text(`Calle / Av.: ${detalle.avenida_calle || 'S/R'}`, 200, 205);
  doc.text(`Teléfono / Celular: ${detalle.celular_contacto || 'S/R'}`, 380, 205);

  // 3. DATOS SOCIOECONÓMICOS
  doc.fillColor('#1e3a8a').rect(30, 230, 552, 18).fill();
  doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text('3. ASPECTOS SOCIOECONÓMICOS Y SERVICIOS', 35, 235);

  doc.fillColor('#000000').font('Helvetica').fontSize(9);
  doc.text(`Idioma de la niñez: ${detalle.idioma_niñez || 'S/R'}`, 40, 255);
  doc.text(`Autoidentificación: ${detalle.autoidentificacion_cultural || 'S/R'}`, 300, 255);
  doc.text(`Agua Potable: ${detalle.servicio_agua ? 'Sí' : 'No'}`, 40, 270);
  doc.text(`Luz Eléctrica: ${detalle.servicio_electricidad ? 'Sí' : 'No'}`, 180, 270);
  doc.text(`Alcantarillado: ${detalle.servicio_alcantarillado ? 'Sí' : 'No'}`, 320, 270);

  // 4. TUTOR
  doc.fillColor('#1e3a8a').rect(30, 295, 552, 18).fill();
  doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text('4. DATOS DEL PADRE / MADRE O TUTOR', 35, 300);

  doc.fillColor('#000000').font('Helvetica').fontSize(9);
  doc.text(`C.I. Tutor: ${detalle.padre_ci || 'S/R'}`, 40, 320);
  doc.text(`Nombres y Apellidos: ${detalle.padre_nombres || ''} ${detalle.padre_apellidos || ''}`, 200, 320);
  doc.text(`Ocupación: ${detalle.padre_ocupacion || 'S/R'}`, 40, 335);

  // FIRMAS (Sintaxis nativa corregida de PDFKit)
  doc.fontSize(8);
  
  // Linea 1
  doc.moveTo(80, 720).lineTo(240, 720).stroke();
  doc.text('Firma del Padre / Madre / Tutor', 80, 725, { width: 160, align: 'center' });

  // Linea 2
  doc.moveTo(350, 720).lineTo(510, 720).stroke();
  doc.text('Sello y Firma Dirección / Dirección UE', 350, 725, { width: 160, align: 'center' });

  doc.end();
};