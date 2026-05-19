const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const prisma = require('../config/prisma');

function firmarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        edificios: {
          include: { edificio: { select: { id: true, nombre: true } } },
        },
      },
    });

    if (!usuario || !usuario.activo) return res.status(401).json({ error: 'Credenciales inválidas' });

    const ok = await bcrypt.compare(password, usuario.password);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    await prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoAcceso: new Date() } });

    const { password: _, ...datos } = usuario;
    res.json({ token: firmarToken(usuario), usuario: datos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}

async function registro(req, res) {
  if (process.env.REGISTRO_ABIERTO === 'false') {
    return res.status(403).json({ error: 'El registro público está deshabilitado. Contacte al administrador.' });
  }

  const { nombre, email, password } = req.body;
  if (!nombre || !email || !password) return res.status(400).json({ error: 'Todos los campos son requeridos' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  try {
    const existe = await prisma.usuario.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existe) return res.status(409).json({ error: 'El email ya está registrado' });

    const hash    = await bcrypt.hash(password, 10);
    const usuario = await prisma.usuario.create({
      data: { nombre, email: email.toLowerCase().trim(), password: hash, rol: 'ADMIN' },
    });

    const { password: _, ...datos } = usuario;
    res.status(201).json({ token: firmarToken(usuario), usuario: { ...datos, edificios: [] } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear cuenta' });
  }
}

async function perfil(req, res) {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      include: {
        edificios: {
          include: { edificio: { select: { id: true, nombre: true, direccion: true } } },
        },
      },
    });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    const { password: _, ...datos } = usuario;
    res.json(datos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
}

async function cambiarPassword(req, res) {
  const { actual, nueva } = req.body;
  if (!actual || !nueva) return res.status(400).json({ error: 'actual y nueva son requeridos' });
  if (nueva.length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  if (actual === nueva) return res.status(400).json({ error: 'La nueva contraseña debe ser diferente a la actual' });

  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    const ok = await bcrypt.compare(actual, usuario.password);
    if (!ok) return res.status(401).json({ error: 'La contraseña actual es incorrecta' });

    const hash = await bcrypt.hash(nueva, 10);
    await prisma.usuario.update({ where: { id: usuario.id }, data: { password: hash } });

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
}

// POST /auth/bootstrap — crea o promueve el primer SUPER_ADMIN
// Requiere BOOTSTRAP_SECRET en .env y el mismo valor en el body
async function bootstrap(req, res) {
  const secret = process.env.BOOTSTRAP_SECRET;
  if (!secret) return res.status(503).json({ error: 'Bootstrap no habilitado en esta instalación' });

  const { nombre, email, password, secret: bodySecret } = req.body;
  if (!email || !bodySecret)       return res.status(400).json({ error: 'email y secret son requeridos' });
  if (bodySecret !== secret)       return res.status(403).json({ error: 'Clave de bootstrap incorrecta' });

  try {
    let usuario = await prisma.usuario.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (usuario) {
      // Promover usuario existente
      usuario = await prisma.usuario.update({
        where: { id: usuario.id },
        data:  { rol: 'SUPER_ADMIN', activo: true },
      });
    } else {
      // Crear nuevo usuario
      if (!nombre || !password)    return res.status(400).json({ error: 'nombre y password requeridos para crear un nuevo usuario' });
      if (password.length < 6)     return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
      const hash = await bcrypt.hash(password, 10);
      usuario = await prisma.usuario.create({
        data: { nombre, email: email.toLowerCase().trim(), password: hash, rol: 'SUPER_ADMIN' },
      });
    }

    const { password: _, ...datos } = usuario;
    res.json({ token: firmarToken(usuario), usuario: { ...datos, edificios: [] } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en bootstrap' });
  }
}

module.exports = { login, registro, perfil, cambiarPassword, bootstrap };
