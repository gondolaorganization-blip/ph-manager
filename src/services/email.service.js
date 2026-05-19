const { enviarCorreo } = require('../utils/email');

async function enviar({ to, subject, html }) {
  try {
    await enviarCorreo({ to, subject, html });
  } catch (err) {
    console.error('[email] Error al enviar a', to, '—', err.message);
  }
}

// ── Shared layout ─────────────────────────────────────────────────────────────

function layout(titulo, contenido) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
        <!-- Header -->
        <tr><td style="background:#1e3a5f;padding:24px 32px">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700">PH Manager</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.7);font-size:13px">Propiedades Horizontales</p>
        </td></tr>
        <!-- Title -->
        <tr><td style="padding:24px 32px 8px">
          <h2 style="margin:0;color:#1e3a5f;font-size:18px">${titulo}</h2>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:8px 32px 24px;color:#374151;font-size:14px;line-height:1.6">
          ${contenido}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
          <p style="margin:0;color:#94a3b8;font-size:12px">
            Este correo fue generado automáticamente por PH Manager. No responda a este mensaje.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function fmtMonto(n) {
  return `$${Number(n).toLocaleString('es-PA', { minimumFractionDigits: 2 })}`;
}

function fmtFecha(d) {
  return new Date(d).toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' });
}

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ── Templates ─────────────────────────────────────────────────────────────────

function htmlRecibo({ propietario, unidad, edificio, pago, cuota }) {
  const mora  = Number(pago.interesMora || 0);
  const total = Number(pago.monto) + mora;

  const filas = [
    ['Edificio',     edificio.nombre],
    ['Unidad',       unidad.numero],
    ['Período',      `${MESES[cuota.mes]} ${cuota.anio}`],
    ['Fecha de pago', fmtFecha(pago.fechaPago)],
    ['Método',       pago.metodo],
    pago.referencia ? ['Referencia', pago.referencia] : null,
    ['Cuota base',   fmtMonto(pago.monto)],
    mora > 0 ? ['Interés mora', `<span style="color:#dc2626">${fmtMonto(mora)}</span>`] : null,
  ].filter(Boolean);

  const tabla = filas.map(([k, v]) => `
    <tr>
      <td style="padding:8px 0;color:#6b7280;width:160px">${k}</td>
      <td style="padding:8px 0;font-weight:600">${v}</td>
    </tr>`).join('');

  return layout('Recibo de Pago', `
    <p>Estimado/a <strong>${propietario.nombre}</strong>,</p>
    <p>Confirmamos el registro de su pago de cuota de mantenimiento:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;margin:16px 0">
      ${tabla}
      <tr style="border-top:2px solid #e2e8f0">
        <td style="padding:10px 0;font-weight:700;color:#1e3a5f">TOTAL PAGADO</td>
        <td style="padding:10px 0;font-weight:700;font-size:18px;color:#16a34a">${fmtMonto(total)}</td>
      </tr>
    </table>
    <p style="color:#6b7280;font-size:13px">Conserve este correo como comprobante de pago.</p>
  `);
}

