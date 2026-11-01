module.exports = {
  isAuthenticated: (req, res, next) => {
    if (req.session && req.session.user) return next();
    return res.redirect('/login');
  },
  isGuest: (req, res, next) => {
    if (req.session && req.session.user) return res.redirect('/dashboard');
    return next();
  }
};