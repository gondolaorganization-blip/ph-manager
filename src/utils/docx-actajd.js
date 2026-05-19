const {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  AlignmentType, WidthType, BorderStyle, convertInchesToTwip, UnderlineType,
} = require('docx');

// ── Números en palabras (español) ─────────────────────────────────────────────
const UNIDADES = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve',
  'diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve'];
const DECENAS  = ['','','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
const CENTENAS = ['','ciento','doscientos','trescientos','cuatrocientos','quinientos',
  'seiscientos','setecientos','ochocientos','novecientos'];

function numPalabras(n) {
  if (n === 0)   return 'cero';
  if (n === 100) return 'cien';
  if (n < 20)    return UNIDADES[n];
  if (n < 30)    return n === 20 ? 'veinte' : 'veinti' + UNIDADES[n - 20];
  if (n < 100) {
    const [d, u] = [Math.floor(n / 10), n % 10];
    return u ? DECENAS[d] + ' y ' + UNIDADES[u] : DECENAS[d];
  }
  if (n < 1000) {
    const [c, r] = [Math.floor(n / 100), n % 100];
    return r ? CENTENAS[c] + ' ' + numPalabras(r) : CENTENAS[c];
  }
  const [miles, r] = [Math.floor(n / 1000), n % 1000];
  const pMiles = miles === 1 ? 'mil' : numPalabras(miles) + ' mil';
  return r ? pMiles + ' ' + numPalabras(r) : pMiles;
}

function nP(n) { return `${numPalabras(n)} (${n})`; }

function horaPalabras(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const h12    = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const periodo = h < 12 ? 'de la mañana' : h === 12 ? 'del mediodía' : h < 20 ? 'de la tarde' : 'de la noche';
  const ampm    = h < 12 ? 'a.m.' : 'p.m.';
  const minStr  = m === 0 ? '' : ` con ${numPalabras(m)} (${m}) minutos`;
  const las     = h12 === 1 ? 'la una' : `las ${numPalabras(h12)}`;
  return `${las} (${h}:${String(m).padStart(2, '0')}) ${periodo}${minStr} (${h12}:${String(m).padStart(2, '0')} ${ampm})`;
}

function fechaPalabras(fecha) {
  const f    = new Date(fecha);
  const dias  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const meses = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const d = f.getUTCDate(), mes = f.getUTCMonth(), anio = f.getUTCFullYear();
  return `${dias[f.getUTCDay()]} ${numPalabras(d)} (${d}) de ${meses[mes]} del año ${numPalabras(anio)} (${anio})`;
}

// ── Helpers de párrafos ────────────────────────────────────────────────────────
const FONT = 'Times New Roman';
const SZ   = 24;  // 12 pt en half-points

function run(text, opts = {}) {
  return new TextRun({ text: String(text ?? ''), font: FONT, size: SZ, ...opts });
}

function p(runsOrText, opts = {}) {
  const children = Array.isArray(runsOrText) ? runsOrText : [run(runsOrText)];
  return new Paragraph({
    children,
    spacing: { after: 200, line: 360, lineRule: 'auto' },
    ...opts,
  });
}

function pTitulo(text) {
  return new Paragraph({
    children: [run(text, { bold: true, allCaps: true })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 120 },
  });
}

function pSeccion(num, text) {
  return new Paragraph({
    children: [run(`${num}. ${text.toUpperCase()}`, { bold: true, underline: { type: UnderlineType.SINGLE } })],
    spacing: { before: 280, after: 160 },
  });
}

function pSubSeccion(num, text) {
  return new Paragraph({
    children: [run(`${num}. ${text}`, { bold: true })],
    spacing: { before: 200, after: 100 },
  });
}

function pBlanco() {
  return new Paragraph({ children: [run('')], spacing: { before: 80, after: 80 } });
}

function pBlancoLg() {
  return new Paragraph({ children: [run('')], spacing: { before: 400, after: 0 } });
}

// ── Tabla de firmas ────────────────────────────────────────────────────────────
const NOBORDER = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
  insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE },
};
const NOBORDER_CELL = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
};

