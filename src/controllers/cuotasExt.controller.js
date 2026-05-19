const prisma = require('../config/prisma');
const { createDoc, drawFooter, generarReciboExt } = require('../services/pdf.service');

const TIPOS = ['FIJO', 'PROPORCIONAL'];
const METODOS = ['EFECTIVO', 'TRANSFERENCIA', 'YAPPY', 'CHEQUE'];

const INCLUDE_PAGOS = {
  unidad: {
    include: {
      propietario: { select: { nombre: true, email: true, telefono: true } },
    },
  },
};

// GET /api/edificios/:edificioId/cuotas-ext
async function listar(req, res) {
  try {
    const cuotas = await prisma.cuotaExtraordinaria.findMany({
      where: { edificioId: req.edificioId },
      include: {
        pagos: { select: { estado: true, monto: true } },
      },
      orderBy: { creadoEn: 'desc' },
    });

    const data = cuotas.map(c => {
      const total    = c.pagos.length;
      const pagados  = c.pagos.filter(p => p.estado === 'PAGADO').length;
      const vencidos = c.pagos.filter(p => p.estado === 'VENCIDO').length;
      const recaudado = c.pagos.filter(p => p.estado === 'PAGADO')
        .reduce((s, p) => s + Number(p.monto), 0);
      const porCobrar = c.pagos.filter(p => p.estado !== 'PAGADO')
        .reduce((s, p) => s + Number(p.monto), 0);
      const { pagos: _, ...rest } = c;
      return {
        ...rest,
        stats: { total, pagados, vencidos, pendientes: total - pagados - vencidos,
                 recaudado: +recaudado.toFixed(2), porCobrar: +porCobrar.toFixed(2) },
      };
    });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar cuotas extraordinarias' });
  }
}

