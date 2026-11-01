const bcrypt = require('bcryptjs');
const db = require('../config/db');

exports.getLogin = (req, res) => {
  res.render('auth/login', { title: 'Iniciar Sesión', error: null });
};

exports.postLogin = async (req, res) => {
  const { usuario, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM usuarios WHERE (usuario = $1 OR correo = $1) AND activo = true', [usuario]);
    if (result.rows.length === 0) {
      return res.render('auth/login', { title: 'Iniciar Sesión', error: 'Usuario o contraseña incorrectos.' });
    }
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.render('auth/login', { title: 'Iniciar Sesión', error: 'Usuario o contraseña incorrectos.' });
    }
    req.session.user = { id: user.id, nombre: user.nombre, apellido: user.apellido, usuario: user.usuario, rol: user.rol };
    return res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.render('auth/login', { title: 'Iniciar Sesión', error: 'Error del servidor' });
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
};