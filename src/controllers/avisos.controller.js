const path   = require('path');
const fs     = require('fs');
const prisma = require('../config/prisma');
const { paginar }      = require('../utils/paginar');
const { enviarCorreo } = require('../utils/email');
const { htmlAviso }    = require('../utils/email-aviso');

const UPLOADS_DIR = path.join(__dirname, '..', '..', process.env.UPLOADS_DIR || 'uploads');

function cargarAdjunto(url) {
  if (!url || !url.startsWith('/uploads/')) return null;
  const filename = path.basename(url);
  const filepath = path.join(UPLOADS_DIR, filename);
  try {
    return { filename, content: fs.readFileSync(filepath) };
  } catch {
    return null; // archivo no encontrado — no bloquear el envío
  }
}

const TIPOS = ['GENERAL', 'URGENTE', 'MANTENIMIENTO', 'CONVOCATORIA'];

// GET /api/edificios/:edificioId/avisos  ?activo=&page=&limit=
async function listar(req, res) {
  const { activo } = req.query;
  try {
    const where = { edificioId: req.edificioId };
    if (activo !== undefined) where.activo = activo === 'true';

    const baseWhere = { edificioId: req.edificioId };
    const [result, conteos] = await Promise.all([
      paginar(
        prisma.aviso,
        { where, orderBy: [{ activo: 'desc' }, { creadoEn: 'desc' }] },
        req.query,
        25,
      ),
      prisma.aviso.groupBy({
        by: ['tipo', 'activo'],
        where: baseWhere,
        _count: { _all: true },
      }),
    ]);

    const meta = { total: 0, activos: 0, urgentes: 0, convocatorias: 0 };
    for (const row of conteos) {
      meta.total += row._count._all;
      if (row.activo) {
        meta.activos       += row._count._all;
        if (row.tipo === 'URGENTE')      meta.urgentes      += row._count._all;
        if (row.tipo === 'CONVOCATORIA') meta.convocatorias += row._count._all;
      }
    }

    res.json({ ...result, meta });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar avisos' });
  }
}

// POST /api/edificios/:edificioId/avisos
async function crear(req, res) {
  const { titulo, mensaje, tipo = 'GENERAL', adjunto, notificar = false } = req.body;
  if (!titulo || !mensaje) return res.status(400).json({ error: 'titulo y mensaje son requeridos' });
  if (!TIPOS.includes(tipo)) return res.status(400).json({ error: `tipo inválido. Use: ${TIPOS.join(', ')}` });

  try {
    const aviso = await prisma.aviso.create({
      data: { edificioId: req.edificioId, titulo, mensaje, tipo, adjunto: adjunto || null },
    });

    let emailResult = null;
    if (notificar) {
      const edificio = await prisma.edificio.findUnique({
        where: { id: req.edificioId }, select: { nombre: true },
      });
      const propietarios = await prisma.propietario.findMany({
        where: { activo: true, email: { not: null }, unidad: { edificioId: req.edificioId, activa: true } },
        select: { id: true, nombre: true, email: true },
      });
      if (propietarios.length > 0) {
        const { htmlAviso } = require('../utils/email-aviso');
        const html        = htmlAviso(aviso, edificio);
        const subject     = `[${edificio.nombre}] ${aviso.titulo}`;
        const adjuntoFile = cargarAdjunto(aviso.adjunto);
        const attachments = adjuntoFile ? [adjuntoFile] : [];
        let enviados = 0;
        for (const p of propietarios) {
          try { await enviarCorreo({ to: p.email, subject, html, attachments }); enviados++; } catch {}
        }
        await prisma.aviso.update({
          where: { id: aviso.id },
          data:  { emailEnviado: true, emailEnviadoEn: new Date(), emailEnviadoCount: enviados },
        });
        emailResult = { enviados, total: propietarios.length };
      }
    }

    res.status(201).json({ ...aviso, emailResult });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear aviso' });
  }
}

