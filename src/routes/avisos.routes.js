const router = require('express').Router({ mergeParams: true });
const { soloAdminEdificio } = require('../middlewares/edificio.middleware');
const c = require('../controllers/avisos.controller');

router.get('/',                                              c.listar);
router.get('/destinatarios',                                 c.listarDestinatarios);
router.post('/',                soloAdminEdificio,           c.crear);
router.put('/:avisoId',         soloAdminEdificio,           c.actualizar);
router.post('/:avisoId/enviar-correo', soloAdminEdificio,    c.enviarPorCorreo);
router.delete('/:avisoId',      soloAdminEdificio,           c.eliminar);

module.exports = router;
