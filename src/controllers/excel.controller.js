const prisma = require('../config/prisma');
const { pagosExcel, morososExcel, visitasExcel, balanceExcel, ordenesExcel, ingresosExcel, propietariosExcel, unidadesExcel, reservasExcel } = require('../utils/excel');
const { datosBalance } = require('../controllers/reportes.controller');

function send(res, buf, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}

// GET /api/edificios/:edificioId/cuotas/:cuotaId/pagos.xlsx
async function exportarPagosCuota(req, res) {
  const cuotaId = parseInt(req.params.cuotaId);
  try {
    const cuota = await prisma.cuotaMantenimiento.findFirst({
      where:   { id: cuotaId, edificioId: req.edificioId },
      include: {
        pagos: {
          include: {
            unidad: { include: { propietario: { select: { nombre: true, email: true } } } },
          },
          orderBy: { unidad: { numero: 'asc' } },
        },
      },
    });
    if (!cuota) return res.status(404).json({ error: 'Cuota no encontrada' });

    const buf = await pagosExcel({ cuota, pagos: cuota.pagos, edificioNombre: req.edificio.nombre });
    send(res, buf, `Pagos_${cuota.mes}_${cuota.anio}.xlsx`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar Excel' });
  }
}

// GET /api/edificios/:edificioId/cuotas/morosos.xlsx
async function exportarMorosos(req, res) {
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
        unidad: { include: { propietario: { select: { nombre: true, email: true, telefono: true } } } },
      },
      orderBy: { fechaVence: 'asc' },
    });

    // Mismo agrupamiento que morosos endpoint
    const porUnidad = {};
    for (const p of pagosVencidos) {
      const uid = p.unidadId;
      if (!porUnidad[uid]) {
        porUnidad[uid] = { unidad: p.unidad, propietario: p.unidad.propietario, cuotas: [], totalDeuda: 0, diasMaxVencidos: 0 };
      }
      const dias  = Math.floor((hoy - new Date(p.fechaVence)) / (1000 * 60 * 60 * 24));
      const mora  = Number(p.interesMora);
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

    const totalDeuda = +Object.values(porUnidad).reduce((s, u) => s + u.totalDeuda, 0).toFixed(2);
    const data = { buckets, totalDeuda, totalMorosos: Object.values(porUnidad).length };

    const buf = await morososExcel({ data, edificioNombre: req.edificio.nombre });
    send(res, buf, `Morosos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar Excel' });
  }
}

// GET /api/edificios/:edificioId/visitas.xlsx?fecha=
async function exportarVisitas(req, res) {
  const { fecha } = req.query;
  try {
    const where = { edificioId: req.edificioId };
    if (fecha) {
      const inicio = new Date(fecha + 'T00:00:00');
      const fin    = new Date(fecha + 'T23:59:59');
      where.fechaVisita = { gte: inicio, lte: fin };
    }

    const visitas = await prisma.visita.findMany({
      where,
      include: {
        unidad:      { select: { numero: true } },
        propietario: { select: { nombre: true } },
      },
      orderBy: [{ fechaVisita: 'desc' }, { creadoEn: 'desc' }],
    });

    const buf = await visitasExcel({ visitas, edificioNombre: req.edificio.nombre, fecha });
    const nombre = fecha ? `Visitas_${fecha}.xlsx` : `Visitas_${new Date().toISOString().slice(0, 10)}.xlsx`;
    send(res, buf, nombre);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar Excel' });
  }
}

// GET /api/edificios/:edificioId/cuotas/reportes/balance.xlsx?mes=&anio=
async function exportarBalance(req, res) {
  const mes  = parseInt(req.query.mes)  || new Date().getMonth() + 1;
  const anio = parseInt(req.query.anio) || new Date().getFullYear();
  if (mes < 1 || mes > 12) return res.status(400).json({ error: 'mes inválido' });
  try {
    const data = await datosBalance(req.edificioId, mes, anio);
    const buf  = await balanceExcel({ data });
    send(res, buf, `Balance_${String(mes).padStart(2, '0')}_${anio}_${data.edificio.nombre.replace(/\s+/g, '_')}.xlsx`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar Excel de balance' });
  }
}

// GET /api/edificios/:edificioId/ordenes.xlsx?estado=&prioridad=
async function exportarOrdenes(req, res) {
  const { estado, prioridad } = req.query;
  try {
    const where = { edificioId: req.edificioId };
    if (estado)    where.estado    = estado;
    if (prioridad) where.prioridad = prioridad;

    const ordenes = await prisma.ordenTrabajo.findMany({
      where,
      include: { proveedor: { select: { nombre: true, servicio: true } } },
      orderBy: [{ prioridad: 'asc' }, { fecha: 'desc' }],
    });

    const buf = await ordenesExcel({ ordenes, edificioNombre: req.edificio.nombre });
    send(res, buf, `Ordenes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar Excel de órdenes' });
  }
}