// PUT /api/edificios/:edificioId/avisos/:avisoId
async function actualizar(req, res) {
  const id = parseInt(req.params.avisoId);
  const { titulo, mensaje, tipo, activo, adjunto } = req.body;
  try {
    const existe = await prisma.aviso.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!existe) return res.status(404).json({ error: 'Aviso no encontrado' });
    if (tipo && !TIPOS.includes(tipo)) return res.status(400).json({ error: `tipo inválido. Use: ${TIPOS.join(', ')}` });

    const aviso = await prisma.aviso.update({
      where: { id },
      data: {
        ...(titulo   !== undefined && { titulo }),
        ...(mensaje  !== undefined && { mensaje }),
        ...(tipo     !== undefined && { tipo }),
        ...(activo   !== undefined && { activo }),
        ...(adjunto  !== undefined && { adjunto: adjunto || null }),
      },
    });
    res.json(aviso);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar aviso' });
  }
}

// DELETE /api/edificios/:edificioId/avisos/:avisoId
async function eliminar(req, res) {
  const id = parseInt(req.params.avisoId);
  try {
    const existe = await prisma.aviso.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!existe) return res.status(404).json({ error: 'Aviso no encontrado' });
    await prisma.aviso.delete({ where: { id } });
    res.json({ message: 'Aviso eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar aviso' });
  }
}

// GET /api/edificios/:edificioId/avisos/destinatarios
// Retorna propietarios con email del edificio para mostrar en el modal
async function listarDestinatarios(req, res) {
  try {
    const propietarios = await prisma.propietario.findMany({
      where: {
        activo: true,
        email:  { not: null },
        unidad: { edificioId: req.edificioId, activa: true },
      },
      select: {
        id:     true,
        nombre: true,
        email:  true,
        unidad: { select: { numero: true } },
      },
      orderBy: { nombre: 'asc' },
    });
    res.json(propietarios);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener destinatarios' });
  }
}

// POST /api/edificios/:edificioId/avisos/:avisoId/enviar-correo
async function enviarPorCorreo(req, res) {
  const id = parseInt(req.params.avisoId);
  const { excluirIds = [] } = req.body;  // ids de propietarios a excluir

  try {
    const [aviso, edificio] = await Promise.all([
      prisma.aviso.findFirst({ where: { id, edificioId: req.edificioId } }),
      prisma.edificio.findUnique({ where: { id: req.edificioId }, select: { nombre: true } }),
    ]);
    if (!aviso) return res.status(404).json({ error: 'Aviso no encontrado' });

    const propietarios = await prisma.propietario.findMany({
      where: {
        activo: true,
        email:  { not: null },
        id:     excluirIds.length ? { notIn: excluirIds } : undefined,
        unidad: { edificioId: req.edificioId, activa: true },
      },
      select: { id: true, nombre: true, email: true },
    });

    if (propietarios.length === 0) {
      return res.status(400).json({ error: 'No hay destinatarios con email registrado' });
    }

    const html        = htmlAviso(aviso, edificio);
    const subject     = `[${edificio.nombre}] ${aviso.titulo}`;
    const adjuntoFile = cargarAdjunto(aviso.adjunto);
    const attachments = adjuntoFile ? [adjuntoFile] : [];
    const errores     = [];
    let enviados      = 0;

    for (const p of propietarios) {
      try {
        await enviarCorreo({ to: p.email, subject, html, attachments });
        enviados++;
      } catch (e) {
        errores.push({ nombre: p.nombre, email: p.email, error: e.message });
      }
    }

    const avisoActualizado = await prisma.aviso.update({
      where: { id },
      data:  {
        emailEnviado:      true,
        emailEnviadoEn:    new Date(),
        emailEnviadoCount: enviados,
      },
    });

    res.json({
      message:  `Correo enviado a ${enviados} de ${propietarios.length} destinatario(s)`,
      enviados,
      total:    propietarios.length,
      errores,
      aviso:    avisoActualizado,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al enviar correos' });
  }
}

module.exports = { listar, crear, actualizar, eliminar, listarDestinatarios, enviarPorCorreo };
