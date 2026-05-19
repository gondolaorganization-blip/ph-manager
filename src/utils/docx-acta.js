const {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, Header, PageNumber, convertInchesToTwip,
} = require('docx');

// ── Números en español ────────────────────────────────────────────────────────

const _U = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
            'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
            'dieciocho', 'diecinueve'];
const _V20 = ['veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro',
              'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const _D  = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const _C  = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
             'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function _menor100(n) {
  if (n < 20)  return _U[n];
  if (n < 30)  return _V20[n - 20];
  const d = Math.floor(n / 10), u = n % 10;
  return u === 0 ? _D[d] : `${_D[d]} y ${_U[u]}`;
}

function _menor1000(n) {
  if (n === 100) return 'cien';
  if (n < 100)   return _menor100(n);
  const c = Math.floor(n / 100), r = n % 100;
  return r === 0 ? _C[c] : `${_C[c]} ${_menor100(r)}`;
}

function numPalabras(n) {
  if (n === 0) return 'cero';
  if (n < 1000) return _menor1000(n);
  if (n < 2000) return `mil ${n > 1000 ? _menor1000(n - 1000) : ''}`.trim();
  const miles = Math.floor(n / 1000), resto = n % 1000;
  return (`${_menor1000(miles)} mil${resto > 0 ? ' ' + _menor1000(resto) : ''}`).trim();
}

// Formato "veintidós (22)"
function nP(n) { return `${numPalabras(n)} (${n})`; }

const MESES_L = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_U = MESES_L.map(m => m.toUpperCase());
const DIAS_L  = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function fechaPalabras(d) {
  const f   = new Date(d);
  const dia = f.getUTCDate();
  const mes = f.getUTCMonth() + 1;
  const anio = f.getUTCFullYear();
  return `${nP(dia)} de ${MESES_L[mes]} de ${nP(anio)}`;
}

function fechaCorta(d) {
  const f = new Date(d);
  return `${f.getUTCDate()} de ${MESES_L[f.getUTCMonth() + 1]} de ${f.getUTCFullYear()}`;
}

function diaSemana(d) {
  return DIAS_L[new Date(d).getUTCDay()];
}

// "19:00" → "las siete de la noche (7:00 p.m.)"
function horaPalabras(hhmm) {
  if (!hhmm) return '';
  const [hStr, mStr = '00'] = hhmm.split(':');
  let h = parseInt(hStr), m = parseInt(mStr);
  const ampm = h < 12 ? 'a.m.' : 'p.m.';
  const periodo = h < 12 ? 'de la mañana' : (h < 19 ? 'de la tarde' : 'de la noche');
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const horaNum = m === 0 ? `${h12}:00` : `${h12}:${String(m).padStart(2, '0')}`;
  const horaTexto = m === 0 ? `las ${numPalabras(h12)}` : `las ${numPalabras(h12)} y ${numPalabras(m)} minutos`;
  return `${horaTexto} ${periodo} (${horaNum} ${ampm})`;
}

// ── Helpers de párrafo ────────────────────────────────────────────────────────

function p(runs, opts = {}) {
  const children = typeof runs === 'string'
    ? [new TextRun({ text: runs, font: 'Times New Roman', size: 24 })]
    : runs;
  return new Paragraph({ children, spacing: { before: 100, after: 100 }, ...opts });
}

function pBlank() {
  return new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 60, after: 60 } });
}

function pTitulo(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, font: 'Times New Roman', size: 24, allCaps: true })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
  });
}

function pSeccion(num, text) {
  return new Paragraph({
    children: [new TextRun({ text: `${num}. ${text.toUpperCase()}`, bold: true, font: 'Times New Roman', size: 24, underline: {} })],
    spacing: { before: 240, after: 100 },
  });
}

function pSubSeccion(num, text) {
  return new Paragraph({
    children: [new TextRun({ text: `${num} ${text}`, bold: true, font: 'Times New Roman', size: 24 })],
    spacing: { before: 180, after: 80 },
  });
}

function pItems(runs) {
  return new Paragraph({
    children: typeof runs === 'string'
      ? [new TextRun({ text: runs, font: 'Times New Roman', size: 24 })]
      : runs,
    spacing: { before: 60, after: 60 },
    indent: { left: 720 },
  });
}

function run(text, opts = {}) {
  return new TextRun({ text, font: 'Times New Roman', size: 24, ...opts });
}

