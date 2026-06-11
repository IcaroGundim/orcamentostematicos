import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../.env.local') });
config({ path: resolve(__dirname, '../.env') });
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL']! });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@seplan.ac.gov.br' },
    update: { username: 'admin' },
    create: {
      id: 'user-seplan-admin',
      name: 'Administrador SEPLAN',
      email: 'admin@seplan.ac.gov.br',
      username: 'admin',
      password: 'admin123',
      role: 'SEPLAN_ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'semulher@ac.gov.br' },
    update: { username: 'semulher' },
    create: {
      id: 'user-semulher',
      name: 'Representante SEMULHER',
      email: 'semulher@ac.gov.br',
      username: 'semulher',
      password: 'secretaria123',
      role: 'SECRETARIA_REPRESENTANTE',
      organizationCode: '762',
    },
  });

  await prisma.user.upsert({
    where: { email: 'sesacre@ac.gov.br' },
    update: { username: 'sesacre' },
    create: {
      id: 'user-sesacre',
      name: 'Representante SESACRE',
      email: 'sesacre@ac.gov.br',
      username: 'sesacre',
      password: 'secretaria123',
      role: 'SECRETARIA_REPRESENTANTE',
      organizationCode: '721',
    },
  });

  console.log('Seed concluído: 3 usuários criados.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
