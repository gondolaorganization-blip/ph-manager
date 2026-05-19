const prisma = require('../config/prisma');
const { paginar } = require('../utils/paginar');

const CATEGORIAS = ['MANTENIMIENTO', 'SERVICIOS', 'PERSONAL', 'ADMINISTRACION', 'FONDO_RESERVA', 'OTROS'];

// GET /api/edificios/:edificioId/gastos  ?anio=&mes=&categoria=&page=&limit=
async function listar(req, res) {
  const { anio, mes, categoria } = req.query;
  try {
    const where = { edificioId: req.edificioId };
    if (categoria) where.categoria = categoria;
    if (anio || mes) {
      const desde = new Date(parseInt(anio) || new Date().getFullYear(), mes ? parseInt(mes) - 1 : 0, 1);
      const hasta = mes
        ? new Date(parseInt(anio) || new Date().getFullYear(), parseInt(mes), 0)
        : new Date(parseInt(anio) || new Date().getFullYear(), 12, 0);
      where.fecha = { gte: desde, lte: hasta };
    }
    const result = await paginar(prisma.gasto, { where, orderBy: { fecha: 'desc' } }, req.query);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar gastos' });
  }
}

// GET /api/edificios/:edificioId/gastos/resumen?anio=
async function resumen(req, res) {
  const anio = parseInt(req.query.anio) || new Date().getFullYear();
  try {
    const [edificio, gastos] = await Promise.all([
      prisma.edificio.findUnique({ where: { id: req.edificioId }, select: { fondoReserva: true } }),
      prisma.gasto.findMany({
        where: { edificioId: req.edificioId, fecha: { gte: new Date(anio, 0, 1), lte: new Date(anio, 11, 31) } },
        orderBy: { fecha: 'asc' },
      }),
    ]);

    // Total por categoría
    const porCategoria = CATEGORIAS.map(cat => ({
      categoria: cat,
      total: +gastos.filter(g => g.categoria === cat).reduce((s, g) => s + Number(g.monto), 0).toFixed(2),
      count: gastos.filter(g => g.categoria === cat).length,
    }));

    // Total por mes
    const porMes = Array.from({ length: 12 }, (_, i) => {
      const total = +gastos.filter(g => new Date(g.fecha).getMonth() === i).reduce((s, g) => s + Number(g.monto), 0).toFixed(2);
      return { mes: i + 1, total };
    });

    const totalAnio = +gastos.reduce((s, g) => s + Number(g.monto), 0).toFixed(2);

    res.json({
      anio,
      fondoReserva: Number(edificio.fondoReserva),
      totalAnio,
      porCategoria,
      porMes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar resumen de gastos' });
  }
}

// POST /api/edificios/:edificioId/gastos
async function crear(req, res) {
  const { categoria, descripcion, monto, fecha, proveedor, notas } = req.body;
  if (!categoria || !descripcion || !monto || !fecha) {
    return res.status(400).json({ error: 'categoria, descripcion, monto y fecha son requeridos' });
  }
  if (!CATEGORIAS.includes(categoria)) {
    return res.status(400).json({ error: `categoria inválida. Use: ${CATEGORIAS.join(', ')}` });
  }
  try {
    const gasto = await prisma.gasto.create({
      data: {
        edificioId:  req.edificioId,
        categoria,
        descripcion,
        monto:       parseFloat(monto),
        fecha:       new Date(fecha),
        proveedor:   proveedor || null,
        notas:       notas     || null,
      },
    });

    // Si el gasto afecta el fondo de reserva, descontar automáticamente
    if (categoria === 'FONDO_RESERVA') {
      await prisma.edificio.update({
        where: { id: req.edificioId },
        data:  { fondoReserva: { decrement: parseFloat(monto) } },
      });
    }

    res.status(201).json(gasto);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear gasto' });
  }
}

// PUT /api/edificios/:edificioId/gastos/:gastoId
async function actualizar(req, res) {
  const id = parseInt(req.params.gastoId);
  const { categoria, descripcion, monto, fecha, proveedor, notas } = req.body;
  try {
    const existe = await prisma.gasto.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!existe) return res.status(404).json({ error: 'Gasto no encontrado' });
    if (categoria && !CATEGORIAS.includes(categoria)) {
      return res.status(400).json({ error: `categoria inválida. Use: ${CATEGORIAS.join(', ')}` });
    }

    // Revertir ajuste de fondo si cambia categoría o monto
    if (existe.categoria === 'FONDO_RESERVA') {
      await prisma.edificio.update({
        where: { id: req.edificioId },
        data:  { fondoReserva: { increment: Number(existe.monto) } },
      });
    }

    const gasto = await prisma.gasto.update({
      where: { id },
      data: {
        ...(categoria   !== undefined && { categoria }),
        ...(descripcion !== undefined && { descripcion }),
        ...(monto       !== undefined && { monto: parseFloat(monto) }),
        ...(fecha       !== undefined && { fecha: new Date(fecha) }),
        ...(proveedor   !== undefined && { proveedor: proveedor || null }),
        ...(notas       !== undefined && { notas: notas || null }),
      },
    });

    const catFinal = categoria ?? existe.categoria;
    if (catFinal === 'FONDO_RESERVA') {
      const montoFinal = monto !== undefined ? parseFloat(monto) : Number(existe.monto);
      await prisma.edificio.update({
        where: { id: req.edificioId },
        data:  { fondoReserva: { decrement: montoFinal } },
      });
    }

    res.json(gasto);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar gasto' });
  }
}

// DELETE /api/edificios/:edificioId/gastos/:gastoId
async function eliminar(req, res) {
  const id = parseInt(req.params.gastoId);
  try {
    const gasto = await prisma.gasto.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!gasto) return res.status(404).json({ error: 'Gasto no encontrado' });

    await prisma.gasto.delete({ where: { id } });

    // Revertir si era FONDO_RESERVA
    if (gasto.categoria === 'FONDO_RESERVA') {
      await prisma.edificio.update({
        where: { id: req.edificioId },
        data:  { fondoReserva: { increment: Number(gasto.monto) } },
      });
    }

    res.json({ message: 'Gasto eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar gasto' });
  }
}

