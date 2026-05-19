const prisma = require('../config/prisma');

/**
 * Valida que el usuario autenticado tenga acceso al edificio indicado
 * en req.params.edificioId. Inyecta req.edificioId y req.rolEdificio.
 */
async function verificarAccesoEdificio(req, res, next) {
  const edificioId = parseInt(req.params.edificioId);
  if (!edificioId || isNaN(edificioId)) {
    return res.status(400).json({ error: 'edificioId inválido' });
  }

  try {
    if (req.usuario?.rol === 'SUPER_ADMIN') {
      const edificio = await prisma.edificio.findUnique({ where: { id: edificioId } });
      if (!edificio)        return res.status(404).json({ error: 'Edificio no encontrado' });
      if (!edificio.activo) return res.status(403).json({ error: 'Edificio inactivo' });
      req.edificioId  = edificioId;
      req.rolEdificio = 'ADMIN';
      req.edificio    = edificio;
      return next();
    }

    const acceso = await prisma.edificioUsuario.findUnique({
      where: {
        edificioId_usuarioId: { edificioId, usuarioId: req.usuario.id },
      },
      include: {
        edificio: true,
      },
    });

    if (!acceso)                   return res.status(403).json({ error: 'Sin acceso a este edificio' });
    if (!acceso.edificio.activo)   return res.status(403).json({ error: 'Edificio inactivo' });

    req.edificioId   = edificioId;
    req.rolEdificio  = acceso.rol;
    req.edificio     = acceso.edificio;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al verificar acceso al edificio' });
  }
}

/**
 * Exige que el usuario sea ADMIN del edificio (no solo OPERADOR).
 * Debe usarse después de verificarAccesoEdificio.
 */
function soloAdminEdificio(req, res, next) {
  if (req.rolEdificio !== 'ADMIN' && req.usuario?.rol !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Se requiere rol ADMIN en este edificio' });
  }
  next();
}

function bloquearAuditor(req, res, next) {
  if (req.rolEdificio === 'AUDITOR') {
    return res.status(403).json({ error: 'Los auditores solo tienen acceso de lectura' });
  }
  next();
}

/**
 * Bloquea el acceso a sub-módulos cuando el trial ha vencido y no hay suscripción activa.
 * Usar después de verificarAccesoEdificio (depende de req.edificio).
 */
function verificarSuscripcion(req, res, next) {
  if (req.usuario?.rol === 'SUPER_ADMIN') return next();
  const e = req.edificio;
  if (!e) return next();
  if (e.suscripcionActiva) return next();
  if (e.trialVence && new Date() < new Date(e.trialVence)) return next();
  return res.status(402).json({
    error: 'El período de prueba ha vencido. Contacte al administrador para activar su suscripción.',
    code: 'TRIAL_EXPIRED',
  });
}

module.exports = { verificarAccesoEdificio, soloAdminEdificio, bloquearAuditor, verificarSuscripcion };
