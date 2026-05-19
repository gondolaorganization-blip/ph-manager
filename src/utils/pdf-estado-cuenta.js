const PDFDocument = require('pdfkit');

// ── Colores ───────────────────────────────────────────────────────────────────
const C_NAVY   = '#1e3a5f';
const C_BLUE   = '#2563eb';
const C_SLATE  = '#64748b';
const C_LIGHT  = '#f1f5f9';
const C_GREEN  = '#16a34a';
const C_RED    = '#dc2626';
const C_AMBER  = '#d97706';
const C_BLACK  = '#0f172a';
const C_BORDER = '#e2e8f0';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function fmt(n) {
  return Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtFecha(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function estadoColor(estado) {
  if (estado === 'PAGADO')  return C_GREEN;
  if (estado === 'VENCIDO') return C_RED;
  return C_AMBER;
}

// ── Generador ─────────────────────────────────────────────────────────────────
async function generarPdfEstadoCuenta({ unidad, propietario, pagos, pagosExt = [], edificio, desde, hasta }) {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'LETTER', margin: 50, bufferPages: true });
    const chunks = [];
    doc.on('data',  c  => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width  - 100;  // ancho útil
    const L = 50;                      // margen izquierdo

    // ── Header ────────────────────────────────────────────────────────────────
    doc.rect(L, 50, W, 70).fill(C_NAVY);
    doc.fillColor('#ffffff')
       .fontSize(18).font('Helvetica-Bold')
       .text(edificio.nombre, L + 16, 62, { width: W - 32 });
    doc.fontSize(10).font('Helvetica')
       .text('ESTADO DE CUENTA', L + 16, 84);
    doc.fontSize(9)
       .text(`Período: ${fmtFecha(desde)} – ${fmtFecha(hasta)}`, L + 16, 98);

    // ── Info propietario ──────────────────────────────────────────────────────
    let y = 138;
    doc.rect(L, y, W, 1).fill(C_NAVY); y += 8;

    doc.fillColor(C_NAVY).fontSize(11).font('Helvetica-Bold')
       .text('DATOS DEL PROPIETARIO', L, y); y += 16;

    const col1 = L, col2 = L + W / 2;
    const infoItems = [
      ['Propietario:', propietario?.nombre || '(Sin propietario)'],
      ['Cédula / RUC:', propietario?.cedula || '—'],
      ['Email:', propietario?.email || '—'],
      ['Teléfono:', propietario?.telefono || '—'],
    ];
    const infoRight = [
      ['Unidad:', unidad.numero],
      ['Tipo:', unidad.tipo],
      ['Finca:', unidad.numFinca || '—'],
      ['Coeficiente:', `${(Number(unidad.coeficiente) * 100).toFixed(4)}%`],
    ];

    for (let i = 0; i < infoItems.length; i++) {
      doc.fillColor(C_SLATE).fontSize(8).font('Helvetica')
         .text(infoItems[i][0], col1, y, { width: 80 });
      doc.fillColor(C_BLACK).font('Helvetica-Bold')
         .text(infoItems[i][1], col1 + 82, y, { width: W / 2 - 90 });
      doc.fillColor(C_SLATE).font('Helvetica')
         .text(infoRight[i][0], col2, y, { width: 80 });
      doc.fillColor(C_BLACK).font('Helvetica-Bold')
         .text(infoRight[i][1], col2 + 82, y, { width: W / 2 - 90 });
      y += 14;
    }

    y += 6;
    doc.rect(L, y, W, 1).fill(C_BORDER); y += 14;

    // ── Resumen ───────────────────────────────────────────────────────────────
    const totalCuotas  = pagos.reduce((s, p) => s + Number(p.monto), 0);
    const totalMora    = pagos.reduce((s, p) => s + Number(p.interesMora ?? 0), 0);
    const totalPagado  = pagos.filter(p => p.estado === 'PAGADO').reduce((s, p) => s + Number(p.monto) + Number(p.interesMora ?? 0), 0);
    const totalPend    = pagos.filter(p => p.estado !== 'PAGADO').reduce((s, p) => s + Number(p.monto) + Number(p.interesMora ?? 0), 0);
    const pagados      = pagos.filter(p => p.estado === 'PAGADO').length;
    const vencidos     = pagos.filter(p => p.estado === 'VENCIDO').length;
    const pendientes   = pagos.filter(p => p.estado === 'PENDIENTE').length;

    const boxes = [
      { label: 'Total cuotas',    val: `$${fmt(totalCuotas + totalMora)}`, color: C_NAVY },
      { label: 'Pagado',          val: `$${fmt(totalPagado)}`,             color: C_GREEN },
      { label: 'Saldo pendiente', val: `$${fmt(totalPend)}`,               color: totalPend > 0 ? C_RED : C_GREEN },
      { label: 'Mora acumulada',  val: `$${fmt(totalMora)}`,               color: totalMora > 0 ? C_AMBER : C_SLATE },
    ];

    const bw = (W - 18) / 4;
    boxes.forEach((b, i) => {
      const bx = L + i * (bw + 6);
      doc.rect(bx, y, bw, 48).fill(C_LIGHT);
      doc.rect(bx, y, 3, 48).fill(b.color);
      doc.fillColor(C_SLATE).fontSize(8).font('Helvetica')
         .text(b.label, bx + 8, y + 8, { width: bw - 12 });
      doc.fillColor(b.color).fontSize(14).font('Helvetica-Bold')
         .text(b.val, bx + 8, y + 20, { width: bw - 12 });
    });

    y += 60;

    // Estado pills
    doc.fillColor(C_SLATE).fontSize(8).font('Helvetica')
       .text(`${pagados} pagadas · ${vencidos} vencidas · ${pendientes} pendientes`, L, y);
    y += 18;

    // ── Tabla de cuotas ───────────────────────────────────────────────────────
    doc.fillColor(C_NAVY).fontSize(11).font('Helvetica-Bold')
       .text('DETALLE DE CUOTAS', L, y); y += 14;

    // Columnas: Período | Vence | Cuota | Mora | Total | Fecha pago | Método | Estado
    const cols = [
      { label: 'Período',    w: 72 },
      { label: 'Vence',      w: 58 },
      { label: 'Cuota',      w: 58, right: true },
      { label: 'Mora',       w: 52, right: true },
      { label: 'Total',      w: 60, right: true },
      { label: 'F. Pago',    w: 58 },
      { label: 'Método',     w: 62 },
      { label: 'Estado',     w: 0  },  // fills remaining
    ];
    // Calc last col width
    const fixedW = cols.slice(0, -1).reduce((s, c) => s + c.w, 0);
    cols[cols.length - 1].w = W - fixedW;

    // Header row
    doc.rect(L, y, W, 18).fill(C_NAVY);
    let cx = L + 6;
    cols.forEach(col => {
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
         .text(col.label, col.right ? cx - 4 : cx, y + 5, { width: col.w - 4, align: col.right ? 'right' : 'left' });
      cx += col.w;
    });
    y += 18;

    if (pagos.length === 0) {
      doc.rect(L, y, W, 28).fill(C_LIGHT);
      doc.fillColor(C_SLATE).fontSize(9).font('Helvetica')
         .text('No hay cuotas en el período seleccionado.', L, y + 9, { width: W, align: 'center' });
      y += 28;
    } else {
      pagos.forEach((p, i) => {
        const rowH = 20;
        const bg   = i % 2 === 0 ? '#ffffff' : C_LIGHT;
        doc.rect(L, y, W, rowH).fill(bg);

        const vals = [
          `${MESES[(p.cuota?.mes ?? 1) - 1]} ${p.cuota?.anio ?? ''}`,
          fmtFecha(p.fechaVence),
          `$${fmt(p.monto)}`,
          `$${fmt(p.interesMora)}`,
          `$${fmt(Number(p.monto) + Number(p.interesMora ?? 0))}`,
          fmtFecha(p.fechaPago),
          p.metodo || '—',
          p.estado,
        ];

        let vx = L + 6;
        cols.forEach((col, ci) => {
          const isEstado = ci === cols.length - 1;
          const color = isEstado ? estadoColor(p.estado) : C_BLACK;
          doc.fillColor(color).fontSize(8)
             .font(isEstado ? 'Helvetica-Bold' : (ci >= 2 && ci <= 4 ? 'Helvetica-Bold' : 'Helvetica'))
             .text(vals[ci], col.right ? vx - 4 : vx, y + 6, { width: col.w - 4, align: col.right ? 'right' : 'left' });
          vx += col.w;
        });

        // Bottom border
        doc.rect(L, y + rowH - 1, W, 1).fill(C_BORDER);
        y += rowH;

        // Page break check
        if (y > doc.page.height - 100) {
          doc.addPage();
          y = 50;
        }
      });
    }

    // ── Cuotas Extraordinarias ────────────────────────────────────────────────
    if (pagosExt.length > 0) {
      y += 20;
      if (y > doc.page.height - 140) { doc.addPage(); y = 50; }

      doc.fillColor(C_NAVY).fontSize(11).font('Helvetica-Bold')
         .text('CUOTAS EXTRAORDINARIAS', L, y); y += 14;

      const extCols = [
        { label: 'Descripción',  w: 0 },
        { label: 'Vence',        w: 70 },
        { label: 'Monto',        w: 68, right: true },
        { label: 'F. Pago',      w: 68 },
        { label: 'Método',       w: 64 },
        { label: 'Estado',       w: 64 },
      ];
      extCols[0].w = W - extCols.slice(1).reduce((s, c) => s + c.w, 0);

      doc.rect(L, y, W, 18).fill(C_NAVY);
      let ecx = L + 6;
      extCols.forEach(col => {
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
           .text(col.label, col.right ? ecx - 4 : ecx, y + 5, { width: col.w - 4, align: col.right ? 'right' : 'left' });
        ecx += col.w;
      });
      y += 18;

      let totalExtPagado = 0;
      let totalExtPend   = 0;

      pagosExt.forEach((p, i) => {
        const rowH = 20;
        const bg   = i % 2 === 0 ? '#ffffff' : C_LIGHT;
        doc.rect(L, y, W, rowH).fill(bg);
        if (p.estado === 'PAGADO') totalExtPagado += Number(p.monto);
        else totalExtPend += Number(p.monto);

        const vals = [
          p.cuota?.descripcion || '—',
          fmtFecha(p.fechaVence),
          `$${fmt(p.monto)}`,
          fmtFecha(p.fechaPago),
          p.metodo || '—',
          p.estado,
        ];
        let evx = L + 6;
        extCols.forEach((col, ci) => {
          const isEstado = ci === extCols.length - 1;
          const color    = isEstado ? estadoColor(p.estado) : C_BLACK;
          doc.fillColor(color).fontSize(8)
             .font(isEstado ? 'Helvetica-Bold' : (ci === 2 ? 'Helvetica-Bold' : 'Helvetica'))
             .text(vals[ci], col.right ? evx - 4 : evx, y + 6, { width: col.w - 4, align: col.right ? 'right' : 'left' });
          evx += col.w;
        });
        doc.rect(L, y + rowH - 1, W, 1).fill(C_BORDER);
        y += rowH;
        if (y > doc.page.height - 100) { doc.addPage(); y = 50; }
      });

      // Totales ext
      y += 4;
      doc.fillColor(C_SLATE).fontSize(8).font('Helvetica')
         .text(`Pagado: $${fmt(totalExtPagado)}  ·  Pendiente: $${fmt(totalExtPend)}`, L, y, { width: W, align: 'right' });
      y += 14;
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    y += 20;
    doc.rect(L, y, W, 1).fill(C_BORDER); y += 8;
    doc.fillColor(C_SLATE).fontSize(8).font('Helvetica')
       .text(
         `Generado el ${fmtFecha(new Date())} · PH Manager · ${edificio.nombre}`,
         L, y, { width: W, align: 'center' },
       );

    // Numeración de páginas
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fillColor(C_SLATE).fontSize(8).font('Helvetica')
         .text(`Página ${i + 1} de ${pages.count}`, L, doc.page.height - 40, { width: W, align: 'right' });
    }

    doc.end();
  });
}

module.exports = { generarPdfEstadoCuenta };
