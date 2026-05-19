const prisma   = require('../config/prisma');
const emailSvc = require('../services/email.service');
const { generarEstadoCuotaBuffer } = require('../services/pdf.service');

// GET /api/edificios/:edificioId/cuotas
async function listar(req, res) {
  try {
    const cuotas = await prisma.cuotaMantenimiento.findMany({
      where: { edificioId: req.edificioId },
      include: {
        _count: { select: { pagos: true } },
        pagos:  {
          select: { estado: true, monto: true, interesMora: true },
        },
      },
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
    });

    const data = cuotas.map(c => {
      const pagos        = c.pagos;
      const total        = pagos.length;
      const pagados      = pagos.filter(p => p.estado === 'PAGADO').length;
      const vencidos     = pagos.filter(p => p.estado === 'VENCIDO').length;
      const pendientes   = pagos.filter(p => p.estado === 'PENDIENTE').length;
      const recaudado    = pagos.filter(p => p.estado === 'PAGADO').reduce((s, p) => s + Number(p.monto), 0);
      const porCobrar    = pagos.filter(p => p.estado !== 'PAGADO').reduce((s, p) => s + Number(p.monto) + Number(p.interesMora), 0);
      const { pagos: _, ...rest } = c;
      return { ...rest, stats: { total, pagados, vencidos, pendientes, recaudado: +recaudado.toFixed(2), porCobrar: +porCobrar.toFixed(2) } };
    });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar cuotas' });
  }
}

