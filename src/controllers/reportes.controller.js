const prisma = require('../config/prisma');
const { createDoc, drawFooter, generarRecibo, generarEstadoCuota, generarMorosos, generarBalance } = require('../services/pdf.service');

// GET /api/edificios/:edificioId/cuotas/:cuotaId/reporte.pdf
async function estadoCuota(req, res) {
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

    const filename = `cuota-${cuota.mes}-${cuota.anio}-${edificio.nombre.replace(/\s+/g, '_')}.pdf`;
    const doc = createDoc(res, filename);
    generarEstadoCuota(doc, edificio, cuota, pagos);
    drawFooter(doc);
    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Error al generar reporte de cuota' });
  }
}

// GET /api/edificios/:edificioId/pagos/:pagoId/recibo.pdf
async function reciboPago(req, res) {
  const pagoId = parseInt(req.params.pagoId);
  try {
    const pago = await prisma.pagoCuota.findFirst({
      where: { id: pagoId, cuota: { edificioId: req.edificioId } },
      include: {
        cuota:  { select: { mes: true, anio: true } },
        unidad: {
          include: { propietario: { select: { nombre: true, email: true, telefono: true } } },
        },
      },
    });
    if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });
    if (pago.estado !== 'PAGADO') return res.status(409).json({ error: 'Solo se puede generar recibo de pagos en estado PAGADO' });

    const edificio = await prisma.edificio.findUnique({
      where: { id: req.edificioId },
      select: { id: true, nombre: true, direccion: true, ruc: true },
    });

    const filename = `recibo-${String(pago.id).padStart(6, '0')}-${pago.unidad.numero}.pdf`;
    const doc = createDoc(res, filename);
    generarRecibo(doc, edificio, pago);
    drawFooter(doc);
    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Error al generar recibo' });
  }
}

// GET /api/edificios/:edificioId/reportes/morosos.pdf
async function reporteMorosos(req, res) {
  try {
    const hoy = new Date();

    const edificio = await prisma.edificio.findUnique({
      where: { id: req.edificioId },
      select: { id: true, nombre: true, direccion: true, ruc: true },
    });

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

    const tasa = Number(req.edificio.tasaMora);
    const calcularMora = (monto, fechaVence) => {
      const dias = Math.floor((hoy - new Date(fechaVence)) / (1000 * 60 * 60 * 24));
      return +(Number(monto) * tasa * (dias / 30)).toFixed(2);
    };

    const porUnidad = {};
    for (const p of pagosVencidos) {
      const uid = p.unidadId;
      if (!porUnidad[uid]) {
        porUnidad[uid] = {
          unidad: p.unidad,
          propietario: p.unidad.propietario,
          cuotas: [],
          totalDeuda: 0,
          diasMaxVencidos: 0,
        };
      }
      const dias  = Math.floor((hoy - new Date(p.fechaVence)) / (1000 * 60 * 60 * 24));
      const mora  = calcularMora(p.monto, p.fechaVence);
      const total = +(Number(p.monto) + mora).toFixed(2);
      porUnidad[uid].cuotas.push({ mes: p.cuota.mes, anio: p.cuota.anio, monto: Number(p.monto), mora, total, diasVencidos: dias });
      porUnidad[uid].totalDeuda      += total;
      porUnidad[uid].diasMaxVencidos  = Math.max(porUnidad[uid].diasMaxVencidos, dias);
    }

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

    const filename = `morosos-${edificio.nombre.replace(/\s+/g, '_')}-${hoy.toISOString().slice(0, 10)}.pdf`;
    const doc = createDoc(res, filename);
    generarMorosos(doc, edificio, { totalMorosos, totalDeuda, buckets });
    drawFooter(doc);
    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Error al generar reporte de morosos' });
  }
}

// ── Balance financiero ────────────────────────────────────────────────────────

