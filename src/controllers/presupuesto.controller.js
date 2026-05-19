const prisma = require('../config/prisma');

const CATEGORIAS = ['MANTENIMIENTO', 'SERVICIOS', 'PERSONAL', 'ADMINISTRACION', 'FONDO_RESERVA', 'OTROS'];

// GET /api/edificios/:edificioId/presupuesto?anio=2026
async function obtener(req, res) {
  const anio = parseInt(req.query.anio) || new Date().getFullYear();
  try {
    const [items, gastosRaw] = await Promise.all([
      prisma.presupuestoItem.findMany({
        where: { edificioId: req.edificioId, anio },
        orderBy: [{ mes: 'asc' }, { categoria: 'asc' }],
      }),
      prisma.$queryRaw`
        SELECT EXTRACT(MONTH FROM fecha)::int AS mes,
               categoria,
               SUM(monto::numeric)            AS total
        FROM   gastos
        WHERE  "edificioId" = ${req.edificioId}
          AND  EXTRACT(YEAR FROM fecha) = ${anio}
        GROUP  BY mes, categoria
      `,
    ]);

    const gastos = gastosRaw.map(r => ({
      mes:      Number(r.mes),
      categoria: r.categoria,
      total:    Number(r.total),
    }));

    res.json({ anio, items, gastos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener presupuesto' });
  }
}

// PUT /api/edificios/:edificioId/presupuesto
// body: { anio, items: [{ mes, categoria, monto }] }
async function guardar(req, res) {
  const { anio, items } = req.body;
  if (!anio || !Array.isArray(items)) {
    return res.status(400).json({ error: 'anio e items son requeridos' });
  }
  const anioInt = parseInt(anio);

  try {
    await prisma.$transaction(
      items
        .filter(i => CATEGORIAS.includes(i.categoria) && i.mes >= 1 && i.mes <= 12)
        .map(({ mes, categoria, monto }) =>
          prisma.presupuestoItem.upsert({
            where: {
              edificioId_anio_mes_categoria: {
                edificioId: req.edificioId,
                anio: anioInt,
                mes:  parseInt(mes),
                categoria,
              },
            },
            create: {
              edificioId: req.edificioId,
              anio:       anioInt,
              mes:        parseInt(mes),
              categoria,
              monto:      parseFloat(monto) || 0,
            },
            update: { monto: parseFloat(monto) || 0 },
          })
        )
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar presupuesto' });
  }
}

module.exports = { obtener, guardar };