function htmlAvisoMora({ propietario, unidad, edificio, cuotasVencidas, totalDeuda, moraDescripcion }) {
  const filas = cuotasVencidas.map(c => `
    <tr>
      <td style="padding:6px 8px">${MESES[c.mes]} ${c.anio}</td>
      <td style="padding:6px 8px;text-align:right">${fmtMonto(c.monto)}</td>
      <td style="padding:6px 8px;text-align:right;color:#dc2626">${fmtMonto(c.interesMora)}</td>
      <td style="padding:6px 8px;text-align:right;font-weight:600">${fmtMonto(Number(c.monto) + Number(c.interesMora))}</td>
    </tr>`).join('');

  return layout('Aviso de Cuotas Vencidas', `
    <p>Estimado/a <strong>${propietario.nombre}</strong>,</p>
    <p>Le informamos que la unidad <strong>${unidad.numero}</strong> en <strong>${edificio.nombre}</strong>
    presenta las siguientes cuotas de mantenimiento pendientes:</p>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="border-collapse:collapse;margin:16px 0;font-size:13px">
      <thead>
        <tr style="background:#f1f5f9">
          <th style="padding:8px;text-align:left">Período</th>
          <th style="padding:8px;text-align:right">Cuota</th>
          <th style="padding:8px;text-align:right;color:#dc2626">Mora</th>
          <th style="padding:8px;text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
      <tfoot>
        <tr style="background:#fef2f2;font-weight:700">
          <td colspan="3" style="padding:10px 8px;text-align:right;color:#7f1d1d">DEUDA TOTAL</td>
          <td style="padding:10px 8px;text-align:right;color:#dc2626;font-size:16px">${fmtMonto(totalDeuda)}</td>
        </tr>
      </tfoot>
    </table>
    <p>Le solicitamos regularizar su situación a la brevedad posible. Para coordinar el pago,
    comuníquese con la administración del edificio.</p>
    ${moraDescripcion ? `<p style="color:#6b7280;font-size:13px">${moraDescripcion}</p>` : ''}
  `);
}

function htmlConfirmacionReserva({ propietario, unidad, edificio, reserva }) {
  const filas = [
    ['Edificio', edificio.nombre],
    ['Unidad',   unidad.numero],
    ['Área',     reserva.area],
    ['Fecha',    fmtFecha(reserva.fecha)],
    ['Horario',  `${reserva.horaInicio} – ${reserva.horaFin}`],
    reserva.notas ? ['Notas', reserva.notas] : null,
  ].filter(Boolean).map(([k, v]) => `
    <tr>
      <td style="padding:8px 0;color:#6b7280;width:120px">${k}</td>
      <td style="padding:8px 0;font-weight:600">${v}</td>
    </tr>`).join('');

  return layout('Reserva Confirmada', `
    <p>Estimado/a <strong>${propietario.nombre}</strong>,</p>
    <p>Su reserva de área común ha sido registrada exitosamente:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;margin:16px 0">
      ${filas}
    </table>
    <p>Si necesita cancelar o modificar la reserva, comuníquese con la administración del edificio.</p>
  `);
}

function htmlCancelacionReserva({ propietario, unidad, edificio, reserva }) {
  return layout('Reserva Cancelada', `
    <p>Estimado/a <strong>${propietario.nombre}</strong>,</p>
    <p>Le informamos que la siguiente reserva ha sido <strong style="color:#dc2626">cancelada</strong>:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;margin:16px 0">
      <tr><td style="padding:8px 0;color:#6b7280;width:120px">Edificio</td><td style="padding:8px 0;font-weight:600">${edificio.nombre}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Unidad</td><td style="padding:8px 0;font-weight:600">${unidad.numero}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Área</td><td style="padding:8px 0;font-weight:600">${reserva.area}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Fecha</td><td style="padding:8px 0;font-weight:600">${fmtFecha(reserva.fecha)}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Horario</td><td style="padding:8px 0;font-weight:600">${reserva.horaInicio} – ${reserva.horaFin}</td></tr>
    </table>
    <p>Para reagendar, comuníquese con la administración del edificio.</p>
  `);
}

// ── Public API ────────────────────────────────────────────────────────────────

async function enviarRecibo(ctx) {
  const { propietario } = ctx;
  if (!propietario?.email) return;
  await enviar({
    to:      propietario.email,
    subject: `Recibo de pago — ${ctx.edificio.nombre}`,
    html:    htmlRecibo(ctx),
  });
}

async function enviarAvisoMora(ctx) {
  const { propietario } = ctx;
  if (!propietario?.email) return;
  await enviar({
    to:      propietario.email,
    subject: `Aviso de cuotas vencidas — ${ctx.edificio.nombre}`,
    html:    htmlAvisoMora(ctx),
  });
}