// GET /api/edificios/:edificioId/ingresos.xlsx?anio=&mes=&categoria=
async function exportarIngresos(req, res) {
  const anio      = parseInt(req.query.anio) || new Date().getFullYear();
  const mes       = parseInt(req.query.mes)  || null;
  const categoria = req.query.categoria      || null;
  try {
    const inicio = new Date(anio, mes ? mes - 1 : 0, 1);
    const fin    = mes ? new Date(anio, mes, 0, 23, 59, 59) : new Date(anio, 11, 31, 23, 59, 59);

    const where = { edificioId: req.edificioId, fecha: { gte: inicio, lte: fin } };
    if (categoria) where.categoria = categoria;

    const ingresos = await prisma.ingreso.findMany({
      where,
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    });

    const buf = await ingresosExcel({ ingresos, edificioNombre: req.edificio.nombre, anio });
    send(res, buf, `Ingresos_${anio}${mes ? `_${String(mes).padStart(2, '0')}` : ''}.xlsx`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar Excel de ingresos' });
  }
}

// GET /api/edificios/:edificioId/propietarios.xlsx
async function exportarPropietarios(req, res) {
  try {
    const propietarios = await prisma.propietario.findMany({
      where:   { unidad: { edificioId: req.edificioId } },
      include: { unidad: { select: { numero: true } } },
      orderBy: [{ unidad: { numero: 'asc' } }, { nombre: 'asc' }],
    });
    const buf = await propietariosExcel({ propietarios, edificioNombre: req.edificio.nombre });
    send(res, buf, `Propietarios_${req.edificio.nombre.replace(/\s+/g, '_')}.xlsx`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar Excel de propietarios' });
  }
}

// GET /api/edificios/:edificioId/unidades.xlsx
async function exportarUnidades(req, res) {
  try {
    const unidades = await prisma.unidad.findMany({
      where:   { edificioId: req.edificioId },
      include: { propietario: { select: { nombre: true, email: true } } },
      orderBy: { numero: 'asc' },
    });
    const buf = await unidadesExcel({ unidades, edificioNombre: req.edificio.nombre });
    send(res, buf, `Unidades_${req.edificio.nombre.replace(/\s+/g, '_')}.xlsx`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar Excel de unidades' });
  }
}

// GET /api/edificios/:edificioId/reservas.xlsx
async function exportarReservas(req, res) {
  const { area, estado } = req.query;
  try {
    const where = { edificioId: req.edificioId };
    if (area)   where.area   = area;
    if (estado) where.estado = estado;

    const reservas = await prisma.reservaArea.findMany({
      where,
      include: {
        unidad: { include: { propietario: { select: { nombre: true } } } },
      },
      orderBy: [{ fecha: 'desc' }, { horaInicio: 'asc' }],
    });
    const buf = await reservasExcel({ reservas, edificioNombre: req.edificio.nombre });
    send(res, buf, `Reservas_${req.edificio.nombre.replace(/\s+/g, '_')}.xlsx`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar Excel de reservas' });
  }
}

module.exports = { exportarPagosCuota, exportarMorosos, exportarVisitas, exportarBalance, exportarOrdenes, exportarIngresos, exportarPropietarios, exportarUnidades, exportarReservas };
