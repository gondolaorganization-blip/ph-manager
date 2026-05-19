const PDFDocument = require('pdfkit');

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const COLOR_HEADER  = '#1e3a5f';
const COLOR_ACCENT  = '#2563eb';
const COLOR_LIGHT   = '#f1f5f9';
const COLOR_BORDER  = '#cbd5e1';
const COLOR_RED     = '#dc2626';
const COLOR_GREEN   = '#16a34a';
const COLOR_YELLOW  = '#d97706';
const COLOR_TEXT    = '#1e293b';
const COLOR_MUTED   = '#64748b';

function fmt(n) {
  return `$${Number(n).toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function createDoc(res, filename) {
  const doc = new PDFDocument({ margin: 40, size: 'LETTER', bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  doc.pipe(res);
  return doc;
}

function drawHeader(doc, edificio, titulo, subtitulo) {
  // Fondo azul oscuro
  doc.rect(40, 40, doc.page.width - 80, 70).fill(COLOR_HEADER);

  doc.fillColor('white')
     .fontSize(16).font('Helvetica-Bold')
     .text('PH MANAGER', 56, 52);

  doc.fontSize(10).font('Helvetica')
     .text(edificio.nombre, 56, 72)
     .text(edificio.direccion || '', 56, 85, { width: 260 });

  // Título del reporte (derecha)
  doc.fontSize(14).font('Helvetica-Bold')
     .text(titulo, 0, 55, { align: 'right', width: doc.page.width - 80 });
  if (subtitulo) {
    doc.fontSize(10).font('Helvetica')
       .text(subtitulo, 0, 76, { align: 'right', width: doc.page.width - 80 });
  }

  doc.fillColor(COLOR_TEXT);
  return 130; // y después del header
}

function drawFooter(doc) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i);
    const y = doc.page.height - 35;
    doc.moveTo(40, y).lineTo(doc.page.width - 40, y).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
    doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica')
       .text(`Generado el ${new Date().toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' })}`,
             40, y + 6)
       .text(`Página ${i + 1} de ${pages.count}`, 40, y + 6, { align: 'right', width: doc.page.width - 80 });
  }
}

function tableHeader(doc, y, cols) {
  doc.rect(40, y, doc.page.width - 80, 20).fill(COLOR_ACCENT);
  doc.fillColor('white').fontSize(8).font('Helvetica-Bold');
  cols.forEach(col => doc.text(col.label, col.x, y + 6, { width: col.w, align: col.align || 'left' }));
  doc.fillColor(COLOR_TEXT);
  return y + 20;
}

function tableRow(doc, y, cols, values, shade) {
  // Salto de página automático
  if (y > doc.page.height - 80) {
    doc.addPage();
    y = 60;
  }
  if (shade) doc.rect(40, y, doc.page.width - 80, 18).fill(COLOR_LIGHT);
  doc.font('Helvetica').fontSize(8).fillColor(COLOR_TEXT);
  cols.forEach((col, i) => {
    const v = values[i];
    const color = col.color ? col.color(v) : COLOR_TEXT;
    doc.fillColor(color).text(String(v ?? ''), col.x, y + 5, { width: col.w, align: col.align || 'left' });
  });
  doc.fillColor(COLOR_TEXT);
  return y + 18;
}

