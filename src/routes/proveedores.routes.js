const router = require('express').Router({ mergeParams: true });
const { soloAdminEdificio } = require('../middlewares/edificio.middleware');
const c = require('../controllers/proveedores.controller');

router.get('/',                          c.listar);
router.post('/',    soloAdminEdificio,   c.crear);
router.put('/:proveedorId', soloAdminEdificio, c.actualizar);
router.delete('/:proveedorId', soloAdminEdificio, c.eliminar);

module.exports = router;
