const router = require('express').Router();
const { verificarToken, soloSuperAdmin } = require('../middlewares/auth.middleware');
const c = require('../controllers/usuarios.controller');

router.use(verificarToken, soloSuperAdmin);

router.get('/',                              c.listar);
router.post('/',                             c.crear);
router.put('/:id',                           c.actualizar);
router.put('/:id/password',                  c.resetPassword);
router.get('/:id/edificios',                 c.listarEdificios);
router.post('/:id/edificios',                c.asignarEdificio);
router.delete('/:id/edificios/:edificioId',  c.quitarEdificio);

module.exports = router;
