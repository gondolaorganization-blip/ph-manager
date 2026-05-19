const prisma    = require('../config/prisma');
const emailSvc  = require('../services/email.service');

const AREAS   = ['SALON', 'PISCINA', 'GIMNASIO', 'TERRAZA', 'BBQ', 'OTRO'];
const ESTADOS = ['PENDIENTE', 'APROBADA', 'CANCELADA'];

// Convierte "HH:MM" a minutos para comparar solapamientos
function toMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function solapan(ini1, fin1, ini2, fin2) {
  return toMinutos(ini1) < toMinutos(fin2) && toMinutos(ini2) < toMinutos(fin1);
}

function validarHoras(horaInicio, horaFin) {
  const re = /^\d{2}:\d{2}$/;
  if (!re.test(horaInicio) || !re.test(horaFin)) return 'Formato de hora inválido. Use HH:MM';
  if (toMinutos(horaInicio) >= toMinutos(horaFin)) return 'horaInicio debe ser anterior a horaFin';
  return null;
}

// GET /api/edificios/:edificioId/reservas  ?area=&fecha=&estado=&unidadId=
async function listar(req, res) {
  const { area, fecha, estado, unidadId } = req.query;
  try {
    const where = { edificioId: req.edificioId };
    if (area)     where.area     = area;
    if (estado)   where.estado   = estado;
    if (unidadId) where.unidadId = parseInt(unidadId);
    if (fecha)    where.fecha    = new Date(fecha);

    const reservas = await prisma.reservaArea.findMany({
      where,
      include: {
        unidad: {
          include: { propietario: { select: { nombre: true, telefono: true } } },
        },
      },
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    });
    res.json(reservas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar reservas' });
  }
}

// GET /api/edificios/:edificioId/reservas/disponibilidad?area=&fecha=
async function disponibilidad(req, res) {
  const { area, fecha } = req.query;
  if (!area || !fecha) return res.status(400).json({ error: 'area y fecha son requeridos' });
  if (!AREAS.includes(area)) return res.status(400).json({ error: `area inválida. Use: ${AREAS.join(', ')}` });

  try {
    const reservas = await prisma.reservaArea.findMany({
      where: {
        edificioId: req.edificioId,
        area,
        fecha:  new Date(fecha),
        estado: { not: 'CANCELADA' },
      },
      select: { id: true, horaInicio: true, horaFin: true, estado: true, unidad: { select: { numero: true } } },
      orderBy: { horaInicio: 'asc' },
    });
    res.json({ area, fecha, ocupado: reservas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar disponibilidad' });
  }
}

// POST /api/edificios/:edificioId/reservas
async function crear(req, res) {
  const { unidadId, area, fecha, horaInicio, horaFin, notas } = req.body;

  if (!unidadId || !area || !fecha || !horaInicio || !horaFin) {
    return res.status(400).json({ error: 'unidadId, area, fecha, horaInicio y horaFin son requeridos' });
  }
  if (!AREAS.includes(area)) return res.status(400).json({ error: `area inválida. Use: ${AREAS.join(', ')}` });

  const errHora = validarHoras(horaInicio, horaFin);
  if (errHora) return res.status(400).json({ error: errHora });

  try {
    // Verificar que la unidad pertenece al edificio
    const unidad = await prisma.unidad.findFirst({
      where: { id: parseInt(unidadId), edificioId: req.edificioId, activa: true },
    });
    if (!unidad) return res.status(404).json({ error: 'Unidad no encontrada o inactiva' });

    // Detectar conflictos (misma área, misma fecha, horario activo que se solape)
    const conflictos = await prisma.reservaArea.findMany({
      where: {
        edificioId: req.edificioId,
        area,
        fecha:  new Date(fecha),
        estado: { not: 'CANCELADA' },
      },
    });

    const conflicto = conflictos.find(r => solapan(horaInicio, horaFin, r.horaInicio, r.horaFin));
    if (conflicto) {
      return res.status(409).json({
        error: `Conflicto de horario: ya existe una reserva de ${conflicto.horaInicio} a ${conflicto.horaFin}`,
      });
    }

    const reserva = await prisma.reservaArea.create({
      data: {
        edificioId: req.edificioId,
        unidadId:   parseInt(unidadId),
        area,
        fecha:      new Date(fecha),
        horaInicio,
        horaFin,
        notas:      notas || null,
      },
      include: {
        unidad: { include: { propietario: { select: { nombre: true, telefono: true } } } },
      },
    });
    res.status(201).json(reserva);

    // Fire-and-forget: confirmación por email
    const propietario = reserva.unidad?.propietario;
    if (propietario?.email) {
      const edificio = await prisma.edificio.findUnique({ where: { id: req.edificioId }, select: { nombre: true } });
      emailSvc.enviarConfirmacionReserva({ propietario, unidad: reserva.unidad, edificio, reserva }).catch(() => {});
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear reserva' });
  }
}

// PUT /api/edificios/:edificioId/reservas/:reservaId
async function actualizar(req, res) {
  const id = parseInt(req.params.reservaId);
  const { estado, notas, horaInicio, horaFin } = req.body;

  try {
    const existe = await prisma.reservaArea.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!existe) return res.status(404).json({ error: 'Reserva no encontrada' });

    if (existe.estado === 'CANCELADA') return res.status(409).json({ error: 'No se puede modificar una reserva cancelada' });
    if (estado && !ESTADOS.includes(estado)) return res.status(400).json({ error: `estado inválido. Use: ${ESTADOS.join(', ')}` });

    // Si cambian horas, re-validar y re-verificar conflictos
    const nuevaIni = horaInicio ?? existe.horaInicio;
    const nuevaFin = horaFin   ?? existe.horaFin;

    if (horaInicio || horaFin) {
      const errHora = validarHoras(nuevaIni, nuevaFin);
      if (errHora) return res.status(400).json({ error: errHora });

      const conflictos = await prisma.reservaArea.findMany({
        where: {
          edificioId: req.edificioId,
          area:   existe.area,
          fecha:  existe.fecha,
          estado: { not: 'CANCELADA' },
          NOT:    { id },
        },
      });
      const conflicto = conflictos.find(r => solapan(nuevaIni, nuevaFin, r.horaInicio, r.horaFin));
      if (conflicto) {
        return res.status(409).json({
          error: `Conflicto de horario: ya existe una reserva de ${conflicto.horaInicio} a ${conflicto.horaFin}`,
        });
      }
    }

    const reserva = await prisma.reservaArea.update({
      where: { id },
      data: {
        ...(estado     !== undefined && { estado }),
        ...(notas      !== undefined && { notas: notas || null }),
        ...(horaInicio !== undefined && { horaInicio }),
        ...(horaFin    !== undefined && { horaFin }),
      },
      include: {
        unidad: { include: { propietario: { select: { nombre: true, telefono: true, email: true } } } },
      },
    });
    res.json(reserva);

    // Fire-and-forget: notificar cambio de estado al propietario
    const propietario = reserva.unidad?.propietario;
    if (estado && propietario?.email && (estado === 'CANCELADA' || estado === 'APROBADA')) {
      const edificio = await prisma.edificio.findUnique({ where: { id: req.edificioId }, select: { nombre: true } });
      const ctx = { propietario, unidad: reserva.unidad, edificio, reserva };
      if (estado === 'CANCELADA') {
        emailSvc.enviarCancelacionReserva(ctx).catch(() => {});
      } else {
        emailSvc.enviarAprobacionReserva(ctx).catch(() => {});
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar reserva' });
  }
}

// DELETE /api/edificios/:edificioId/reservas/:reservaId
async function eliminar(req, res) {
  const id = parseInt(req.params.reservaId);
  try {
    const reserva = await prisma.reservaArea.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
    if (reserva.estado === 'APROBADA') {
      return res.status(409).json({ error: 'Cancela la reserva antes de eliminarla' });
    }
    await prisma.reservaArea.delete({ where: { id } });
    res.json({ message: 'Reserva eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar reserva' });
  }
}

module.exports = { listar, disponibilidad, crear, actualizar, eliminar };
