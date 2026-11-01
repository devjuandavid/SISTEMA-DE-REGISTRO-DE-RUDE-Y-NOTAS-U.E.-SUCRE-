const db = require('../config/db');

// Listar docentes (Trae todos los datos de la tabla para evitar errores de columnas faltantes)
exports.getDocentes = async (req, res) => {
  try {
    const { rows: docentes } = await db.query(`
      SELECT * 
      FROM usuarios 
      WHERE UPPER(rol) IN ('DOCENTE', 'PROFESOR', 'ADMIN') AND activo = true
      ORDER BY apellido ASC
    `);
    res.render('docentes/index', { title: 'Gestión de Docentes', docentes });
  } catch (error) {
    console.error('❌ Error en getDocentes:', error);
    res.status(500).send(`Error al obtener docentes: ${error.message}`);
  }
};

// Formulario nuevo docente
exports.getNuevoDocente = (req, res) => {
  res.render('docentes/nuevo', { title: 'Registrar Nuevo Docente' });
};

// Guardar nuevo docente (Inserta solo con los campos estándar obligatorios)
exports.crearDocente = async (req, res) => {
  const { nombre, apellido } = req.body;
  try {
    await db.query(`
      INSERT INTO usuarios (nombre, apellido, rol, activo)
      VALUES ($1, $2, 'DOCENTE', true)
    `, [nombre, apellido]);
    res.redirect('/docentes');
  } catch (error) {
    console.error('❌ Error al crear docente:', error);
    res.status(500).send(`Error al guardar docente: ${error.message}`);
  }
};