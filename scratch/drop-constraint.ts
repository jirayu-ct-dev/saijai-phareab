import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('Dropping constraint...');
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "package_expiry_notification" DROP CONSTRAINT IF EXISTS "package_expiry_notification_entitlementId_daysBefore_endAtS_key"`
    );
    console.log('Successfully dropped constraint!');
  } catch (error) {
    console.error('Error dropping constraint:', error);
  } finally {
    await pool.end();
  }
}

main();
