const router = require('express').Router({ mergeParams: true });
const { soloAdminEdificio } = require('../middlewares/edificio.middleware');
const c = require('../controllers/cuotasExt.controller');

router.get( '/',                                      c.listar);
router.post('/',                soloAdminEdificio,    c.crear);
router.delete('/:cuotaExtId',   soloAdminEdificio,    c.eliminar);
router.get(  '/:cuotaExtId/pagos',                                    c.listarPagos);
router.put(  '/:cuotaExtId/pagos/:pagoId/pagar',   soloAdminEdificio, c.registrarPago);
router.put(  '/:cuotaExtId/pagos/:pagoId/anular',  soloAdminEdificio, c.anularPago);
router.get(  '/:cuotaExtId/pagos/:pagoId/recibo.pdf',                 c.reciboPago);
router.post( '/:cuotaExtId/mora',                  soloAdminEdificio, c.calcularMora);
router.post( '/:cuotaExtId/recordatorio',          soloAdminEdificio, c.enviarRecordatorio);

module.exports = router;
