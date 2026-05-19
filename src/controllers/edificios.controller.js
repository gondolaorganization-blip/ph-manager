const bcrypt = require('bcryptjs');
const prisma  = require('../config/prisma');

// GET /api/edificios — edificios a los que tiene acceso el usuario
async function listar(req, res) {
  try {
    if (req.usuario.rol === 'SUPER_ADMIN') {
      const edificios = await prisma.edificio.findMany({
        include: { _count: { select: { unidades: true, ordenes: true, avisos: true } } },
        orderBy: { nombre: 'asc' },
      });
      return res.json(edificios.map(e => ({ ...e, rolUsuario: 'ADMIN' })));
    }

    const accesos = await prisma.edificioUsuario.findMany({
      where:   { usuarioId: req.usuario.id },
      include: {
        edificio: {
          include: {
            _count: { select: { unidades: true, ordenes: true, avisos: true } },
          },
        },
      },
    });

    res.json(accesos.map(a => ({ ...a.edificio, rolUsuario: a.rol })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar edificios' });
  }
}

// GET /api/edificios/:edificioId — detalle del edificio
async function obtener(req, res) {
  try {
    const edificio = await prisma.edificio.findUnique({
      where: { id: req.edificioId },
      include: {
        _count: {
          select: {
            unidades: true,
            cuotas:   true,
            ordenes:  true,
            gastos:   true,
            avisos:   true,
          },
        },
      },
    });
    res.json({ ...edificio, rolUsuario: req.rolEdificio });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener edificio' });
  }
}

// POST /api/edificios — crear edificio y asignar creador como ADMIN
async function crear(req, res) {
  const { nombre, ruc, direccion, totalUnidades, fondoReserva, admin,
          diaCorte, tipoMora, tasaMora, montoMoraFijo,
          codigoUbicacion, folioReal } = req.body;
  if (!nombre || !direccion) {
    return res.status(400).json({ error: 'nombre y direccion son requeridos' });
  }

  try {
    const trialVence = new Date();
    trialVence.setDate(trialVence.getDate() + 14);

    const edificio = await prisma.$transaction(async (tx) => {
      const e = await tx.edificio.create({
        data: {
          nombre,
          ruc:              ruc              || null,
          direccion,
          totalUnidades:    totalUnidades     ? parseInt(totalUnidades)    : 0,
          fondoReserva:     fondoReserva      ? parseFloat(fondoReserva)   : 0,
          diaCorte:         diaCorte          ? parseInt(diaCorte)         : 5,
          tipoMora:         tipoMora          || 'PORCENTAJE',
          tasaMora:         tasaMora          ? parseFloat(tasaMora)       : 0.02,
          montoMoraFijo:    montoMoraFijo     ? parseFloat(montoMoraFijo)  : 0,
          codigoUbicacion:  codigoUbicacion   || null,
          folioReal:        folioReal         || null,
          admin:            admin             || null,
          trialVence,
        },
      });
      await tx.edificioUsuario.create({
        data: { edificioId: e.id, usuarioId: req.usuario.id, rol: 'ADMIN' },
      });
      return e;
    });

    res.status(201).json(edificio);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear edificio' });
  }
}

// PUT /api/edificios/:edificioId — actualizar datos del edificio
async function actualizar(req, res) {
  const { nombre, ruc, direccion, totalUnidades, fondoReserva, admin,
          diaCorte, tipoMora, tasaMora, montoMoraFijo,
          codigoUbicacion, folioReal } = req.body;
  try {
    const data = {};
    if (nombre           !== undefined) data.nombre           = nombre;
    if (ruc              !== undefined) data.ruc              = ruc;
    if (direccion        !== undefined) data.direccion        = direccion;
    if (totalUnidades    !== undefined) data.totalUnidades    = parseInt(totalUnidades);
    if (fondoReserva     !== undefined) data.fondoReserva     = parseFloat(fondoReserva);
    if (diaCorte         !== undefined) data.diaCorte         = parseInt(diaCorte);
    if (tipoMora         !== undefined) data.tipoMora         = tipoMora;
    if (tasaMora         !== undefined) data.tasaMora         = parseFloat(tasaMora);
    if (montoMoraFijo    !== undefined) data.montoMoraFijo    = parseFloat(montoMoraFijo);
    if (codigoUbicacion  !== undefined) data.codigoUbicacion  = codigoUbicacion || null;
    if (folioReal        !== undefined) data.folioReal        = folioReal       || null;
    if (admin            !== undefined) data.admin            = admin;

    const edificio = await prisma.edificio.update({ where: { id: req.edificioId }, data });
    res.json(edificio);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar edificio' });
  }
}

// GET /api/edificios/:edificioId/usuarios — usuarios con acceso al edificio
async function listarUsuarios(req, res) {
  try {
    const accesos = await prisma.edificioUsuario.findMany({
      where:   { edificioId: req.edificioId },
      include: {
        usuario: { select: { id: true, nombre: true, email: true, rol: true, ultimoAcceso: true } },
      },
    });
    res.json(accesos.map(a => ({ ...a.usuario, rolEdificio: a.rol, accesoId: a.id })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
}

// POST /api/edificios/:edificioId/usuarios — invitar/agregar usuario al edificio
async function agregarUsuario(req, res) {
  const { email, rol = 'OPERADOR', nombre, password } = req.body;
  if (!email) return res.status(400).json({ error: 'email es requerido' });

  try {
    let usuario = await prisma.usuario.findUnique({ where: { email: email.toLowerCase().trim() } });

    // Si no existe, crearlo
    if (!usuario) {
      if (!nombre || !password) {
        return res.status(400).json({ error: 'Para un usuario nuevo se requiere nombre y password' });
      }
      const hash = await bcrypt.hash(password, 10);
      usuario = await prisma.usuario.create({
        data: { nombre, email: email.toLowerCase().trim(), password: hash, rol: 'OPERADOR' },
      });
    }

    // Verificar que no tenga acceso ya
    const yaExiste = await prisma.edificioUsuario.findUnique({
      where: { edificioId_usuarioId: { edificioId: req.edificioId, usuarioId: usuario.id } },
    });
    if (yaExiste) return res.status(409).json({ error: 'El usuario ya tiene acceso a este edificio' });

    const acceso = await prisma.edificioUsuario.create({
      data: { edificioId: req.edificioId, usuarioId: usuario.id, rol },
    });

    res.status(201).json({ ...usuario, password: undefined, rolEdificio: acceso.rol });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al agregar usuario' });
  }
}

// DELETE /api/edificios/:edificioId/usuarios/:usuarioId — remover acceso
async function removerUsuario(req, res) {
  const usuarioId = parseInt(req.params.usuarioId);

  // No permitir quitarse a uno mismo
  if (usuarioId === req.usuario.id) {
    return res.status(400).json({ error: 'No puedes removerte a ti mismo' });
  }

  try {
    await prisma.edificioUsuario.delete({
      where: { edificioId_usuarioId: { edificioId: req.edificioId, usuarioId } },
    });
    res.json({ message: 'Acceso removido' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al remover usuario' });
  }
}

// GET /api/edificios/kpis-globales  (solo SUPER_ADMIN)
async function kpisGlobales(req, res) {
  if (req.usuario.rol !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Solo SUPER_ADMIN' });

  try {
    const hoy = new Date();
    const mes  = hoy.getMonth() + 1;
    const anio = hoy.getFullYear();

    const [edificios, unidadesActivas, morosas, deudaRaw, cuotasMes] = await Promise.all([
      prisma.edificio.findMany({
        select: { id: true, nombre: true, direccion: true, plan: true, trialVence: true, suscripcionActiva: true },
        orderBy: { nombre: 'asc' },
      }),

      prisma.unidad.findMany({
        where:  { activa: true },
        select: { id: true, edificioId: true, propietarioId: true },
      }),

      prisma.unidad.findMany({
        where:  { activa: true, pagos: { some: { estado: { not: 'PAGADO' }, fechaVence: { lt: hoy } } } },
        select: { id: true, edificioId: true },
      }),

      prisma.pagoCuota.findMany({
        where:   { estado: { not: 'PAGADO' }, fechaVence: { lt: hoy } },
        select:  { monto: true, interesMora: true, cuota: { select: { edificioId: true } } },
      }),

      prisma.cuotaMantenimiento.findMany({
        where:   { mes, anio },
        include: { pagos: { select: { estado: true } } },
      }),
    ]);

    // Build per-edificio maps
    const unidadesMap = {};
    const propMap     = {};
    unidadesActivas.forEach(u => {
      unidadesMap[u.edificioId] = (unidadesMap[u.edificioId] || 0) + 1;
      if (u.propietarioId) propMap[u.edificioId] = (propMap[u.edificioId] || 0) + 1;
    });

    const morosaMap = {};
    morosas.forEach(u => { morosaMap[u.edificioId] = (morosaMap[u.edificioId] || 0) + 1; });

    const deudaMap = {};
    deudaRaw.forEach(p => {
      const eid = p.cuota.edificioId;
      deudaMap[eid] = (deudaMap[eid] || 0) + Number(p.monto) + Number(p.interesMora);
    });

    const cuotaMesMap = {};
    cuotasMes.forEach(c => {
      const total  = c.pagos.length;
      const pagado = c.pagos.filter(p => p.estado === 'PAGADO').length;
      cuotaMesMap[c.edificioId] = { total, pagado };
    });

    const resultado = edificios.map(e => {
      const diasTrial = e.trialVence
        ? Math.ceil((new Date(e.trialVence) - new Date()) / 86400000)
        : null;
      return {
        id:               e.id,
        nombre:           e.nombre,
        direccion:        e.direccion,
        plan:             e.plan,
        trialVence:       e.trialVence,
        suscripcionActiva: e.suscripcionActiva,
        diasTrial,
        unidades:         unidadesMap[e.id]    || 0,
        conProp:          propMap[e.id]        || 0,
        morosas:          morosaMap[e.id]      || 0,
        deudaVencida:     +(deudaMap[e.id]     || 0).toFixed(2),
        cuotaMes:         cuotaMesMap[e.id]   || null,
      };
    });

    const totales = {
      edificios:   resultado.length,
      unidades:    resultado.reduce((s, e) => s + e.unidades,    0),
      morosas:     resultado.reduce((s, e) => s + e.morosas,     0),
      deudaVencida: +(resultado.reduce((s, e) => s + e.deudaVencida, 0)).toFixed(2),
    };

    res.json({ totales, edificios: resultado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener KPIs globales' });
  }
}

// PUT /api/edificios/:edificioId/suscripcion  (solo SUPER_ADMIN)
async function activarSuscripcion(req, res) {
  if (req.usuario?.rol !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Solo SUPER_ADMIN puede activar suscripciones' });
  }
  const { plan = 'BASICO', desactivar = false } = req.body;
  const PLANES = ['BASICO', 'PROFESIONAL', 'ENTERPRISE'];
  if (!desactivar && !PLANES.includes(plan)) {
    return res.status(400).json({ error: 'Plan inválido. Use: BASICO, PROFESIONAL, ENTERPRISE' });
  }
  try {
    const edificio = await prisma.edificio.update({
      where: { id: req.edificioId },
      data: desactivar
        ? { suscripcionActiva: false, plan: 'TRIAL', trialVence: null }
        : { suscripcionActiva: true, plan },
    });
    res.json(edificio);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar suscripción' });
  }
}

module.exports = { listar, obtener, crear, actualizar, listarUsuarios, agregarUsuario, removerUsuario, kpisGlobales, activarSuscripcion };