function cargoLabel(cargo) {
  const map = {
    PRESIDENTE:     'Presidente de la Junta Directiva',
    VICEPRESIDENTE: 'Vicepresidente de la Junta Directiva',
    SECRETARIO:     'Secretario de la Junta Directiva',
    TESORERO:       'Tesorero de la Junta Directiva',
    VOCAL:          'Vocal de la Junta Directiva',
    DIRECTOR:       'Director',
  };
  return map[cargo] || 'Miembro de la Junta Directiva';
}

function firmaCell(dir) {
  if (!dir) {
    return new TableCell({
      children: [pBlanco()],
      borders: NOBORDER_CELL,
      width: { size: 50, type: WidthType.PERCENTAGE },
    });
  }
  return new TableCell({
    children: [
      new Paragraph({ children: [run('')], spacing: { before: 400, after: 60 } }),
      new Paragraph({ children: [run('_'.repeat(35))], alignment: AlignmentType.CENTER, spacing: { after: 60 } }),
      new Paragraph({ children: [run(dir.nombre || '', { bold: true })], alignment: AlignmentType.CENTER, spacing: { after: 40 } }),
      ...(dir.cedula ? [new Paragraph({
        children: [run(`C.I.P. N°${dir.cedula}`)],
        alignment: AlignmentType.CENTER, spacing: { after: 40 },
      })] : []),
      new Paragraph({ children: [run(cargoLabel(dir.cargo))], alignment: AlignmentType.CENTER, spacing: { after: 40 } }),
    ],
    borders: NOBORDER_CELL,
    width: { size: 50, type: WidthType.PERCENTAGE },
  });
}

function firmaFila(left, right) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NOBORDER,
    rows: [new TableRow({ children: [firmaCell(left), firmaCell(right)] })],
  });
}