// PUT /api/edificios/:edificioId/fondo-reserva
async function ajustarFondo(req, res) {
  const { monto, operacion, notas } = req.body;
  if (!monto || !operacion) return res.status(400).json({ error: 'monto y operacion (INCREMENTAR/DECREMENTAR/FIJAR) son requeridos' });
  if (!['INCREMENTAR', 'DECREMENTAR', 'FIJAR'].includes(operacion)) {
    return res.status(400).json({ error: 'operacion inválida. Use: INCREMENTAR, DECREMENTAR, FIJAR' });
  }
  try {
    let data;
    if (operacion === 'FIJAR')        data = { fondoReserva: parseFloat(monto) };
    else if (operacion === 'INCREMENTAR') data = { fondoReserva: { increment: parseFloat(monto) } };
    else                               data = { fondoReserva: { decrement: parseFloat(monto) } };

    const edificio = await prisma.edificio.update({
      where: { id: req.edificioId },
      data,
      select: { id: true, nombre: true, fondoReserva: true },
    });

    // Registrar como gasto si aplica
    if (operacion === 'DECREMENTAR') {
      await prisma.gasto.create({
        data: {
          edificioId:  req.edificioId,
          categoria:   'FONDO_RESERVA',
          descripcion: notas || 'Retiro de fondo de reserva',
          monto:       parseFloat(monto),
          fecha:       new Date(),
        },
      });
    }

    res.json({ ...edificio, fondoReserva: Number(edificio.fondoReserva) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al ajustar fondo de reserva' });
  }
}

module.exports = { listar, resumen, crear, actualizar, eliminar, ajustarFondo };
