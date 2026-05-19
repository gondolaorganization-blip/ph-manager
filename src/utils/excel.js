const ExcelJS = require('exceljs');

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function fmtMoney(n) { return Number(n).toFixed(2); }
function fmtDate(d)  { return d ? new Date(d).toLocaleDateString('es-PA') : '—'; }

function headerStyle(cell) {
  cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  cell.border    = { bottom: { style: 'thin', color: { argb: 'FFAAB4C4' } } };
}

function altRow(row, idx) {
  if (idx % 2 === 0) {
    row.eachCell(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });
  }
}

// ── Pagos de una cuota ────────────────────────────────────────────────────────
async function pagosExcel({ cuota, pagos, edificioNombre }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PH Manager';
  wb.created = new Date();

  const ws = wb.addWorksheet(`Cuota ${MESES[cuota.mes]} ${cuota.anio}`);

  // Título
  ws.mergeCells('A1:I1');
  const titulo = ws.getCell('A1');
  titulo.value = `${edificioNombre} — Cuota ${MESES[cuota.mes]} ${cuota.anio}`;
  titulo.font  = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
  titulo.alignment = { horizontal: 'center' };
  ws.getRow(1).height = 28;
  ws.addRow([]);

  // Cabeceras
  const headers = ['Unidad', 'Propietario', 'Email', 'Monto', 'Mora', 'Total', 'Estado', 'F. Pago', 'Método'];
  const hRow = ws.addRow(headers);
  hRow.eachCell(c => headerStyle(c));
  ws.getRow(hRow.number).height = 22;

  ws.columns = [
    { key: 'unidad',      width: 10 },
    { key: 'propietario', width: 26 },
    { key: 'email',       width: 28 },
    { key: 'monto',       width: 12 },
    { key: 'mora',        width: 12 },
    { key: 'total',       width: 12 },
    { key: 'estado',      width: 12 },
    { key: 'fpago',       width: 14 },
    { key: 'metodo',      width: 14 },
  ];

  pagos.forEach((p, i) => {
    const mora  = Number(p.interesMora);
    const total = Number(p.monto) + mora;
    const row   = ws.addRow([
      p.unidad?.numero              || '—',
      p.unidad?.propietario?.nombre || '—',
      p.unidad?.propietario?.email  || '—',
      fmtMoney(p.monto),
      mora > 0 ? fmtMoney(mora) : '—',
      fmtMoney(total),
      p.estado,
      fmtDate(p.fechaPago),
      p.metodo || '—',
    ]);
    // Color por estado
    const estadoCell = row.getCell(7);
    if (p.estado === 'PAGADO')   { estadoCell.font = { color: { argb: 'FF166534' } }; estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; }
    if (p.estado === 'VENCIDO')  { estadoCell.font = { color: { argb: 'FF991B1B' } }; estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; }
    if (p.estado === 'PENDIENTE'){ estadoCell.font = { color: { argb: 'FF854D0E' } }; estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } }; }
    altRow(row, i);
  });

  // Totales
  ws.addRow([]);
  const pagados   = pagos.filter(p => p.estado === 'PAGADO');
  const pendientes = pagos.filter(p => p.estado !== 'PAGADO');
  const totRow = ws.addRow([
    'TOTALES', '', '',
    fmtMoney(pagos.reduce((s, p) => s + Number(p.monto), 0)),
    fmtMoney(pagos.reduce((s, p) => s + Number(p.interesMora), 0)),
    fmtMoney(pagos.reduce((s, p) => s + Number(p.monto) + Number(p.interesMora), 0)),
    `${pagados.length} pagados / ${pendientes.length} pendientes`,
  ]);
  totRow.font = { bold: true };

  return wb.xlsx.writeBuffer();
}

