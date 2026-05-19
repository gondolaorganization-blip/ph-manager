const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
  const header = req.headers.authorization || '';
  // Fallback a query param para PDFs abiertos directamente en el navegador
  const token  = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || null);
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function soloAdmin(req, res, next) {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(req.usuario?.rol)) {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
  next();
}

function soloSuperAdmin(req, res, next) {
  if (req.usuario?.rol !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Acceso restringido a super administradores' });
  }
  next();
}

module.exports = { verificarToken, soloAdmin, soloSuperAdmin };
