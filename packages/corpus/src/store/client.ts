/**
 * Accesso al client Prisma.
 *
 * Un unico client per processo: Prisma tiene un pool di connessioni e
 * istanziarne uno per modulo esaurisce le connessioni del database molto prima
 * di esaurire la pazienza di chi legge lo stack trace.
 */
import { PrismaClient } from '@prisma/client';

let client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!client) {
    if (!process.env['DATABASE_URL']) {
      throw new Error(
        'DATABASE_URL non impostata. Copia .env.example in .env, oppure avvia il database con `docker compose up -d`.',
      );
    }
    client = new PrismaClient();
  }
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}

export type { PrismaClient };
