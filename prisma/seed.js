require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// monto × coeficiente, rounded to cents
function montoPorCoef(monto, coef) {
  return +Number(Number(monto) * Number(coef)).toFixed(2);
}

// Simulate pago on a PagoCuota (returns update data)
function datosPago(metodo, referencia, diasAntes = 3) {
  return { estado: 'PAGADO', metodo, referencia };
}

async function main() {
  // ── Limpiar todo (CASCADE cubre todas las tablas hijas) ───────────────────
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE propietarios, unidades, edificio_usuarios, edificios, usuarios RESTART IDENTITY CASCADE'
  );

  // ── Usuarios ───────────────────────────────────────────────────────────────
  const hash = await bcrypt.hash('demo1234', 10);

  const admin = await prisma.usuario.create({
    data: { nombre: 'Administrador Demo', email: 'admin@demo.com', password: hash, rol: 'ADMIN' },
  });
  const operador = await prisma.usuario.create({
    data: { nombre: 'Operador Demo', email: 'operador@demo.com', password: hash, rol: 'OPERADOR' },
  });
  console.log('✓ Usuarios: admin@demo.com / demo1234  |  operador@demo.com / demo1234');

  // ── Edificio 1: Torre Pacífico ─────────────────────────────────────────────
  const torre = await prisma.edificio.create({
    data: {
      nombre: 'Torre Pacífico',
      ruc: '155-123456-2-2025 DV 00',
      direccion: 'Calle 50, Bella Vista, Ciudad de Panamá',
      totalUnidades: 12,
      fondoReserva: 6200.00,
      admin: 'Administración Inmobiliaria del Pacífico S.A.',
    },
  });

  await prisma.edificioUsuario.createMany({
    data: [
      { edificioId: torre.id, usuarioId: admin.id,    rol: 'ADMIN' },
      { edificioId: torre.id, usuarioId: operador.id, rol: 'OPERADOR' },
    ],
  });

  const unidadesTorre = [
    { numero: '101',  piso: 1, tipo: 'APARTAMENTO',     metrosCuadrados: 85.50,  coeficiente: 0.085000 },
    { numero: '102',  piso: 1, tipo: 'APARTAMENTO',     metrosCuadrados: 90.00,  coeficiente: 0.090000 },
    { numero: '201',  piso: 2, tipo: 'APARTAMENTO',     metrosCuadrados: 85.50,  coeficiente: 0.085000 },
    { numero: '202',  piso: 2, tipo: 'APARTAMENTO',     metrosCuadrados: 90.00,  coeficiente: 0.090000 },
    { numero: '301',  piso: 3, tipo: 'APARTAMENTO',     metrosCuadrados: 85.50,  coeficiente: 0.085000 },
    { numero: '302',  piso: 3, tipo: 'APARTAMENTO',     metrosCuadrados: 90.00,  coeficiente: 0.090000 },
    { numero: '401',  piso: 4, tipo: 'APARTAMENTO',     metrosCuadrados: 85.50,  coeficiente: 0.085000 },
    { numero: '402',  piso: 4, tipo: 'APARTAMENTO',     metrosCuadrados: 90.00,  coeficiente: 0.090000 },
    { numero: 'PH-1', piso: 5, tipo: 'APARTAMENTO',     metrosCuadrados: 180.00, coeficiente: 0.180000 },
    { numero: 'L-01', piso: 0, tipo: 'LOCAL',            metrosCuadrados: 45.00,  coeficiente: 0.045000 },
    { numero: 'E-01', piso: 0, tipo: 'ESTACIONAMIENTO',  metrosCuadrados: 12.50,  coeficiente: 0.012500 },
    { numero: 'E-02', piso: 0, tipo: 'ESTACIONAMIENTO',  metrosCuadrados: 12.50,  coeficiente: 0.012500 },
  ];

  const propietariosTorre = [
    { nombre: 'Carlos Rodríguez Pérez',  cedula: '8-123-4567', email: 'carlos@email.com',  telefono: '6000-0001' },
    { nombre: 'María González López',    cedula: '4-234-5678', email: 'maria@email.com',   telefono: '6000-0002' },
    { nombre: 'Juan Martínez Silva',     cedula: '2-345-6789', email: 'juan@email.com',    telefono: '6000-0003' },
    { nombre: 'Ana Herrera Castillo',    cedula: '8-456-7890', email: 'ana@email.com',     telefono: '6000-0004' },
    { nombre: 'Roberto Sánchez Torres',  cedula: '6-567-8901', email: 'roberto@email.com', telefono: '6000-0005' },
    { nombre: 'Lucía Morales Vega',      cedula: '3-678-9012', email: 'lucia@email.com',   telefono: '6000-0006' },
    { nombre: 'Pedro Jiménez Ruiz',      cedula: '8-789-0123', email: 'pedro@email.com',   telefono: '6000-0007' },
    { nombre: 'Sofia Castro Mendoza',    cedula: '9-890-1234', email: 'sofia@email.com',   telefono: '6000-0008' },
    { nombre: 'Inversiones PHC S.A.',    cedula: null,         email: 'phc@corp.com',      telefono: '6000-0009' },
    { nombre: 'Comercial Bella Vista',   cedula: null,         email: 'cbv@corp.com',      telefono: '6000-0010' },
    { nombre: 'Ricardo Flores Díaz',     cedula: '8-111-2222', email: 'ricardo@email.com', telefono: '6000-0011' },
    { nombre: 'Elena Vargas Núñez',      cedula: '8-333-4444', email: 'elena@email.com',   telefono: '6000-0012' },
  ];

  const unidadesTorreRecords = [];
  for (let i = 0; i < unidadesTorre.length; i++) {
    const unidad = await prisma.unidad.create({
      data: { edificioId: torre.id, ...unidadesTorre[i] },
    });
    await prisma.propietario.create({
      data: { unidadId: unidad.id, ...propietariosTorre[i] },
    });
    unidadesTorreRecords.push(unidad);
  }
  console.log(`✓ Edificio 1: ${torre.nombre} — ${unidadesTorre.length} unidades`);

  // ── Cuotas Torre Pacífico (Feb–May 2026, monto base $1500) ────────────────
  // Unidades que son morosas: L-01 (idx 9) y E-01 (idx 10)
  const morososTorre = new Set([
    unidadesTorreRecords[9].id,  // L-01
    unidadesTorreRecords[10].id, // E-01
  ]);

  const cuotasTorre = [
    { mes: 2, anio: 2026, fechaVence: new Date('2026-02-05'), allPaid: true },
    { mes: 3, anio: 2026, fechaVence: new Date('2026-03-05'), allPaid: true },
    { mes: 4, anio: 2026, fechaVence: new Date('2026-04-05'), allPaid: false },
    { mes: 5, anio: 2026, fechaVence: new Date('2026-05-05'), allPaid: false },
  ];

  for (const ct of cuotasTorre) {
    const cuota = await prisma.cuotaMantenimiento.create({
      data: {
        edificioId: torre.id,
        mes:        ct.mes,
        anio:       ct.anio,
        monto:      1500,
        fechaVence: ct.fechaVence,
        generada:   true,
      },
    });

    // Generate PagoCuota per unit
    for (const u of unidadesTorreRecords) {
      const monto = montoPorCoef(1500, u.coeficiente);
      const esMoroso = morososTorre.has(u.id);
      const vencida  = ct.fechaVence < new Date();

      let estado = 'PENDIENTE';
      let fechaPago = null;
      let metodo    = null;
      let referencia = null;
      let interesMora = 0;

      if (ct.allPaid && !esMoroso) {
        estado = 'PAGADO';
        fechaPago = new Date(ct.fechaVence.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days before
        metodo = ['TRANSFERENCIA', 'YAPPY', 'EFECTIVO'][Math.floor(Math.random() * 3)];
        referencia = `REF-${ct.anio}${String(ct.mes).padStart(2,'0')}-${u.id}`;
      } else if (!ct.allPaid && !esMoroso && ct.mes === 4) {
        // April: half paid, half pending
        if (u.id % 2 === 0) {
          estado = 'PAGADO';
          fechaPago = new Date('2026-04-03');
          metodo = 'TRANSFERENCIA';
          referencia = `REF-202604-${u.id}`;
        } else {
          estado = vencida ? 'VENCIDO' : 'PENDIENTE';
          if (vencida) {
            const dias = Math.floor((new Date() - ct.fechaVence) / (1000 * 60 * 60 * 24));
            interesMora = +(monto * 0.02 * (dias / 30)).toFixed(2);
          }
        }
      } else if (esMoroso && vencida) {
        // Morosos: always overdue for past months
        estado = 'VENCIDO';
        const dias = Math.floor((new Date() - ct.fechaVence) / (1000 * 60 * 60 * 24));
        interesMora = +(monto * 0.02 * Math.max(1, dias / 30)).toFixed(2);
      }

      await prisma.pagoCuota.create({
        data: {
          cuotaId:    cuota.id,
          unidadId:   u.id,
          monto,
          interesMora,
          fechaVence: ct.fechaVence,
          fechaPago:  fechaPago ? fechaPago : null,
          estado,
          metodo,
          referencia,
        },
      });
    }
  }
  console.log('✓ Cuotas Torre Pacífico: Feb–May 2026 generadas');

  // ── Gastos Torre Pacífico ─────────────────────────────────────────────────
  await prisma.gasto.createMany({
    data: [
      { edificioId: torre.id, categoria: 'SERVICIOS',       descripcion: 'Agua y alcantarillado — Febrero', monto: 320.00, fecha: new Date('2026-02-10'), proveedor: 'IDAAN' },
      { edificioId: torre.id, categoria: 'SERVICIOS',       descripcion: 'Electricidad áreas comunes — Feb', monto: 480.50, fecha: new Date('2026-02-10'), proveedor: 'ENSA' },
      { edificioId: torre.id, categoria: 'PERSONAL',        descripcion: 'Salario conserje — Febrero',      monto: 750.00, fecha: new Date('2026-02-28') },
      { edificioId: torre.id, categoria: 'MANTENIMIENTO',   descripcion: 'Mantenimiento ascensores',        monto: 650.00, fecha: new Date('2026-03-15'), proveedor: 'Elevadores Técnicos S.A.' },
      { edificioId: torre.id, categoria: 'SERVICIOS',       descripcion: 'Agua y alcantarillado — Marzo',   monto: 310.00, fecha: new Date('2026-03-10'), proveedor: 'IDAAN' },
      { edificioId: torre.id, categoria: 'SERVICIOS',       descripcion: 'Electricidad áreas comunes — Mar',monto: 510.00, fecha: new Date('2026-03-10'), proveedor: 'ENSA' },
      { edificioId: torre.id, categoria: 'PERSONAL',        descripcion: 'Salario conserje — Marzo',        monto: 750.00, fecha: new Date('2026-03-31') },
      { edificioId: torre.id, categoria: 'ADMINISTRACION',  descripcion: 'Honorarios administración — T1',  monto: 400.00, fecha: new Date('2026-04-01') },
      { edificioId: torre.id, categoria: 'MANTENIMIENTO',   descripcion: 'Pintura pasillos piso 3 y 4',     monto: 850.00, fecha: new Date('2026-04-20'), proveedor: 'Pinturas Centroamérica' },
      { edificioId: torre.id, categoria: 'SERVICIOS',       descripcion: 'Agua y alcantarillado — Abril',   monto: 295.00, fecha: new Date('2026-04-10'), proveedor: 'IDAAN' },
      { edificioId: torre.id, categoria: 'FONDO_RESERVA',   descripcion: 'Reparación bomba de agua',        monto: 1200.00,fecha: new Date('2026-04-25'), notas: 'Reemplazo bomba principal' },
      { edificioId: torre.id, categoria: 'PERSONAL',        descripcion: 'Salario conserje — Abril',        monto: 750.00, fecha: new Date('2026-04-30') },
    ],
  });
  // Actualizar fondo de reserva (se restó 1200 del gasto FONDO_RESERVA)
  await prisma.edificio.update({
    where: { id: torre.id },
    data: { fondoReserva: 6200.00 - 1200.00 },
  });
  console.log('✓ Gastos Torre Pacífico: 12 registros');

  // ── Proveedor + Órdenes Torre Pacífico ───────────────────────────────────
  const provElec = await prisma.proveedor.create({
    data: {
      edificioId: torre.id,
      nombre: 'Electrotécnica del Pacífico S.A.',
      ruc: '155-78901-1-2020',
      servicio: 'ELECTRICIDAD',
      contacto: 'Ing. Marcos Fuentes',
      email: 'mfuentes@electrotecnica.pa',
    },
  });
  const provPlom = await prisma.proveedor.create({
    data: {
      edificioId: torre.id,
      nombre: 'Plomería y Servicios Integrados',
      ruc: '155-11223-2-2018',
      servicio: 'PLOMERIA',
      contacto: 'Julián Herrera',
      email: 'jherrera@plomeria.pa',
    },
  });

  await prisma.ordenTrabajo.createMany({
    data: [
      {
        edificioId: torre.id, proveedorId: provElec.id,
        descripcion: 'Revisión y cambio de luminarias LED en pasillos',
        monto: 420.00, estado: 'COMPLETADA', prioridad: 'NORMAL',
        fecha: new Date('2026-03-10'), fechaEstimada: new Date('2026-03-20'),
        fechaCierre: new Date('2026-03-18'),
      },
      {
        edificioId: torre.id, proveedorId: provPlom.id,
        descripcion: 'Reparación fuga de agua tubería principal piso 2',
        monto: 380.00, estado: 'COMPLETADA', prioridad: 'URGENTE',
        fecha: new Date('2026-04-02'), fechaEstimada: new Date('2026-04-05'),
        fechaCierre: new Date('2026-04-04'),
      },
      {
        edificioId: torre.id, proveedorId: provElec.id,
        descripcion: 'Instalación tomacorrientes área de BBQ',
        monto: 280.00, estado: 'APROBADA', prioridad: 'NORMAL',
        fecha: new Date('2026-05-05'), fechaEstimada: new Date('2026-05-20'),
      },
      {
        edificioId: torre.id,
        descripcion: 'Limpieza de cisterna y revisión bomba',
        monto: null, estado: 'PENDIENTE', prioridad: 'NORMAL',
        fecha: new Date('2026-05-12'),
        notas: 'Solicitar cotizaciones a 2 proveedores',
      },
    ],
  });
  console.log('✓ Proveedores y órdenes Torre Pacífico: 2 proveedores, 4 órdenes');

  // ── Edificio 2: Residencias del Mar ────────────────────────────────────────
  const residencias = await prisma.edificio.create({
    data: {
      nombre: 'Residencias del Mar',
      ruc: '155-654321-1-2023 DV 00',
      direccion: 'Av. Balboa, Punta Paitilla, Ciudad de Panamá',
      totalUnidades: 8,
      fondoReserva: 12000.00,
      admin: 'Administración Inmobiliaria del Pacífico S.A.',
    },
  });

  await prisma.edificioUsuario.create({
    data: { edificioId: residencias.id, usuarioId: admin.id, rol: 'ADMIN' },
  });

  const unidadesRes = [
    { numero: 'A-101', piso: 1, tipo: 'APARTAMENTO',     metrosCuadrados: 120.00, coeficiente: 0.125000 },
    { numero: 'A-102', piso: 1, tipo: 'APARTAMENTO',     metrosCuadrados: 120.00, coeficiente: 0.125000 },
    { numero: 'B-101', piso: 1, tipo: 'APARTAMENTO',     metrosCuadrados: 95.00,  coeficiente: 0.100000 },
    { numero: 'B-102', piso: 1, tipo: 'APARTAMENTO',     metrosCuadrados: 95.00,  coeficiente: 0.100000 },
    { numero: 'A-201', piso: 2, tipo: 'APARTAMENTO',     metrosCuadrados: 120.00, coeficiente: 0.125000 },
    { numero: 'A-202', piso: 2, tipo: 'APARTAMENTO',     metrosCuadrados: 120.00, coeficiente: 0.125000 },
    { numero: 'PH-A',  piso: 3, tipo: 'APARTAMENTO',     metrosCuadrados: 200.00, coeficiente: 0.200000 },
    { numero: 'E-01',  piso: 0, tipo: 'ESTACIONAMIENTO', metrosCuadrados: 14.00,  coeficiente: 0.025000 },
  ];

  const propietariosRes = [
    { nombre: 'Francisco Díaz Moreno',   cedula: '8-500-1001', email: 'fdiaz@email.com',   telefono: '6100-0001' },
    { nombre: 'Patricia Luna Solis',     cedula: '8-500-1002', email: 'pluna@email.com',   telefono: '6100-0002' },
    { nombre: 'Grupo Mar Azul S.A.',     cedula: null,         email: 'mar@corp.com',       telefono: '6100-0003' },
    { nombre: 'Inversiones Costa S.A.',  cedula: null,         email: 'costa@corp.com',    telefono: '6100-0004' },
    { nombre: 'Daniel Reyes Pinto',      cedula: '8-500-1005', email: 'dreyes@email.com',  telefono: '6100-0005' },
    { nombre: 'Carmen Solano Arias',     cedula: '8-500-1006', email: 'csolano@email.com', telefono: '6100-0006' },
    { nombre: 'Pent & Sea Corp.',        cedula: null,         email: 'ph@corp.com',        telefono: '6100-0007' },
    { nombre: 'Mario Vega Espino',       cedula: '8-500-1008', email: 'mvega@email.com',   telefono: '6100-0008' },
  ];

  const unidadesResRecords = [];
  for (let i = 0; i < unidadesRes.length; i++) {
    const unidad = await prisma.unidad.create({
      data: { edificioId: residencias.id, ...unidadesRes[i] },
    });
    await prisma.propietario.create({
      data: { unidadId: unidad.id, ...propietariosRes[i] },
    });
    unidadesResRecords.push(unidad);
  }
  console.log(`✓ Edificio 2: ${residencias.nombre} — ${unidadesRes.length} unidades`);

  // ── Cuotas Residencias del Mar (Mar–May 2026, monto base $2000) ────────────
  const morosasRes = new Set([
    unidadesResRecords[3].id, // B-102
    unidadesResRecords[7].id, // E-01
  ]);

  const cuotasRes = [
    { mes: 3, anio: 2026, fechaVence: new Date('2026-03-05'), allPaid: true  },
    { mes: 4, anio: 2026, fechaVence: new Date('2026-04-05'), allPaid: false },
    { mes: 5, anio: 2026, fechaVence: new Date('2026-05-05'), allPaid: false },
  ];

  for (const cr of cuotasRes) {
    const cuota = await prisma.cuotaMantenimiento.create({
      data: {
        edificioId: residencias.id,
        mes:        cr.mes,
        anio:       cr.anio,
        monto:      2000,
        fechaVence: cr.fechaVence,
        generada:   true,
      },
    });

    for (const u of unidadesResRecords) {
      const monto    = montoPorCoef(2000, u.coeficiente);
      const esMoroso = morosasRes.has(u.id);
      const vencida  = cr.fechaVence < new Date();

      let estado = 'PENDIENTE';
      let fechaPago = null;
      let metodo    = null;
      let referencia = null;
      let interesMora = 0;

      if (cr.allPaid && !esMoroso) {
        estado = 'PAGADO';
        fechaPago = new Date(cr.fechaVence.getTime() - 2 * 24 * 60 * 60 * 1000);
        metodo = 'TRANSFERENCIA';
        referencia = `RES-${cr.anio}${String(cr.mes).padStart(2,'0')}-${u.id}`;
      } else if (!cr.allPaid && !esMoroso && cr.mes === 4) {
        if (u.id % 2 === 0) {
          estado = 'PAGADO';
          fechaPago = new Date('2026-04-04');
          metodo = 'YAPPY';
          referencia = `RES-202604-${u.id}`;
        } else {
          estado = vencida ? 'VENCIDO' : 'PENDIENTE';
          if (vencida) {
            const dias = Math.floor((new Date() - cr.fechaVence) / (1000 * 60 * 60 * 24));
            interesMora = +(monto * 0.02 * (dias / 30)).toFixed(2);
          }
        }
      } else if (esMoroso && vencida) {
        estado = 'VENCIDO';
        const dias = Math.floor((new Date() - cr.fechaVence) / (1000 * 60 * 60 * 24));
        interesMora = +(monto * 0.02 * Math.max(1, dias / 30)).toFixed(2);
      }

      await prisma.pagoCuota.create({
        data: {
          cuotaId:    cuota.id,
          unidadId:   u.id,
          monto,
          interesMora,
          fechaVence: cr.fechaVence,
          fechaPago:  fechaPago ? fechaPago : null,
          estado,
          metodo,
          referencia,
        },
      });
    }
  }
  console.log('✓ Cuotas Residencias del Mar: Mar–May 2026 generadas');

  // ── Gastos Residencias del Mar ────────────────────────────────────────────
  await prisma.gasto.createMany({
    data: [
      { edificioId: residencias.id, categoria: 'SERVICIOS',     descripcion: 'Agua y alcantarillado — Marzo', monto: 410.00, fecha: new Date('2026-03-10'), proveedor: 'IDAAN' },
      { edificioId: residencias.id, categoria: 'SERVICIOS',     descripcion: 'Electricidad áreas comunes — Mar', monto: 620.00, fecha: new Date('2026-03-10'), proveedor: 'ENSA' },
      { edificioId: residencias.id, categoria: 'PERSONAL',      descripcion: 'Salario portero — Marzo',      monto: 850.00, fecha: new Date('2026-03-31') },
      { edificioId: residencias.id, categoria: 'MANTENIMIENTO', descripcion: 'Limpieza piscina — Abril',     monto: 320.00, fecha: new Date('2026-04-15'), proveedor: 'AquaClean Panamá' },
      { edificioId: residencias.id, categoria: 'SERVICIOS',     descripcion: 'Agua y alcantarillado — Abril',monto: 390.00, fecha: new Date('2026-04-10'), proveedor: 'IDAAN' },
      { edificioId: residencias.id, categoria: 'PERSONAL',      descripcion: 'Salario portero — Abril',      monto: 850.00, fecha: new Date('2026-04-30') },
    ],
  });
  console.log('✓ Gastos Residencias del Mar: 6 registros');

  console.log('✓ Seed completado.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
