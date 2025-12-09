// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');

  // 1) Roles base
  const rolesData = [
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

  // 2) Usuario administrador
  const adminEmail = 'admin@itmsas.net';
  const adminPlainPassword = 'Admin123!'; // cámbialo en prod

  const adminPasswordHash = await bcrypt.hash(adminPlainPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      name: 'Super Admin',
      isActive: true,
      // Admin normalmente no tiene supportArea
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: rolesMap['admin'].id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: rolesMap['admin'].id,
    },
  });

  console.log('✅ Usuario admin creado/actualizado:', adminUser.email);

  // 3) Usuario agente de Sistemas
  const agenteEmail = 'agente.sistemas@itmsas.net';
  const agentePlainPassword = 'Agente123!'; // cámbialo si quieres

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
  console.log(`   Admin  -> ${adminEmail} / ${adminPlainPassword}`);
  console.log(`   Agente -> ${agenteEmail} / ${agentePlainPassword}`);
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
