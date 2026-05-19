const prisma    = require('../config/prisma');
const { paginar } = require('../utils/paginar');
const emailSvc  = require('../services/email.service');
const path      = require('path');

const ESTADOS     = ['PENDIENTE', 'APROBADA', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA'];
const PRIORIDADES = ['URGENTE', 'NORMAL', 'BAJA'];

const INCLUDE_DETALLE = {
  proveedor: { select: { id: true, nombre: true, servicio: true, email: true, telefono: true } },
  logs:      { orderBy: { creadoEn: 'asc' } },
  adjuntos:  { orderBy: { creadoEn: 'asc' } },
};

// GET /api/edificios/:edificioId/ordenes  ?estado=&prioridad=&page=&limit=
async function listar(req, res) {
  const { estado, prioridad } = req.query;
  try {
    const where = { edificioId: req.edificioId };
    if (estado)    where.estado    = estado;
    if (prioridad) where.prioridad = prioridad;

    // Always fetch counts across all estados for the stats cards
    const baseWhere = { edificioId: req.edificioId };
    const [result, conteos] = await Promise.all([
      paginar(
        prisma.ordenTrabajo,
        {
          where,
          include: { proveedor: { select: { id: true, nombre: true, servicio: true } } },
          orderBy: [{ prioridad: 'asc' }, { fecha: 'desc' }],
        },
        req.query,
      ),
      prisma.ordenTrabajo.groupBy({
        by: ['estado'],
        where: baseWhere,
        _count: { _all: true },
        _sum:   { monto: true },
      }),
    ]);

    const counts = Object.fromEntries(ESTADOS.map(e => [e, 0]));
    let montoTotal = 0;
    for (const row of conteos) {
      counts[row.estado] = row._count._all;
      if (row.estado !== 'CANCELADA') montoTotal += Number(row._sum.monto || 0);
    }

    res.json({ ...result, counts, montoTotal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar órdenes' });
  }
}

// GET /api/edificios/:edificioId/ordenes/:ordenId
async function obtener(req, res) {
  const id = parseInt(req.params.ordenId);
  try {
    const orden = await prisma.ordenTrabajo.findFirst({
      where:   { id, edificioId: req.edificioId },
      include: INCLUDE_DETALLE,
    });
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    res.json(orden);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener orden' });
  }
}

// POST /api/edificios/:edificioId/ordenes
async function crear(req, res) {
  const { descripcion, proveedorId, monto, prioridad = 'NORMAL', fechaEstimada, notas } = req.body;
  if (!descripcion) return res.status(400).json({ error: 'descripcion es requerida' });
  if (prioridad && !PRIORIDADES.includes(prioridad)) return res.status(400).json({ error: `prioridad inválida. Use: ${PRIORIDADES.join(', ')}` });

  try {
    if (proveedorId) {
      const prov = await prisma.proveedor.findFirst({ where: { id: parseInt(proveedorId), edificioId: req.edificioId } });
      if (!prov) return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    const orden = await prisma.ordenTrabajo.create({
      data: {
        edificioId:    req.edificioId,
        descripcion,
        proveedorId:   proveedorId ? parseInt(proveedorId) : null,
        monto:         monto       ? parseFloat(monto)     : null,
        prioridad,
        fechaEstimada: fechaEstimada ? new Date(fechaEstimada) : null,
        notas:         notas || null,
        logs: { create: { estado: 'PENDIENTE' } },
      },
      include: INCLUDE_DETALLE,
    });
    res.status(201).json(orden);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear orden' });
  }
}

// PUT /api/edificios/:edificioId/ordenes/:ordenId
async function actualizar(req, res) {
  const id = parseInt(req.params.ordenId);
  const { descripcion, proveedorId, monto, prioridad, estado, fechaEstimada, fechaCierre, notas, comprobante, notaLog } = req.body;

  try {
    const existe = await prisma.ordenTrabajo.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!existe) return res.status(404).json({ error: 'Orden no encontrada' });

    if (estado && !ESTADOS.includes(estado)) return res.status(400).json({ error: `estado inválido. Use: ${ESTADOS.join(', ')}` });
    if (prioridad && !PRIORIDADES.includes(prioridad)) return res.status(400).json({ error: `prioridad inválida. Use: ${PRIORIDADES.join(', ')}` });

    // Auto-asignar fechaCierre al completar/cancelar
    let cierre = fechaCierre !== undefined ? (fechaCierre ? new Date(fechaCierre) : null) : undefined;
    if (estado && ['COMPLETADA', 'CANCELADA'].includes(estado) && !existe.fechaCierre && cierre === undefined) {
      cierre = new Date();
    }

    const estadoCambia = estado !== undefined && estado !== existe.estado;

    const orden = await prisma.ordenTrabajo.update({
      where: { id },
      data: {
        ...(descripcion   !== undefined && { descripcion }),
        ...(proveedorId   !== undefined && { proveedorId: proveedorId ? parseInt(proveedorId) : null }),
        ...(monto         !== undefined && { monto: monto ? parseFloat(monto) : null }),
        ...(prioridad     !== undefined && { prioridad }),
        ...(estado        !== undefined && { estado }),
        ...(fechaEstimada !== undefined && { fechaEstimada: fechaEstimada ? new Date(fechaEstimada) : null }),
        ...(cierre        !== undefined && { fechaCierre: cierre }),
        ...(notas         !== undefined && { notas: notas || null }),
        ...(comprobante   !== undefined && { comprobante: comprobante || null }),
        ...(estadoCambia  && { logs: { create: { estado, nota: notaLog || null } } }),
      },
      include: INCLUDE_DETALLE,
    });

    // Email al proveedor si se asignó y el estado es APROBADA o EN_PROCESO
    if (proveedorId !== undefined && orden.proveedor?.email) {
      const estadoFinal = orden.estado;
      if (['APROBADA', 'EN_PROCESO'].includes(estadoFinal)) {
        const edificio = await prisma.edificio.findUnique({
          where: { id: req.edificioId }, select: { nombre: true },
        });
        emailSvc.enviarOrdenProveedor({ proveedor: orden.proveedor, edificio, orden });
      }
    }

    res.json(orden);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar orden' });
  }
}

// DELETE /api/edificios/:edificioId/ordenes/:ordenId
async function eliminar(req, res) {
  const id = parseInt(req.params.ordenId);
  try {
    const orden = await prisma.ordenTrabajo.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    if (['EN_PROCESO', 'COMPLETADA'].includes(orden.estado)) {
      return res.status(409).json({ error: `No se puede eliminar una orden en estado ${orden.estado}` });
    }
    await prisma.ordenTrabajo.delete({ where: { id } });
    res.json({ message: 'Orden eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar orden' });
  }
}

// POST /api/edificios/:edificioId/ordenes/:ordenId/adjuntos
async function agregarAdjunto(req, res) {
  const id = parseInt(req.params.ordenId);
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
  try {
    const orden = await prisma.ordenTrabajo.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });

    const url    = `/uploads/${req.file.filename}`;
    const nombre = req.file.originalname || path.basename(req.file.filename);
    const adjunto = await prisma.ordenTrabajoAdjunto.create({ data: { ordenId: id, url, nombre } });
    res.status(201).json(adjunto);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al agregar adjunto' });
  }
}

// DELETE /api/edificios/:edificioId/ordenes/:ordenId/adjuntos/:adjuntoId
async function eliminarAdjunto(req, res) {
  const ordenId   = parseInt(req.params.ordenId);
  const adjuntoId = parseInt(req.params.adjuntoId);
  try {
    const adjunto = await prisma.ordenTrabajoAdjunto.findFirst({
      where: { id: adjuntoId, ordenId },
    });
    if (!adjunto) return res.status(404).json({ error: 'Adjunto no encontrado' });
    await prisma.ordenTrabajoAdjunto.delete({ where: { id: adjuntoId } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar adjunto' });
  }
}

// POST /api/edificios/:edificioId/ordenes/:ordenId/notificar-proveedor
async function notificarProveedor(req, res) {
  const id = parseInt(req.params.ordenId);
  try {
    const orden = await prisma.ordenTrabajo.findFirst({
      where:   { id, edificioId: req.edificioId },
      include: { proveedor: true },
    });
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    if (!orden.proveedor)        return res.status(409).json({ error: 'La orden no tiene proveedor asignado' });
    if (!orden.proveedor.email)  return res.status(409).json({ error: 'El proveedor no tiene email registrado' });

    const edificio = await prisma.edificio.findUnique({
      where: { id: req.edificioId }, select: { nombre: true },
    });
    await emailSvc.enviarOrdenProveedor({ proveedor: orden.proveedor, edificio, orden });
    res.json({ ok: true, mensaje: `Email enviado a ${orden.proveedor.email}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al notificar al proveedor' });
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar, agregarAdjunto, eliminarAdjunto, notificarProveedor };