// ── RECIBO DE PAGO ────────────────────────────────────────────────────────────
function generarRecibo(doc, edificio, pago) {
  let y = drawHeader(doc, edificio, 'RECIBO DE PAGO', `N° ${String(pago.id).padStart(6, '0')}`);

  // Cuerpo del recibo — dos columnas de datos
  const fields = [
    ['Unidad',        pago.unidad.numero],
    ['Propietario',   pago.unidad.propietario?.nombre || '—'],
    ['Período',       `${MESES[pago.cuota.mes]} ${pago.cuota.anio}`],
    ['Fecha de pago', pago.fechaPago
      ? new Date(pago.fechaPago).toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' })
      : '—'],
    ['Método',        pago.metodo || '—'],
    ['Referencia',    pago.referencia || '—'],
  ];

  y += 10;
  fields.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? 56 : 316;
    const row = Math.floor(i / 2);
    const ry = y + row * 36;
    doc.rect(x, ry, 230, 28).fillAndStroke(COLOR_LIGHT, COLOR_BORDER);
    doc.fillColor(COLOR_MUTED).fontSize(7).font('Helvetica').text(label, x + 8, ry + 5);
    doc.fillColor(COLOR_TEXT).fontSize(10).font('Helvetica-Bold').text(value, x + 8, ry + 14);
  });

  y += Math.ceil(fields.length / 2) * 36 + 20;

  // Caja de montos
  doc.rect(40, y, doc.page.width - 80, 70).fill(COLOR_HEADER);
  doc.fillColor('white');

  doc.fontSize(9).font('Helvetica').text('MONTO CUOTA', 60, y + 10);
  doc.fontSize(9).font('Helvetica').text('MORA', 230, y + 10);
  doc.fontSize(9).font('Helvetica').text('TOTAL PAGADO', 400, y + 10);

  doc.moveTo(220, y + 8).lineTo(220, y + 62).strokeColor('rgba(255,255,255,0.3)').lineWidth(0.5).stroke();
  doc.moveTo(390, y + 8).lineTo(390, y + 62).strokeColor('rgba(255,255,255,0.3)').lineWidth(0.5).stroke();

  doc.fontSize(20).font('Helvetica-Bold')
     .text(fmt(pago.monto), 56, y + 28)
     .text(fmt(pago.interesMora), 226, y + 28)
     .text(fmt(Number(pago.monto) + Number(pago.interesMora)), 396, y + 28);

  y += 90;

  if (pago.notas) {
    doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica-Oblique')
       .text(`Notas: ${pago.notas}`, 56, y);
  }

  doc.rect(40, y + 20, doc.page.width - 80, 1).fill(COLOR_BORDER);
  doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica')
     .text('Este recibo es un comprobante oficial generado por PH Manager.', 40, y + 28, { align: 'center', width: doc.page.width - 80 });
}

