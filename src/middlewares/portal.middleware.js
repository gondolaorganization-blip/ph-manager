const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET;

function verificarPropietario(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requerido' });

  try {
    const payload = jwt.verify(auth.slice(7), SECRET);
    if (payload.rol !== 'PROPIETARIO') return res.status(403).json({ error: 'Acceso exclusivo para propietarios' });
    req.propietarioId    = payload.id;
    req.propietarioUnidadId = payload.unidadId;
    req.portalEdificioId = payload.edificioId;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = { verificarPropietario };
