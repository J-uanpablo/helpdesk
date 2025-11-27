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
  const plainPassword = 'Admin123!'; // ⚠ cámbialo en producción

  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      name: 'Super Admin',
      isActive: true,
    },
  });

  console.log('✅ Usuario admin creado/actualizado:', adminUser.email);

  // 3) Asignar rol admin al usuario
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

  console.log('✅ Rol admin asignado al usuario admin');
  console.log('🎉 Seed completado. Credenciales de prueba:');
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Password: ${plainPassword}`);
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
