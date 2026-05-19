const prisma = require('../config/prisma');
const { generarDocxActa } = require('../utils/docx-acta');

const TIPOS      = ['ORDINARIA', 'EXTRAORDINARIA'];
const MODALIDADES = ['PRESENCIAL', 'VIRTUAL', 'MIXTA'];
const ESTADOS    = ['PRESENTE', 'AUSENTE', 'REPRESENTADO'];
const MOD_ASIST  = ['PRESENCIAL', 'VIRTUAL'];
const TIPOS_VOT  = ['SIMPLE', 'P51', 'P66', 'P66_75V', 'P75V'];
const RESULTADOS = ['APROBADA', 'NEGADA', 'PENDIENTE'];

const incluirAsistencias = {
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
};

const incluirPropuestas = {
  propuestas: { orderBy: { orden: 'asc' } },
};

// Quórum según Ley 284 Art.67: % de propietarios presentes sobre total habilitados
function calcularQuorum(asistencias) {
  const habilitados = asistencias.filter(a => a.unidad.propietario);
  const presentes   = habilitados.filter(a => a.estado === 'PRESENTE' || a.estado === 'REPRESENTADO');
  if (habilitados.length === 0) return { quorum: 0, presentes: 0, habilitados: 0, coefPresente: 0 };

  const quorum = +(presentes.length / habilitados.length * 100).toFixed(2);
  const coefPresente = presentes.reduce((s, a) => s + Number(a.unidad.coeficiente), 0);
  return { quorum, presentes: presentes.length, habilitados: habilitados.length, coefPresente: +coefPresente.toFixed(6) };
}

// Resultado de propuesta según tipo de votación
function calcularResultado(tipo, aFavor, enContra, totalUnidades) {
  if (aFavor + enContra === 0) return 'PENDIENTE';
  const pct = aFavor / totalUnidades;
  switch (tipo) {
    case 'SIMPLE':   return aFavor > enContra ? 'APROBADA' : 'NEGADA';
    case 'P51':      return pct >= 0.51 ? 'APROBADA' : 'NEGADA';
    case 'P66':
    case 'P66_75V':  return pct >= 0.66 ? 'APROBADA' : 'NEGADA';
    case 'P75V':     return pct >= 0.75 ? 'APROBADA' : 'NEGADA';
    default:         return 'PENDIENTE';
  }
}

async function proximoNumero(edificioId, anio) {
  const ultimo = await prisma.acta.findFirst({
    where:   { edificioId, anio, numero: { not: null } },
    orderBy: { numero: 'desc' },
    select:  { numero: true },
  });
  return (ultimo?.numero ?? 0) + 1;
}

