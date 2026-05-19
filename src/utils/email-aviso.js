const TIPO_COLOR = {
  URGENTE:       '#dc2626',
  CONVOCATORIA:  '#d97706',
  MANTENIMIENTO: '#2563eb',
  GENERAL:       '#475569',
};

const TIPO_LABEL = {
  URGENTE:       'URGENTE',
  CONVOCATORIA:  'CONVOCATORIA',
  MANTENIMIENTO: 'MANTENIMIENTO',
  GENERAL:       'AVISO GENERAL',
};

function htmlAviso(aviso, edificio) {
  const color = TIPO_COLOR[aviso.tipo] || TIPO_COLOR.GENERAL;
  const label = TIPO_LABEL[aviso.tipo] || aviso.tipo;
  const fecha = new Date(aviso.creadoEn).toLocaleDateString('es-PA', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const mensajeHtml = (aviso.mensaje || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${aviso.titulo}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:28px 32px;">
            <p style="margin:0;color:rgba(255,255,255,.7);font-size:13px;letter-spacing:.05em;text-transform:uppercase;">${edificio.nombre}</p>
            <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">
              ${aviso.titulo}
            </h1>
          </td>
        </tr>

        <!-- Tipo badge -->
        <tr>
          <td style="padding:0 32px;">
            <span style="display:inline-block;margin-top:20px;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:.06em;color:#fff;background:${color};">
              ${label}
            </span>
          </td>
        </tr>

        <!-- Mensaje -->
        <tr>
          <td style="padding:20px 32px 28px;">
            <p style="margin:0;font-size:15px;line-height:1.75;color:#374151;">
              ${mensajeHtml}
            </p>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding:0 32px;">
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:0;">
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px 28px;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              ${fecha} · ${edificio.nombre}<br>
              Este mensaje fue enviado a través de <strong>PH Manager</strong>.<br>
              Si tienes dudas, comunícate directamente con la administración del edificio.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

module.exports = { htmlAviso };
