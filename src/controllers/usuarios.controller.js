const bcrypt = require('bcryptjs');
const prisma  = require('../config/prisma');

const ROLES_USUARIO  = ['SUPER_ADMIN', 'ADMIN'];
const ROLES_EDIFICIO = ['ADMIN', 'OPERADOR', 'AUDITOR'];

// GET /api/usuarios
async function listar(req, res) {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true, nombre: true, email: true, rol: true, activo: true,
        ultimoAcceso: true, creadoEn: true,
        edificios: {
          include: { edificio: { select: { id: true, nombre: true } } },
        },
      },
      orderBy: { nombre: 'asc' },
    });
    res.json(usuarios);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
}

// POST /api/usuarios
async function crear(req, res) {
  const { nombre, email, password, rol = 'ADMIN' } = req.body;
  if (!nombre || !email || !password) return res.status(400).json({ error: 'nombre, email y password son requeridos' });
  if (password.length < 6)            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  if (!ROLES_USUARIO.includes(rol))   return res.status(400).json({ error: 'Rol inválido' });

  try {
    const existe = await prisma.usuario.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existe) return res.status(409).json({ error: 'El email ya está registrado' });

    const hash    = await bcrypt.hash(password, 10);
    const usuario = await prisma.usuario.create({
      data: { nombre, email: email.toLowerCase().trim(), password: hash, rol },
      select: { id: true, nombre: true, email: true, rol: true, activo: true, creadoEn: true, edificios: true },
    });
    res.status(201).json(usuario);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
}

// PUT /api/usuarios/:id
async function actualizar(req, res) {
  const id = parseInt(req.params.id);
  const { nombre, rol, activo } = req.body;

  if (rol !== undefined && !ROLES_USUARIO.includes(rol)) return res.status(400).json({ error: 'Rol inválido' });

  try {
    const existe = await prisma.usuario.findUnique({ where: { id } });
    if (!existe) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (id === req.usuario.id && activo === false) return res.status(400).json({ error: 'No puedes desactivarte a ti mismo' });

    const data = {};
    if (nombre  !== undefined) data.nombre = nombre;
    if (rol     !== undefined) data.rol    = rol;
    if (activo  !== undefined) data.activo = activo;

    const usuario = await prisma.usuario.update({
      where: { id },
      data,
      select: { id: true, nombre: true, email: true, rol: true, activo: true },
    });
    res.json(usuario);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
}

// PUT /api/usuarios/:id/password
async function resetPassword(req, res) {
  const id = parseInt(req.params.id);
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  try {
    const existe = await prisma.usuario.findUnique({ where: { id } });
    if (!existe) return res.status(404).json({ error: 'Usuario no encontrado' });

    const hash = await bcrypt.hash(password, 10);
    await prisma.usuario.update({ where: { id }, data: { password: hash } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
}

// GET /api/usuarios/:id/edificios
async function listarEdificios(req, res) {
  const id = parseInt(req.params.id);
  try {
    const accesos = await prisma.edificioUsuario.findMany({
      where:   { usuarioId: id },
      include: { edificio: { select: { id: true, nombre: true, activo: true } } },
    });
    res.json(accesos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar edificios del usuario' });
  }
}

// POST /api/usuarios/:id/edificios
async function asignarEdificio(req, res) {
  const usuarioId  = parseInt(req.params.id);
  const { edificioId, rol = 'ADMIN' } = req.body;
  if (!edificioId)                      return res.status(400).json({ error: 'edificioId requerido' });
  if (!ROLES_EDIFICIO.includes(rol))    return res.status(400).json({ error: 'Rol inválido' });

  try {
    const acceso = await prisma.edificioUsuario.upsert({
      where:  { edificioId_usuarioId: { edificioId: parseInt(edificioId), usuarioId } },
      create: { edificioId: parseInt(edificioId), usuarioId, rol },
      update: { rol },
      include: { edificio: { select: { id: true, nombre: true } } },
    });
    res.json(acceso);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al asignar edificio' });
  }
}

// DELETE /api/usuarios/:id/edificios/:edificioId
async function quitarEdificio(req, res) {
  const usuarioId  = parseInt(req.params.id);
  const edificioId = parseInt(req.params.edificioId);
  try {
    await prisma.edificioUsuario.deleteMany({ where: { usuarioId, edificioId } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al quitar edificio' });
  }
}

module.exports = { listar, crear, actualizar, resetPassword, listarEdificios, asignarEdificio, quitarEdificio };
