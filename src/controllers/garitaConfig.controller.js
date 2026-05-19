const prisma  = require('../config/prisma');
const bcrypt  = require('bcryptjs');

// GET /edificios/:edificioId/garita-config
async function obtener(req, res) {
  try {
    const config = await prisma.garitaConfig.findUnique({ where: { edificioId: req.edificioId } });
    res.json(config ?? { edificioId: req.edificioId, pin: null, activo: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener configuración de garita' });
  }
}

// PUT /edificios/:edificioId/garita-config
async function guardar(req, res) {
  const { pin, activo } = req.body;
  if (!pin || !/^\d{4,8}$/.test(pin))
    return res.status(400).json({ error: 'PIN debe ser numérico de 4 a 8 dígitos' });

  try {
    const config = await prisma.garitaConfig.upsert({
      where:  { edificioId: req.edificioId },
      create: { edificioId: req.edificioId, pin, activo: activo !== false },
      update: { pin, activo: activo !== false },
    });
    res.json(config);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar configuración de garita' });
  }
}

module.exports = { obtener, guardar };