// ── ESTADO DE CUOTA ───────────────────────────────────────────────────────────
function generarEstadoCuota(doc, edificio, cuota, pagos) {
  const titulo   = `${MESES[cuota.mes].toUpperCase()} ${cuota.anio}`;
  let y = drawHeader(doc, edificio, 'ESTADO DE CUOTA', titulo);

  // KPIs
  const total     = pagos.length;
  const pagados   = pagos.filter(p => p.estado === 'PAGADO').length;
  const vencidos  = pagos.filter(p => p.estado === 'VENCIDO').length;
  const pendientes = pagos.filter(p => p.estado === 'PENDIENTE').length;
  const recaudado = pagos.filter(p => p.estado === 'PAGADO').reduce((s, p) => s + Number(p.monto), 0);
  const porCobrar = pagos.filter(p => p.estado !== 'PAGADO').reduce((s, p) => s + Number(p.monto) + Number(p.interesMora), 0);

  const kpis = [
    { label: 'Total unidades', value: total },
    { label: 'Pagados',        value: pagados,    color: COLOR_GREEN  },
    { label: 'Pendientes',     value: pendientes, color: COLOR_YELLOW },
    { label: 'Vencidos',       value: vencidos,   color: COLOR_RED    },
    { label: 'Recaudado',      value: fmt(recaudado) },
    { label: 'Por cobrar',     value: fmt(porCobrar) },
  ];

  const kw = Math.floor((doc.page.width - 80) / kpis.length);
  kpis.forEach((k, i) => {
    const x = 40 + i * kw;
    doc.rect(x, y, kw - 4, 46).fillAndStroke(COLOR_LIGHT, COLOR_BORDER);
    doc.fillColor(COLOR_MUTED).fontSize(7).font('Helvetica').text(k.label, x + 6, y + 6, { width: kw - 12 });
    doc.fillColor(k.color || COLOR_TEXT).fontSize(14).font('Helvetica-Bold').text(String(k.value), x + 6, y + 20, { width: kw - 12 });
  });

  y += 60;

  // Tabla
  const cols = [
    { label: 'UNIDAD',      x: 44,  w: 50  },
    { label: 'PROPIETARIO', x: 98,  w: 150 },
    { label: 'MONTO',       x: 252, w: 70,  align: 'right' },
    { label: 'MORA',        x: 326, w: 60,  align: 'right' },
    { label: 'TOTAL',       x: 390, w: 70,  align: 'right' },
    { label: 'ESTADO',      x: 464, w: 68,  align: 'center',
      color: v => v === 'PAGADO' ? COLOR_GREEN : v === 'VENCIDO' ? COLOR_RED : COLOR_YELLOW },
    { label: 'F. PAGO',     x: 464, w: 68,  align: 'center' },
  ];

  // Reemplazar última col por F.PAGO para no superponer
  const tableCols = [
    { label: 'UNIDAD',      x: 44,  w: 48  },
    { label: 'PROPIETARIO', x: 96,  w: 148 },
    { label: 'MONTO',       x: 248, w: 66,  align: 'right' },
    { label: 'MORA',        x: 318, w: 56,  align: 'right' },
    { label: 'TOTAL',       x: 378, w: 66,  align: 'right' },
    { label: 'ESTADO',      x: 448, w: 58,  align: 'center',
      color: v => v === 'PAGADO' ? COLOR_GREEN : v === 'VENCIDO' ? COLOR_RED : COLOR_YELLOW },
    { label: 'F. PAGO',     x: 510, w: 62,  align: 'center' },
  ];

  y = tableHeader(doc, y, tableCols);

  pagos.forEach((p, i) => {
    const mora   = Number(p.interesMora);
    const total  = Number(p.monto) + mora;
    const fpago  = p.fechaPago
      ? new Date(p.fechaPago).toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: '2-digit' })
      : '—';
    const propietario = p.unidad?.propietario?.nombre || '—';

    y = tableRow(doc, y, tableCols, [
      p.unidad?.numero,
      propietario.length > 22 ? propietario.slice(0, 20) + '…' : propietario,
      fmt(p.monto),
      fmt(mora),
      fmt(total),
      p.estado,
      fpago,
    ], i % 2 === 0);
  });

  // Totales
  y += 4;
  doc.rect(40, y, doc.page.width - 80, 22).fill(COLOR_HEADER);
  doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
     .text('TOTALES', 44, y + 7)
     .text(fmt(recaudado),                     248, y + 7, { width: 66, align: 'right' })
     .text(fmt(porCobrar - (pagos.filter(p => p.estado !== 'PAGADO').reduce((s, p) => s + Number(p.monto), 0))),
           318, y + 7, { width: 56, align: 'right' })
     .text(fmt(recaudado + porCobrar),          378, y + 7, { width: 66, align: 'right' });
}