const TIPO_VOT_LABEL = {
  SIMPLE:   'mayoría simple',
  P51:      'el cincuenta y uno por ciento (51%) de las unidades habilitadas para votar',
  P66:      'el sesenta y seis por ciento (66%) de las unidades habilitadas para votar',
  P66_75V:  'el sesenta y seis por ciento (66%) de los propietarios y el setenta y cinco por ciento (75%) del valor del inmueble',
  P75V:     'el setenta y cinco por ciento (75%) del valor del inmueble',
};

// ── Generador principal ───────────────────────────────────────────────────────
async function generarDocxActa(acta, edificio) {
  const fechaDoc  = new Date(acta.fecha);
  const diaNum    = fechaDoc.getUTCDate();
  const mesNum    = fechaDoc.getUTCMonth() + 1;
  const anioNum   = fechaDoc.getUTCFullYear();
  const tipo      = acta.tipo === 'ORDINARIA' ? 'Ordinaria' : 'Extraordinaria';
  const tipoUp    = tipo.toUpperCase();

  const asistencias = acta.asistencias ?? [];
  const habilitados = asistencias.filter(a => a.unidad?.propietario);
  const presentes   = habilitados.filter(a => a.estado === 'PRESENTE' || a.estado === 'REPRESENTADO');
  const ausentes    = habilitados.filter(a => a.estado === 'AUSENTE');
  const qPct        = Number(acta.quorum ?? 0).toFixed(2);

  const propuestas  = acta.propuestas ?? [];

  // Identificación del inmueble
  const idInmueble = [
    edificio.codigoUbicacion ? `Código de Ubicación ${edificio.codigoUbicacion}` : '',
    edificio.folioReal        ? `Folio Real Nº ${edificio.folioReal}`             : '',
  ].filter(Boolean).join(' y ');

  const parrafoIdentificacion = idInmueble
    ? `, inmueble identificado con ${idInmueble}, inscrito en la Sección de Propiedad Horizontal del Registro Público de Panamá`
    : '';

  // Modalidad de reunión
  let lugarTexto = '';
  if (acta.modalidad === 'PRESENCIAL') {
    lugarTexto = acta.lugar ? `, en ${acta.lugar}` : ', en la ciudad de Panamá';
  } else if (acta.modalidad === 'VIRTUAL') {
    lugarTexto = acta.lugar ? `, a través de ${acta.lugar}` : ', a través de medios virtuales';
  } else {
    lugarTexto = acta.lugar ? `, de forma mixta en ${acta.lugar} y por medios virtuales` : ', de forma mixta';
  }

  // ── Contenido ─────────────────────────────────────────────────────────────

  const children = [];

  // Título principal
  children.push(pTitulo(`ACTA DE ASAMBLEA ${tipoUp} DE PROPIETARIOS DE ${edificio.nombre.toUpperCase()}`));
  children.push(pTitulo(`CELEBRADA EL DÍA ${nP(diaNum).toUpperCase()} DE ${MESES_U[mesNum]} DE ${nP(anioNum).toUpperCase()}`));
  children.push(pBlank());

  // Párrafo de apertura
  const horaTexto = acta.horaInicio ? `siendo ${horaPalabras(acta.horaInicio)}` : 'en la hora señalada';
  children.push(p([
    run(`En la ciudad de Panamá, ${horaTexto} del día ${diaSemana(acta.fecha)} ${fechaPalabras(acta.fecha)}, se celebró la Asamblea ${tipo} de Propietarios de `),
    run(edificio.nombre, { bold: true }),
    run(`${parrafoIdentificacion}${lugarTexto}.`),
  ]));
  children.push(pBlank());

  // Párrafo de convocatoria legal
  const fechaConvStr = acta.fechaConvocatoria
    ? `el día ${fechaPalabras(acta.fechaConvocatoria)}`
    : 'en la fecha establecida reglamentariamente';
  const convocadoPorStr = acta.convocadoPor || 'la Junta Directiva';

  children.push(p([
    run('La convocatoria para esta reunión fue realizada en estricto cumplimiento de los artículos '),
    run('sesenta y uno (61) y sesenta y dos (62)', { bold: true }),
    run(' de la '),
    run('Ley doscientos ochenta y cuatro (284) del catorce (14) de febrero de dos mil veintidós (2022)', { bold: true }),
    run(`, que establece el Régimen de Propiedad Horizontal. Dicha convocatoria fue emitida ${fechaConvStr}, por ${convocadoPorStr}. La notificación se realizó mediante documento escrito entregado a los propietarios del inmueble y colocado en los tableros y lugares visibles de las áreas comunes del edificio, con la debida anticipación que exige la ley.`),
  ]));
  children.push(pBlank());

  // Texto de la convocatoria
  if (acta.convocatoria) {
    children.push(p([run('CONVOCATORIA:', { bold: true, underline: {} })], { alignment: AlignmentType.CENTER }));
    children.push(pBlank());
    // Separar por saltos de línea
    acta.convocatoria.split('\n').forEach(linea => {
      children.push(p(linea || ' ', { spacing: { before: 60, after: 60 } }));
    });
    children.push(pBlank());
  }

  // ── 1. VERIFICACIÓN DE QUÓRUM ─────────────────────────────────────────────
  children.push(pSeccion('1', 'Verificación de Quórum'));

  children.push(p([
    run(`Siendo ${acta.horaInicio ? horaPalabras(acta.horaInicio) : 'la hora de inicio'}, se llevó a cabo el registro de propietarios presentes y representados, con el debido control detallado de los asistentes, con el fin de verificar la cantidad de propietarios participantes y los habilitados para votar. `),
    run(`Se constata la presencia de `),
    run(`${nP(presentes.length)} de ${nP(habilitados.length)}`, { bold: true }),
    run(` propietarios ${habilitados.length > 0 ? 'habilitados para votar' : 'registrados'}, lo que representa el `),
    run(`${qPct}%`, { bold: true }),
    run(` de participación. `),
    run(
      Number(acta.quorum) >= 50
        ? 'Se confirma que se ha alcanzado el quórum requerido conforme al artículo sesenta y siete (67) de la Ley 284 de 2022 para la celebración válida de la asamblea.'
        : 'No se alcanzó el quórum requerido en primera convocatoria. De conformidad con el artículo sesenta y siete (67) de la Ley 284 de 2022, transcurridos treinta (30) minutos se sesionó en segunda convocatoria con los propietarios presentes.',
      { bold: true }
    ),
  ]));

  // ── 2. LISTA DE ASISTENTES ────────────────────────────────────────────────
  children.push(pSeccion('2', 'Lista de Asistentes'));

  children.push(p([run('Propietarios Presentes o Representados:', { bold: true, underline: {} })]));
  children.push(pBlank());

  if (presentes.length === 0) {
    children.push(pItems('No se registraron propietarios presentes.'));
  } else {
    presentes.forEach((a, i) => {
      const nombre  = a.unidad?.propietario?.nombre?.toUpperCase() ?? '(SIN PROPIETARIO)';
      const unidad  = a.unidad?.numero ?? '—';
      const tipo    = a.unidad?.tipo ?? '';
      const unidadLabel = tipo ? `${tipo.charAt(0) + tipo.slice(1).toLowerCase()} ${unidad}` : `Unidad ${unidad}`;
      let texto = `${i + 1}. ${nombre} (${unidadLabel})`;
      if (a.estado === 'REPRESENTADO' && a.mandatario) {
        texto += ` — Representado/a por ${a.mandatario}`;
        if (a.mandatarioCedula) texto += `, cédula ${a.mandatarioCedula}`;
      }
      children.push(pItems(texto));
    });
  }

  children.push(pBlank());
  children.push(p([run('Propietarios Ausentes:', { bold: true, underline: {} })]));
  children.push(pBlank());

  if (ausentes.length === 0) {
    children.push(pItems('No se registraron ausentes (todos los propietarios habilitados se encuentran presentes o representados).'));
  } else {
    ausentes.forEach((a, i) => {
      const nombre = a.unidad?.propietario?.nombre?.toUpperCase() ?? '(SIN PROPIETARIO)';
      const unidad = a.unidad?.numero ?? '—';
      const tipo   = a.unidad?.tipo ?? '';
      const unidadLabel = tipo ? `${tipo.charAt(0) + tipo.slice(1).toLowerCase()} ${unidad}` : `Unidad ${unidad}`;
      children.push(pItems(`${i + 1}. ${nombre} (${unidadLabel})`));
    });
  }

  // ── 3. ORDEN DEL DÍA ──────────────────────────────────────────────────────
  children.push(pSeccion('3', 'Orden del Día'));

  if (propuestas.length === 0) {
    children.push(p('No se registraron puntos en el orden del día.'));
  } else {
    propuestas.forEach(pp => {
      children.push(pItems(`${pp.orden}. ${pp.descripcion}`));
    });
  }

  // ── 4. DESARROLLO DE LA REUNIÓN ───────────────────────────────────────────
  children.push(pSeccion('4', 'Desarrollo de la Reunión'));

  if (propuestas.length === 0) {
    children.push(p('No se registraron desarrollos de puntos del orden del día.'));
  } else {
    propuestas.forEach(pp => {
      children.push(pSubSeccion(`4.${pp.orden}.`, pp.descripcion));

      const totalVotos = pp.votosAFavor + pp.votosEnContra + pp.abstenciones;
      const umbral = TIPO_VOT_LABEL[pp.tipoVotacion] || pp.tipoVotacion;

      let textoVotacion = '';
      if (totalVotos > 0) {
        textoVotacion = `Se procedió a la votación. Para su aprobación se requería ${umbral}. Al término del conteo de votos se obtuvo el siguiente resultado: ${nP(pp.votosAFavor)} voto(s) a favor, ${nP(pp.votosEnContra)} voto(s) en contra y ${nP(pp.abstenciones)} abstención/abstenciones, de un total de ${presentes.length} unidades habilitadas. `;
        textoVotacion += pp.resultado === 'APROBADA'
          ? `La propuesta queda APROBADA.`
          : pp.resultado === 'NEGADA'
          ? `La propuesta queda NEGADA.`
          : `La votación está pendiente de resultado definitivo.`;
      } else {
        textoVotacion = 'Punto de carácter informativo — no requirió votación.';
      }

      children.push(p(textoVotacion));

      if (pp.notas) {
        children.push(p([run(pp.notas, { italics: true, color: '4b5563' })]));
      }
    });
  }

  // Acuerdos adicionales
  if (acta.acuerdos) {
    children.push(pSubSeccion('4.N.', 'Comentarios y Otros Asuntos'));
    acta.acuerdos.split('\n').forEach(linea => {
      if (linea.trim()) children.push(p(linea));
    });
  }

  // ── 5. CIERRE DE LA ASAMBLEA ──────────────────────────────────────────────
  children.push(pSeccion('5', 'Cierre de la Asamblea'));

  const horaFin = acta.horaFin ? horaPalabras(acta.horaFin) : '_______________';
  children.push(p([
    run(`Finalizados todos los puntos del orden del día y habiendo espacio para comentarios generales, la asamblea fue declarada concluida siendo ${horaFin} del día ${fechaPalabras(acta.fecha)}.`),
  ]));
  children.push(pBlank());

  // Cláusula de autorización para RP
  if (acta.autorizadoPara) {
    children.push(p([
      run('Se autoriza a ', {}),
      run(acta.autorizadoPara),
      run(` para realizar los trámites necesarios de protocolización e inscripción en el Registro Público de Panamá de la escritura correspondiente a la presente Asamblea ${tipo} de Propietarios de `),
      run(edificio.nombre, { bold: true }),
      run(`, celebrada el día ${fechaCorta(acta.fecha)}.`),
    ]));
    children.push(pBlank());
  }

  children.push(p([
    run(`No habiendo otros asuntos que tratar, se da por terminada la reunión de Asamblea ${tipo} de Propietarios de `),
    run(edificio.nombre, { bold: true }),
    run('.'),
  ]));
  children.push(pBlank());
  children.push(p([run('Firmas:')]));
  children.push(pBlank());

  // ── Bloque de firmas ──────────────────────────────────────────────────────
  const firmaBloque = (nombre, cedula, cargo) => [
    pBlank(),
    p('_'.repeat(45), { spacing: { before: 400, after: 60 } }),
    p([run(nombre || cargo, { bold: true })]),
    ...(cedula ? [p([run(`Cédula de identidad personal ${cedula}`)])] : []),
    p([run(cargo)]),
    pBlank(),
  ];

  children.push(...firmaBloque(acta.presidente, acta.presidenteCedula, 'Presidente de la Asamblea'));
  children.push(...firmaBloque(acta.secretario, acta.secretarioCedula, 'Secretario/a de la Asamblea'));

  // ── Documento ─────────────────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Times New Roman', size: 24 } } },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(1.2),
            bottom: convertInchesToTwip(1.2),
            left:   convertInchesToTwip(1.5),
            right:  convertInchesToTwip(1.2),
          },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `${edificio.nombre} — Acta de Asamblea ${tipo} N°${acta.numero ?? 'S/N'}/${anioNum}`, font: 'Times New Roman', size: 20, color: '4b5563' }),
                new TextRun({ children: ['  Página ', PageNumber.CURRENT], font: 'Times New Roman', size: 20, color: '4b5563' }),
              ],
              alignment: AlignmentType.RIGHT,
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '1e3a5f', space: 4 } },
            }),
          ],
        }),
      },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}

module.exports = { generarDocxActa };
