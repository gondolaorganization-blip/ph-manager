const router = require('express').Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const { login, registro, perfil, cambiarPassword, bootstrap } = require('../controllers/auth.controller');

router.post('/login',      login);
router.post('/registro',   registro);
router.post('/bootstrap',  bootstrap);
router.get('/perfil',      verificarToken, perfil);
router.put('/password',    verificarToken, cambiarPassword);

module.exports = router;
