const router = require('express').Router({ mergeParams: true });
const { soloAdminEdificio } = require('../middlewares/edificio.middleware');
const c = require('../controllers/presupuesto.controller');

router.get('/', c.obtener);
router.put('/', soloAdminEdificio, c.guardar);

module.exports = router;
