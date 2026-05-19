const router = require('express').Router({ mergeParams: true });
const { soloAdminEdificio } = require('../middlewares/edificio.middleware');
const c = require('../controllers/ingresos.controller');

router.get('/',              c.listar);
router.post('/',             soloAdminEdificio, c.crear);
router.put('/:ingresoId',   soloAdminEdificio, c.actualizar);
router.delete('/:ingresoId', soloAdminEdificio, c.eliminar);

module.exports = router;
