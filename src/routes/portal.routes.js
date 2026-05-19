const router = require('express').Router();
const { verificarPropietario } = require('../middlewares/portal.middleware');
const portal  = require('../controllers/portal.controller');
const visitas = require('../controllers/visitas.controller');
const upload  = require('../middlewares/upload.middleware');

// Auth (sin middleware)
router.post('/login', portal.login);

// Perfil
router.get('/me',       verificarPropietario, portal.me);
router.put('/password', verificarPropietario, portal.cambiarPassword);

// Visitas del propietario — el :edificioId viene del JWT (req.portalEdificioId)
router.get(   '/:edificioId/visitas',              verificarPropietario, visitas.listarPortal);
router.post(  '/:edificioId/visitas',              verificarPropietario, visitas.crearPortal);
router.put(   '/:edificioId/visitas/:visitaId',    verificarPropietario, visitas.actualizarPortal);
router.delete('/:edificioId/visitas/:visitaId',    verificarPropietario, visitas.cancelarPortal);

// Avisos y estado de cuenta
router.get('/:edificioId/avisos',                  verificarPropietario, portal.listarAvisos);
router.get('/:edificioId/estado-cuenta',           verificarPropietario, portal.estadoCuenta);

// Pagos y comprobantes
router.get( '/:edificioId/pagos',                                     verificarPropietario, portal.listarPagos);
router.get( '/:edificioId/pagos/:pagoId/recibo.pdf',                  verificarPropietario, portal.descargarReciboPago);
router.post('/:edificioId/pagos/:pagoId/comprobante', upload.single('file'), verificarPropietario, portal.subirComprobante);

// Reservas
router.get(   '/:edificioId/reservas/disponibilidad', verificarPropietario, portal.disponibilidadReservas);
router.get(   '/:edificioId/reservas',                verificarPropietario, portal.listarReservas);
router.post(  '/:edificioId/reservas',                verificarPropietario, portal.crearReserva);
router.delete('/:edificioId/reservas/:reservaId',     verificarPropietario, portal.cancelarReserva);

// Actas de asamblea (solo lectura)
router.get('/:edificioId/actas',                      verificarPropietario, portal.listarActas);
router.get('/:edificioId/actas/:actaId/docx',         verificarPropietario, portal.descargarActaDocx);

// Actas de junta directiva (solo lectura)
router.get('/:edificioId/actas-jd',                   verificarPropietario, portal.listarActasJD);
router.get('/:edificioId/actas-jd/:actaId/docx',      verificarPropietario, portal.descargarActaJDDocx);

// Órdenes de trabajo (solo lectura)
router.get('/:edificioId/ordenes',                    verificarPropietario, portal.listarOrdenes);

// Cuotas extraordinarias (solo lectura, filtradas por unidad del propietario)
router.get( '/:edificioId/cuotas-ext',                                             verificarPropietario, portal.listarCuotasExt);
router.get( '/:edificioId/cuotas-ext/:pagoExtId/recibo.pdf',                       verificarPropietario, portal.descargarReciboExt);
router.post('/:edificioId/cuotas-ext/:pagoExtId/comprobante', upload.single('file'), verificarPropietario, portal.subirComprobanteExt);

module.exports = router;