function moraDescripcionEdificio(edificio) {
  if (edificio.tipoMora === 'FIJO') {
    const monto = Number(edificio.montoMoraFijo || 0);
    return monto > 0
      ? `El recargo por mora aplicado es de $${monto.toFixed(2)} fijo por cuota vencida, conforme al reglamento del edificio.`
      : null;
  }
  const tasa = Number(edificio.tasaMora || 0) * 100;
  return tasa > 0
    ? `El recargo por mora aplicado es del ${tasa.toFixed(2)}% sobre el monto de la cuota, conforme al reglamento del edificio.`
    : null;
}

function htmlAprobacionReserva({ propietario, unidad, edificio, reserva }) {
  const filas = [
    ['Edificio', edificio.nombre],
    ['Unidad',   unidad.numero],
    ['Área',     reserva.area],
    ['Fecha',    fmtFecha(reserva.fecha)],
    ['Horario',  `${reserva.horaInicio} – ${reserva.horaFin}`],
    reserva.notas ? ['Notas', reserva.notas] : null,
  ].filter(Boolean).map(([k, v]) => `
    <tr>
      <td style="padding:8px 0;color:#6b7280;width:120px">${k}</td>
      <td style="padding:8px 0;font-weight:600">${v}</td>
    </tr>`).join('');

  return layout('Reserva Aprobada', `
    <p>Estimado/a <strong>${propietario.nombre}</strong>,</p>
    <p>Su reserva ha sido <strong style="color:#16a34a">aprobada</strong> por la administración:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;margin:16px 0">
      ${filas}
    </table>
    <p>Por favor preséntese puntualmente el día de su reserva. Ante cualquier consulta, comuníquese con la administración.</p>
  `);
}

async function enviarAprobacionReserva(ctx) {
  const { propietario } = ctx;
  if (!propietario?.email) return;
  await enviar({
    to:      propietario.email,
    subject: `Reserva aprobada — ${ctx.reserva.area} en ${ctx.edificio.nombre}`,
    html:    htmlAprobacionReserva(ctx),
  });
}

async function enviarConfirmacionReserva(ctx) {
  const { propietario } = ctx;
  if (!propietario?.email) return;
  await enviar({
    to:      propietario.email,
    subject: `Reserva confirmada — ${ctx.reserva.area} en ${ctx.edificio.nombre}`,
    html:    htmlConfirmacionReserva(ctx),
  });
}

async function enviarCancelacionReserva(ctx) {
  const { propietario } = ctx;
  if (!propietario?.email) return;
  await enviar({
    to:      propietario.email,
    subject: `Reserva cancelada — ${ctx.reserva.area} en ${ctx.edificio.nombre}`,
    html:    htmlCancelacionReserva(ctx),
  });
}

async function enviarOrdenProveedor({ proveedor, edificio, orden }) {
  if (!proveedor?.email) return false;
  const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const fechaEst = orden.fechaEstimada
    ? new Date(orden.fechaEstimada).toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  const html = layout(`Orden de Trabajo #${orden.id} — ${edificio.nombre}`, `
    <p>Estimado/a <strong>${proveedor.nombre}</strong>,</p>
    <p>Le informamos que ha sido asignado/a a la siguiente orden de trabajo:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;margin:16px 0">
      <tr><td style="padding:8px 0;color:#6b7280;width:140px">Edificio</td><td style="padding:8px 0;font-weight:600">${edificio.nombre}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Orden #</td><td style="padding:8px 0;font-weight:600">${orden.id}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Descripción</td><td style="padding:8px 0">${orden.descripcion}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Estado</td><td style="padding:8px 0;font-weight:600">${orden.estado.replace('_', ' ')}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Prioridad</td><td style="padding:8px 0">${orden.prioridad}</td></tr>
      ${fechaEst ? `<tr><td style="padding:8px 0;color:#6b7280">Fecha estimada</td><td style="padding:8px 0">${fechaEst}</td></tr>` : ''}
      ${orden.monto ? `<tr><td style="padding:8px 0;color:#6b7280">Monto estimado</td><td style="padding:8px 0;font-weight:600">$${Number(orden.monto).toLocaleString('es-PA', { minimumFractionDigits: 2 })}</td></tr>` : ''}
      ${orden.notas ? `<tr><td style="padding:8px 0;color:#6b7280;vertical-align:top">Notas</td><td style="padding:8px 0">${orden.notas}</td></tr>` : ''}
    </table>
    <p>Para coordinar los detalles, comuníquese con la administración del edificio.</p>
  `);
  try {
    await enviarCorreo({
      to:      proveedor.email,
      subject: `Orden de trabajo #${orden.id} — ${edificio.nombre}`,
      html,
    });
    return true;
  } catch (err) {
    console.error('[email] Error notificando proveedor:', err.message);
    return false;
  }
}

