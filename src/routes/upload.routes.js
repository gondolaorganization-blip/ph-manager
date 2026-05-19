const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');
const { verificarToken } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

// POST /api/upload  — single file, field name "file"
router.post('/', verificarToken, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo supera el límite de 5 MB'
        : err.message || 'Error al subir archivo';
      return res.status(400).json({ error: msg });
    }
    next();
  });
}, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });
  res.json({ url: `/uploads/${req.file.filename}`, nombre: req.file.originalname });
});

// DELETE /api/upload  — eliminar archivo por url
router.delete('/', verificarToken, (req, res) => {
  const { url } = req.body;
  if (!url || !url.startsWith('/uploads/')) {
    return res.status(400).json({ error: 'URL inválida' });
  }
  const filename = path.basename(url);
  // Guard against path traversal
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ error: 'Nombre de archivo inválido' });
  }
  const filepath = path.join(__dirname, '..', '..', process.env.UPLOADS_DIR || 'uploads', filename);
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  res.json({ message: 'Archivo eliminado' });
});

module.exports = router;
