const prisma = require('../config/prisma');
const { generarDocxActaJD } = require('../utils/docx-actajd');

const CARGOS    = ['PRESIDENTE', 'VICEPRESIDENTE', 'SECRETARIO', 'TESORERO', 'VOCAL', 'DIRECTOR'];
const ESTADOS   = ['PRESENTE', 'AUSENTE', 'JUSTIFICADO'];
const RESULTADOS = ['APROBADO', 'NEGADO', 'INFORMATIVO', 'PENDIENTE'];

const incluirTodo = {
  directores: { orderBy: { cargo: 'asc' } },
  puntos:     { orderBy: { orden: 'asc' } },
};

function calcularQuorum(directores) {
  if (!directores.length) return 0;
  const presentes = directores.filter(d => d.estado === 'PRESENTE').length;
  return +(presentes / directores.length * 100).toFixed(2);
}

async function proximoNumero(edificioId, anio) {
  const ultimo = await prisma.actaJD.findFirst({
    where:   { edificioId, anio, numero: { not: null } },
    orderBy: { numero: 'desc' },
    select:  { numero: true },
  });
  return (ultimo?.numero ?? 0) + 1;
}

// GET /api/edificios/:edificioId/actas-jd
async function listar(req, res) {
  try {
    const actas = await prisma.actaJD.findMany({
      where:   { edificioId: req.edificioId },
      orderBy: [{ anio: 'desc' }, { numero: 'desc' }],
      include: incluirTodo,
    });
    res.json(actas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar actas de JD' });
  }
}

// GET /api/edificios/:edificioId/actas-jd/:actaId
async function obtener(req, res) {
  const id = parseInt(req.params.actaId);
  try {
    const acta = await prisma.actaJD.findFirst({
      where: { id, edificioId: req.edificioId },
      include: incluirTodo,
    });
    if (!acta) return res.status(404).json({ error: 'Acta de JD no encontrada' });
    res.json(acta);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener acta de JD' });
  }
}

// POST /api/edificios/:edificioId/actas-jd
async function crear(req, res) {
  const { fecha, horaInicio, horaFin, lugar, presidente, presidenteCedula, secretario, secretarioCedula, acuerdos, documento } = req.body;
  if (!fecha) return res.status(400).json({ error: 'fecha es requerida' });

  try {
    const anio   = new Date(fecha).getFullYear();
    const numero = await proximoNumero(req.edificioId, anio);

    const acta = await prisma.actaJD.create({
      data: {
        edificioId: req.edificioId,
        numero, anio,
        fecha:            new Date(fecha),
        horaInicio:       horaInicio       || null,
        horaFin:          horaFin          || null,
        lugar:            lugar            || null,
        presidente:       presidente       || null,
        presidenteCedula: presidenteCedula || null,
        secretario:       secretario       || null,
        secretarioCedula: secretarioCedula || null,
        acuerdos:         acuerdos         || null,
        documento:        documento        || null,
        quorum:     0,
      },
      include: incluirTodo,
    });
    res.status(201).json(acta);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear acta de JD' });
  }
}

// PUT /api/edificios/:edificioId/actas-jd/:actaId
async function actualizar(req, res) {
  const id = parseInt(req.params.actaId);
  const { fecha, horaInicio, horaFin, lugar, presidente, presidenteCedula, secretario, secretarioCedula, acuerdos, documento } = req.body;

  try {
    const existe = await prisma.actaJD.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!existe) return res.status(404).json({ error: 'Acta de JD no encontrada' });

    const data = {};
    if (fecha             !== undefined) data.fecha            = new Date(fecha);
    if (horaInicio        !== undefined) data.horaInicio       = horaInicio       || null;
    if (horaFin           !== undefined) data.horaFin          = horaFin          || null;
    if (lugar             !== undefined) data.lugar            = lugar            || null;
    if (presidente        !== undefined) data.presidente       = presidente       || null;
    if (presidenteCedula  !== undefined) data.presidenteCedula = presidenteCedula || null;
    if (secretario        !== undefined) data.secretario       = secretario       || null;
    if (secretarioCedula  !== undefined) data.secretarioCedula = secretarioCedula || null;
    if (acuerdos          !== undefined) data.acuerdos         = acuerdos         || null;
    if (documento         !== undefined) data.documento        = documento        || null;

    const acta = await prisma.actaJD.update({ where: { id }, data, include: incluirTodo });
    res.json(acta);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar acta de JD' });
  }
}

