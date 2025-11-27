// prisma.config.ts

import 'dotenv/config'; // 👈 carga las variables del .env
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma', // ruta del schema

  datasource: {
    // Aquí lee DATABASE_URL desde el .env
    url: env('DATABASE_URL'),
  },

  migrations: {
    // Comando para correr el seed
    seed: 'ts-node prisma/seed.ts',
  },
});
