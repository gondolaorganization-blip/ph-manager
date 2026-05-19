const router = require('express').Router({ mergeParams: true });
const { soloAdminEdificio } = require('../middlewares/edificio.middleware');
const c = require('../controllers/gastos.controller');

router.get('/resumen',             c.resumen);
router.get('/',                    c.listar);
router.post('/',  soloAdminEdificio, c.crear);
router.put('/:gastoId',  soloAdminEdificio, c.actualizar);
router.delete('/:gastoId', soloAdminEdificio, c.eliminar);

module.exports = router;
