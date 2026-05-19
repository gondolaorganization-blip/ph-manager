const router = require('express').Router({ mergeParams: true });
const { soloAdminEdificio } = require('../middlewares/edificio.middleware');
const c = require('../controllers/actas.controller');

router.get('/',                                        c.listar);
router.post('/',                soloAdminEdificio,     c.crear);
router.get('/:actaId',                                 c.obtener);
router.get('/:actaId/docx',                            c.descargarDocx);
router.put('/:actaId',          soloAdminEdificio,     c.actualizar);
router.put('/:actaId/asistencias',  soloAdminEdificio, c.actualizarAsistencias);
router.put('/:actaId/propuestas',   soloAdminEdificio, c.actualizarPropuestas);
router.delete('/:actaId',       soloAdminEdificio,     c.eliminar);

module.exports = router;
