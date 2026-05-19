const prisma = require('../config/prisma');

// GET /api/edificios/:edificioId/proveedores
async function listar(req, res) {
  try {
    const proveedores = await prisma.proveedor.findMany({
      where: { edificioId: req.edificioId },
      include: { _count: { select: { ordenes: true } } },
      orderBy: { nombre: 'asc' },
    });
    res.json(proveedores);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar proveedores' });
  }
}

// POST /api/edificios/:edificioId/proveedores
async function crear(req, res) {
  const { nombre, servicio, ruc, contacto, email } = req.body;
  if (!nombre || !servicio) return res.status(400).json({ error: 'nombre y servicio son requeridos' });
  try {
    const proveedor = await prisma.proveedor.create({
      data: { edificioId: req.edificioId, nombre, servicio, ruc: ruc || null, contacto: contacto || null, email: email || null },
    });
    res.status(201).json(proveedor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
}

// PUT /api/edificios/:edificioId/proveedores/:proveedorId
async function actualizar(req, res) {
  const id = parseInt(req.params.proveedorId);
  const { nombre, servicio, ruc, contacto, email, activo } = req.body;
  try {
    const existe = await prisma.proveedor.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!existe) return res.status(404).json({ error: 'Proveedor no encontrado' });

    const proveedor = await prisma.proveedor.update({
      where: { id },
      data: {
        ...(nombre    !== undefined && { nombre }),
        ...(servicio  !== undefined && { servicio }),
        ...(ruc       !== undefined && { ruc: ruc || null }),
        ...(contacto  !== undefined && { contacto: contacto || null }),
        ...(email     !== undefined && { email: email || null }),
        ...(activo    !== undefined && { activo }),
      },
    });
    res.json(proveedor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar proveedor' });
  }
}

// DELETE /api/edificios/:edificioId/proveedores/:proveedorId
async function eliminar(req, res) {
  const id = parseInt(req.params.proveedorId);
  try {
    const existe = await prisma.proveedor.findFirst({ where: { id, edificioId: req.edificioId } });
    if (!existe) return res.status(404).json({ error: 'Proveedor no encontrado' });

    const ordenes = await prisma.ordenTrabajo.count({ where: { proveedorId: id } });
    if (ordenes > 0) return res.status(409).json({ error: `No se puede eliminar: tiene ${ordenes} orden(es) asociada(s)` });

    await prisma.proveedor.delete({ where: { id } });
    res.json({ message: 'Proveedor eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar proveedor' });
  }
}

module.exports = { listar, crear, actualizar, eliminar };
