const router = require('express').Router({ mergeParams: true });
const { soloAdminEdificio, bloquearAuditor } = require('../middlewares/edificio.middleware');
const c = require('../controllers/reservas.controller');

// Rutas fijas antes de /:reservaId
router.get('/disponibilidad',              c.disponibilidad);
router.get('/',                            c.listar);
router.post('/',         bloquearAuditor,  c.crear);
router.put('/:reservaId',  soloAdminEdificio, c.actualizar);
router.delete('/:reservaId', soloAdminEdificio, c.eliminar);

module.exports = router;
