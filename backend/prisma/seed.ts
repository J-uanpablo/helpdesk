// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');

  // 1) Roles base (incluimos super-admin)
  const rolesData = [
    { name: 'super-admin', description: 'Super Administrador' },
    { name: 'admin', description: 'Administrador del sistema' },
    { name: 'support', description: 'Agente de soporte' },
    { name: 'auditor', description: 'Auditor de soportes' },
    { name: 'end-user', description: 'Usuario final' },
  ];

  const rolesMap: Record<string, { id: number }> = {};

  for (const role of rolesData) {
    const r = await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });

    rolesMap[role.name] = { id: r.id };
  }

  console.log('✅ Roles creados/actualizados:', Object.keys(rolesMap));

  // 2) Usuario súper administrador
  const adminEmail = 'admin@itmsas.net';
  const adminPlainPassword = 'Admin123!';

  const adminPasswordHash = await bcrypt.hash(adminPlainPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'Super Admin',
      isActive: true,
    },
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      name: 'Super Admin',
      isActive: true,
    },
  });

  // le asignamos el rol SUPER-ADMIN
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: rolesMap['super-admin'].id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: rolesMap['super-admin'].id,
    },
  });

  console.log('✅ Usuario super-admin creado/actualizado:', adminUser.email);

  // 3) Usuario agente de Sistemas
  const agenteEmail = 'agente.sistemas@itmsas.net';
  const agentePlainPassword = 'Agente123!';

  const agentePasswordHash = await bcrypt.hash(agentePlainPassword, 10);

  const agente = await prisma.user.upsert({
    where: { email: agenteEmail },
    update: {
      supportArea: 'Sistemas',
      isActive: true,
    },
    create: {
      email: agenteEmail,
      passwordHash: agentePasswordHash,
      name: 'Agente Sistemas',
      isActive: true,
      supportArea: 'Sistemas',
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: agente.id,
        roleId: rolesMap['support'].id,
      },
    },
    update: {},
    create: {
      userId: agente.id,
      roleId: rolesMap['support'].id,
    },
  });

  console.log('✅ Agente de sistemas creado/actualizado:', agente.email);
  console.log('🎉 Seed completado. Credenciales de prueba:');
  console.log(`   Super Admin -> ${adminEmail} / ${adminPlainPassword}`);
  console.log(`   Agente      -> ${agenteEmail} / ${agentePlainPassword}`);
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
