import { PrismaClient } from '@prisma/client'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// For SQLite, Prisma resolves relative paths relative to schema.prisma location,
// NOT relative to CWD. In production standalone builds, schema.prisma is deep
// inside node_modules/.prisma/client/, so relative paths break.
// Fix: Resolve the database path relative to CWD and pass it explicitly.
function resolveDbUrl(): string | undefined {
  const rawUrl = process.env.DATABASE_URL
  if (!rawUrl) return undefined

  // Only fix SQLite relative file: paths
  if (rawUrl.startsWith('file:') && !rawUrl.includes('///')) {
    const relativePath = rawUrl.replace('file:', '')
    // If it's already absolute, leave it alone
    if (path.isAbsolute(relativePath)) return rawUrl
    // Resolve relative to CWD
    const absolutePath = path.join(process.cwd(), relativePath)
    return `file:${absolutePath}`
  }

  return rawUrl
}

const resolvedUrl = resolveDbUrl()

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    datasources: resolvedUrl ? { db: { url: resolvedUrl } } : undefined,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
