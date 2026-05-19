const router = require('express').Router({ mergeParams: true });
const { soloAdminEdificio } = require('../middlewares/edificio.middleware');
const upload = require('../middlewares/upload.middleware');
const c = require('../controllers/ordenes.controller');

router.get('/',                                                 c.listar);
router.post('/',                        soloAdminEdificio,      c.crear);
router.get('/:ordenId',                                         c.obtener);
router.put('/:ordenId',                 soloAdminEdificio,      c.actualizar);
router.delete('/:ordenId',              soloAdminEdificio,      c.eliminar);
router.post('/:ordenId/adjuntos',       soloAdminEdificio,      upload.single('file'), c.agregarAdjunto);
router.delete('/:ordenId/adjuntos/:adjuntoId', soloAdminEdificio, c.eliminarAdjunto);
router.post('/:ordenId/notificar-proveedor',   soloAdminEdificio, c.notificarProveedor);

module.exports = router;