// ── Morosos ──────────────────────────────────────────────────────────────────
async function morososExcel({ data, edificioNombre }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PH Manager';
  wb.created = new Date();

  const ws = wb.addWorksheet('Morosos');

  ws.mergeCells('A1:G1');
  const titulo = ws.getCell('A1');
  titulo.value = `${edificioNombre} — Reporte de Morosos`;
  titulo.font  = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
  titulo.alignment = { horizontal: 'center' };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:G2');
  const sub = ws.getCell('A2');
  sub.value     = `Generado: ${new Date().toLocaleDateString('es-PA')} · Total deuda: $${fmtMoney(data.totalDeuda)}`;
  sub.font      = { italic: true, color: { argb: 'FF64748B' } };
  sub.alignment = { horizontal: 'center' };
  ws.addRow([]);

  const headers = ['Unidad', 'Propietario', 'Email', 'Teléfono', 'Cuotas', 'Días vencido', 'Total deuda'];
  const hRow = ws.addRow(headers);
  hRow.eachCell(c => headerStyle(c));
  ws.getRow(hRow.number).height = 22;

  ws.columns = [
    { key: 'unidad',      width: 10 },
    { key: 'propietario', width: 26 },
    { key: 'email',       width: 28 },
    { key: 'telefono',    width: 16 },
    { key: 'cuotas',      width: 10 },
    { key: 'dias',        width: 14 },
    { key: 'deuda',       width: 14 },
  ];

  const BUCKET_ORDER = ['1-30', '31-60', '61-90', '91+'];
  const BUCKET_COLORS = { '1-30': 'FFFEF9C3', '31-60': 'FFFFEDD5', '61-90': 'FFFEE2E2', '91+': 'FFFCE7F3' };

  let rowIdx = 0;
  for (const bucket of BUCKET_ORDER) {
    const items = data.buckets[bucket];
    if (!items?.length) continue;

    // Bucket header
    ws.addRow([]);
    const bRow = ws.addRow([`${bucket} días (${items.length} unidades)`]);
    bRow.getCell(1).font = { bold: true, color: { argb: 'FF1E3A5F' } };
    bRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BUCKET_COLORS[bucket] } };

    items.forEach((item, i) => {
      const row = ws.addRow([
        item.unidad?.numero              || '—',
        item.propietario?.nombre         || '—',
        item.propietario?.email          || '—',
        item.propietario?.telefono       || '—',
        item.cuotas?.length,
        item.diasMaxVencidos,
        fmtMoney(item.totalDeuda),
      ]);
      row.getCell(7).font = { bold: true, color: { argb: 'FF991B1B' } };
      altRow(row, rowIdx++);
    });
  }

  // Detalle de cuotas en hoja secundaria
  const ws2 = wb.addWorksheet('Detalle cuotas');
  ws2.mergeCells('A1:6');
  const hRow2 = ws2.addRow(['Unidad', 'Propietario', 'Mes', 'Año', 'Monto', 'Mora', 'Total', 'Días vencido']);
  hRow2.eachCell(c => headerStyle(c));
  ws2.columns = [
    { width: 10 }, { width: 26 }, { width: 10 }, { width: 8 },
    { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 },
  ];

  for (const bucket of BUCKET_ORDER) {
    const items = data.buckets[bucket] || [];
    items.forEach((item, i) => {
      item.cuotas?.forEach(c => {
        const row = ws2.addRow([
          item.unidad?.numero,
          item.propietario?.nombre || '—',
          MESES[c.mes],
          c.anio,
          fmtMoney(c.monto),
          fmtMoney(c.mora),
          fmtMoney(c.total),
          c.diasVencidos,
        ]);
        altRow(row, i);
      });
    });
  }

  return wb.xlsx.writeBuffer();
}