// PUT /api/edificios/:edificioId/actas-jd/:actaId/directores
async function actualizarDirectores(req, res) {
  const actaJDId = parseInt(req.params.actaId);
  const { directores } = req.body;

  if (!Array.isArray(directores)) return res.status(400).json({ error: 'directores debe ser un array' });
  for (const d of directores) {
    if (!d.nombre) return res.status(400).json({ error: 'Cada director requiere nombre' });
    if (d.cargo  && !CARGOS.includes(d.cargo))   return res.status(400).json({ error: `cargo inválido: ${d.cargo}` });
    if (d.estado && !ESTADOS.includes(d.estado)) return res.status(400).json({ error: `estado inválido: ${d.estado}` });
  }

  try {
    const acta = await prisma.actaJD.findFirst({ where: { id: actaJDId, edificioId: req.edificioId } });
    if (!acta) return res.status(404).json({ error: 'Acta de JD no encontrada' });

    await prisma.actaJDDirector.deleteMany({ where: { actaJDId } });

    if (directores.length > 0) {
      await prisma.actaJDDirector.createMany({
        data: directores.map(d => ({
          actaJDId,
          nombre: d.nombre,
          cedula: d.cedula || null,
          cargo:  d.cargo  || 'DIRECTOR',
          estado: d.estado || 'PRESENTE',
        })),
      });
    }

    const nuevosDirectores = await prisma.actaJDDirector.findMany({ where: { actaJDId } });
    const quorum = calcularQuorum(nuevosDirectores);

    const actaActualizada = await prisma.actaJD.update({
      where:   { id: actaJDId },
      data:    { quorum },
      include: incluirTodo,
    });
    res.json(actaActualizada);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar directores' });
  }
}

// PUT /api/edificios/:edificioId/actas-jd/:actaId/puntos
async function actualizarPuntos(req, res) {
  const actaJDId = parseInt(req.params.actaId);
  const { puntos } = req.body;

  if (!Array.isArray(puntos)) return res.status(400).json({ error: 'puntos debe ser un array' });
  for (const p of puntos) {
    if (!p.descripcion) return res.status(400).json({ error: 'Cada punto requiere descripcion' });
    if (p.resultado && !RESULTADOS.includes(p.resultado)) return res.status(400).json({ error: `resultado inválido: ${p.resultado}` });
  }

  try {
    const acta = await prisma.actaJD.findFirst({ where: { id: actaJDId, edificioId: req.edificioId } });
    if (!acta) return res.status(404).json({ error: 'Acta de JD no encontrada' });

    await prisma.actaJDPunto.deleteMany({ where: { actaJDId } });

    if (puntos.length > 0) {
      await prisma.actaJDPunto.createMany({
        data: puntos.map((p, i) => ({
          actaJDId,
          orden:       i + 1,
          descripcion: p.descripcion,
          resultado:   p.resultado || 'INFORMATIVO',
          notas:       p.notas || null,
        })),
      });
    }

    const actaActualizada = await prisma.actaJD.findFirst({
      where: { id: actaJDId },
      include: incluirTodo,
    });
    res.json(actaActualizada);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar puntos' });
  }
}

// DELETE /api/edificios/:edificioId/actas-jd/:actaId
async function eliminar(req, res) {
  const id = parseInt(req.params.actaId);
  try {
    const acta = await prisma.actaJD.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!acta) return res.status(404).json({ error: 'Acta de JD no encontrada' });
    await prisma.actaJD.delete({ where: { id } });
    res.json({ message: 'Acta de JD eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar acta de JD' });
  }
}

// GET /api/edificios/:edificioId/actas-jd/:actaId/docx
async function descargarDocx(req, res) {
  const id = parseInt(req.params.actaId);
  try {
    const acta = await prisma.actaJD.findFirst({
      where:   { id, edificioId: req.edificioId },
      include: incluirTodo,
    });
    if (!acta) return res.status(404).json({ error: 'Acta de JD no encontrada' });

    const edificio = await prisma.edificio.findUnique({
      where:  { id: req.edificioId },
      select: { nombre: true, codigoUbicacion: true, folioReal: true },
    });

    const buffer = await generarDocxActaJD(acta, edificio);
    const nombre = `ActaJD_${acta.numero ?? 'SN'}_${acta.anio ?? ''}_${edificio.nombre.replace(/\s+/g, '_')}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar documento Word' });
  }
}

module.exports = { listar, obtener, crear, actualizar, actualizarDirectores, actualizarPuntos, eliminar, descargarDocx };