// ── Generador principal ────────────────────────────────────────────────────────
async function generarDocxActaJD(acta, edificio) {
  const directores   = acta.directores ?? [];
  const presentes    = directores.filter(d => d.estado === 'PRESENTE');
  const justificados = directores.filter(d => d.estado === 'JUSTIFICADO');
  const ausentes     = directores.filter(d => d.estado === 'AUSENTE');
  const puntos       = acta.puntos ?? [];

  const quorum     = Number(acta.quorum ?? 0);
  const hayQuorum  = quorum >= 50;
  const nPresentes = presentes.length;
  const nTotal     = directores.length;

  const nombrePH  = edificio.nombre || '';
  const codUbic   = edificio.codigoUbicacion || null;
  const folioReal = edificio.folioReal || null;

  let identInmueble = nombrePH;
  if (codUbic || folioReal) {
    const partes = [];
    if (folioReal) partes.push(`Folio Real N°${folioReal}`);
    if (codUbic)   partes.push(`Código de Ubicación N°${codUbic}`);
    identInmueble = `${nombrePH} (${partes.join(', ')})`;
  }

  const children = [];

  // ── Título ─────────────────────────────────────────────────────────────────
  children.push(pTitulo(`ACTA N°${acta.numero ?? 'S/N'}/${acta.anio ?? ''}`));
  children.push(pTitulo('SESIÓN DE JUNTA DIRECTIVA'));
  children.push(pTitulo(nombrePH.toUpperCase()));
  children.push(pBlancoLg());

  // ── Párrafo de apertura ────────────────────────────────────────────────────
  const fechaTxt = fechaPalabras(acta.fecha);
  const horaTxt  = acta.horaInicio ? horaPalabras(acta.horaInicio) : 'la hora convenida';
  const lugarTxt = acta.lugar || '_______________';

  children.push(p([
    run('En la Ciudad de Panamá, siendo '),
    run(horaTxt, { bold: true }),
    run(' del día '),
    run(fechaTxt, { bold: true }),
    run(', reunidos en '),
    run(lugarTxt, { bold: true }),
    run(', los miembros de la Junta Directiva del Régimen de Propiedad Horizontal denominado '),
    run(identInmueble, { bold: true }),
    run(', se da inicio a la presente sesión de Junta Directiva para tratar el siguiente orden del día:'),
  ]));

  // Lista de orden del día en apertura
  if (puntos.length > 0) {
    puntos.forEach((pt, i) => {
      children.push(p(
        [run(`${i + 1}. ${pt.descripcion}`)],
        { indent: { left: 720 }, spacing: { after: 80, line: 360, lineRule: 'auto' } },
      ));
    });
    children.push(pBlanco());
  }

  // ── 1. Verificación de Quórum ──────────────────────────────────────────────
  children.push(pSeccion('1', 'Verificación de Quórum'));

  const quorumConcl = hayQuorum
    ? 'constituyendo quórum reglamentario suficiente para la válida celebración de la presente sesión.'
    : 'no alcanzando el quórum mínimo del cincuenta por ciento (50%) de los miembros de la Junta Directiva. Se deja constancia de los puntos tratados para los efectos correspondientes.';

  children.push(p([
    run(`La Junta Directiva se encuentra conformada por un total de ${nP(nTotal)} directores. Se encuentran presentes en este acto `),
    run(nP(nPresentes), { bold: true }),
    run(` director${nPresentes !== 1 ? 'es' : ''}, representando el `),
    run(`${quorum.toFixed(2)}%`, { bold: true }),
    run(` de sus miembros, ${quorumConcl}`),
  ]));

  // ── 2. Asistencia de Directores ────────────────────────────────────────────
  children.push(pSeccion('2', 'Asistencia de Directores'));

  if (presentes.length > 0) {
    children.push(p([run('Estuvieron presentes en la sesión los siguientes miembros de la Junta Directiva:')]));
    presentes.forEach((d, i) => {
      children.push(p([
        run(`${i + 1}. `, { bold: true }),
        run(d.nombre, { bold: true }),
        run(d.cedula ? `, portador(a) de la cédula de identidad personal N°${d.cedula}` : ''),
        run(`, en calidad de ${cargoLabel(d.cargo)}.`),
      ], { indent: { left: 720 }, spacing: { after: 80, line: 360, lineRule: 'auto' } }));
    });
    children.push(pBlanco());
  }

  if (justificados.length > 0) {
    children.push(p([run('Justificaron su ausencia los siguientes directores:')]));
    justificados.forEach((d, i) => {
      children.push(p([
        run(`${i + 1}. `),
        run(d.nombre, { bold: true }),
        run(d.cedula ? `, cédula N°${d.cedula}` : ''),
        run(`, ${cargoLabel(d.cargo)}.`),
      ], { indent: { left: 720 }, spacing: { after: 80, line: 360, lineRule: 'auto' } }));
    });
    children.push(pBlanco());
  }

  if (ausentes.length > 0) {
    children.push(p([run('Estuvieron ausentes sin justificación:')]));
    ausentes.forEach((d, i) => {
      children.push(p([
        run(`${i + 1}. `),
        run(d.nombre, { bold: true }),
        run(d.cedula ? `, cédula N°${d.cedula}` : ''),
        run(`, ${cargoLabel(d.cargo)}.`),
      ], { indent: { left: 720 }, spacing: { after: 80, line: 360, lineRule: 'auto' } }));
    });
    children.push(pBlanco());
  }

  if (directores.length === 0) {
    children.push(p([run('No se registraron directores en esta sesión.')]));
  }

  // ── 3. Orden del Día ───────────────────────────────────────────────────────
  children.push(pSeccion('3', 'Orden del Día'));

  if (puntos.length > 0) {
    puntos.forEach((pt, i) => {
      children.push(p(
        [run(`${i + 1}. ${pt.descripcion}`)],
        { indent: { left: 720 }, spacing: { after: 80, line: 360, lineRule: 'auto' } },
      ));
    });
    children.push(pBlanco());
  } else {
    children.push(p([run('No se registraron puntos en el orden del día.')]));
  }

  // ── 4. Desarrollo ──────────────────────────────────────────────────────────
  if (puntos.length > 0) {
    children.push(pSeccion('4', 'Desarrollo de los Puntos del Orden del Día'));

    puntos.forEach((pt, i) => {
      children.push(pSubSeccion(`4.${i + 1}`, pt.descripcion));

      if (pt.notas) {
        children.push(p([run(pt.notas)]));
      }

      let resultNarrativa;
      switch (pt.resultado) {
        case 'APROBADO':
          resultNarrativa = 'Sometido a consideración de los directores presentes, el punto fue APROBADO.';
          break;
        case 'NEGADO':
          resultNarrativa = 'Sometido a votación, el punto fue RECHAZADO por los directores presentes.';
          break;
        case 'INFORMATIVO':
          resultNarrativa = 'El punto fue presentado con carácter meramente informativo, sin requerir votación.';
          break;
        case 'PENDIENTE':
          resultNarrativa = 'El punto quedó PENDIENTE de resolución para una próxima sesión de Junta Directiva.';
          break;
        default:
          resultNarrativa = 'El punto fue tratado por los miembros presentes.';
      }

      children.push(p([run(resultNarrativa, { bold: pt.resultado === 'APROBADO' || pt.resultado === 'NEGADO' })]));
    });
  }

  // ── Acuerdos adicionales ───────────────────────────────────────────────────
  if (acta.acuerdos) {
    const numSec = puntos.length > 0 ? '5' : '4';
    children.push(pSeccion(numSec, 'Acuerdos Adicionales'));
    children.push(p([run(acta.acuerdos)]));
  }

  // ── Cierre ─────────────────────────────────────────────────────────────────
  const baseNum = puntos.length > 0 ? 4 : 3;
  const secCierre = String(baseNum + (acta.acuerdos ? 2 : 1));
  children.push(pSeccion(secCierre, 'Cierre de la Sesión'));

  const horaFinTxt = acta.horaFin ? `siendo ${horaPalabras(acta.horaFin)}` : 'a la hora convenida';
  children.push(p([
    run(`No habiendo más asuntos que tratar en el orden del día, el Presidente de la Junta Directiva declaró concluida la presente sesión, ${horaFinTxt} del mismo día. La presente acta es aprobada por los directores presentes, quienes la suscriben en señal de conformidad.`),
  ]));

  // ── Firmas ─────────────────────────────────────────────────────────────────
  children.push(pBlancoLg());

  const ordenFirmas = [...presentes].sort((a, b) => {
    const ord = { PRESIDENTE: 0, VICEPRESIDENTE: 1, SECRETARIO: 2, TESORERO: 3, VOCAL: 4, DIRECTOR: 5 };
    return (ord[a.cargo] ?? 5) - (ord[b.cargo] ?? 5);
  });

  if (ordenFirmas.length === 0) {
    const pres = acta.presidente ? { nombre: acta.presidente, cargo: 'PRESIDENTE', cedula: null } : null;
    const sec  = acta.secretario ? { nombre: acta.secretario, cargo: 'SECRETARIO', cedula: null } : null;
    if (pres || sec) {
      children.push(firmaFila(pres, sec));
    }
  } else {
    for (let i = 0; i < ordenFirmas.length; i += 2) {
      children.push(firmaFila(ordenFirmas[i], ordenFirmas[i + 1] || null));
      if (i + 2 < ordenFirmas.length) children.push(pBlancoLg());
    }
  }

  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: SZ } } },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left:   convertInchesToTwip(1.5),
            right:  convertInchesToTwip(1.5),
          },
        },
      },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}

module.exports = { generarDocxActaJD };