// ── Visitas ──────────────────────────────────────────────────────────────────
async function visitasExcel({ visitas, edificioNombre, fecha }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PH Manager';
  wb.created = new Date();

  const ws = wb.addWorksheet('Visitas');

  ws.mergeCells('A1:J1');
  const titulo = ws.getCell('A1');
  titulo.value = `${edificioNombre} — Visitas${fecha ? ' · ' + fecha : ''}`;
  titulo.font  = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
  titulo.alignment = { horizontal: 'center' };
  ws.getRow(1).height = 28;
  ws.addRow([]);

  const headers = ['Visitante', 'Unidad', 'Propietario', 'Fecha', 'Hora esp.', 'Estado', 'Entrada', 'Salida', 'Cédula', 'Placa'];
  const hRow = ws.addRow(headers);
  hRow.eachCell(c => headerStyle(c));
  ws.getRow(hRow.number).height = 22;

  ws.columns = [
    { width: 24 }, { width: 10 }, { width: 22 }, { width: 14 },
    { width: 10 }, { width: 12 }, { width: 14 }, { width: 14 },
    { width: 16 }, { width: 12 },
  ];

  visitas.forEach((v, i) => {
    const row = ws.addRow([
      v.nombreVisitante,
      v.unidad?.numero         || '—',
      v.propietario?.nombre    || '—',
      fmtDate(v.fechaVisita),
      v.horaEsperada           || '—',
      v.estado,
      v.entrada ? new Date(v.entrada).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }) : '—',
      v.salida  ? new Date(v.salida ).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }) : '—',
      v.cedulaVisitante        || '—',
      v.placa                  || '—',
    ]);
    const estadoCell = row.getCell(6);
    if (v.estado === 'LLEGÓ')    { estadoCell.font = { color: { argb: 'FF166534' } }; estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; }
    if (v.estado === 'PENDIENTE'){ estadoCell.font = { color: { argb: 'FF854D0E' } }; estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } }; }
    if (v.estado === 'NO_LLEGÓ') { estadoCell.font = { color: { argb: 'FF991B1B' } }; estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; }
    altRow(row, i);
  });

  // Resumen
  ws.addRow([]);
  const res = ws.addRow([
    `Total: ${visitas.length}`,
    `Llegaron: ${visitas.filter(v => v.estado === 'LLEGÓ').length}`,
    `Pendientes: ${visitas.filter(v => v.estado === 'PENDIENTE').length}`,
    `No llegaron: ${visitas.filter(v => v.estado === 'NO_LLEGÓ').length}`,
    `Canceladas: ${visitas.filter(v => v.estado === 'CANCELADA').length}`,
  ]);
  res.font = { bold: true };

  return wb.xlsx.writeBuffer();
}

