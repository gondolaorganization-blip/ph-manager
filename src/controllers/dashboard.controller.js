const prisma = require('../config/prisma');

// GET /api/edificios/:edificioId/dashboard
async function dashboard(req, res) {
  try {
    const hoy      = new Date();
    const mes      = hoy.getMonth() + 1;
    const anio     = hoy.getFullYear();
    const en30dias = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000);

    const inicioDia = new Date(hoy); inicioDia.setHours(0, 0, 0, 0);
    const finDia    = new Date(hoy); finDia.setHours(23, 59, 59, 999);

    const inicioMes = new Date(anio, mes - 1, 1);
    const finMes    = new Date(anio, mes, 0, 23, 59, 59);

    const [
      edificio,
      cuotaMes,
      unidadesMorosas,
      deudaVencida,
      ordenesPendientes,
      cuotasProximas,
      cuotasAnio,
      unidadesStats,
      visitasHoyRaw,
      presupuestoItems,
      gastosMes,
    ] = await Promise.all([

      prisma.edificio.findUnique({
        where:  { id: req.edificioId },
        select: { id: true, nombre: true, fondoReserva: true, totalUnidades: true },
      }),

      prisma.cuotaMantenimiento.findUnique({
        where:   { edificioId_mes_anio: { edificioId: req.edificioId, mes, anio } },
        include: { pagos: { select: { estado: true, monto: true, interesMora: true } } },
      }),

      // Unidades con al menos un pago vencido
      prisma.pagoCuota.findMany({
        where: {
          cuota:      { edificioId: req.edificioId },
          estado:     { not: 'PAGADO' },
          fechaVence: { lt: hoy },
        },
        distinct: ['unidadId'],
        select:   { unidadId: true },
      }),

      // Suma total de deuda vencida
      prisma.pagoCuota.aggregate({
        where: {
          cuota:      { edificioId: req.edificioId },
          estado:     { not: 'PAGADO' },
          fechaVence: { lt: hoy },
        },
        _sum: { monto: true, interesMora: true },
      }),

      // Órdenes activas (PENDIENTE, APROBADA, EN_PROCESO)
      prisma.ordenTrabajo.count({
        where: {
          edificioId: req.edificioId,
          estado: { in: ['PENDIENTE', 'APROBADA', 'EN_PROCESO'] },
        },
      }),

      // Cuotas con vencimiento en los próximos 30 días y pagos pendientes
      prisma.cuotaMantenimiento.findMany({
        where: {
          edificioId: req.edificioId,
          fechaVence: { gte: hoy, lte: en30dias },
          pagos:      { some: { estado: 'PENDIENTE' } },
        },
        select: {
          id: true, mes: true, anio: true, fechaVence: true,
          pagos: { where: { estado: 'PENDIENTE' }, select: { monto: true } },
        },
        orderBy: { fechaVence: 'asc' },
      }),

      // Todas las cuotas del año en curso para resumen mensual
      prisma.cuotaMantenimiento.findMany({
        where:   { edificioId: req.edificioId, anio },
        include: { pagos: { select: { estado: true, monto: true } } },
        orderBy: { mes: 'asc' },
      }),

      // Conteo de unidades activas y con propietario
      prisma.unidad.findMany({
        where:  { edificioId: req.edificioId, activa: true },
        select: { id: true, propietario: { select: { id: true } } },
      }),

      // Visitas de hoy
      prisma.visita.findMany({
        where: { edificioId: req.edificioId, fechaVisita: { gte: inicioDia, lte: finDia } },
        select: {
          id: true, nombreVisitante: true, estado: true,
          horaEsperada: true, entrada: true,
          unidad: { select: { numero: true } },
        },
        orderBy: [{ horaEsperada: 'asc' }, { creadoEn: 'asc' }],
      }),

      // Presupuesto del mes actual
      prisma.presupuestoItem.findMany({
        where: { edificioId: req.edificioId, anio, mes },
      }),

      // Gastos del mes actual
      prisma.gasto.aggregate({
        where: { edificioId: req.edificioId, fecha: { gte: inicioMes, lte: finMes } },
        _sum: { monto: true },
      }),
    ]);

    // ── Cuota del mes actual ──────────────────────────────────────────────────
    let cuotaActual = null;
    if (cuotaMes) {
      const pagos     = cuotaMes.pagos;
      const pagados   = pagos.filter(p => p.estado === 'PAGADO');
      const noPagados = pagos.filter(p => p.estado !== 'PAGADO');
      cuotaActual = {
        id:            cuotaMes.id,
        mes:           cuotaMes.mes,
        anio:          cuotaMes.anio,
        monto:         Number(cuotaMes.monto),
        fechaVence:    cuotaMes.fechaVence,
        total:         pagos.length,
        pagados:       pagados.length,
        pendientes:    pagos.filter(p => p.estado === 'PENDIENTE').length,
        vencidos:      pagos.filter(p => p.estado === 'VENCIDO').length,
        recaudado:     +pagados.reduce((s, p) => s + Number(p.monto), 0).toFixed(2),
        porCobrar:     +noPagados.reduce((s, p) => s + Number(p.monto) + Number(p.interesMora), 0).toFixed(2),
        pctRecaudado:  pagos.length ? +(pagados.length / pagos.length * 100).toFixed(1) : 0,
      };
    }

    // ── Morosos ───────────────────────────────────────────────────────────────
    const deudaMonto = Number(deudaVencida._sum.monto      || 0);
    const deudaMora  = Number(deudaVencida._sum.interesMora || 0);
    const morosos = {
      totalUnidades: unidadesMorosas.length,
      totalDeuda:    +(deudaMonto + deudaMora).toFixed(2),
    };

    // ── Próximos vencimientos ─────────────────────────────────────────────────
    const proximosVencimientos = cuotasProximas.map(c => {
      const diasRestantes  = Math.ceil((new Date(c.fechaVence) - hoy) / (1000 * 60 * 60 * 24));
      const montoPendiente = c.pagos.reduce((s, p) => s + Number(p.monto), 0);
      return {
        cuotaId:            c.id,
        mes:                c.mes,
        anio:               c.anio,
        fechaVence:         c.fechaVence,
        diasRestantes,
        unidadesPendientes: c.pagos.length,
        montoPendiente:     +montoPendiente.toFixed(2),
      };
    });

    // ── Resumen anual ─────────────────────────────────────────────────────────
    const meses = cuotasAnio.map(c => {
      const pagados   = c.pagos.filter(p => p.estado === 'PAGADO');
      const noPagados = c.pagos.filter(p => p.estado !== 'PAGADO');
      return {
        mes:          c.mes,
        anio:         c.anio,
        cuotaId:      c.id,
        recaudado:    +pagados.reduce((s, p) => s + Number(p.monto), 0).toFixed(2),
        pendiente:    +noPagados.reduce((s, p) => s + Number(p.monto), 0).toFixed(2),
        pctRecaudado: c.pagos.length ? +(pagados.length / c.pagos.length * 100).toFixed(1) : 0,
      };
    });

    // ── Unidades ──────────────────────────────────────────────────────────────
    const unidades = {
      activas:        unidadesStats.length,
      conPropietario: unidadesStats.filter(u => u.propietario).length,
      sinPropietario: unidadesStats.filter(u => !u.propietario).length,
    };

    const visitasHoy = {
      total:     visitasHoyRaw.length,
      pendientes: visitasHoyRaw.filter(v => v.estado === 'PENDIENTE').length,
      llegaron:   visitasHoyRaw.filter(v => v.estado === 'LLEGÓ').length,
      lista:      visitasHoyRaw,
    };

    // ── Presupuesto del mes ───────────────────────────────────────────────────
    const presupuestado = +presupuestoItems.reduce((s, i) => s + Number(i.monto), 0).toFixed(2);
    const gastadoMes    = +Number(gastosMes._sum.monto || 0).toFixed(2);
    const presupuestoMes = presupuestado > 0 ? {
      presupuestado,
      gastado: gastadoMes,
      disponible: +(presupuestado - gastadoMes).toFixed(2),
      pct: +(gastadoMes / presupuestado * 100).toFixed(1),
    } : null;

    res.json({
      edificio: { ...edificio, fondoReserva: Number(edificio.fondoReserva) },
      cuotaActual,
      morosos,
      ordenesPendientes,
      proximosVencimientos,
      unidades,
      visitasHoy,
      presupuestoMes,
      resumenAnual: {
        anio,
        totalRecaudado: +meses.reduce((s, m) => s + m.recaudado, 0).toFixed(2),
        totalPendiente: +meses.reduce((s, m) => s + m.pendiente, 0).toFixed(2),
        meses,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar dashboard' });
  }
}

module.exports = { dashboard };
