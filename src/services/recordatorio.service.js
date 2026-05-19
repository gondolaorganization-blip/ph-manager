const prisma   = require('../config/prisma');
const emailSvc = require('./email.service');

const DIAS_AVISO = [5, 1]; // días antes del vencimiento para enviar recordatorio

function addDias(fecha, n) {
  const d = new Date(fecha);
  d.setDate(d.getDate() + n);
  return d;
}

function mismaFecha(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

async function enviarRecordatoriosAutomaticos() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  let totalEnviados = 0;
  let totalErrores  = 0;

  for (const diasAntes of DIAS_AVISO) {
    const fechaObjetivo = addDias(hoy, diasAntes);

    // ── Cuotas de mantenimiento ────────────────────────────────────────────
    const cuotas = await prisma.cuotaMantenimiento.findMany({
      where: {
        fechaVence: {
          gte: new Date(fechaObjetivo.getFullYear(), fechaObjetivo.getMonth(), fechaObjetivo.getDate()),
          lt:  new Date(fechaObjetivo.getFullYear(), fechaObjetivo.getMonth(), fechaObjetivo.getDate() + 1),
        },
        pagos: { some: { estado: { not: 'PAGADO' } } },
      },
      include: {
        edificio: { select: { id: true, nombre: true } },
        pagos: {
          where: { estado: { not: 'PAGADO' } },
          include: {
            unidad: {
              include: { propietario: { select: { nombre: true, email: true } } },
            },
          },
        },
      },
    });

    for (const cuota of cuotas) {
      const vistos = new Set();
      for (const pago of cuota.pagos) {
        const prop = pago.unidad?.propietario;
        if (!prop?.email || vistos.has(prop.email)) continue;
        vistos.add(prop.email);
        try {
          await emailSvc.enviarRecordatorio({
            propietario: prop,
            unidad:      pago.unidad,
            edificio:    cuota.edificio,
            cuota,
            pago,
          });
          totalEnviados++;
        } catch { totalErrores++; }
      }
    }

    // ── Cuotas extraordinarias ────────────────────────────────────────────
    const cuotasExt = await prisma.cuotaExtraordinaria.findMany({
      where: {
        pagos: {
          some: {
            estado:    { not: 'PAGADO' },
            fechaVence: {
              gte: new Date(fechaObjetivo.getFullYear(), fechaObjetivo.getMonth(), fechaObjetivo.getDate()),
              lt:  new Date(fechaObjetivo.getFullYear(), fechaObjetivo.getMonth(), fechaObjetivo.getDate() + 1),
            },
          },
        },
      },
      include: {
        edificio: { select: { id: true, nombre: true } },
        pagos: {
          where: {
            estado:    { not: 'PAGADO' },
            fechaVence: {
              gte: new Date(fechaObjetivo.getFullYear(), fechaObjetivo.getMonth(), fechaObjetivo.getDate()),
              lt:  new Date(fechaObjetivo.getFullYear(), fechaObjetivo.getMonth(), fechaObjetivo.getDate() + 1),
            },
          },
          include: {
            unidad: {
              include: { propietario: { select: { nombre: true, email: true } } },
            },
          },
        },
      },
    });

    for (const cuota of cuotasExt) {
      const vistos = new Set();
      for (const pago of cuota.pagos) {
        const prop = pago.unidad?.propietario;
        if (!prop?.email || vistos.has(prop.email)) continue;
        vistos.add(prop.email);
        try {
          await emailSvc.enviarRecordatorioExt({
            propietario: prop,
            unidad:      pago.unidad,
            edificio:    cuota.edificio,
            cuota,
            pago,
          });
          totalEnviados++;
        } catch { totalErrores++; }
      }
    }
  }

  console.log(`[recordatorio] Enviados: ${totalEnviados}, errores: ${totalErrores}`);
  return { totalEnviados, totalErrores };
}

module.exports = { enviarRecordatoriosAutomaticos };