// GET /api/edificios/:edificioId/actas
async function listar(req, res) {
  try {
    const actas = await prisma.acta.findMany({
      where:   { edificioId: req.edificioId },
      orderBy: { fecha: 'desc' },
      include: { ...incluirAsistencias, ...incluirPropuestas },
    });
    res.json(actas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar actas' });
  }
}

// GET /api/edificios/:edificioId/actas/:actaId
async function obtener(req, res) {
  const id = parseInt(req.params.actaId);
  try {
    const acta = await prisma.acta.findFirst({
      where:   { id, edificioId: req.edificioId },
      include: { ...incluirAsistencias, ...incluirPropuestas },
    });
    if (!acta) return res.status(404).json({ error: 'Acta no encontrada' });
    res.json(acta);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener acta' });
  }
}

// POST /api/edificios/:edificioId/actas
async function crear(req, res) {
  const { tipo, modalidad, fecha, lugar, horaInicio, horaFin, convocatoria,
          fechaConvocatoria, convocadoPor,
          presidente, presidenteCedula, secretario, secretarioCedula,
          acuerdos, autorizadoPara, documento } = req.body;

  if (!tipo || !fecha) return res.status(400).json({ error: 'tipo y fecha son requeridos' });
  if (!TIPOS.includes(tipo))       return res.status(400).json({ error: `tipo inválido. Use: ${TIPOS.join(', ')}` });
  if (modalidad && !MODALIDADES.includes(modalidad)) return res.status(400).json({ error: `modalidad inválida` });

  try {
    const anio = new Date(fecha).getFullYear();
    const [unidades, numero] = await Promise.all([
      prisma.unidad.findMany({ where: { edificioId: req.edificioId, activa: true }, select: { id: true } }),
      proximoNumero(req.edificioId, anio),
    ]);

    const acta = await prisma.acta.create({
      data: {
        edificioId: req.edificioId,
        numero,
        anio,
        tipo,
        modalidad:        modalidad        || 'PRESENCIAL',
        fecha:            new Date(fecha),
        lugar:            lugar            || null,
        horaInicio:       horaInicio       || null,
        horaFin:          horaFin          || null,
        convocatoria:      convocatoria      || null,
        fechaConvocatoria: fechaConvocatoria ? new Date(fechaConvocatoria) : null,
        convocadoPor:      convocadoPor      || null,
        presidente:        presidente        || null,
        presidenteCedula:  presidenteCedula  || null,
        secretario:        secretario        || null,
        secretarioCedula:  secretarioCedula  || null,
        quorum:            0,
        acuerdos:          acuerdos          || null,
        autorizadoPara:    autorizadoPara    || null,
        documento:         documento         || null,
        asistencias: {
          create: unidades.map(u => ({ unidadId: u.id, estado: 'AUSENTE', modalidadAsistencia: 'PRESENCIAL' })),
        },
      },
      include: { ...incluirAsistencias, ...incluirPropuestas },
    });
    res.status(201).json(acta);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear acta' });
  }
}

// PUT /api/edificios/:edificioId/actas/:actaId
async function actualizar(req, res) {
  const id = parseInt(req.params.actaId);
  const { tipo, modalidad, fecha, lugar, horaInicio, horaFin, convocatoria,
          fechaConvocatoria, convocadoPor,
          presidente, presidenteCedula, secretario, secretarioCedula,
          acuerdos, autorizadoPara, documento } = req.body;

  try {
    const existe = await prisma.acta.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!existe) return res.status(404).json({ error: 'Acta no encontrada' });
    if (tipo     && !TIPOS.includes(tipo))           return res.status(400).json({ error: `tipo inválido` });
    if (modalidad && !MODALIDADES.includes(modalidad)) return res.status(400).json({ error: `modalidad inválida` });

    const data = {};
    if (tipo               !== undefined) data.tipo               = tipo;
    if (modalidad          !== undefined) data.modalidad          = modalidad;
    if (fecha              !== undefined) data.fecha              = new Date(fecha);
    if (lugar              !== undefined) data.lugar              = lugar              || null;
    if (horaInicio         !== undefined) data.horaInicio         = horaInicio         || null;
    if (horaFin            !== undefined) data.horaFin            = horaFin            || null;
    if (convocatoria       !== undefined) data.convocatoria       = convocatoria       || null;
    if (fechaConvocatoria  !== undefined) data.fechaConvocatoria  = fechaConvocatoria ? new Date(fechaConvocatoria) : null;
    if (convocadoPor       !== undefined) data.convocadoPor       = convocadoPor       || null;
    if (presidente         !== undefined) data.presidente         = presidente         || null;
    if (presidenteCedula   !== undefined) data.presidenteCedula   = presidenteCedula   || null;
    if (secretario         !== undefined) data.secretario         = secretario         || null;
    if (secretarioCedula   !== undefined) data.secretarioCedula   = secretarioCedula   || null;
    if (acuerdos           !== undefined) data.acuerdos           = acuerdos           || null;
    if (autorizadoPara     !== undefined) data.autorizadoPara     = autorizadoPara     || null;
    if (documento          !== undefined) data.documento          = documento          || null;

    const acta = await prisma.acta.update({
      where: { id }, data,
      include: { ...incluirAsistencias, ...incluirPropuestas },
    });
    res.json(acta);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar acta' });
  }
}

// PUT /api/edificios/:edificioId/actas/:actaId/asistencias
async function actualizarAsistencias(req, res) {
  const actaId = parseInt(req.params.actaId);
  const { asistencias } = req.body;

  if (!Array.isArray(asistencias) || asistencias.length === 0) {
    return res.status(400).json({ error: 'asistencias debe ser un array no vacío' });
  }
  for (const a of asistencias) {
    if (!ESTADOS.includes(a.estado))   return res.status(400).json({ error: `estado inválido: ${a.estado}` });
    if (a.modalidadAsistencia && !MOD_ASIST.includes(a.modalidadAsistencia)) {
      return res.status(400).json({ error: `modalidadAsistencia inválida: ${a.modalidadAsistencia}` });
    }
  }

  try {
    const acta = await prisma.acta.findFirst({ where: { id: actaId, edificioId: req.edificioId } });
    if (!acta) return res.status(404).json({ error: 'Acta no encontrada' });

    await Promise.all(
      asistencias.map(a =>
        prisma.actaAsistencia.upsert({
          where:  { actaId_unidadId: { actaId, unidadId: a.unidadId } },
          create: {
            actaId, unidadId: a.unidadId,
            estado:              a.estado,
            modalidadAsistencia: a.modalidadAsistencia || 'PRESENCIAL',
            mandatario:          a.mandatario          || null,
            mandatarioCedula:    a.mandatarioCedula    || null,
          },
          update: {
            estado:              a.estado,
            modalidadAsistencia: a.modalidadAsistencia || 'PRESENCIAL',
            mandatario:          a.mandatario          || null,
            mandatarioCedula:    a.mandatarioCedula    || null,
          },
        })
      )
    );

    const todas = await prisma.actaAsistencia.findMany({
      where:   { actaId },
      include: { unidad: { select: { coeficiente: true, propietario: { select: { id: true } } } } },
    });

    const { quorum } = calcularQuorum(todas);

    const actaActualizada = await prisma.acta.update({
      where:   { id: actaId },
      data:    { quorum },
      include: { ...incluirAsistencias, ...incluirPropuestas },
    });

    res.json(actaActualizada);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar asistencias' });
  }
}

