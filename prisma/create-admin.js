require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('GestarSoft2026!', 10);
  const usuario = await prisma.usuario.upsert({
    where: { email: 'admin@gestarsoft.com' },
    update: { password: hash, rol: 'ADMIN' },
    create: {
      nombre: 'Administrador',
      email: 'admin@gestarsoft.com',
      password: hash,
      rol: 'ADMIN',
    },
  });
  console.log('Admin listo:', usuario.email);
}

main().catch(console.error).finally(() => prisma.$disconnect());
