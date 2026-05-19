const prisma = require('../config/prisma');

const ESTADOS = ['PENDIENTE', 'LLEGÓ', 'NO_LLEGÓ', 'CANCELADA'];

const incluirRelaciones = {
  include: {
    unidad:      { select: { numero: true, tipo: true } },
    propietario: { select: { nombre: true } },
  },
};

// GET /portal/:edificioId/visitas  (propietario ve las suyas)
async function listarPortal(req, res) {
  try {
    const visitas = await prisma.visita.findMany({
      where:   { propietarioId: req.propietarioId, edificioId: req.portalEdificioId },
      orderBy: [{ fechaVisita: 'desc' }, { creadoEn: 'desc' }],
      ...incluirRelaciones,
    });
    res.json(visitas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar visitas' });
  }
}

// POST /portal/:edificioId/visitas
async function crearPortal(req, res) {
  const { nombreVisitante, fechaVisita, horaEsperada, placa, cantidadPersonas, notas } = req.body;
  if (!nombreVisitante || !fechaVisita)
    return res.status(400).json({ error: 'nombreVisitante y fechaVisita son requeridos' });

  try {
    const propietario = await prisma.propietario.findUnique({
      where:   { id: req.propietarioId },
      include: { unidad: true },
    });
    if (!propietario) return res.status(404).json({ error: 'Propietario no encontrado' });

    const visita = await prisma.visita.create({
      data: {
        edificioId:      req.portalEdificioId,
        unidadId:        propietario.unidadId,
        propietarioId:   req.propietarioId,
        nombreVisitante,
        fechaVisita:     new Date(fechaVisita),
        horaEsperada:    horaEsperada || null,
        placa:           placa        || null,
        cantidadPersonas: cantidadPersonas ? parseInt(cantidadPersonas) : 1,
        notas:           notas        || null,
      },
      ...incluirRelaciones,
    });
    res.status(201).json(visita);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar visita' });
  }
}

// PUT /portal/:edificioId/visitas/:visitaId
async function actualizarPortal(req, res) {
  const id = parseInt(req.params.visitaId);
  const { nombreVisitante, fechaVisita, horaEsperada, placa, cantidadPersonas, notas } = req.body;

  try {
    const visita = await prisma.visita.findFirst({
      where: { id, propietarioId: req.propietarioId },
    });
    if (!visita) return res.status(404).json({ error: 'Visita no encontrada' });
    if (visita.estado !== 'PENDIENTE')
      return res.status(400).json({ error: 'Solo se pueden editar visitas pendientes' });

    const data = {};
    if (nombreVisitante  !== undefined) data.nombreVisitante  = nombreVisitante;
    if (fechaVisita      !== undefined) data.fechaVisita      = new Date(fechaVisita);
    if (horaEsperada     !== undefined) data.horaEsperada     = horaEsperada || null;
    if (placa            !== undefined) data.placa            = placa || null;
    if (cantidadPersonas !== undefined) data.cantidadPersonas = parseInt(cantidadPersonas);
    if (notas            !== undefined) data.notas            = notas || null;

    const actualizada = await prisma.visita.update({ where: { id }, data, ...incluirRelaciones });
    res.json(actualizada);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar visita' });
  }
}

// DELETE /portal/:edificioId/visitas/:visitaId
async function cancelarPortal(req, res) {
  const id = parseInt(req.params.visitaId);
  try {
    const visita = await prisma.visita.findFirst({
      where: { id, propietarioId: req.propietarioId },
    });
    if (!visita) return res.status(404).json({ error: 'Visita no encontrada' });
    if (visita.estado === 'LLEGÓ')
      return res.status(400).json({ error: 'No se puede cancelar una visita que ya llegó' });

    await prisma.visita.update({ where: { id }, data: { estado: 'CANCELADA' } });
    res.json({ message: 'Visita cancelada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cancelar visita' });
  }
}

// ── Garita (acceso público con PIN) ──────────────────────────────────────────

// GET /garita/:edificioId?pin=1234  — visitas de hoy y mañana
async function listarGarita(req, res) {
  const { pin } = req.query;
  const edificioId = parseInt(req.params.edificioId);

  try {
    const config = await prisma.garitaConfig.findUnique({ where: { edificioId } });
    if (!config || !config.activo || config.pin !== pin)
      return res.status(401).json({ error: 'PIN inválido' });

    const hoy     = new Date(); hoy.setHours(0, 0, 0, 0);
    const manana  = new Date(hoy); manana.setDate(manana.getDate() + 1);
    const pasado  = new Date(hoy); pasado.setDate(pasado.getDate() + 2);

    const visitas = await prisma.visita.findMany({
      where: {
        edificioId,
        fechaVisita: { gte: hoy, lt: pasado },
        estado:      { in: ['PENDIENTE', 'LLEGÓ'] },
      },
      orderBy: [{ fechaVisita: 'asc' }, { horaEsperada: 'asc' }],
      ...incluirRelaciones,
    });

    const edificio = await prisma.edificio.findUnique({
      where:  { id: edificioId },
      select: { nombre: true },
    });

    res.json({ edificio, visitas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener visitas' });
  }
}

// PUT /garita/:edificioId/visitas/:visitaId/entrada
async function marcarEntrada(req, res) {
  const { pin, cedulaVisitante, fotoDocumento, placa } = req.body;
  const edificioId = parseInt(req.params.edificioId);
  const id         = parseInt(req.params.visitaId);

  try {
    const config = await prisma.garitaConfig.findUnique({ where: { edificioId } });
    if (!config || !config.activo || config.pin !== pin)
      return res.status(401).json({ error: 'PIN inválido' });

    const visita = await prisma.visita.findFirst({ where: { id, edificioId } });
    if (!visita) return res.status(404).json({ error: 'Visita no encontrada' });

    const data = { estado: 'LLEGÓ', entrada: new Date() };
    if (cedulaVisitante) data.cedulaVisitante = cedulaVisitante;
    if (fotoDocumento)   data.fotoDocumento   = fotoDocumento;
    if (placa)           data.placa           = placa;

    const actualizada = await prisma.visita.update({
      where: { id },
      data,
      ...incluirRelaciones,
    });
    res.json(actualizada);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al marcar entrada' });
  }
}

// PUT /garita/:edificioId/visitas/:visitaId/salida
async function marcarSalida(req, res) {
  const { pin } = req.body;
  const edificioId = parseInt(req.params.edificioId);
  const id         = parseInt(req.params.visitaId);

  try {
    const config = await prisma.garitaConfig.findUnique({ where: { edificioId } });
    if (!config || !config.activo || config.pin !== pin)
      return res.status(401).json({ error: 'PIN inválido' });

    const actualizada = await prisma.visita.update({
      where: { id },
      data:  { salida: new Date() },
      ...incluirRelaciones,
    });
    res.json(actualizada);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al marcar salida' });
  }
}

// ── Admin ─────────────────────────────────────────────────────────────────────

// GET /edificios/:edificioId/visitas  (admin ve todas)
async function listarAdmin(req, res) {
  const { fecha } = req.query;
  try {
    const where = { edificioId: req.edificioId };
    if (fecha) {
      const d = new Date(fecha); d.setHours(0, 0, 0, 0);
      const d2 = new Date(d); d2.setDate(d2.getDate() + 1);
      where.fechaVisita = { gte: d, lt: d2 };
    }
    const visitas = await prisma.visita.findMany({
      where, orderBy: [{ fechaVisita: 'desc' }, { creadoEn: 'desc' }],
      ...incluirRelaciones,
    });
    res.json(visitas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar visitas' });
  }
}

// PUT /edificios/:edificioId/visitas/:visitaId/estado  (admin cambia estado)
async function cambiarEstadoAdmin(req, res) {
  const id = parseInt(req.params.visitaId);
  const { estado } = req.body;
  if (!ESTADOS.includes(estado)) return res.status(400).json({ error: `estado inválido` });

  try {
    const visita = await prisma.visita.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!visita) return res.status(404).json({ error: 'Visita no encontrada' });

    const data = { estado };
    if (estado === 'LLEGÓ' && !visita.entrada) data.entrada = new Date();

    const actualizada = await prisma.visita.update({ where: { id }, data, ...incluirRelaciones });
    res.json(actualizada);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
}

module.exports = {
  listarPortal, crearPortal, actualizarPortal, cancelarPortal,
  listarGarita, marcarEntrada, marcarSalida,
  listarAdmin, cambiarEstadoAdmin,
};
