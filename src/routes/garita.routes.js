const router  = require('express').Router({ mergeParams: true });
const prisma  = require('../config/prisma');
const upload  = require('../middlewares/upload.middleware');
const visitas = require('../controllers/visitas.controller');

// Rutas públicas — autenticación por PIN en query / body
router.get('/:edificioId',                                      visitas.listarGarita);
router.put('/:edificioId/visitas/:visitaId/entrada',            visitas.marcarEntrada);
router.put('/:edificioId/visitas/:visitaId/salida',             visitas.marcarSalida);

// Upload de foto de documento — PIN en query string
router.post('/:edificioId/upload', (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Error al subir archivo' });

    const { pin } = req.query;
    const edificioId = parseInt(req.params.edificioId);

    try {
      const config = await prisma.garitaConfig.findUnique({ where: { edificioId } });
      if (!config || !config.activo || config.pin !== pin)
        return res.status(401).json({ error: 'PIN inválido' });

      if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

      res.json({ url: `/uploads/${req.file.filename}` });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al procesar archivo' });
    }
  });
});

module.exports = router;