async function enviarEstadoCuota({ propietario, unidad, edificio, cuota, pdfBuffer }) {
  if (!propietario?.email) return false;
  const periodo = `${MESES[cuota.mes]} ${cuota.anio}`;
  const html = layout(`Estado de Cuenta — ${periodo}`, `
    <p>Estimado/a <strong>${propietario.nombre}</strong>,</p>
    <p>Adjunto encontrará el estado de cuenta de cuotas de mantenimiento correspondiente al período
    <strong>${periodo}</strong> del edificio <strong>${edificio.nombre}</strong>.</p>
    <p>Puede revisar el detalle de su situación en el documento adjunto o accediendo al portal de propietarios.</p>
    <p style="color:#6b7280;font-size:13px">Para consultas o aclaraciones, comuníquese con la administración del edificio.</p>
  `);
  try {
    await enviarCorreo({
      to:      propietario.email,
      subject: `Estado de cuenta ${periodo} — ${edificio.nombre}`,
      html,
      attachments: [{ filename: `Estado_Cuenta_${periodo.replace(' ', '_')}.pdf`, content: pdfBuffer }],
    });
    return true;
  } catch (err) {
    console.error('[email] Error enviando estado de cuenta a', propietario.email, '—', err.message);
    return false;
  }
}

function htmlRecordatorio({ propietario, unidad, edificio, cuota, pago }) {
  const mora  = Number(pago.interesMora || 0);
  const total = Number(pago.monto) + mora;

  return layout('Recordatorio de Pago', `
    <p>Estimado/a <strong>${propietario.nombre}</strong>,</p>
    <p>Le recordamos que tiene una cuota de mantenimiento pendiente de pago:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;margin:16px 0">
      <tr><td style="padding:8px 0;color:#6b7280;width:160px">Edificio</td><td style="padding:8px 0;font-weight:600">${edificio.nombre}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Unidad</td><td style="padding:8px 0;font-weight:600">${unidad.numero}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Período</td><td style="padding:8px 0;font-weight:600">${MESES[cuota.mes]} ${cuota.anio}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Fecha de vencimiento</td><td style="padding:8px 0;font-weight:600;color:${pago.estado === 'VENCIDO' ? '#dc2626' : '#374151'}">${fmtFecha(pago.fechaVence)}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Monto cuota</td><td style="padding:8px 0;font-weight:600">${fmtMonto(pago.monto)}</td></tr>
      ${mora > 0 ? `<tr><td style="padding:8px 0;color:#6b7280">Interés mora</td><td style="padding:8px 0;font-weight:600;color:#dc2626">${fmtMonto(mora)}</td></tr>` : ''}
      <tr><td style="padding:8px 0;color:#6b7280;font-weight:700">Total a pagar</td><td style="padding:8px 0;font-weight:700;font-size:16px;color:#1e3a5f">${fmtMonto(total)}</td></tr>
    </table>
    <p style="color:#64748b;font-size:13px">Para realizar su pago o subir un comprobante, ingrese al portal del propietario o comuníquese con la administración.</p>
  `);
}