// ── REPORTE DE MOROSOS ────────────────────────────────────────────────────────
function generarMorosos(doc, edificio, data) {
  const { totalMorosos, totalDeuda, buckets } = data;
  let y = drawHeader(doc, edificio, 'REPORTE DE MOROSOS', `Corte: ${new Date().toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' })}`);

  // Resumen por bucket
  const bucketDefs = [
    { key: '1-30',  label: '1–30 días',  color: COLOR_YELLOW },
    { key: '31-60', label: '31–60 días', color: '#ea580c' },
    { key: '61-90', label: '61–90 días', color: COLOR_RED },
    { key: '91+',   label: '91+ días',   color: '#7f1d1d' },
  ];

  const bw = Math.floor((doc.page.width - 80) / 4);
  bucketDefs.forEach((b, i) => {
    const items = buckets[b.key] || [];
    const deuda = items.reduce((s, u) => s + u.totalDeuda, 0);
    const x = 40 + i * bw;
    doc.rect(x, y, bw - 4, 50).fillAndStroke(COLOR_LIGHT, COLOR_BORDER);
    doc.fillColor(b.color).fontSize(7).font('Helvetica-Bold').text(b.label, x + 6, y + 6, { width: bw - 12 });
    doc.fillColor(COLOR_TEXT).fontSize(13).font('Helvetica-Bold').text(String(items.length), x + 6, y + 18, { width: bw - 12 });
    doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica').text(fmt(deuda), x + 6, y + 34, { width: bw - 12 });
  });

  y += 60;

  // Totales globales
  doc.rect(40, y, doc.page.width - 80, 28).fill(COLOR_HEADER);
  doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
     .text(`Total morosos: ${totalMorosos} unidades`, 56, y + 9)
     .text(`Deuda total: ${fmt(totalDeuda)}`, 0, y + 9, { align: 'right', width: doc.page.width - 80 });
  y += 36;

  // Una tabla por bucket
  const tableCols = [
    { label: 'UNIDAD',      x: 44,  w: 48  },
    { label: 'PROPIETARIO', x: 96,  w: 130 },
    { label: 'TELÉFONO',    x: 230, w: 74  },
    { label: 'CUOTAS',      x: 308, w: 38,  align: 'center' },
    { label: 'DÍAS MÁX',    x: 350, w: 50,  align: 'center' },
    { label: 'DEUDA',       x: 404, w: 80,  align: 'right'  },
    { label: 'MORA',        x: 488, w: 80,  align: 'right'  },
  ];

  bucketDefs.forEach(b => {
    const items = buckets[b.key] || [];
    if (items.length === 0) return;

    if (y > doc.page.height - 120) { doc.addPage(); y = 60; }

    // Encabezado de bucket
    doc.rect(40, y, doc.page.width - 80, 18).fill(b.color);
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
       .text(`${b.label} — ${items.length} unidad(es)`, 44, y + 5);
    y += 18;

    y = tableHeader(doc, y, tableCols);

    items.forEach((item, i) => {
      const prop = item.propietario;
      const nombre = prop?.nombre || '—';
      const montoBase = item.cuotas.reduce((s, c) => s + c.monto, 0);
      const moraTotal = item.cuotas.reduce((s, c) => s + c.mora, 0);

      y = tableRow(doc, y, tableCols, [
        item.unidad.numero,
        nombre.length > 20 ? nombre.slice(0, 18) + '…' : nombre,
        prop?.telefono || '—',
        item.cuotas.length,
        item.diasMaxVencidos,
        fmt(montoBase),
        fmt(moraTotal),
      ], i % 2 === 0);
    });

    y += 8;
  });
}