// GET /api/edificios/:edificioId/cuotas/:cuotaId
async function obtener(req, res) {
  const id = parseInt(req.params.cuotaId);
  try {
    const cuota = await prisma.cuotaMantenimiento.findFirst({
      where:   { id, edificioId: req.edificioId },
      include: {
        pagos: {
          include: {
            unidad: {
              include: { propietario: { select: { nombre: true, email: true, telefono: true } } },
            },
          },
          orderBy: { unidad: { numero: 'asc' } },
        },
      },
    });
    if (!cuota) return res.status(404).json({ error: 'Cuota no encontrada' });

    const pagos = cuota.pagos.map(p => {
      const mora = Number(p.interesMora);
      return { ...p, interesMora: mora, totalDeuda: +(Number(p.monto) + mora).toFixed(2) };
    });

    res.json({ ...cuota, pagos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener cuota' });
  }
}

// POST /api/edificios/:edificioId/cuotas
async function crear(req, res) {
  const { mes, anio, monto, fechaVence, usarCoeficiente = true } = req.body;

  if (!mes || !anio || !monto || !fechaVence) {
    return res.status(400).json({ error: 'mes, anio, monto y fechaVence son requeridos' });
  }
  if (mes < 1 || mes > 12) return res.status(400).json({ error: 'mes debe ser entre 1 y 12' });

  try {
    // Verificar que no exista ya cuota para ese mes/año
    const existe = await prisma.cuotaMantenimiento.findUnique({
      where: { edificioId_mes_anio: { edificioId: req.edificioId, mes: parseInt(mes), anio: parseInt(anio) } },
    });
    if (existe) return res.status(409).json({ error: `Ya existe una cuota para ${mes}/${anio}` });

    // Obtener unidades activas
    const unidades = await prisma.unidad.findMany({
      where: { edificioId: req.edificioId, activa: true },
    });
    if (unidades.length === 0) return res.status(400).json({ error: 'El edificio no tiene unidades activas' });

    const cuota = await prisma.$transaction(async (tx) => {
      const c = await tx.cuotaMantenimiento.create({
        data: {
          edificioId: req.edificioId,
          mes:        parseInt(mes),
          anio:       parseInt(anio),
          monto:      parseFloat(monto),
          fechaVence: new Date(fechaVence),
          generada:   true,
        },
      });

      // Generar PagoCuota para cada unidad
      const pagosData = unidades.map(u => {
        const montoPago = usarCoeficiente
          ? +(Number(monto) * Number(u.coeficiente)).toFixed(2)
          : +Number(monto).toFixed(2);
        return {
          cuotaId:    c.id,
          unidadId:   u.id,
          monto:      montoPago,
          fechaVence: new Date(fechaVence),
          estado:     'PENDIENTE',
        };
      });
      await tx.pagoCuota.createMany({ data: pagosData });

      return c;
    });

    const total = await prisma.pagoCuota.count({ where: { cuotaId: cuota.id } });
    res.status(201).json({ ...cuota, pagosGenerados: total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear cuota' });
  }
}

// DELETE /api/edificios/:edificioId/cuotas/:cuotaId
async function eliminar(req, res) {
  const id = parseInt(req.params.cuotaId);
  try {
    const cuota = await prisma.cuotaMantenimiento.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!cuota) return res.status(404).json({ error: 'Cuota no encontrada' });

    const pagados = await prisma.pagoCuota.count({ where: { cuotaId: id, estado: 'PAGADO' } });
    if (pagados > 0) return res.status(409).json({ error: `No se puede eliminar: hay ${pagados} pago(s) ya registrado(s)` });

    await prisma.$transaction([
      prisma.pagoCuota.deleteMany({ where: { cuotaId: id } }),
      prisma.cuotaMantenimiento.delete({ where: { id } }),
    ]);
    res.json({ message: 'Cuota eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar cuota' });
  }
}

// ── Pagos ─────────────────────────────────────────────────────────────────────

// GET /api/edificios/:edificioId/pagos  ?mes=&anio=&unidadId=&estado=
async function listarPagos(req, res) {
  const { mes, anio, unidadId, estado } = req.query;
  try {
    const where = {
      cuota: { edificioId: req.edificioId },
    };
    if (mes)      where.cuota = { ...where.cuota, mes: parseInt(mes) };
    if (anio)     where.cuota = { ...where.cuota, anio: parseInt(anio) };
    if (unidadId) where.unidadId = parseInt(unidadId);
    if (estado)   where.estado   = estado;

    const pagos = await prisma.pagoCuota.findMany({
      where,
      include: {
        cuota:  { select: { mes: true, anio: true, monto: true } },
        unidad: { include: { propietario: { select: { nombre: true, email: true } } } },
      },
      orderBy: [{ cuota: { anio: 'desc' } }, { cuota: { mes: 'desc' } }, { unidad: { numero: 'asc' } }],
    });

    const data = pagos.map(p => ({ ...p, interesMora: Number(p.interesMora) }));

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar pagos' });
  }
}

// PUT /api/edificios/:edificioId/pagos/:pagoId/pagar
async function registrarPago(req, res) {
  const pagoId = parseInt(req.params.pagoId);
  const { metodo, referencia, fecha, monto: montoPagado, notas, comprobante } = req.body;

  if (!metodo) return res.status(400).json({ error: 'metodo es requerido (EFECTIVO, TRANSFERENCIA, YAPPY, CHEQUE)' });

  const METODOS = ['EFECTIVO', 'TRANSFERENCIA', 'YAPPY', 'CHEQUE'];
  if (!METODOS.includes(metodo)) return res.status(400).json({ error: `Método inválido. Use: ${METODOS.join(', ')}` });

  try {
    const pago = await prisma.pagoCuota.findFirst({
      where: { id: pagoId, cuota: { edificioId: req.edificioId } },
    });
    if (!pago)                    return res.status(404).json({ error: 'Pago no encontrado' });
    if (pago.estado === 'PAGADO') return res.status(409).json({ error: 'Este pago ya fue registrado' });

    const mora      = Number(pago.interesMora); // ya calculado por mora.service
    const fechaPago = fecha ? new Date(fecha) : new Date();

    const actualizado = await prisma.pagoCuota.update({
      where: { id: pagoId },
      data:  {
        estado:      'PAGADO',
        fechaPago,
        metodo,
        referencia:  referencia   || null,
        comprobante: comprobante  || null,
        notas:       notas        || null,
        interesMora: mora,
        monto:       montoPagado  ? parseFloat(montoPagado) : pago.monto,
      },
      include: {
        unidad: { include: { propietario: { select: { nombre: true, email: true } } } },
        cuota:  { select: { mes: true, anio: true } },
      },
    });

    res.json(actualizado);

    // Fire-and-forget: enviar recibo por email
    if (actualizado.unidad?.propietario?.email) {
      const edificio = await prisma.edificio.findUnique({ where: { id: req.edificioId }, select: { nombre: true } });
      emailSvc.enviarRecibo({
        propietario: actualizado.unidad.propietario,
        unidad:      actualizado.unidad,
        edificio,
        pago:        actualizado,
        cuota:       actualizado.cuota,
      }).catch(() => {});
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar pago' });
  }
}

// PUT /api/edificios/:edificioId/pagos/:pagoId/anular
async function anularPago(req, res) {
  const pagoId = parseInt(req.params.pagoId);
  try {
    const pago = await prisma.pagoCuota.findFirst({
      where: { id: pagoId, cuota: { edificioId: req.edificioId } },
    });
    if (!pago)                     return res.status(404).json({ error: 'Pago no encontrado' });
    if (pago.estado !== 'PAGADO')  return res.status(409).json({ error: 'Solo se pueden anular pagos en estado PAGADO' });

    const hoy      = new Date();
    const vence    = new Date(pago.fechaVence);
    const estado   = hoy > vence ? 'VENCIDO' : 'PENDIENTE';

    const actualizado = await prisma.pagoCuota.update({
      where: { id: pagoId },
      data:  { estado, fechaPago: null, metodo: null, referencia: null, interesMora: 0 },
    });
    res.json(actualizado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al anular pago' });
  }
}

// POST /api/edificios/:edificioId/pagos/actualizar-mora — delegado a mora.service
async function actualizarMora(req, res) {
  const { calcularMoraEdificio } = require('../services/mora.service');
  try {
    const result = await calcularMoraEdificio(req.edificioId);
    res.json({ actualizados: result.actualizados, mensaje: `${result.actualizados} pagos actualizados a VENCIDO con mora calculada` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar mora' });
  }
}

// GET /api/edificios/:edificioId/morosos  — Aging report
async function morosos(req, res) {
  try {
    const hoy = new Date();

    const pagosVencidos = await prisma.pagoCuota.findMany({
      where: {
        cuota:      { edificioId: req.edificioId },
        estado:     { not: 'PAGADO' },
        fechaVence: { lt: hoy },
      },
      include: {
        cuota:  { select: { mes: true, anio: true } },
        unidad: {
          include: { propietario: { select: { nombre: true, email: true, telefono: true } } },
        },
      },
      orderBy: { fechaVence: 'asc' },
    });

    // Agrupar por unidad
    const porUnidad = {};
    for (const p of pagosVencidos) {
      const uid = p.unidadId;
      if (!porUnidad[uid]) {
        porUnidad[uid] = {
          unidad:      p.unidad,
          propietario: p.unidad.propietario,
          cuotas:      [],
          totalDeuda:  0,
          diasMaxVencidos: 0,
        };
      }
      const dias  = Math.floor((hoy - new Date(p.fechaVence)) / (1000 * 60 * 60 * 24));
      const mora  = Number(p.interesMora);
      const total = +(Number(p.monto) + mora).toFixed(2);

      porUnidad[uid].cuotas.push({
        pagoId:  p.id,
        mes:     p.cuota.mes,
        anio:    p.cuota.anio,
        monto:   Number(p.monto),
        mora,
        total,
        diasVencidos: dias,
      });
      porUnidad[uid].totalDeuda      += total;
      porUnidad[uid].diasMaxVencidos  = Math.max(porUnidad[uid].diasMaxVencidos, dias);
    }

    // Clasificar por aging bucket
    const buckets = { '1-30': [], '31-60': [], '61-90': [], '91+': [] };
    for (const item of Object.values(porUnidad)) {
      item.totalDeuda = +item.totalDeuda.toFixed(2);
      const d = item.diasMaxVencidos;
      if      (d <= 30) buckets['1-30'].push(item);
      else if (d <= 60) buckets['31-60'].push(item);
      else if (d <= 90) buckets['61-90'].push(item);
      else              buckets['91+'].push(item);
    }

    const totalMorosos = Object.values(porUnidad).length;
    const totalDeuda   = +Object.values(porUnidad).reduce((s, u) => s + u.totalDeuda, 0).toFixed(2);

    res.json({ totalMorosos, totalDeuda, buckets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar reporte de morosos' });
  }
}

// POST /api/edificios/:edificioId/cuotas/morosos/notificar
async function notificarMorosos(req, res) {
  try {
    const hoy = new Date();
    const pagosVencidos = await prisma.pagoCuota.findMany({
      where: {
        cuota:      { edificioId: req.edificioId },
        estado:     { not: 'PAGADO' },
        fechaVence: { lt: hoy },
      },
      include: {
        cuota:  { select: { mes: true, anio: true } },
        unidad: { include: { propietario: { select: { nombre: true, email: true } } } },
      },
    });

    const edificio = await prisma.edificio.findUnique({
      where:  { id: req.edificioId },
      select: { nombre: true, tipoMora: true, tasaMora: true, montoMoraFijo: true },
    });
    const moraDesc = emailSvc.moraDescripcionEdificio(edificio);

    // Agrupar por unidad
    const porUnidad = {};
    for (const p of pagosVencidos) {
      const uid = p.unidadId;
      if (!porUnidad[uid]) {
        porUnidad[uid] = {
          unidad:      p.unidad,
          propietario: p.unidad.propietario,
          cuotas:      [],
          totalDeuda:  0,
        };
      }
      const mora  = Number(p.interesMora);
      const total = Number(p.monto) + mora;
      porUnidad[uid].cuotas.push({ mes: p.cuota.mes, anio: p.cuota.anio, monto: p.monto, interesMora: mora });
      porUnidad[uid].totalDeuda += total;
    }

    let enviados = 0, sinEmail = 0;
    for (const item of Object.values(porUnidad)) {
      if (!item.propietario?.email) { sinEmail++; continue; }
      await emailSvc.enviarAvisoMora({
        propietario:     item.propietario,
        unidad:          item.unidad,
        edificio,
        cuotasVencidas:  item.cuotas,
        totalDeuda:      +item.totalDeuda.toFixed(2),
        moraDescripcion: moraDesc,
      });
      enviados++;
    }

    res.json({
      mensaje:  `Notificaciones enviadas: ${enviados}. Sin email: ${sinEmail}.`,
      enviados,
      sinEmail,
      total: Object.values(porUnidad).length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al notificar morosos' });
  }
}

// GET /api/edificios/:edificioId/cuotas/siguiente
async function sugerirSiguiente(req, res) {
  try {
    const diaCorte = req.edificio.diaCorte || 5;

    const ultima = await prisma.cuotaMantenimiento.findFirst({
      where:   { edificioId: req.edificioId },
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
    });

    let mes, anio, monto;
    if (ultima) {
      const sig = new Date(ultima.anio, ultima.mes, 1); // JS overflows month 12 → next year
      mes   = sig.getMonth() + 1;
      anio  = sig.getFullYear();
      monto = Number(ultima.monto);
    } else {
      const now = new Date();
      mes   = now.getMonth() + 1;
      anio  = now.getFullYear();
      monto = 0;
    }

    const pad = n => String(n).padStart(2, '0');
    const fechaVence = `${anio}-${pad(mes)}-${pad(diaCorte)}`;

    const existe = await prisma.cuotaMantenimiento.findUnique({
      where: { edificioId_mes_anio: { edificioId: req.edificioId, mes, anio } },
    });

    res.json({ mes, anio, monto, fechaVence, yaExiste: !!existe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener sugerencia' });
  }
}

// POST /api/edificios/:edificioId/cuotas/:cuotaId/enviar-estado
async function enviarEstadoCuotaEmail(req, res) {
  const cuotaId = parseInt(req.params.cuotaId);
  try {
    const cuota = await prisma.cuotaMantenimiento.findFirst({
      where: { id: cuotaId, edificioId: req.edificioId },
    });
    if (!cuota) return res.status(404).json({ error: 'Cuota no encontrada' });

    const edificio = await prisma.edificio.findUnique({
      where: { id: req.edificioId },
      select: { id: true, nombre: true, direccion: true, ruc: true },
    });

    const pagos = await prisma.pagoCuota.findMany({
      where: { cuotaId },
      include: {
        unidad: {
          include: { propietario: { select: { nombre: true, email: true, telefono: true } } },
        },
      },
      orderBy: { unidad: { numero: 'asc' } },
    });

    const pdfBuffer = await generarEstadoCuotaBuffer(edificio, cuota, pagos);

    // Build unique propietarios with email
    const vistos = new Set();
    const destinatarios = [];
    for (const p of pagos) {
      const prop = p.unidad?.propietario;
      if (prop?.email && !vistos.has(prop.email)) {
        vistos.add(prop.email);
        destinatarios.push({ propietario: prop, unidad: p.unidad });
      }
    }

    if (destinatarios.length === 0) {
      return res.json({ enviados: 0, sinEmail: pagos.length, mensaje: 'Ningún propietario tiene email registrado' });
    }

    let enviados = 0;
    let errores  = 0;
    for (const { propietario, unidad } of destinatarios) {
      const ok = await emailSvc.enviarEstadoCuota({ propietario, unidad, edificio, cuota, pdfBuffer });
      if (ok) enviados++; else errores++;
    }

    res.json({
      enviados,
      errores,
      sinEmail: pagos.length - destinatarios.length,
      mensaje:  `Estado de cuenta enviado a ${enviados} propietario${enviados !== 1 ? 's' : ''}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar estado de cuenta' });
  }
}

// POST /api/edificios/:edificioId/cuotas/:cuotaId/recordatorio
async function enviarRecordatorioCuota(req, res) {
  const cuotaId = parseInt(req.params.cuotaId);
  try {
    const cuota = await prisma.cuotaMantenimiento.findFirst({
      where: { id: cuotaId, edificioId: req.edificioId },
    });
    if (!cuota) return res.status(404).json({ error: 'Cuota no encontrada' });

    const edificio = await prisma.edificio.findUnique({
      where: { id: req.edificioId },
      select: { id: true, nombre: true, direccion: true },
    });

    const pagos = await prisma.pagoCuota.findMany({
      where: { cuotaId, estado: { not: 'PAGADO' } },
      include: {
        unidad: {
          include: { propietario: { select: { nombre: true, email: true } } },
        },
      },
    });

    const vistos = new Set();
    let enviados = 0;
    let sinEmail = 0;

    for (const pago of pagos) {
      const propietario = pago.unidad?.propietario;
      if (!propietario?.email) { sinEmail++; continue; }
      if (vistos.has(propietario.email)) continue;
      vistos.add(propietario.email);
      const ok = await emailSvc.enviarRecordatorio({ propietario, unidad: pago.unidad, edificio, cuota, pago });
      if (ok) enviados++;
    }

    res.json({
      enviados,
      sinEmail,
      mensaje: `Recordatorio enviado a ${enviados} propietario${enviados !== 1 ? 's' : ''}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar recordatorios' });
  }
}

module.exports = { listar, obtener, crear, eliminar, listarPagos, registrarPago, anularPago, actualizarMora, morosos, notificarMorosos, sugerirSiguiente, enviarEstadoCuotaEmail, enviarRecordatorioCuota };
