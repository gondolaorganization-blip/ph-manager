const router = require('express').Router();
const { verificarToken }                                                    = require('../middlewares/auth.middleware');
const { verificarAccesoEdificio, soloAdminEdificio, verificarSuscripcion } = require('../middlewares/edificio.middleware');
const c              = require('../controllers/edificios.controller');
const dash           = require('../controllers/dashboard.controller');
const unidadesRoutes = require('./unidades.routes');
const cuotasRoutes      = require('./cuotas.routes');
const cuotasExtRoutes   = require('./cuotasExt.routes');
const proveedoresRoutes = require('./proveedores.routes');
const ordenesRoutes     = require('./ordenes.routes');
const gastosRoutes          = require('./gastos.routes');
const ingresosRoutes        = require('./ingresos.routes');
const presupuestoRoutes     = require('./presupuesto.routes');
const actasRoutes       = require('./actas.routes');
const actasJDRoutes     = require('./actasjd.routes');
const avisosRoutes      = require('./avisos.routes');
const reservasRoutes    = require('./reservas.routes');
const ec                = require('../controllers/estadoCuenta.controller');
const visitas           = require('../controllers/visitas.controller');
const garitaCfg         = require('../controllers/garitaConfig.controller');
const mora              = require('../controllers/mora.controller');
const xls               = require('../controllers/excel.controller');

router.use(verificarToken);

// Rutas globales (sin edificioId)
router.get('/kpis-globales', c.kpisGlobales);
router.get('/',  c.listar);
router.post('/', c.crear);

// Rutas de edificio — verificarAccesoEdificio inyecta req.edificioId
router.get(   '/:edificioId/dashboard',            verificarAccesoEdificio,                    dash.dashboard);
router.get(   '/:edificioId',                     verificarAccesoEdificio,                    c.obtener);
router.put(   '/:edificioId',                     verificarAccesoEdificio, soloAdminEdificio, c.actualizar);
router.get(   '/:edificioId/usuarios',            verificarAccesoEdificio, soloAdminEdificio, c.listarUsuarios);
router.post(  '/:edificioId/usuarios',            verificarAccesoEdificio, soloAdminEdificio, c.agregarUsuario);
router.delete('/:edificioId/usuarios/:usuarioId', verificarAccesoEdificio, soloAdminEdificio, c.removerUsuario);

// Sub-módulos del edificio — verificarSuscripcion bloquea si el trial venció
router.use('/:edificioId/unidades',    verificarAccesoEdificio, verificarSuscripcion, unidadesRoutes);
router.use('/:edificioId/cuotas',      verificarAccesoEdificio, verificarSuscripcion, cuotasRoutes);
router.use('/:edificioId/cuotas-ext',  verificarAccesoEdificio, verificarSuscripcion, cuotasExtRoutes);
router.use('/:edificioId/proveedores', verificarAccesoEdificio, verificarSuscripcion, proveedoresRoutes);
router.use('/:edificioId/ordenes',     verificarAccesoEdificio, verificarSuscripcion, ordenesRoutes);
router.use('/:edificioId/gastos',       verificarAccesoEdificio, verificarSuscripcion, gastosRoutes);
router.use('/:edificioId/ingresos',     verificarAccesoEdificio, verificarSuscripcion, ingresosRoutes);
router.use('/:edificioId/presupuesto',  verificarAccesoEdificio, verificarSuscripcion, presupuestoRoutes);
router.put('/:edificioId/fondo-reserva', verificarAccesoEdificio, verificarSuscripcion, soloAdminEdificio, require('../controllers/gastos.controller').ajustarFondo);
router.use('/:edificioId/actas',         verificarAccesoEdificio, verificarSuscripcion, actasRoutes);
router.use('/:edificioId/actas-jd',      verificarAccesoEdificio, verificarSuscripcion, actasJDRoutes);
router.use('/:edificioId/avisos',        verificarAccesoEdificio, verificarSuscripcion, avisosRoutes);
router.use('/:edificioId/reservas',      verificarAccesoEdificio, verificarSuscripcion, reservasRoutes);
router.get( '/:edificioId/estado-cuenta/:unidadId', verificarAccesoEdificio, verificarSuscripcion,                    ec.descargar);
router.post('/:edificioId/estado-cuenta/enviar',    verificarAccesoEdificio, verificarSuscripcion, soloAdminEdificio, ec.enviar);

// Suscripción (solo SUPER_ADMIN)
router.put('/:edificioId/suscripcion', verificarAccesoEdificio, c.activarSuscripcion);

// Admin — visitas
router.get('/:edificioId/visitas',                         verificarAccesoEdificio, verificarSuscripcion,                    visitas.listarAdmin);
router.get('/:edificioId/visitas.xlsx',                    verificarAccesoEdificio, verificarSuscripcion,                    xls.exportarVisitas);
router.put('/:edificioId/visitas/:visitaId/estado',        verificarAccesoEdificio, verificarSuscripcion, soloAdminEdificio, visitas.cambiarEstadoAdmin);

// Admin — garita config
router.get('/:edificioId/garita-config',                   verificarAccesoEdificio, verificarSuscripcion, soloAdminEdificio, garitaCfg.obtener);
router.put('/:edificioId/garita-config',                   verificarAccesoEdificio, verificarSuscripcion, soloAdminEdificio, garitaCfg.guardar);

// Exports Excel
router.get('/:edificioId/ordenes.xlsx',       verificarAccesoEdificio, verificarSuscripcion, xls.exportarOrdenes);
router.get('/:edificioId/ingresos.xlsx',      verificarAccesoEdificio, verificarSuscripcion, xls.exportarIngresos);
router.get('/:edificioId/propietarios.xlsx',  verificarAccesoEdificio, verificarSuscripcion, xls.exportarPropietarios);
router.get('/:edificioId/unidades.xlsx',      verificarAccesoEdificio, verificarSuscripcion, xls.exportarUnidades);
router.get('/:edificioId/reservas.xlsx',      verificarAccesoEdificio, verificarSuscripcion, xls.exportarReservas);

// Mora
router.post('/:edificioId/mora/calcular', verificarAccesoEdificio, verificarSuscripcion, soloAdminEdificio, mora.calcular);

module.exports = router;