// ── BALANCE FINANCIERO ────────────────────────────────────────────────────────
function generarBalance(doc, edificio, data) {
  const { periodo, ingresos, gastos, balance, fondoReserva, deudaPendiente } = data;
  const periodoLabel = `${MESES[periodo.mes]} ${periodo.anio}`;
  let y = drawHeader(doc, edificio, 'BALANCE FINANCIERO', periodoLabel);

  // KPI boxes
  const kpis = [
    { label: 'INGRESOS',        value: fmt(ingresos.total), color: COLOR_GREEN  },
    { label: 'GASTOS',          value: fmt(gastos.total),   color: COLOR_RED    },
    { label: 'BALANCE NETO',    value: fmt(balance),        color: balance >= 0 ? COLOR_GREEN : COLOR_RED },
    { label: 'FONDO DE RESERVA',value: fmt(fondoReserva),   color: COLOR_ACCENT },
    { label: 'DEUDA PENDIENTE', value: fmt(deudaPendiente), color: COLOR_YELLOW },
  ];

  const kw = Math.floor((doc.page.width - 80) / kpis.length);
  kpis.forEach((k, i) => {
    const x = 40 + i * kw;
    doc.rect(x, y, kw - 4, 50).fillAndStroke(COLOR_LIGHT, COLOR_BORDER);
    doc.fillColor(COLOR_MUTED).fontSize(7).font('Helvetica').text(k.label, x + 6, y + 6, { width: kw - 12 });
    doc.fillColor(k.color).fontSize(11).font('Helvetica-Bold').text(k.value, x + 6, y + 20, { width: kw - 12 });
  });
  y += 62;

  // ── Ingresos ──────────────────────────────────────────────────────────────
  doc.rect(40, y, doc.page.width - 80, 20).fill(COLOR_GREEN);
  doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
     .text(`INGRESOS DEL PERÍODO — ${ingresos.count} pago(s)  /  ${fmt(ingresos.total)}`, 48, y + 6);
  y += 20;

  if (ingresos.detalle.length === 0) {
    doc.fillColor(COLOR_MUTED).fontSize(9).font('Helvetica-Oblique')
       .text('Sin pagos registrados en este período.', 48, y + 6);
    y += 24;
  } else {
    const ingCols = [
      { label: 'UNIDAD',      x: 44,  w: 48  },
      { label: 'PROPIETARIO', x: 96,  w: 130 },
      { label: 'CUOTA',       x: 230, w: 60  },
      { label: 'F. PAGO',     x: 294, w: 68, align: 'center' },
      { label: 'MONTO',       x: 366, w: 66, align: 'right'  },
      { label: 'MORA',        x: 436, w: 56, align: 'right'  },
      { label: 'TOTAL',       x: 496, w: 72, align: 'right'  },
    ];
    y = tableHeader(doc, y, ingCols);
    ingresos.detalle.forEach((p, i) => {
      const cuotaLabel = `${MESES[p.cuota.mes].slice(0,3)} ${p.cuota.anio}`;
      const fp = p.fechaPago
        ? new Date(p.fechaPago).toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : '—';
      const nombre = p.propietario.length > 20 ? p.propietario.slice(0, 18) + '…' : p.propietario;
      y = tableRow(doc, y, ingCols, [p.unidad, nombre, cuotaLabel, fp, fmt(p.monto), fmt(p.mora), fmt(p.total)], i % 2 === 0);
    });
    // Total ingresos
    y += 2;
    doc.rect(40, y, doc.page.width - 80, 18).fill(COLOR_HEADER);
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
       .text('TOTAL INGRESOS', 44, y + 5)
       .text(fmt(ingresos.total), 0, y + 5, { align: 'right', width: doc.page.width - 44 });
    y += 22;
  }

  y += 8;

  // ── Gastos ────────────────────────────────────────────────────────────────
  if (y > doc.page.height - 160) { doc.addPage(); y = 60; }

  doc.rect(40, y, doc.page.width - 80, 20).fill(COLOR_RED);
  doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
     .text(`GASTOS DEL PERÍODO — ${gastos.count} registro(s)  /  ${fmt(gastos.total)}`, 48, y + 6);
  y += 20;

  // Gastos por categoría
  const cats = Object.entries(gastos.porCategoria);
  if (cats.length > 0) {
    const catW = Math.floor((doc.page.width - 80) / Math.min(cats.length, 4));
    cats.forEach(([cat, monto], i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 40 + col * catW;
      const cy = y + row * 40;
      doc.rect(x, cy, catW - 4, 34).fillAndStroke(COLOR_LIGHT, COLOR_BORDER);
      doc.fillColor(COLOR_MUTED).fontSize(7).font('Helvetica').text(cat, x + 6, cy + 4, { width: catW - 12 });
      doc.fillColor(COLOR_RED).fontSize(11).font('Helvetica-Bold').text(fmt(monto), x + 6, cy + 16, { width: catW - 12 });
    });
    y += Math.ceil(cats.length / 4) * 40 + 8;
  }

  if (gastos.detalle.length === 0) {
    doc.fillColor(COLOR_MUTED).fontSize(9).font('Helvetica-Oblique')
       .text('Sin gastos registrados en este período.', 48, y + 6);
    y += 24;
  } else {
    if (y > doc.page.height - 120) { doc.addPage(); y = 60; }
    const gasCols = [
      { label: 'FECHA',       x: 44,  w: 60, align: 'center' },
      { label: 'CATEGORÍA',   x: 108, w: 88  },
      { label: 'DESCRIPCIÓN', x: 200, w: 190 },
      { label: 'PROVEEDOR',   x: 394, w: 100 },
      { label: 'MONTO',       x: 498, w: 74, align: 'right' },
    ];
    y = tableHeader(doc, y, gasCols);
    gastos.detalle.forEach((g, i) => {
      const fecha = new Date(g.fecha).toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: '2-digit' });
      const desc = g.descripcion.length > 30 ? g.descripcion.slice(0, 28) + '…' : g.descripcion;
      const prov = (g.proveedor || '—').length > 14 ? (g.proveedor || '').slice(0, 12) + '…' : (g.proveedor || '—');
      y = tableRow(doc, y, gasCols, [fecha, g.categoria, desc, prov, fmt(g.monto)], i % 2 === 0);
    });
    y += 2;
    doc.rect(40, y, doc.page.width - 80, 18).fill(COLOR_HEADER);
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
       .text('TOTAL GASTOS', 44, y + 5)
       .text(fmt(gastos.total), 0, y + 5, { align: 'right', width: doc.page.width - 44 });
    y += 22;
  }

  // ── Balance neto ──────────────────────────────────────────────────────────
  y += 8;
  if (y > doc.page.height - 60) { doc.addPage(); y = 60; }
  const balColor = balance >= 0 ? COLOR_GREEN : COLOR_RED;
  doc.rect(40, y, doc.page.width - 80, 28).fill(balColor);
  doc.fillColor('white').fontSize(12).font('Helvetica-Bold')
     .text(`BALANCE NETO: ${fmt(balance)}`, 44, y + 8, { align: 'center', width: doc.page.width - 88 });
}

