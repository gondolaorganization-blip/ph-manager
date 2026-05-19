const prisma   = require('../config/prisma');
const bcrypt   = require('bcryptjs');
const ExcelJS  = require('exceljs');

// GET /api/edificios/:edificioId/unidades
async function listar(req, res) {
  try {
    const unidades = await prisma.unidad.findMany({
      where:   { edificioId: req.edificioId, activa: true },
      include: {
        propietario: true,
        pagos: {
          where: { estado: { in: ['PENDIENTE', 'VENCIDO'] } },
          select: { monto: true, interesMora: true },
        },
      },
      orderBy: [{ piso: 'asc' }, { numero: 'asc' }],
    });

    const data = unidades.map(u => {
      const saldoPendiente = u.pagos.reduce(
        (sum, p) => sum + Number(p.monto) + Number(p.interesMora), 0
      );
      const { pagos: _, ...rest } = u;
      return { ...rest, saldoPendiente: +saldoPendiente.toFixed(2), morosa: saldoPendiente > 0 };
    });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar unidades' });
  }
}

// GET /api/edificios/:edificioId/unidades/resumen
async function resumen(req, res) {
  try {
    const unidades = await prisma.unidad.findMany({
      where:   { edificioId: req.edificioId, activa: true },
      include: { propietario: { select: { id: true } } },
    });

    const total          = unidades.length;
    const conPropietario = unidades.filter(u => u.propietario).length;
    const coefTotal      = unidades.reduce((s, u) => s + Number(u.coeficiente), 0);
    const m2Total        = unidades.reduce((s, u) => s + Number(u.metrosCuadrados), 0);

    const porTipo = unidades.reduce((acc, u) => {
      if (!acc[u.tipo]) acc[u.tipo] = { cantidad: 0, m2: 0 };
      acc[u.tipo].cantidad++;
      acc[u.tipo].m2 += Number(u.metrosCuadrados);
      return acc;
    }, {});

    res.json({
      total,
      conPropietario,
      sinPropietario:    total - conPropietario,
      coeficienteTotal:  +coefTotal.toFixed(6),
      coeficientePendiente: +(1 - coefTotal).toFixed(6),
      m2Total:           +m2Total.toFixed(2),
      porTipo,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
}

// GET /api/edificios/:edificioId/unidades/:unidadId
async function obtener(req, res) {
  const id = parseInt(req.params.unidadId);
  try {
    const unidad = await prisma.unidad.findFirst({
      where:   { id, edificioId: req.edificioId },
      include: {
        propietario: true,
        pagos: {
          orderBy: { fechaVence: 'desc' },
          take: 12,
          include: { cuota: { select: { mes: true, anio: true } } },
        },
      },
    });
    if (!unidad) return res.status(404).json({ error: 'Unidad no encontrada' });

    const saldoPendiente = unidad.pagos
      .filter(p => p.estado !== 'PAGADO')
      .reduce((s, p) => s + Number(p.monto) + Number(p.interesMora), 0);

    res.json({ ...unidad, saldoPendiente: +saldoPendiente.toFixed(2) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener unidad' });
  }
}

// POST /api/edificios/:edificioId/unidades
async function crear(req, res) {
  const { numero, numFinca, piso, tipo, metrosCuadrados, coeficiente } = req.body;
  if (!numero) return res.status(400).json({ error: 'numero es requerido' });

  try {
    // Validar unicidad de número en el edificio
    const existe = await prisma.unidad.findUnique({
      where: { edificioId_numero: { edificioId: req.edificioId, numero } },
    });
    if (existe) return res.status(409).json({ error: `Ya existe la unidad ${numero} en este edificio` });

    // Validar que coeficiente no supere 1.0 en total
    if (coeficiente) {
      const { _sum } = await prisma.unidad.aggregate({
        where:  { edificioId: req.edificioId, activa: true },
        _sum:   { coeficiente: true },
      });
      const sumaActual = Number(_sum.coeficiente || 0);
      if (sumaActual + parseFloat(coeficiente) > 1.000001) {
        return res.status(400).json({
          error: `El coeficiente supera el 100%. Disponible: ${(1 - sumaActual).toFixed(6)}`,
        });
      }
    }

    const unidad = await prisma.unidad.create({
      data: {
        edificioId:      req.edificioId,
        numero,
        numFinca:        numFinca        || null,
        piso:            piso            !== undefined ? parseInt(piso)           : null,
        tipo:            tipo            || 'APARTAMENTO',
        metrosCuadrados: metrosCuadrados ? parseFloat(metrosCuadrados)            : 0,
        coeficiente:     coeficiente     ? parseFloat(coeficiente)                : 0,
      },
    });
    res.status(201).json(unidad);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear unidad' });
  }
}

// PUT /api/edificios/:edificioId/unidades/:unidadId
async function actualizar(req, res) {
  const id = parseInt(req.params.unidadId);
  const { numero, numFinca, piso, tipo, metrosCuadrados, coeficiente } = req.body;

  try {
    const existe = await prisma.unidad.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!existe) return res.status(404).json({ error: 'Unidad no encontrada' });

    // Validar coeficiente si cambia
    if (coeficiente !== undefined) {
      const { _sum } = await prisma.unidad.aggregate({
        where: { edificioId: req.edificioId, activa: true, id: { not: id } },
        _sum:  { coeficiente: true },
      });
      const sumaOtros = Number(_sum.coeficiente || 0);
      if (sumaOtros + parseFloat(coeficiente) > 1.000001) {
        return res.status(400).json({
          error: `El coeficiente supera el 100%. Disponible para esta unidad: ${(1 - sumaOtros).toFixed(6)}`,
        });
      }
    }

    const data = {};
    if (numero          !== undefined) data.numero          = numero;
    if (numFinca        !== undefined) data.numFinca        = numFinca || null;
    if (piso            !== undefined) data.piso            = piso !== null ? parseInt(piso) : null;
    if (tipo            !== undefined) data.tipo            = tipo;
    if (metrosCuadrados !== undefined) data.metrosCuadrados = parseFloat(metrosCuadrados);
    if (coeficiente     !== undefined) data.coeficiente     = parseFloat(coeficiente);

    const unidad = await prisma.unidad.update({ where: { id }, data, include: { propietario: true } });
    res.json(unidad);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar unidad' });
  }
}

// DELETE /api/edificios/:edificioId/unidades/:unidadId
async function eliminar(req, res) {
  const id = parseInt(req.params.unidadId);
  try {
    const unidad = await prisma.unidad.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!unidad) return res.status(404).json({ error: 'Unidad no encontrada' });

    // Verificar que no tenga pagos registrados
    const tienePagos = await prisma.pagoCuota.count({ where: { unidadId: id } });
    if (tienePagos > 0) {
      return res.status(409).json({ error: 'No se puede eliminar una unidad con pagos registrados' });
    }

    // Soft delete
    await prisma.unidad.update({ where: { id }, data: { activa: false } });
    res.json({ message: 'Unidad desactivada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar unidad' });
  }
}

// ── Propietario ───────────────────────────────────────────────────────────────

// POST /api/edificios/:edificioId/unidades/:unidadId/propietario
async function setPropietario(req, res) {
  const unidadId = parseInt(req.params.unidadId);
  const { nombre, cedula, email, telefono } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });

  try {
    const unidad = await prisma.unidad.findFirst({ where: { id: unidadId, edificioId: req.edificioId } });
    if (!unidad) return res.status(404).json({ error: 'Unidad no encontrada' });

    const propietario = await prisma.propietario.upsert({
      where:  { unidadId },
      create: { unidadId, nombre, cedula: cedula || null, email: email || null, telefono: telefono || null },
      update: { nombre, cedula: cedula || null, email: email || null, telefono: telefono || null },
    });
    res.status(201).json(propietario);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al asignar propietario' });
  }
}

// DELETE /api/edificios/:edificioId/unidades/:unidadId/propietario
async function eliminarPropietario(req, res) {
  const unidadId = parseInt(req.params.unidadId);
  try {
    const unidad = await prisma.unidad.findFirst({ where: { id: unidadId, edificioId: req.edificioId } });
    if (!unidad) return res.status(404).json({ error: 'Unidad no encontrada' });

    await prisma.propietario.delete({ where: { unidadId } });
    res.json({ message: 'Propietario desvinculado' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Esta unidad no tiene propietario' });
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar propietario' });
  }
}

// PUT /api/edificios/:edificioId/unidades/:unidadId/propietario/portal
async function configurarPortal(req, res) {
  const unidadId = parseInt(req.params.unidadId);
  const { password, activo } = req.body;

  try {
    const propietario = await prisma.propietario.findUnique({ where: { unidadId } });
    if (!propietario) return res.status(404).json({ error: 'Esta unidad no tiene propietario' });

    const data = {};
    if (password !== undefined) {
      if (password === null || password === '') {
        data.portalPassword = null;
        data.portalActivo   = false;
      } else {
        if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        data.portalPassword = await bcrypt.hash(password, 10);
        data.portalActivo   = true;
      }
    }
    if (activo !== undefined) data.portalActivo = Boolean(activo);

    const actualizado = await prisma.propietario.update({ where: { unidadId }, data });
    res.json({ ...actualizado, portalPassword: undefined, portalConfigured: !!actualizado.portalPassword });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al configurar portal' });
  }
}

// GET /api/edificios/:edificioId/unidades/plantilla.xlsx
async function descargarPlantilla(_req, res) {
  const wb   = new ExcelJS.Workbook();
  const ws   = wb.addWorksheet('Unidades');
  ws.columns = [
    { header: 'Numero',              key: 'numero',      width: 12 },
    { header: 'Piso',                key: 'piso',        width: 8  },
    { header: 'Tipo',                key: 'tipo',        width: 16 },
    { header: 'MetrosCuadrados',     key: 'm2',          width: 16 },
    { header: 'Coeficiente',         key: 'coef',        width: 14 },
    { header: 'PropietarioNombre',   key: 'pNombre',     width: 22 },
    { header: 'PropietarioEmail',    key: 'pEmail',      width: 26 },
    { header: 'PropietarioTelefono', key: 'pTel',        width: 18 },
    { header: 'PropietarioCedula',   key: 'pCedula',     width: 16 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.addRow({ numero: 'A-101', piso: 1, tipo: 'APARTAMENTO', m2: 85.5, coef: 0.02, pNombre: 'Juan Pérez', pEmail: 'juan@email.com', pTel: '6000-0000', pCedula: '8-000-0000' });
  ws.addRow({ numero: 'PQ-01', piso: 0, tipo: 'ESTACIONAMIENTO', m2: 12, coef: 0.005, pNombre: '', pEmail: '', pTel: '', pCedula: '' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="Plantilla_Unidades.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}

// POST /api/edificios/:edificioId/unidades/importar
const TIPOS_VALIDOS = ['APARTAMENTO', 'LOCAL', 'ESTACIONAMIENTO', 'BODEGA', 'OFICINA', 'PARQUEO', 'OTRO'];

async function importarMasivo(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo Excel' });

  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
    const ws = wb.worksheets[0];
    if (!ws) return res.status(400).json({ error: 'El archivo no tiene hojas' });

    const creadas  = [];
    const omitidas = [];
    const errores  = [];

    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // skip header
      const v = row.values; // 1-indexed
      const numero = v[1]?.toString()?.trim();
      if (!numero) { omitidas.push({ fila: rowNum, razon: 'Número vacío' }); return; }

      const tipoRaw = v[3]?.toString()?.trim()?.toUpperCase() || 'APARTAMENTO';
      creadas.push({
        rowNum,
        numero,
        piso:            v[2] != null ? parseInt(v[2]) : null,
        tipo:            TIPOS_VALIDOS.includes(tipoRaw) ? tipoRaw : 'APARTAMENTO',
        metrosCuadrados: v[4] != null ? parseFloat(v[4]) : 0,
        coeficiente:     v[5] != null ? parseFloat(v[5]) : 0,
        propNombre:      v[6]?.toString()?.trim() || null,
        propEmail:       v[7]?.toString()?.trim()?.toLowerCase() || null,
        propTelefono:    v[8]?.toString()?.trim() || null,
        propCedula:      v[9]?.toString()?.trim() || null,
      });
    });

    const resultado = { creadas: 0, omitidas: omitidas.length, errores: 0, detalles: [] };

    for (const row of creadas) {
      const { rowNum, numero, piso, tipo, metrosCuadrados, coeficiente, propNombre, propEmail, propTelefono, propCedula } = row;
      try {
        const existe = await prisma.unidad.findUnique({
          where: { edificioId_numero: { edificioId: req.edificioId, numero } },
        });
        if (existe) {
          resultado.omitidas++;
          resultado.detalles.push({ fila: rowNum, numero, resultado: 'omitida', razon: 'Ya existe' });
          continue;
        }

        const unidad = await prisma.unidad.create({
          data: {
            edificioId: req.edificioId,
            numero,
            piso:            !isNaN(piso) && piso !== null ? piso : null,
            tipo,
            metrosCuadrados: !isNaN(metrosCuadrados) ? metrosCuadrados : 0,
            coeficiente:     !isNaN(coeficiente) ? coeficiente : 0,
          },
        });

        if (propNombre) {
          await prisma.propietario.upsert({
            where:  { unidadId: unidad.id },
            create: { unidadId: unidad.id, nombre: propNombre, email: propEmail || null, telefono: propTelefono || null, cedula: propCedula || null },
            update: { nombre: propNombre, email: propEmail || null, telefono: propTelefono || null, cedula: propCedula || null },
          });
        }

        resultado.creadas++;
        resultado.detalles.push({ fila: rowNum, numero, resultado: 'creada', conPropietario: !!propNombre });
      } catch (err) {
        resultado.errores++;
        resultado.detalles.push({ fila: rowNum, numero, resultado: 'error', razon: err.message });
      }
    }

    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar el archivo Excel' });
  }
}

module.exports = { listar, resumen, obtener, crear, actualizar, eliminar, setPropietario, eliminarPropietario, configurarPortal, descargarPlantilla, importarMasivo };
