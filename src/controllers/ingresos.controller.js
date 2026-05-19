const prisma = require('../config/prisma');
const { paginar } = require('../utils/paginar');

const CATEGORIAS = ['MULTA', 'ALQUILER', 'INTERESES', 'CUOTA_EXTRAORDINARIA', 'OTROS'];

// GET /api/edificios/:edificioId/ingresos?anio=&mes=&categoria=&page=&limit=
async function listar(req, res) {
  const { anio, mes, categoria } = req.query;
  try {
    const where = { edificioId: req.edificioId };
    if (categoria) where.categoria = categoria;
    if (anio) {
      const a = parseInt(anio);
      const m = mes ? parseInt(mes) : null;
      const desde = m ? new Date(a, m - 1, 1) : new Date(a, 0, 1);
      const hasta = m ? new Date(a, m, 0, 23, 59, 59) : new Date(a, 11, 31, 23, 59, 59);
      where.fecha = { gte: desde, lte: hasta };
    }

    const anioResumen = parseInt(anio) || new Date().getFullYear();
    const desdeAnio   = new Date(anioResumen, 0, 1);
    const hastaAnio   = new Date(anioResumen, 11, 31, 23, 59, 59);

    const [result, resumen] = await Promise.all([
      paginar(prisma.ingreso, { where, orderBy: { fecha: 'desc' } }, req.query),
      prisma.ingreso.groupBy({
        by:    ['categoria'],
        where: { edificioId: req.edificioId, fecha: { gte: desdeAnio, lte: hastaAnio } },
        _sum:  { monto: true },
        _count: { _all: true },
      }),
    ]);

    const totalAnio = resumen.reduce((s, r) => s + Number(r._sum.monto || 0), 0);
    res.json({ ...result, resumen, totalAnio: +totalAnio.toFixed(2) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar ingresos' });
  }
}

// POST /api/edificios/:edificioId/ingresos
async function crear(req, res) {
  const { categoria, descripcion, monto, fecha, referencia, notas } = req.body;
  if (!categoria || !descripcion || !monto || !fecha) {
    return res.status(400).json({ error: 'categoria, descripcion, monto y fecha son requeridos' });
  }
  if (!CATEGORIAS.includes(categoria)) {
    return res.status(400).json({ error: `categoria inválida. Use: ${CATEGORIAS.join(', ')}` });
  }
  try {
    const ingreso = await prisma.ingreso.create({
      data: {
        edificioId: req.edificioId,
        categoria,
        descripcion,
        monto:      parseFloat(monto),
        fecha:      new Date(fecha),
        referencia: referencia || null,
        notas:      notas      || null,
      },
    });
    res.status(201).json(ingreso);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear ingreso' });
  }
}

// PUT /api/edificios/:edificioId/ingresos/:ingresoId
async function actualizar(req, res) {
  const id = parseInt(req.params.ingresoId);
  const { categoria, descripcion, monto, fecha, referencia, notas } = req.body;
  try {
    const existe = await prisma.ingreso.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!existe) return res.status(404).json({ error: 'Ingreso no encontrado' });
    if (categoria && !CATEGORIAS.includes(categoria)) {
      return res.status(400).json({ error: `categoria inválida. Use: ${CATEGORIAS.join(', ')}` });
    }
    const ingreso = await prisma.ingreso.update({
      where: { id },
      data: {
        ...(categoria    !== undefined && { categoria }),
        ...(descripcion  !== undefined && { descripcion }),
        ...(monto        !== undefined && { monto: parseFloat(monto) }),
        ...(fecha        !== undefined && { fecha: new Date(fecha) }),
        ...(referencia   !== undefined && { referencia: referencia || null }),
        ...(notas        !== undefined && { notas: notas || null }),
      },
    });
    res.json(ingreso);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar ingreso' });
  }
}

// DELETE /api/edificios/:edificioId/ingresos/:ingresoId
async function eliminar(req, res) {
  const id = parseInt(req.params.ingresoId);
  try {
    const existe = await prisma.ingreso.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!existe) return res.status(404).json({ error: 'Ingreso no encontrado' });
    await prisma.ingreso.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar ingreso' });
  }
}

module.exports = { listar, crear, actualizar, eliminar };
