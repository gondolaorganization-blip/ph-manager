const router = require('express').Router({ mergeParams: true });
const { soloAdminEdificio } = require('../middlewares/edificio.middleware');
const c = require('../controllers/actasjd.controller');

router.get('/',                                          c.listar);
router.post('/',                 soloAdminEdificio,      c.crear);
router.get('/:actaId',                                   c.obtener);
router.get('/:actaId/docx',                              c.descargarDocx);
router.put('/:actaId',           soloAdminEdificio,      c.actualizar);
router.put('/:actaId/directores', soloAdminEdificio,     c.actualizarDirectores);
router.put('/:actaId/puntos',     soloAdminEdificio,     c.actualizarPuntos);
router.delete('/:actaId',        soloAdminEdificio,      c.eliminar);

module.exports = router;
