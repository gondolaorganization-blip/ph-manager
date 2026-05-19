const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const prisma = require('../config/prisma');

const SECRET = process.env.JWT_SECRET;

// POST /portal/login
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email y password requeridos' });

  try {
    const propietario = await prisma.propietario.findFirst({
      where:   { email, portalActivo: true, activo: true },
      include: { unidad: { select: { id: true, numero: true, edificioId: true, tipo: true } } },
    });
    if (!propietario || !propietario.portalPassword)
      return res.status(401).json({ error: 'Credenciales inválidas o portal no activado' });

    const ok = await bcrypt.compare(password, propietario.portalPassword);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign(
      { id: propietario.id, rol: 'PROPIETARIO', unidadId: propietario.unidadId, edificioId: propietario.unidad.edificioId },
      SECRET,
      { expiresIn: '7d' },
    );

    res.json({
      token,
      propietario: {
        id:       propietario.id,
        nombre:   propietario.nombre,
        email:    propietario.email,
        unidad:   propietario.unidad,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}

// GET /portal/me
async function me(req, res) {
  try {
    const propietario = await prisma.propietario.findUnique({
      where:   { id: req.propietarioId },
      include: {
        unidad: {
          select: {
            id: true, numero: true, numFinca: true, tipo: true, coeficiente: true, edificioId: true,
            edificio: { select: { id: true, nombre: true, direccion: true } },
          },
        },
      },
    });
    if (!propietario) return res.status(404).json({ error: 'Propietario no encontrado' });

    // Saldo pendiente
    const pagos = await prisma.pagoCuota.findMany({
      where:   { unidadId: propietario.unidadId, estado: { in: ['PENDIENTE', 'VENCIDO'] } },
      select:  { monto: true, interesMora: true, estado: true, fechaVence: true },
      orderBy: { fechaVence: 'asc' },
    });
    const saldoPendiente = pagos.reduce((s, p) => s + Number(p.monto) + Number(p.interesMora), 0);
    const vencidas       = pagos.filter(p => p.estado === 'VENCIDO').length;

    res.json({
      ...propietario,
      portalPassword: undefined,
      saldoPendiente: +saldoPendiente.toFixed(2),
      vencidas,
      proximaVence: pagos[0]?.fechaVence ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener datos' });
  }
}

// PUT /portal/password
async function cambiarPassword(req, res) {
  const { actual, nueva } = req.body;
  if (!actual || !nueva) return res.status(400).json({ error: 'actual y nueva son requeridos' });
  if (nueva.length < 6)  return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });

  try {
    const propietario = await prisma.propietario.findUnique({ where: { id: req.propietarioId } });
    if (!propietario?.portalPassword) return res.status(400).json({ error: 'Sin contraseña configurada' });

    const ok = await bcrypt.compare(actual, propietario.portalPassword);
    if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

    const hash = await bcrypt.hash(nueva, 10);
    await prisma.propietario.update({ where: { id: req.propietarioId }, data: { portalPassword: hash } });
    res.json({ message: 'Contraseña actualizada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
}

// GET /portal/:edificioId/avisos
async function listarAvisos(req, res) {
  const edificioId = parseInt(req.params.edificioId);
  if (edificioId !== req.portalEdificioId) return res.status(403).json({ error: 'Acceso denegado' });

  try {
    const avisos = await prisma.aviso.findMany({
      where:   { edificioId, activo: true },
      orderBy: { fechaPublica: 'desc' },
      take:    50,
    });
    res.json(avisos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener avisos' });
  }
}

// GET /portal/:edificioId/estado-cuenta?desde=&hasta=
async function estadoCuenta(req, res) {
  const edificioId = parseInt(req.params.edificioId);
  if (edificioId !== req.portalEdificioId) return res.status(403).json({ error: 'Acceso denegado' });

  const { desde, hasta } = req.query;
  const { generarPdfEstadoCuenta } = require('../utils/pdf-estado-cuenta');

  try {
    const propietario = await prisma.propietario.findUnique({
      where:   { id: req.propietarioId },
      include: { unidad: { include: { edificio: true } } },
    });
    if (!propietario) return res.status(404).json({ error: 'Propietario no encontrado' });

    const where = { unidadId: propietario.unidadId };
    if (desde || hasta) {
      where.fechaVence = {};
      if (desde) where.fechaVence.gte = new Date(desde);
      if (hasta) { const h = new Date(hasta); h.setDate(h.getDate() + 1); where.fechaVence.lt = h; }
    }

    const [pagos, pagosExt] = await Promise.all([
      prisma.pagoCuota.findMany({
        where, orderBy: { fechaVence: 'asc' },
        include: { cuota: { select: { mes: true, anio: true } } },
      }),
      prisma.pagoCuotaExt.findMany({
        where: { unidadId: propietario.unidadId },
        orderBy: { fechaVence: 'asc' },
        include: { cuota: { select: { descripcion: true } } },
      }),
    ]);

    const buf = await generarPdfEstadoCuenta({
      unidad: propietario.unidad, propietario, pagos, pagosExt,
      edificio: propietario.unidad.edificio, desde, hasta,
    });

    const nombre = `Estado_Cuenta_${propietario.unidad.numero}_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar estado de cuenta' });
  }
}

// ── Reservas ──────────────────────────────────────────────────────────────────

const AREAS_RESERVA = ['SALON', 'PISCINA', 'GIMNASIO', 'TERRAZA', 'BBQ', 'OTRO'];

function toMin(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
function solapan(a1, b1, a2, b2) { return toMin(a1) < toMin(b2) && toMin(a2) < toMin(b1); }

// GET /portal/:edificioId/reservas
async function listarReservas(req, res) {
  const edificioId = parseInt(req.params.edificioId);
  if (edificioId !== req.portalEdificioId) return res.status(403).json({ error: 'Acceso denegado' });

  try {
    const reservas = await prisma.reservaArea.findMany({
      where:   { edificioId, unidadId: req.propietarioUnidadId },
      orderBy: [{ fecha: 'desc' }, { horaInicio: 'asc' }],
      include: { unidad: { select: { numero: true } } },
    });
    res.json(reservas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar reservas' });
  }
}

// GET /portal/:edificioId/reservas/disponibilidad?area=&fecha=
async function disponibilidadReservas(req, res) {
  const edificioId = parseInt(req.params.edificioId);
  if (edificioId !== req.portalEdificioId) return res.status(403).json({ error: 'Acceso denegado' });

  const { area, fecha } = req.query;
  if (!area || !fecha) return res.status(400).json({ error: 'area y fecha son requeridos' });

  try {
    const ocupado = await prisma.reservaArea.findMany({
      where: { edificioId, area, fecha: new Date(fecha), estado: { not: 'CANCELADA' } },
      select: { id: true, horaInicio: true, horaFin: true, estado: true, unidadId: true },
      orderBy: { horaInicio: 'asc' },
    });
    res.json({ area, fecha, ocupado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar disponibilidad' });
  }
}

// POST /portal/:edificioId/reservas
async function crearReserva(req, res) {
  const edificioId = parseInt(req.params.edificioId);
  if (edificioId !== req.portalEdificioId) return res.status(403).json({ error: 'Acceso denegado' });

  const { area, fecha, horaInicio, horaFin, notas } = req.body;
  if (!area || !fecha || !horaInicio || !horaFin)
    return res.status(400).json({ error: 'area, fecha, horaInicio y horaFin son requeridos' });
  if (!AREAS_RESERVA.includes(area))
    return res.status(400).json({ error: `Área inválida. Opciones: ${AREAS_RESERVA.join(', ')}` });
  if (toMin(horaInicio) >= toMin(horaFin))
    return res.status(400).json({ error: 'horaInicio debe ser anterior a horaFin' });

  try {
    const conflictos = await prisma.reservaArea.findMany({
      where: { edificioId, area, fecha: new Date(fecha), estado: { not: 'CANCELADA' } },
    });
    const conflicto = conflictos.find(r => solapan(horaInicio, horaFin, r.horaInicio, r.horaFin));
    if (conflicto)
      return res.status(409).json({
        error: `Horario ocupado: hay una reserva de ${conflicto.horaInicio} a ${conflicto.horaFin}`,
      });

    const reserva = await prisma.reservaArea.create({
      data: {
        edificioId,
        unidadId: req.propietarioUnidadId,
        area, fecha: new Date(fecha), horaInicio, horaFin,
        notas: notas || null,
        estado: 'PENDIENTE',
      },
      include: { unidad: { select: { numero: true } } },
    });
    res.status(201).json(reserva);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear reserva' });
  }
}

// DELETE /portal/:edificioId/reservas/:reservaId  (cancela)
async function cancelarReserva(req, res) {
  const edificioId = parseInt(req.params.edificioId);
  if (edificioId !== req.portalEdificioId) return res.status(403).json({ error: 'Acceso denegado' });

  const id = parseInt(req.params.reservaId);
  try {
    const reserva = await prisma.reservaArea.findFirst({
      where: { id, edificioId, unidadId: req.propietarioUnidadId },
    });
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
    if (reserva.estado === 'CANCELADA')
      return res.status(400).json({ error: 'La reserva ya está cancelada' });

    const actualizada = await prisma.reservaArea.update({
      where: { id },
      data:  { estado: 'CANCELADA' },
      include: { unidad: { select: { numero: true } } },
    });
    res.json(actualizada);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cancelar reserva' });
  }
}

// GET /portal/:edificioId/pagos
async function listarPagos(req, res) {
  const edificioId = parseInt(req.params.edificioId);
  if (edificioId !== req.portalEdificioId) return res.status(403).json({ error: 'Acceso denegado' });

  try {
    const pagos = await prisma.pagoCuota.findMany({
      where:   { unidadId: req.propietarioUnidadId },
      include: { cuota: { select: { mes: true, anio: true } } },
      orderBy: { fechaVence: 'desc' },
    });
    res.json(pagos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar pagos' });
  }
}

// POST /portal/:edificioId/pagos/:pagoId/comprobante  (multipart/form-data, field: "file")
async function subirComprobante(req, res) {
  const edificioId = parseInt(req.params.edificioId);
  if (edificioId !== req.portalEdificioId) return res.status(403).json({ error: 'Acceso denegado' });

  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

  const pagoId = parseInt(req.params.pagoId);
  try {
    const pago = await prisma.pagoCuota.findFirst({
      where: { id: pagoId, unidadId: req.propietarioUnidadId },
    });
    if (!pago)                    return res.status(404).json({ error: 'Pago no encontrado' });
    if (pago.estado === 'PAGADO') return res.status(409).json({ error: 'El pago ya está registrado como pagado' });

    const url = `/uploads/${req.file.filename}`;
    const actualizado = await prisma.pagoCuota.update({
      where:   { id: pagoId },
      data:    { comprobante: url },
      include: { cuota: { select: { mes: true, anio: true } } },
    });
    res.json(actualizado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al subir comprobante' });
  }
}

// GET /portal/:edificioId/cuotas-ext/:pagoExtId/recibo.pdf
async function descargarReciboExt(req, res) {
  const edificioId = parseInt(req.params.edificioId);
  if (edificioId !== req.portalEdificioId) return res.status(403).json({ error: 'Acceso denegado' });

  const pagoExtId = parseInt(req.params.pagoExtId);
  try {
    const pago = await prisma.pagoCuotaExt.findFirst({
      where:   { id: pagoExtId, unidadId: req.propietarioUnidadId },
      include: {
        cuota:  { select: { descripcion: true } },
        unidad: { include: { propietario: { select: { nombre: true, email: true } } } },
      },
    });
    if (!pago)                       return res.status(404).json({ error: 'Pago no encontrado' });
    if (pago.estado !== 'PAGADO')    return res.status(409).json({ error: 'Solo se puede generar recibo de pagos en estado PAGADO' });

    const edificio = await prisma.edificio.findUnique({
      where:  { id: edificioId },
      select: { nombre: true, direccion: true, ruc: true },
    });

    const { createDoc, drawFooter, generarReciboExt } = require('../services/pdf.service');
    const filename = `Recibo_Ext_${String(pago.id).padStart(6, '0')}.pdf`;
    const doc = createDoc(res, filename);
    generarReciboExt(doc, edificio, pago);
    drawFooter(doc);
    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Error al generar recibo' });
  }
}

// POST /portal/:edificioId/cuotas-ext/:pagoExtId/comprobante
async function subirComprobanteExt(req, res) {
  const edificioId = parseInt(req.params.edificioId);
  if (edificioId !== req.portalEdificioId) return res.status(403).json({ error: 'Acceso denegado' });

  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

  const pagoExtId = parseInt(req.params.pagoExtId);
  try {
    const pago = await prisma.pagoCuotaExt.findFirst({
      where: { id: pagoExtId, unidadId: req.propietarioUnidadId },
    });
    if (!pago)                    return res.status(404).json({ error: 'Pago no encontrado' });
    if (pago.estado === 'PAGADO') return res.status(409).json({ error: 'El pago ya está registrado como pagado' });

    const url        = `/uploads/${req.file.filename}`;
    const actualizado = await prisma.pagoCuotaExt.update({
      where: { id: pagoExtId },
      data:  { comprobante: url },
      include: { cuota: { select: { descripcion: true } } },
    });
    res.json(actualizado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al subir comprobante' });
  }
}

// GET /portal/:edificioId/actas
async function listarActas(req, res) {
  const edificioId = parseInt(req.params.edificioId);
  if (edificioId !== req.portalEdificioId) return res.status(403).json({ error: 'Acceso denegado' });

  try {
    const actas = await prisma.acta.findMany({
      where:   { edificioId },
      orderBy: { fecha: 'desc' },
      include: {
        propuestas: { orderBy: { orden: 'asc' } },
        asistencias: {
          where:  { unidadId: req.propietarioUnidadId },
          select: { estado: true, modalidadAsistencia: true, mandatario: true },
        },
      },
    });
    res.json(actas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener actas' });
  }
}

// GET /portal/:edificioId/actas/:actaId/docx
async function descargarActaDocx(req, res) {
  const edificioId = parseInt(req.params.edificioId);
  if (edificioId !== req.portalEdificioId) return res.status(403).json({ error: 'Acceso denegado' });

  const id = parseInt(req.params.actaId);
  try {
    const acta = await prisma.acta.findFirst({
      where:   { id, edificioId },
      include: {
        asistencias: {
          include: {
            unidad: {
              select: {
                id: true, numero: true, numFinca: true, tipo: true, coeficiente: true,
                propietario: { select: { nombre: true } },
              },
            },
          },
          orderBy: { unidad: { numero: 'asc' } },
        },
        propuestas: { orderBy: { orden: 'asc' } },
      },
    });
    if (!acta) return res.status(404).json({ error: 'Acta no encontrada' });

    const edificio = await prisma.edificio.findUnique({
      where:  { id: edificioId },
      select: { nombre: true, ruc: true, direccion: true, codigoUbicacion: true, folioReal: true },
    });

    const { generarDocxActa } = require('../utils/docx-acta');
    const buffer = await generarDocxActa(acta, edificio);
    const nombre = `Acta_${acta.numero ?? 'SN'}_${acta.anio ?? ''}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar documento' });
  }
}

// GET /portal/:edificioId/pagos/:pagoId/recibo.pdf
async function descargarReciboPago(req, res) {
  const edificioId = parseInt(req.params.edificioId);
  if (edificioId !== req.portalEdificioId) return res.status(403).json({ error: 'Acceso denegado' });

  const pagoId = parseInt(req.params.pagoId);
  try {
    const pago = await prisma.pagoCuota.findFirst({
      where:   { id: pagoId, unidadId: req.propietarioUnidadId },
      include: {
        cuota:  { select: { mes: true, anio: true } },
        unidad: { include: { propietario: { select: { nombre: true, email: true, telefono: true } } } },
      },
    });
    if (!pago)                       return res.status(404).json({ error: 'Pago no encontrado' });
    if (pago.estado !== 'PAGADO')    return res.status(409).json({ error: 'Solo se puede generar recibo de pagos ya pagados' });

    const edificio = await prisma.edificio.findUnique({
      where:  { id: edificioId },
      select: { id: true, nombre: true, direccion: true, ruc: true },
    });

    const { createDoc, drawFooter, generarRecibo } = require('../services/pdf.service');
    const filename = `Recibo_${String(pago.id).padStart(6, '0')}_${pago.unidad.numero}.pdf`;
    const doc = createDoc(res, filename);
    generarRecibo(doc, edificio, pago);
    drawFooter(doc);
    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Error al generar recibo' });
  }
}

// GET /portal/:edificioId/ordenes?estado=
async function listarOrdenes(req, res) {
  const edificioId = parseInt(req.params.edificioId);
  if (edificioId !== req.portalEdificioId) return res.status(403).json({ error: 'Acceso denegado' });

  try {
    const { estado } = req.query;
    const where = { edificioId };
    if (estado) where.estado = estado;

    const ordenes = await prisma.ordenTrabajo.findMany({
      where,
      select: {
        id:           true,
        descripcion:  true,
        estado:       true,
        prioridad:    true,
        fecha:        true,
        fechaEstimada: true,
        fechaCierre:  true,
        proveedor: { select: { nombre: true, servicio: true } },
        logs: {
          select:  { estado: true, creadoEn: true },
          orderBy: { creadoEn: 'asc' },
        },
      },
      orderBy: [{ prioridad: 'asc' }, { fecha: 'desc' }],
    });

    res.json(ordenes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener órdenes' });
  }
}

// GET /portal/:edificioId/cuotas-ext
async function listarCuotasExt(req, res) {
  const edificioId = parseInt(req.params.edificioId);
  if (edificioId !== req.portalEdificioId) return res.status(403).json({ error: 'Acceso denegado' });

  try {
    const pagos = await prisma.pagoCuotaExt.findMany({
      where: {
        unidadId: req.propietarioUnidadId,
        cuota: { edificioId },
      },
      select: {
        id:        true,
        monto:     true,
        estado:    true,
        fechaVence: true,
        fechaPago:  true,
        metodo:     true,
        cuota: {
          select: { id: true, descripcion: true, tipoDistribucion: true, fechaVence: true },
        },
      },
      orderBy: [{ estado: 'asc' }, { fechaVence: 'asc' }],
    });

    res.json(pagos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener cuotas extraordinarias' });
  }
}

// GET /portal/:edificioId/actas-jd
async function listarActasJD(req, res) {
  const edificioId = parseInt(req.params.edificioId);
  if (edificioId !== req.portalEdificioId) return res.status(403).json({ error: 'Acceso denegado' });

  try {
    const actas = await prisma.actaJD.findMany({
      where:   { edificioId },
      orderBy: [{ anio: 'desc' }, { numero: 'desc' }],
      include: {
        directores: { orderBy: { cargo: 'asc' } },
        puntos:     { orderBy: { orden: 'asc' } },
      },
    });
    res.json(actas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener actas de JD' });
  }
}

// GET /portal/:edificioId/actas-jd/:actaId/docx
async function descargarActaJDDocx(req, res) {
  const edificioId = parseInt(req.params.edificioId);
  if (edificioId !== req.portalEdificioId) return res.status(403).json({ error: 'Acceso denegado' });

  const id = parseInt(req.params.actaId);
  try {
    const acta = await prisma.actaJD.findFirst({
      where:   { id, edificioId },
      include: {
        directores: { orderBy: { cargo: 'asc' } },
        puntos:     { orderBy: { orden: 'asc' } },
      },
    });
    if (!acta) return res.status(404).json({ error: 'Acta de JD no encontrada' });

    const edificio = await prisma.edificio.findUnique({
      where:  { id: edificioId },
      select: { nombre: true, codigoUbicacion: true, folioReal: true },
    });

    const { generarDocxActaJD } = require('../utils/docx-actajd');
    const buffer = await generarDocxActaJD(acta, edificio);
    const nombre = `ActaJD_${acta.numero ?? 'SN'}_${acta.anio ?? ''}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar documento' });
  }
}

module.exports = { login, me, cambiarPassword, listarAvisos, estadoCuenta, listarPagos, subirComprobante, subirComprobanteExt, descargarReciboPago, descargarReciboExt, listarReservas, disponibilidadReservas, crearReserva, cancelarReserva, listarActas, descargarActaDocx, listarActasJD, descargarActaJDDocx, listarOrdenes, listarCuotasExt };
