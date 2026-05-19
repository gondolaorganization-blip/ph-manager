const prisma    = require('../config/prisma');
const emailSvc  = require('./email.service');

/**
 * Marca como VENCIDO todo pago cuya fechaVence ya pasó
 * y aplica el recargo configurado en el edificio (una sola vez, no acumula).
 *
 * tipoMora PORCENTAJE: interesMora = monto × tasaMora
 * tipoMora FIJO:       interesMora = montoMoraFijo
 *
 * Devuelve { edificioId, procesados, actualizados }.
 */
async function calcularMoraEdificio(edificioId) {
  const edificio = await prisma.edificio.findUnique({
    where:  { id: edificioId },
    select: { nombre: true, tipoMora: true, tasaMora: true, montoMoraFijo: true },
  });
  if (!edificio) throw new Error(`Edificio ${edificioId} no encontrado`);

  const { tipoMora, tasaMora, montoMoraFijo } = edificio;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  const pagos = await prisma.pagoCuota.findMany({
    where: {
      cuota:      { edificioId },
      estado:     { in: ['PENDIENTE', 'VENCIDO'] },
      fechaVence: { lt: hoy },
    },
    select: {
      id: true, monto: true, estado: true, interesMora: true, fechaVence: true,
      cuota: { select: { mes: true, anio: true } },
      unidad: {
        select: {
          id: true, numero: true,
          propietario: { select: { nombre: true, email: true } },
        },
      },
    },
  });

  let actualizados = 0;

  for (const pago of pagos) {
    const recargo = tipoMora === 'FIJO'
      ? +Number(montoMoraFijo).toFixed(2)
      : +(Number(pago.monto) * Number(tasaMora)).toFixed(2);

    const esNuevoVencido = pago.estado !== 'VENCIDO';

    if (esNuevoVencido || Number(pago.interesMora) !== recargo) {
      await prisma.pagoCuota.update({
        where: { id: pago.id },
        data:  { estado: 'VENCIDO', interesMora: recargo },
      });
      actualizados++;

      if (esNuevoVencido && pago.unidad?.propietario?.email) {
        emailSvc.enviarNotificacionMora({
          propietario: pago.unidad.propietario,
          unidad:      pago.unidad,
          edificio,
          pago,
          cuota:   pago.cuota,
          recargo,
        }).catch(() => {});
      }
    }
  }

  // Cuotas extraordinarias vencidas (sin recargo, solo cambio de estado)
  const extResult = await prisma.pagoCuotaExt.updateMany({
    where: {
      cuota:      { edificioId },
      estado:     'PENDIENTE',
      fechaVence: { lt: hoy },
    },
    data: { estado: 'VENCIDO' },
  });
  actualizados += extResult.count;

  return { edificioId, procesados: pagos.length, actualizados };
}

/**
 * Ejecuta el cálculo para TODOS los edificios activos.
 * Usada por el cron diario.
 */
async function calcularMoraTodos() {
  const edificios = await prisma.edificio.findMany({
    where:  { activo: true },
    select: { id: true },
  });

  const resultados = await Promise.all(
    edificios.map(e => calcularMoraEdificio(e.id).catch(err => ({ edificioId: e.id, error: err.message })))
  );

  const total = resultados.reduce((s, r) => s + (r.actualizados ?? 0), 0);
  console.log(`[mora] Cron ejecutado — ${edificios.length} edificio(s), ${total} pago(s) actualizados`);
  return resultados;
}

module.exports = { calcularMoraEdificio, calcularMoraTodos };