function htmlRecordatorioExt({ propietario, unidad, edificio, cuota, pago }) {
  return layout('Recordatorio — Cuota Extraordinaria', `
    <p>Estimado/a <strong>${propietario.nombre}</strong>,</p>
    <p>Le recordamos que tiene un cargo extraordinario pendiente de pago:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;margin:16px 0">
      <tr><td style="padding:8px 0;color:#6b7280;width:160px">Edificio</td><td style="padding:8px 0;font-weight:600">${edificio.nombre}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Unidad</td><td style="padding:8px 0;font-weight:600">${unidad.numero}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Concepto</td><td style="padding:8px 0;font-weight:600">${cuota.descripcion}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Fecha de vencimiento</td><td style="padding:8px 0;font-weight:600;color:${pago.estado === 'VENCIDO' ? '#dc2626' : '#374151'}">${fmtFecha(pago.fechaVence)}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-weight:700">Total a pagar</td><td style="padding:8px 0;font-weight:700;font-size:16px;color:#1e3a5f">${fmtMonto(pago.monto)}</td></tr>
    </table>
    <p style="color:#64748b;font-size:13px">Para realizar su pago o comunicarse con la administración, contáctenos a la brevedad.</p>
  `);
}

async function enviarRecordatorioExt(ctx) {
  const { propietario } = ctx;
  if (!propietario?.email) return false;
  try {
    await enviar({
      to:      propietario.email,
      subject: `Recordatorio cuota extraordinaria — ${ctx.edificio.nombre}`,
      html:    htmlRecordatorioExt(ctx),
    });
    return true;
  } catch { return false; }
}

async function enviarRecordatorio(ctx) {
  const { propietario } = ctx;
  if (!propietario?.email) return false;
  try {
    await enviar({
      to:      propietario.email,
      subject: `Recordatorio de pago — ${ctx.edificio.nombre}`,
      html:    htmlRecordatorio(ctx),
    });
    return true;
  } catch { return false; }
}

async function enviarNotificacionMora({ propietario, unidad, edificio, pago, cuota, recargo }) {
  if (!propietario?.email) return;
  const total = Number(pago.monto) + recargo;
  const html = layout('⚠️ Cuota vencida — se ha aplicado recargo por mora', `
    <p>Estimado/a <strong>${propietario.nombre}</strong>,</p>
    <p>Le informamos que la cuota de mantenimiento correspondiente al período
    <strong>${MESES[cuota.mes]} ${cuota.anio}</strong> del edificio <strong>${edificio.nombre}</strong>
    ha vencido y se ha aplicado un recargo por mora.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;margin:16px 0">
      <tr><td style="padding:8px 0;color:#6b7280;width:160px">Edificio</td><td style="padding:8px 0;font-weight:600">${edificio.nombre}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Unidad</td><td style="padding:8px 0;font-weight:600">${unidad.numero}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Período</td><td style="padding:8px 0;font-weight:600">${MESES[cuota.mes]} ${cuota.anio}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Cuota</td><td style="padding:8px 0;font-weight:600">${fmtMonto(pago.monto)}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Recargo por mora</td><td style="padding:8px 0;font-weight:600;color:#dc2626">${fmtMonto(recargo)}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-weight:700">Total a pagar</td><td style="padding:8px 0;font-weight:700;font-size:16px;color:#dc2626">${fmtMonto(total)}</td></tr>
    </table>
    <p>Por favor regularice su situación a la brevedad para evitar recargos adicionales.</p>
    <p style="color:#64748b;font-size:13px">Puede realizar su pago o subir un comprobante accediendo al portal del propietario.</p>
  `);
  await enviar({
    to:      propietario.email,
    subject: `Cuota vencida — recargo aplicado — ${edificio.nombre}`,
    html,
  });
}

module.exports = {
  enviarRecibo,
  enviarAvisoMora,
  enviarConfirmacionReserva,
  enviarCancelacionReserva,
  enviarEstadoCuota,
  enviarOrdenProveedor,
  moraDescripcionEdificio,
  enviarRecordatorio,
  enviarRecordatorioExt,
  enviarAprobacionReserva,
  enviarNotificacionMora,
};