// ── Balance financiero ────────────────────────────────────────────────────────
async function balanceExcel({ data }) {
  const { periodo, edificio, ingresos, gastos, balance, fondoReserva, deudaPendiente } = data;
  const periodo_label = `${MESES[periodo.mes]} ${periodo.anio}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'PH Manager';
  wb.created = new Date();

  // ── Hoja 1: Resumen ────────────────────────────────────────────────────────
  const wsRes = wb.addWorksheet('Resumen');

  wsRes.mergeCells('A1:D1');
  const t1 = wsRes.getCell('A1');
  t1.value     = `${edificio.nombre} — Balance Financiero ${periodo_label}`;
  t1.font      = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
  t1.alignment = { horizontal: 'center' };
  wsRes.getRow(1).height = 28;
  wsRes.addRow([]);

  // KPIs
  const kpis = [
    ['Ingresos del mes',     ingresos.total,    'FF166534', 'FFDCFCE7'],
    ['Gastos del mes',       gastos.total,      'FF991B1B', 'FFFEE2E2'],
    ['Balance neto',         balance,           balance >= 0 ? 'FF166534' : 'FF991B1B', balance >= 0 ? 'FFDCFCE7' : 'FFFEE2E2'],
    ['Fondo de reserva',     fondoReserva,      'FF1D4ED8', 'FFDBEAFE'],
    ['Deuda pendiente total',deudaPendiente,    'FF92400E', 'FFFEF9C3'],
  ];

  for (const [label, monto, fg, bg] of kpis) {
    const row = wsRes.addRow([label, `$${fmtMoney(monto)}`]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).font = { bold: true, color: { argb: fg } };
    row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    row.getCell(2).alignment = { horizontal: 'right' };
  }

  wsRes.addRow([]);

  // Gastos por categoría
  if (Object.keys(gastos.porCategoria).length > 0) {
    const catHeader = wsRes.addRow(['Gastos por categoría', 'Monto', '% del total']);
    catHeader.eachCell(c => headerStyle(c));

    for (const [cat, monto] of Object.entries(gastos.porCategoria)) {
      const pct = gastos.total > 0 ? ((monto / gastos.total) * 100).toFixed(1) + '%' : '0%';
      wsRes.addRow([cat, `$${fmtMoney(monto)}`, pct]);
    }

    wsRes.addRow([]);
    const totCat = wsRes.addRow(['TOTAL GASTOS', `$${fmtMoney(gastos.total)}`, '100%']);
    totCat.font = { bold: true };
  }

  wsRes.columns = [{ width: 28 }, { width: 18 }, { width: 14 }];

  // ── Hoja 2: Ingresos ───────────────────────────────────────────────────────
  const wsIng = wb.addWorksheet('Ingresos');

  wsIng.mergeCells('A1:G1');
  const t2 = wsIng.getCell('A1');
  t2.value     = `${edificio.nombre} — Ingresos ${periodo_label}`;
  t2.font      = { bold: true, size: 13, color: { argb: 'FF1E3A5F' } };
  t2.alignment = { horizontal: 'center' };
  wsIng.getRow(1).height = 26;
  wsIng.addRow([]);

  const ingHeaders = ['Unidad', 'Propietario', 'Cuota', 'F. Pago', 'Monto', 'Mora', 'Total'];
  const ingHRow = wsIng.addRow(ingHeaders);
  ingHRow.eachCell(c => headerStyle(c));

  wsIng.columns = [
    { width: 10 }, { width: 26 }, { width: 12 }, { width: 14 },
    { width: 13 }, { width: 13 }, { width: 13 },
  ];

  ingresos.detalle.forEach((p, i) => {
    const row = wsIng.addRow([
      p.unidad,
      p.propietario,
      `${MESES[p.cuota.mes].slice(0, 3)} ${p.cuota.anio}`,
      fmtDate(p.fechaPago),
      fmtMoney(p.monto),
      p.mora > 0 ? fmtMoney(p.mora) : '—',
      fmtMoney(p.total),
    ]);
    if (p.mora > 0) row.getCell(6).font = { color: { argb: 'FF991B1B' } };
    row.getCell(7).font = { bold: true, color: { argb: 'FF166534' } };
    altRow(row, i);
  });

  if (ingresos.detalle.length > 0) {
    wsIng.addRow([]);
    const totRow = wsIng.addRow(['', '', '', 'TOTAL', fmtMoney(ingresos.detalle.reduce((s, p) => s + p.monto, 0)), '', fmtMoney(ingresos.total)]);
    totRow.font = { bold: true };
    totRow.getCell(7).font = { bold: true, color: { argb: 'FF166534' } };
  }

  // ── Hoja 3: Gastos ─────────────────────────────────────────────────────────
  const wsGas = wb.addWorksheet('Gastos');

  wsGas.mergeCells('A1:E1');
  const t3 = wsGas.getCell('A1');
  t3.value     = `${edificio.nombre} — Gastos ${periodo_label}`;
  t3.font      = { bold: true, size: 13, color: { argb: 'FF1E3A5F' } };
  t3.alignment = { horizontal: 'center' };
  wsGas.getRow(1).height = 26;
  wsGas.addRow([]);

  const gasHeaders = ['Fecha', 'Categoría', 'Descripción', 'Proveedor', 'Monto'];
  const gasHRow = wsGas.addRow(gasHeaders);
  gasHRow.eachCell(c => headerStyle(c));

  wsGas.columns = [
    { width: 13 }, { width: 16 }, { width: 34 }, { width: 20 }, { width: 13 },
  ];

  gastos.detalle.forEach((g, i) => {
    const row = wsGas.addRow([
      fmtDate(g.fecha),
      g.categoria,
      g.descripcion,
      g.proveedor || '—',
      fmtMoney(g.monto),
    ]);
    row.getCell(5).font = { bold: true, color: { argb: 'FF991B1B' } };
    altRow(row, i);
  });

  if (gastos.detalle.length > 0) {
    wsGas.addRow([]);
    const totRow = wsGas.addRow(['', '', '', 'TOTAL', fmtMoney(gastos.total)]);
    totRow.font = { bold: true };
    totRow.getCell(5).font = { bold: true, color: { argb: 'FF991B1B' } };
  }

  return wb.xlsx.writeBuffer();
}

// ── Órdenes de trabajo ────────────────────────────────────────────────────────
async function ordenesExcel({ ordenes, edificioNombre }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PH Manager';
  wb.created = new Date();

  const ws = wb.addWorksheet('Órdenes de Trabajo');

  ws.mergeCells('A1:J1');
  const titulo = ws.getCell('A1');
  titulo.value = `${edificioNombre} — Órdenes de Trabajo`;
  titulo.font  = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
  titulo.alignment = { horizontal: 'center' };
  ws.getRow(1).height = 28;
  ws.addRow([]);

  const headers = ['#', 'Descripción', 'Estado', 'Prioridad', 'Proveedor', 'Servicio', 'Monto', 'Fecha', 'F. Estimada', 'F. Cierre'];
  const hRow = ws.addRow(headers);
  hRow.eachCell(c => headerStyle(c));
  ws.columns = [
    { width: 6 }, { width: 36 }, { width: 14 }, { width: 12 },
    { width: 22 }, { width: 16 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 },
  ];

  const ESTADO_COLORS = {
    PENDIENTE:  { bg: 'FFFEF9C3', fg: 'FF854D0E' },
    APROBADA:   { bg: 'FFDBEAFE', fg: 'FF1E40AF' },
    EN_PROCESO: { bg: 'FFEDE9FE', fg: 'FF5B21B6' },
    COMPLETADA: { bg: 'FFDCFCE7', fg: 'FF166534' },
    CANCELADA:  { bg: 'FFF1F5F9', fg: 'FF64748B' },
  };

  ordenes.forEach((o, i) => {
    const row = ws.addRow([
      o.id, o.descripcion, o.estado, o.prioridad,
      o.proveedor?.nombre || '—', o.proveedor?.servicio || '—',
      o.monto ? fmtMoney(o.monto) : '—',
      fmtDate(o.fecha), fmtDate(o.fechaEstimada), fmtDate(o.fechaCierre),
    ]);
    const c = ESTADO_COLORS[o.estado];
    if (c) {
      const cell = row.getCell(3);
      cell.font = { color: { argb: c.fg } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.bg } };
    }
    if (o.prioridad === 'URGENTE') {
      const pc = row.getCell(4);
      pc.font = { bold: true, color: { argb: 'FFDC2626' } };
    }
    altRow(row, i);
  });

  ws.addRow([]);
  const totRow = ws.addRow(['', `Total: ${ordenes.length} órdenes`]);
  totRow.font = { bold: true };

  return wb.xlsx.writeBuffer();
}

// ── Ingresos varios ───────────────────────────────────────────────────────────
async function ingresosExcel({ ingresos, edificioNombre, anio }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PH Manager';
  wb.created = new Date();

  const ws = wb.addWorksheet('Ingresos Varios');

  ws.mergeCells('A1:G1');
  const titulo = ws.getCell('A1');
  titulo.value = `${edificioNombre} — Ingresos Varios${anio ? ' ' + anio : ''}`;
  titulo.font  = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
  titulo.alignment = { horizontal: 'center' };
  ws.getRow(1).height = 28;
  ws.addRow([]);

  const headers = ['Fecha', 'Categoría', 'Descripción', 'Monto', 'Referencia', 'Notas'];
  const hRow = ws.addRow(headers);
  hRow.eachCell(c => headerStyle(c));
  ws.columns = [
    { width: 14 }, { width: 20 }, { width: 36 }, { width: 14 }, { width: 20 }, { width: 30 },
  ];

  let total = 0;
  ingresos.forEach((i, idx) => {
    const monto = Number(i.monto);
    total += monto;
    const row = ws.addRow([
      fmtDate(i.fecha), i.categoria, i.descripcion,
      fmtMoney(monto), i.referencia || '—', i.notas || '—',
    ]);
    row.getCell(4).numFmt = '#,##0.00';
    altRow(row, idx);
  });

  ws.addRow([]);
  const totRow = ws.addRow(['', '', 'TOTAL', fmtMoney(total)]);
  totRow.font = { bold: true };
  totRow.getCell(4).font = { bold: true, color: { argb: 'FF166534' } };

  return wb.xlsx.writeBuffer();
}

// ── Propietarios ─────────────────────────────────────────────────────────────
async function propietariosExcel({ propietarios, edificioNombre }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PH Manager';
  wb.created = new Date();

  const ws = wb.addWorksheet('Propietarios');

  ws.mergeCells('A1:H1');
  const titulo = ws.getCell('A1');
  titulo.value = `${edificioNombre} — Propietarios`;
  titulo.font  = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
  titulo.alignment = { horizontal: 'center' };
  ws.getRow(1).height = 28;
  ws.addRow([]);

  const headers = ['Unidad', 'Nombre', 'Cédula / RUC', 'Email', 'Teléfono', 'Portal activo', 'F. Ingreso', 'Estado'];
  const hRow = ws.addRow(headers);
  hRow.eachCell(c => headerStyle(c));
  ws.columns = [
    { width: 10 }, { width: 30 }, { width: 18 }, { width: 28 },
    { width: 16 }, { width: 14 }, { width: 14 }, { width: 10 },
  ];

  propietarios.forEach((p, i) => {
    const row = ws.addRow([
      p.unidad?.numero || '—',
      p.nombre,
      p.cedula || '—',
      p.email  || '—',
      p.telefono || '—',
      p.portalActivo ? 'Sí' : 'No',
      fmtDate(p.creadoEn),
      p.activo ? 'Activo' : 'Inactivo',
    ]);
    if (!p.activo) row.getCell(8).font = { color: { argb: 'FF64748B' } };
    if (p.portalActivo) row.getCell(6).font = { bold: true, color: { argb: 'FF166534' } };
    altRow(row, i);
  });

  return wb.xlsx.writeBuffer();
}

// ── Unidades ──────────────────────────────────────────────────────────────────
async function unidadesExcel({ unidades, edificioNombre }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PH Manager';
  wb.created = new Date();

  const ws = wb.addWorksheet('Unidades');

  ws.mergeCells('A1:H1');
  const titulo = ws.getCell('A1');
  titulo.value = `${edificioNombre} — Unidades`;
  titulo.font  = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
  titulo.alignment = { horizontal: 'center' };
  ws.getRow(1).height = 28;
  ws.addRow([]);

  const headers = ['#', 'Número', 'Tipo', 'N° Finca', 'Coeficiente', 'Propietario', 'Email', 'Estado'];
  const hRow = ws.addRow(headers);
  hRow.eachCell(c => headerStyle(c));
  ws.columns = [
    { width: 6 }, { width: 12 }, { width: 14 }, { width: 14 },
    { width: 14 }, { width: 28 }, { width: 28 }, { width: 10 },
  ];

  unidades.forEach((u, i) => {
    const row = ws.addRow([
      i + 1,
      u.numero,
      u.tipo || '—',
      u.numFinca || '—',
      u.coeficiente != null ? `${(Number(u.coeficiente) * 100).toFixed(4)}%` : '—',
      u.propietario?.nombre || 'Sin propietario',
      u.propietario?.email  || '—',
      u.activa ? 'Activa' : 'Inactiva',
    ]);
    if (!u.activa) row.getCell(8).font = { color: { argb: 'FF64748B' } };
    if (!u.propietario) row.getCell(6).font = { color: { argb: 'FF94A3B8' } };
    altRow(row, i);
  });

  return wb.xlsx.writeBuffer();
}

// ── Reservas ──────────────────────────────────────────────────────────────────
async function reservasExcel({ reservas, edificioNombre }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PH Manager';
  wb.created = new Date();

  const ws = wb.addWorksheet('Reservas');

  ws.mergeCells('A1:H1');
  const titulo = ws.getCell('A1');
  titulo.value = `${edificioNombre} — Reservas de Áreas Comunes`;
  titulo.font  = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
  titulo.alignment = { horizontal: 'center' };
  ws.getRow(1).height = 28;
  ws.addRow([]);

  const headers = ['Área', 'Fecha', 'Hora Inicio', 'Hora Fin', 'Unidad', 'Propietario', 'Estado', 'Notas'];
  const hRow = ws.addRow(headers);
  hRow.eachCell(c => headerStyle(c));
  ws.columns = [
    { width: 14 }, { width: 14 }, { width: 12 }, { width: 12 },
    { width: 10 }, { width: 26 }, { width: 12 }, { width: 30 },
  ];

  const ESTADO_COLOR = { APROBADA: 'FF16A34A', CANCELADA: 'FF64748B', PENDIENTE: 'FFD97706' };

  reservas.forEach((r, i) => {
    const row = ws.addRow([
      r.area,
      fmtDate(r.fecha),
      r.horaInicio,
      r.horaFin,
      r.unidad?.numero || '—',
      r.unidad?.propietario?.nombre || '—',
      r.estado,
      r.notas || '',
    ]);
    const colorEstado = ESTADO_COLOR[r.estado];
    if (colorEstado) row.getCell(7).font = { bold: true, color: { argb: colorEstado } };
    altRow(row, i);
  });

  return wb.xlsx.writeBuffer();
}

module.exports = { pagosExcel, morososExcel, visitasExcel, balanceExcel, ordenesExcel, ingresosExcel, propietariosExcel, unidadesExcel, reservasExcel };
