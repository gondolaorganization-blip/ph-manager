const router  = require('express').Router({ mergeParams: true });
const multer  = require('multer');
const { soloAdminEdificio } = require('../middlewares/edificio.middleware');
const c = require('../controllers/unidades.controller');

const uploadXlsx = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.includes('spreadsheet') || file.originalname.endsWith('.xlsx')) cb(null, true);
    else cb(new Error('Solo se permiten archivos .xlsx'));
  },
});

// Importante: rutas fijas antes de '/:unidadId' para evitar conflictos
router.get(   '/resumen',                   c.resumen);
router.get(   '/plantilla.xlsx',            c.descargarPlantilla);
router.post(  '/importar',  soloAdminEdificio, uploadXlsx.single('file'), c.importarMasivo);
router.get(   '/',                          c.listar);
router.post(  '/',        soloAdminEdificio, c.crear);
router.get(   '/:unidadId',                 c.obtener);
router.put(   '/:unidadId', soloAdminEdificio, c.actualizar);
router.delete('/:unidadId', soloAdminEdificio, c.eliminar);

// Propietario anidado bajo unidad
router.post(  '/:unidadId/propietario',        soloAdminEdificio, c.setPropietario);
router.put(   '/:unidadId/propietario',        soloAdminEdificio, c.setPropietario);
router.delete('/:unidadId/propietario',        soloAdminEdificio, c.eliminarPropietario);
router.put(   '/:unidadId/propietario/portal', soloAdminEdificio, c.configurarPortal);

module.exports = router;