async function _datosBalance(edificioId, mes, anio) {
  const desde = new Date(anio, mes - 1, 1);
  const hasta = new Date(anio, mes, 0, 23, 59, 59);

  const [pagos, pagosExt, gastos, ingresosVarios, edificio] = await Promise.all([
    prisma.pagoCuota.findMany({
      where: {
        cuota:    { edificioId },
        estado:   'PAGADO',
        fechaPago: { gte: desde, lte: hasta },
      },
      include: {
        unidad: { include: { propietario: { select: { nombre: true } } } },
        cuota:  { select: { mes: true, anio: true } },
      },
      orderBy: { fechaPago: 'asc' },
    }),
    prisma.pagoCuotaExt.findMany({
      where: {
        cuota:    { edificioId },
        estado:   'PAGADO',
        fechaPago: { gte: desde, lte: hasta },
      },
      include: {
        cuota:  { select: { descripcion: true } },
        unidad: { include: { propietario: { select: { nombre: true } } } },
      },
      orderBy: { fechaPago: 'asc' },
    }),
    prisma.gasto.findMany({
      where: { edificioId, fecha: { gte: desde, lte: hasta } },
      orderBy: { fecha: 'asc' },
    }),
    prisma.ingreso.findMany({
      where: { edificioId, fecha: { gte: desde, lte: hasta } },
      orderBy: { fecha: 'asc' },
    }),
    prisma.edificio.findUnique({
      where: { id: edificioId },
      select: { nombre: true, direccion: true, ruc: true, fondoReserva: true },
    }),
  ]);

  const deudaAgg = await prisma.pagoCuota.aggregate({
    where: { cuota: { edificioId }, estado: { not: 'PAGADO' } },
    _sum:  { monto: true },
  });

  const totalCuotas         = pagos.reduce((s, p) => s + Number(p.monto) + Number(p.interesMora), 0);
  const totalCuotasExt      = pagosExt.reduce((s, p) => s + Number(p.monto), 0);
  const totalIngresosVarios = ingresosVarios.reduce((s, i) => s + Number(i.monto), 0);
  const totalIngresos       = totalCuotas + totalCuotasExt + totalIngresosVarios;
  const totalGastos         = gastos.reduce((s, g) => s + Number(g.monto), 0);

  const porCategoria = {};
  for (const g of gastos) {
    porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + Number(g.monto);
  }

  return {
    periodo:  { mes, anio },
    edificio,
    ingresos: {
      total:   +totalCuotas.toFixed(2),
      count:   pagos.length,
      detalle: pagos.map(p => ({
        unidad:      p.unidad.numero,
        propietario: p.unidad.propietario?.nombre || '—',
        monto:       Number(p.monto),
        mora:        Number(p.interesMora),
        total:       +(Number(p.monto) + Number(p.interesMora)).toFixed(2),
        fechaPago:   p.fechaPago,
        cuota:       { mes: p.cuota.mes, anio: p.cuota.anio },
      })),
    },
    ingresosExt: {
      total:   +totalCuotasExt.toFixed(2),
      count:   pagosExt.length,
      detalle: pagosExt.map(p => ({
        id:          p.id,
        descripcion: p.cuota.descripcion,
        unidad:      p.unidad.numero,
        propietario: p.unidad.propietario?.nombre || '—',
        monto:       Number(p.monto),
        fechaPago:   p.fechaPago,
      })),
    },
    ingresosVarios: {
      total:   +totalIngresosVarios.toFixed(2),
      count:   ingresosVarios.length,
      detalle: ingresosVarios.map(i => ({
        id:          i.id,
        categoria:   i.categoria,
        descripcion: i.descripcion,
        monto:       Number(i.monto),
        fecha:       i.fecha,
        referencia:  i.referencia || null,
      })),
    },
    gastos: {
      total:       +totalGastos.toFixed(2),
      count:       gastos.length,
      porCategoria,
      detalle:     gastos.map(g => ({
        descripcion: g.descripcion,
        categoria:   g.categoria,
        monto:       Number(g.monto),
        fecha:       g.fecha,
        proveedor:   g.proveedor || null,
      })),
    },
    balance:        +(totalIngresos - totalGastos).toFixed(2),
    fondoReserva:   Number(edificio.fondoReserva),
    deudaPendiente: +Number(deudaAgg._sum.monto || 0).toFixed(2),
  };
}

// GET /api/edificios/:edificioId/cuotas/reportes/balance?mes=&anio=
async function balanceFinanciero(req, res) {
  const mes  = parseInt(req.query.mes)  || new Date().getMonth() + 1;
  const anio = parseInt(req.query.anio) || new Date().getFullYear();
  if (mes < 1 || mes > 12) return res.status(400).json({ error: 'mes debe ser entre 1 y 12' });
  try {
    const data = await _datosBalance(req.edificioId, mes, anio);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar balance financiero' });
  }
}

// GET /api/edificios/:edificioId/cuotas/reportes/balance.pdf?mes=&anio=
async function balancePdf(req, res) {
  const mes  = parseInt(req.query.mes)  || new Date().getMonth() + 1;
  const anio = parseInt(req.query.anio) || new Date().getFullYear();
  try {
    const data = await _datosBalance(req.edificioId, mes, anio);
    const filename = `balance-${String(mes).padStart(2,'0')}-${anio}-${data.edificio.nombre.replace(/\s+/g,'_')}.pdf`;
    const doc = createDoc(res, filename);
    generarBalance(doc, data.edificio, data);
    drawFooter(doc);
    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Error al generar PDF de balance' });
  }
}

module.exports = { estadoCuota, reciboPago, reporteMorosos, balanceFinanciero, balancePdf, datosBalance: _datosBalance };