// POST /api/edificios/:edificioId/cuotas-ext
async function crear(req, res) {
  const { descripcion, monto, tipoDistribucion = 'FIJO', fechaVence, notas } = req.body;
  if (!descripcion || !monto || !fechaVence) {
    return res.status(400).json({ error: 'descripcion, monto y fechaVence son requeridos' });
  }
  if (!TIPOS.includes(tipoDistribucion)) {
    return res.status(400).json({ error: `tipoDistribucion inválido. Use: ${TIPOS.join(', ')}` });
  }

  try {
    const unidades = await prisma.unidad.findMany({
      where:   { edificioId: req.edificioId, activa: true },
      select:  { id: true, coeficiente: true },
      orderBy: { numero: 'asc' },
    });

    if (unidades.length === 0) {
      return res.status(409).json({ error: 'No hay unidades activas en este edificio' });
    }

    const montoNum = parseFloat(monto);
    const vence    = new Date(fechaVence);
    let pagosData;

    if (tipoDistribucion === 'FIJO') {
      pagosData = unidades.map(u => ({
        unidadId: u.id, monto: montoNum, fechaVence: vence, estado: 'PENDIENTE',
      }));
    } else {
      // PROPORCIONAL: monto es el total, se distribuye por coeficiente
      const sumCoef = unidades.reduce((s, u) => s + Number(u.coeficiente), 0) || 1;
      pagosData = unidades.map(u => ({
        unidadId: u.id,
        monto:    +(montoNum * (Number(u.coeficiente) / sumCoef)).toFixed(2),
        fechaVence: vence,
        estado:   'PENDIENTE',
      }));
    }

    const cuota = await prisma.cuotaExtraordinaria.create({
      data: {
        edificioId: req.edificioId,
        descripcion,
        monto:           montoNum,
        tipoDistribucion,
        fechaVence:      vence,
        notas:           notas || null,
        pagos:           { createMany: { data: pagosData } },
      },
      include: { _count: { select: { pagos: true } } },
    });

    res.status(201).json({ ...cuota, pagosGenerados: cuota._count.pagos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear cuota extraordinaria' });
  }
}

// DELETE /api/edificios/:edificioId/cuotas-ext/:cuotaExtId
async function eliminar(req, res) {
  const id = parseInt(req.params.cuotaExtId);
  try {
    const cuota = await prisma.cuotaExtraordinaria.findFirst({
      where:   { id, edificioId: req.edificioId },
      include: { pagos: { where: { estado: 'PAGADO' }, select: { id: true } } },
    });
    if (!cuota) return res.status(404).json({ error: 'Cuota extraordinaria no encontrada' });
    if (cuota.pagos.length > 0) {
      return res.status(409).json({ error: 'No se puede eliminar: hay pagos registrados' });
    }
    await prisma.cuotaExtraordinaria.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar cuota extraordinaria' });
  }
}

// GET /api/edificios/:edificioId/cuotas-ext/:cuotaExtId/pagos
async function listarPagos(req, res) {
  const id = parseInt(req.params.cuotaExtId);
  try {
    const cuota = await prisma.cuotaExtraordinaria.findFirst({
      where:   { id, edificioId: req.edificioId },
    });
    if (!cuota) return res.status(404).json({ error: 'Cuota extraordinaria no encontrada' });

    const pagos = await prisma.pagoCuotaExt.findMany({
      where:   { cuotaId: id },
      include: INCLUDE_PAGOS,
      orderBy: { unidad: { numero: 'asc' } },
    });

    const stats = {
      total:     pagos.length,
      pagados:   pagos.filter(p => p.estado === 'PAGADO').length,
      vencidos:  pagos.filter(p => p.estado === 'VENCIDO').length,
      pendientes: pagos.filter(p => p.estado === 'PENDIENTE').length,
      recaudado:  +pagos.filter(p => p.estado === 'PAGADO')
        .reduce((s, p) => s + Number(p.monto), 0).toFixed(2),
      porCobrar:  +pagos.filter(p => p.estado !== 'PAGADO')
        .reduce((s, p) => s + Number(p.monto), 0).toFixed(2),
    };

    res.json({ cuota, pagos, stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener pagos' });
  }
}

// PUT /api/edificios/:edificioId/cuotas-ext/:cuotaExtId/pagos/:pagoId/pagar
async function registrarPago(req, res) {
  const pagoId = parseInt(req.params.pagoId);
  const { metodo, referencia, fecha, notas, comprobante } = req.body;
  if (!metodo) return res.status(400).json({ error: 'metodo es requerido' });
  if (!METODOS.includes(metodo)) return res.status(400).json({ error: `metodo inválido. Use: ${METODOS.join(', ')}` });

  try {
    const pago = await prisma.pagoCuotaExt.findFirst({
      where: { id: pagoId, cuota: { edificioId: req.edificioId } },
    });
    if (!pago)                     return res.status(404).json({ error: 'Pago no encontrado' });
    if (pago.estado === 'PAGADO')  return res.status(409).json({ error: 'El pago ya está registrado' });

    const updated = await prisma.pagoCuotaExt.update({
      where: { id: pagoId },
      data: {
        estado:     'PAGADO',
        fechaPago:  fecha ? new Date(fecha) : new Date(),
        metodo,
        referencia: referencia  || null,
        notas:      notas       || null,
        comprobante: comprobante || null,
      },
      include: INCLUDE_PAGOS,
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar pago' });
  }
}

// PUT /api/edificios/:edificioId/cuotas-ext/:cuotaExtId/pagos/:pagoId/anular
async function anularPago(req, res) {
  const pagoId = parseInt(req.params.pagoId);
  try {
    const pago = await prisma.pagoCuotaExt.findFirst({
      where: { id: pagoId, cuota: { edificioId: req.edificioId } },
    });
    if (!pago)                      return res.status(404).json({ error: 'Pago no encontrado' });
    if (pago.estado !== 'PAGADO')   return res.status(409).json({ error: 'El pago no está en estado PAGADO' });

    const hoy   = new Date(); hoy.setHours(0, 0, 0, 0);
    const vence = new Date(pago.fechaVence);
    const updated = await prisma.pagoCuotaExt.update({
      where: { id: pagoId },
      data: {
        estado:     vence < hoy ? 'VENCIDO' : 'PENDIENTE',
        fechaPago:  null,
        metodo:     null,
        referencia: null,
        notas:      null,
      },
      include: INCLUDE_PAGOS,
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al anular pago' });
  }
}

// POST /api/edificios/:edificioId/cuotas-ext/:cuotaExtId/mora
async function calcularMora(req, res) {
  const id  = parseInt(req.params.cuotaExtId);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  try {
    const cuota = await prisma.cuotaExtraordinaria.findFirst({
      where: { id, edificioId: req.edificioId },
    });
    if (!cuota) return res.status(404).json({ error: 'Cuota extraordinaria no encontrada' });

    const result = await prisma.pagoCuotaExt.updateMany({
      where: { cuotaId: id, estado: 'PENDIENTE', fechaVence: { lt: hoy } },
      data:  { estado: 'VENCIDO' },
    });
    res.json({ actualizados: result.count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular mora' });
  }
}

// GET /api/edificios/:edificioId/cuotas-ext/:cuotaExtId/pagos/:pagoId/recibo.pdf
async function reciboPago(req, res) {
  const pagoId = parseInt(req.params.pagoId);
  try {
    const pago = await prisma.pagoCuotaExt.findFirst({
      where:   { id: pagoId, cuota: { edificioId: req.edificioId } },
      include: {
        cuota:  { select: { descripcion: true } },
        unidad: { include: { propietario: { select: { nombre: true, email: true } } } },
      },
    });
    if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });
    if (pago.estado !== 'PAGADO') return res.status(409).json({ error: 'Solo se puede generar recibo de pagos en estado PAGADO' });

    const edificio = await prisma.edificio.findUnique({
      where:  { id: req.edificioId },
      select: { nombre: true, direccion: true, ruc: true },
    });

    const filename = `Recibo_Ext_${String(pago.id).padStart(6, '0')}_${pago.unidad.numero}.pdf`;
    const doc = createDoc(res, filename);
    generarReciboExt(doc, edificio, pago);
    drawFooter(doc);
    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Error al generar recibo' });
  }
}

// POST /api/edificios/:edificioId/cuotas-ext/:cuotaExtId/recordatorio
async function enviarRecordatorio(req, res) {
  const cuotaExtId = parseInt(req.params.cuotaExtId);
  try {
    const cuota = await prisma.cuotaExtraordinaria.findFirst({
      where: { id: cuotaExtId, edificioId: req.edificioId },
    });
    if (!cuota) return res.status(404).json({ error: 'Cuota extraordinaria no encontrada' });

    const edificio = await prisma.edificio.findUnique({
      where:  { id: req.edificioId },
      select: { nombre: true },
    });

    const pagos = await prisma.pagoCuotaExt.findMany({
      where:   { cuotaId: cuotaExtId, estado: { not: 'PAGADO' } },
      include: { unidad: { include: { propietario: { select: { nombre: true, email: true } } } } },
    });

    const emailSvc = require('../services/email.service');
    const vistos   = new Set();
    let enviados   = 0;
    let sinEmail   = 0;

    for (const pago of pagos) {
      const propietario = pago.unidad?.propietario;
      if (!propietario?.email) { sinEmail++; continue; }
      if (vistos.has(propietario.email)) continue;
      vistos.add(propietario.email);
      const ok = await emailSvc.enviarRecordatorioExt({ propietario, unidad: pago.unidad, edificio, cuota, pago });
      if (ok) enviados++;
    }

    res.json({ enviados, sinEmail, mensaje: `Recordatorio enviado a ${enviados} propietario${enviados !== 1 ? 's' : ''}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar recordatorios' });
  }
}

module.exports = { listar, crear, eliminar, listarPagos, registrarPago, anularPago, calcularMora, reciboPago, enviarRecordatorio };
