const router = require('express').Router({ mergeParams: true });
const { soloAdminEdificio, bloquearAuditor } = require('../middlewares/edificio.middleware');
const c  = require('../controllers/cuotas.controller');
const r  = require('../controllers/reportes.controller');
const xls = require('../controllers/excel.controller');

// Orden importante: rutas fijas antes de /:cuotaId
router.get('/',                                          c.listar);
router.get('/siguiente',                                 c.sugerirSiguiente);
router.post('/',                  soloAdminEdificio,     c.crear);
router.get('/pagos',                                     c.listarPagos);
router.post('/pagos/actualizar-mora', soloAdminEdificio, c.actualizarMora);
router.get('/morosos',                                   c.morosos);
router.post('/morosos/notificar',    soloAdminEdificio,  c.notificarMorosos);
router.get('/reportes/morosos.pdf',                      r.reporteMorosos);
router.get('/reportes/morosos.xlsx',                     xls.exportarMorosos);
router.get('/reportes/balance',                          r.balanceFinanciero);
router.get('/reportes/balance.pdf',                      r.balancePdf);
router.get('/reportes/balance.xlsx',                     xls.exportarBalance);
router.put('/pagos/:pagoId/pagar',   bloquearAuditor,     c.registrarPago);
router.put('/pagos/:pagoId/anular',  soloAdminEdificio,  c.anularPago);
router.get('/pagos/:pagoId/recibo.pdf',                  r.reciboPago);
router.get('/:cuotaId',                                  c.obtener);
router.delete('/:cuotaId',           soloAdminEdificio,  c.eliminar);
router.get('/:cuotaId/reporte.pdf',                      r.estadoCuota);
router.get('/:cuotaId/pagos.xlsx',                       xls.exportarPagosCuota);
router.post('/:cuotaId/enviar-estado',  soloAdminEdificio, c.enviarEstadoCuotaEmail);
router.post('/:cuotaId/recordatorio',   soloAdminEdificio, c.enviarRecordatorioCuota);

module.exports = router;
