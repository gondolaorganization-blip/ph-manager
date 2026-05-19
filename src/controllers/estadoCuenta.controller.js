const prisma = require('../config/prisma');
const { generarPdfEstadoCuenta } = require('../utils/pdf-estado-cuenta');
const { enviarCorreo }           = require('../utils/email');

const INCLUDE_PAGOS = {
  include: {
    cuota: { select: { mes: true, anio: true } },
  },
  orderBy: [
    { cuota: { anio: 'asc' } },
    { cuota: { mes:  'asc' } },
  ],
};

async function obtenerPagos(unidadId, desde, hasta) {
  return prisma.pagoCuota.findMany({
    where: {
      unidadId,
      fechaVence: {
        gte: new Date(desde),
        lte: new Date(hasta + 'T23:59:59'),
      },
    },
    ...INCLUDE_PAGOS,
  });
}

// GET /api/edificios/:edificioId/estado-cuenta/:unidadId?desde=&hasta=
async function descargar(req, res) {
  const unidadId = parseInt(req.params.unidadId);
  const { desde, hasta } = req.query;

  if (!desde || !hasta) {
    return res.status(400).json({ error: 'Los parámetros desde y hasta son requeridos (YYYY-MM-DD)' });
  }

  try {
    const [unidad, edificio] = await Promise.all([
      prisma.unidad.findFirst({
        where:   { id: unidadId, edificioId: req.edificioId },
        include: { propietario: true },
      }),
      prisma.edificio.findUnique({ where: { id: req.edificioId }, select: { nombre: true } }),
    ]);
    if (!unidad) return res.status(404).json({ error: 'Unidad no encontrada' });

    const pagos  = await obtenerPagos(unidadId, desde, hasta);
    const buffer = await generarPdfEstadoCuenta({
      unidad, propietario: unidad.propietario, pagos, edificio, desde, hasta,
    });

    const nombre = `EstadoCuenta_${unidad.numero}_${desde}_${hasta}.pdf`
      .replace(/\s+/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar estado de cuenta' });
  }
}

// POST /api/edificios/:edificioId/estado-cuenta/enviar
// Body: { unidadIds: [1,2,...] | 'todos', desde, hasta }
async function enviar(req, res) {
  const { unidadIds = 'todos', desde, hasta } = req.body;

  if (!desde || !hasta) {
    return res.status(400).json({ error: 'desde y hasta son requeridos' });
  }

  try {
    const edificio = await prisma.edificio.findUnique({
      where:  { id: req.edificioId },
      select: { nombre: true },
    });

    const where = {
      edificioId: req.edificioId,
      activa:     true,
      propietario: {
        activo: true,
        email:  { not: null },
      },
    };
    if (unidadIds !== 'todos' && Array.isArray(unidadIds) && unidadIds.length > 0) {
      where.id = { in: unidadIds.map(Number) };
    }

    const unidades = await prisma.unidad.findMany({
      where,
      include: { propietario: true },
      orderBy: { numero: 'asc' },
    });

    if (unidades.length === 0) {
      return res.status(400).json({ error: 'No hay propietarios con email en la selección' });
    }

    const subject  = `[${edificio.nombre}] Estado de cuenta — ${desde} al ${hasta}`;
    const enviados = [];
    const errores  = [];

    for (const unidad of unidades) {
      try {
        const pagos  = await obtenerPagos(unidad.id, desde, hasta);
        const buffer = await generarPdfEstadoCuenta({
          unidad, propietario: unidad.propietario, pagos, edificio, desde, hasta,
        });

        const nombrePdf = `EstadoCuenta_${unidad.numero}.pdf`;
        await enviarCorreo({
          to:      unidad.propietario.email,
          subject,
          html:    htmlEstadoCuenta(unidad, edificio, desde, hasta),
          attachments: [{ filename: nombrePdf, content: buffer }],
        });
        enviados.push({ nombre: unidad.propietario.nombre, email: unidad.propietario.email });
      } catch (e) {
        errores.push({ nombre: unidad.propietario?.nombre, email: unidad.propietario?.email, error: e.message });
      }
    }

    res.json({
      message: `Estado de cuenta enviado a ${enviados.length} de ${unidades.length} propietario(s)`,
      enviados: enviados.length,
      total:    unidades.length,
      errores,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar estados de cuenta' });
  }
}

function htmlEstadoCuenta(unidad, edificio, desde, hasta) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr><td style="background:#1e3a5f;padding:28px 32px;">
          <p style="margin:0;color:rgba(255,255,255,.7);font-size:12px;text-transform:uppercase;letter-spacing:.05em;">${edificio.nombre}</p>
          <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:700;">Estado de Cuenta</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:13px;">Período: ${desde} al ${hasta}</p>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <p style="margin:0 0 6px;font-size:14px;color:#374151;">Estimado/a <strong>${unidad.propietario?.nombre || 'Propietario'}</strong>,</p>
          <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
            Adjunto encontrará el estado de cuenta de la unidad <strong>${unidad.numero}</strong> correspondiente al período indicado.
          </p>
          <p style="margin:0;font-size:12px;color:#94a3b8;">
            Este correo fue generado automáticamente por <strong>PH Manager</strong>.<br>
            Comuníquese con la administración si tiene alguna consulta.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

module.exports = { descargar, enviar };