function generarEstadoCuotaBuffer(edificio, cuota, pagos) {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 40, size: 'LETTER', bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    generarEstadoCuota(doc, edificio, cuota, pagos);
    drawFooter(doc);
    doc.end();
  });
}

// ── RECIBO CUOTA EXTRAORDINARIA ───────────────────────────────────────────────
function generarReciboExt(doc, edificio, pago) {
  let y = drawHeader(doc, edificio, 'RECIBO — CUOTA EXTRAORDINARIA', `N° ${String(pago.id).padStart(6, '0')}`);

  const fields = [
    ['Unidad',        pago.unidad.numero],
    ['Propietario',   pago.unidad.propietario?.nombre || '—'],
    ['Concepto',      pago.cuota.descripcion],
    ['Fecha de pago', pago.fechaPago
      ? new Date(pago.fechaPago).toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' })
      : '—'],
    ['Método',        pago.metodo || '—'],
    ['Referencia',    pago.referencia || '—'],
  ];

  y += 10;
  fields.forEach(([label, value], i) => {
    const x   = i % 2 === 0 ? 56 : 316;
    const row = Math.floor(i / 2);
    const ry  = y + row * 36;
    doc.rect(x, ry, 230, 28).fillAndStroke(COLOR_LIGHT, COLOR_BORDER);
    doc.fillColor(COLOR_MUTED).fontSize(7).font('Helvetica').text(label, x + 8, ry + 5);
    doc.fillColor(COLOR_TEXT).fontSize(10).font('Helvetica-Bold').text(String(value), x + 8, ry + 14, { width: 212 });
  });

  y += Math.ceil(fields.length / 2) * 36 + 20;

  // Caja de monto
  doc.rect(40, y, doc.page.width - 80, 70).fill(COLOR_HEADER);
  doc.fillColor('white');
  doc.fontSize(9).font('Helvetica').text('MONTO PAGADO', 60, y + 10);
  doc.fontSize(28).font('Helvetica-Bold').text(fmt(pago.monto), 56, y + 26);

  if (pago.notas) {
    y += 90;
    doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica-Oblique').text(`Notas: ${pago.notas}`, 56, y);
  }

  y += 90;
  doc.rect(40, y + 20, doc.page.width - 80, 1).fill(COLOR_BORDER);
  doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica')
     .text('Este recibo es un comprobante oficial generado por PH Manager.', 40, y + 28, { align: 'center', width: doc.page.width - 80 });
}

module.exports = { createDoc, drawFooter, generarRecibo, generarEstadoCuota, generarMorosos, generarBalance, generarEstadoCuotaBuffer, generarReciboExt };