// PUT /api/edificios/:edificioId/actas/:actaId/propuestas
async function actualizarPropuestas(req, res) {
  const actaId = parseInt(req.params.actaId);
  const { propuestas } = req.body;

  if (!Array.isArray(propuestas)) return res.status(400).json({ error: 'propuestas debe ser un array' });

  for (const p of propuestas) {
    if (!p.descripcion) return res.status(400).json({ error: 'Cada propuesta requiere descripcion' });
    if (p.tipoVotacion && !TIPOS_VOT.includes(p.tipoVotacion)) {
      return res.status(400).json({ error: `tipoVotacion inválido: ${p.tipoVotacion}` });
    }
  }

  try {
    const acta = await prisma.acta.findFirst({ where: { id: actaId, edificioId: req.edificioId } });
    if (!acta) return res.status(404).json({ error: 'Acta no encontrada' });

    const totalUnidades = await prisma.unidad.count({ where: { edificioId: req.edificioId, activa: true } });

    // Reemplazar todas las propuestas
    await prisma.actaPropuesta.deleteMany({ where: { actaId } });

    if (propuestas.length > 0) {
      await prisma.actaPropuesta.createMany({
        data: propuestas.map((p, i) => {
          const aFavor    = parseInt(p.votosAFavor   ?? 0);
          const enContra  = parseInt(p.votosEnContra ?? 0);
          const abstenciones = parseInt(p.abstenciones ?? 0);
          const tipo      = p.tipoVotacion || 'SIMPLE';
          const resultado = p.resultado && RESULTADOS.includes(p.resultado)
            ? p.resultado
            : calcularResultado(tipo, aFavor, enContra, totalUnidades);

          return {
            actaId,
            orden:               i + 1,
            descripcion:         p.descripcion,
            tipoVotacion:        tipo,
            resultado,
            votosAFavor:         aFavor,
            votosEnContra:       enContra,
            abstenciones,
            requiereInscripcionRP: p.requiereInscripcionRP ?? false,
            notas:               p.notas || null,
          };
        }),
      });
    }

    const actaActualizada = await prisma.acta.findFirst({
      where:   { id: actaId },
      include: { ...incluirAsistencias, ...incluirPropuestas },
    });
    res.json(actaActualizada);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar propuestas' });
  }
}

// DELETE /api/edificios/:edificioId/actas/:actaId
async function eliminar(req, res) {
  const id = parseInt(req.params.actaId);
  try {
    const acta = await prisma.acta.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!acta) return res.status(404).json({ error: 'Acta no encontrada' });
    await prisma.acta.delete({ where: { id } });
    res.json({ message: 'Acta eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar acta' });
  }
}

// GET /api/edificios/:edificioId/actas/:actaId/docx
async function descargarDocx(req, res) {
  const id = parseInt(req.params.actaId);
  try {
    const acta = await prisma.acta.findFirst({
      where:   { id, edificioId: req.edificioId },
      include: { ...incluirAsistencias, ...incluirPropuestas },
    });
    if (!acta) return res.status(404).json({ error: 'Acta no encontrada' });

    const edificio = await prisma.edificio.findUnique({
      where:  { id: req.edificioId },
      select: { nombre: true, ruc: true, direccion: true, codigoUbicacion: true, folioReal: true },
    });

    const buffer = await generarDocxActa(acta, edificio);
    const nombre = `Acta_${acta.numero ?? 'SN'}_${acta.anio ?? ''}_${edificio.nombre.replace(/\s+/g, '_')}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar documento Word' });
  }
}

module.exports = { listar, obtener, crear, actualizar, actualizarAsistencias, actualizarPropuestas, eliminar, descargarDocx };
