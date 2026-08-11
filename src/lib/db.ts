import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Production-safe singleton PrismaClient for PostgreSQL (Neon).
// - In development: reuse singleton on hot reload via globalThis
// - In production: create a single instance
// - DATABASE_URL must point to the Neon PostgreSQL connection string
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
