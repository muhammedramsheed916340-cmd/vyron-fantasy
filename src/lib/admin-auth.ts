import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

// Use the shared singleton PrismaClient from db.ts
// This ensures we don't create multiple PrismaClient instances in production
const prisma = db;

/**
 * Verify admin session token from request headers.
 * Returns true if valid, false otherwise.
 */
export async function verifyAdminAuth(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);
  if (!token) return false;

  const session = await prisma.adminSession.findUnique({
    where: { token },
  });

  if (!session) return false;
  if (new Date(session.expiresAt) < new Date()) {
    // Session expired, clean up
    await prisma.adminSession.delete({ where: { id: session.id } });
    return false;
  }

  return true;
}

/**
 * Generate a random license key in format: VYRON-XXXX-XXXX-XXXX
 */
export function generateLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I,O,0,1 to avoid confusion
  const segment = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `VYRON-${segment()}-${segment()}-${segment()}`;
}

/**
 * Calculate expiry date based on license type from a given start date.
 * Returns null for LIFETIME.
 */
export function calculateExpiry(type: string, from: Date = new Date()): Date | null {
  switch (type) {
    case 'MONTHLY':
      return new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000);
    case 'THREE_MONTHS':
      return new Date(from.getTime() + 90 * 24 * 60 * 60 * 1000);
    case 'SIX_MONTHS':
      return new Date(from.getTime() + 180 * 24 * 60 * 60 * 1000);
    case 'LIFETIME':
      return null;
    default:
      return null;
  }
}

/**
 * Validate if a license is active and not expired/revoked.
 * Server-side only — checks the real database.
 */
export async function validateLicense(licenseKey: string): Promise<{
  valid: boolean;
  license?: {
    id: string;
    key: string;
    type: string;
    status: string;
    expiresAt: Date | null;
    assignedTo: string | null;
  };
  reason?: string;
}> {
  const license = await prisma.license.findUnique({
    where: { key: licenseKey },
  });

  if (!license) {
    return { valid: false, reason: 'License not found' };
  }

  if (license.status === 'REVOKED') {
    return { valid: false, reason: 'License revoked' };
  }

  if (license.status === 'EXPIRED') {
    return { valid: false, reason: 'License expired' };
  }

  if (license.status !== 'ACTIVE') {
    return { valid: false, reason: 'License is not active' };
  }

  // Check expiry for non-lifetime licenses
  if (license.type !== 'LIFETIME' && license.expiresAt) {
    if (new Date(license.expiresAt) < new Date()) {
      // Auto-expire in database
      await prisma.license.update({
        where: { id: license.id },
        data: { status: 'EXPIRED' },
      });
      return { valid: false, reason: 'License expired' };
    }
  }

  return {
    valid: true,
    license: {
      id: license.id,
      key: license.key,
      type: license.type,
      status: license.status,
      expiresAt: license.expiresAt,
      assignedTo: license.assignedTo,
    },
  };
}

/**
 * Find an active license for a given account identifier.
 */
export async function findActiveLicenseForAccount(accountId: string): Promise<{
  valid: boolean;
  license?: {
    id: string;
    key: string;
    type: string;
    status: string;
    expiresAt: Date | null;
    assignedTo: string | null;
  };
}> {
  // First try: license assigned to this specific account
  let license = await prisma.license.findFirst({
    where: {
      assignedTo: accountId,
      status: 'ACTIVE',
    },
    orderBy: { createdAt: 'desc' },
  });

  // Fallback: any active license (supports admin/single-user setups where
  // license is assigned to "admin" but frontend sends the phone number)
  if (!license) {
    license = await prisma.license.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!license) {
    return { valid: false };
  }

  // Check expiry
  if (license.type !== 'LIFETIME' && license.expiresAt) {
    if (new Date(license.expiresAt) < new Date()) {
      await prisma.license.update({
        where: { id: license.id },
        data: { status: 'EXPIRED' },
      });
      return { valid: false };
    }
  }

  return {
    valid: true,
    license: {
      id: license.id,
      key: license.key,
      type: license.type,
      status: license.status,
      expiresAt: license.expiresAt,
      assignedTo: license.assignedTo,
    },
  };
}

export { prisma };
