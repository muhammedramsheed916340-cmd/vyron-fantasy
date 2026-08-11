import { NextRequest, NextResponse } from 'next/server';
import { prisma, calculateExpiry } from '@/lib/admin-auth';

// POST /api/license/activate — Activate a license key for the current user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { licenseKey, accountId } = body;

    if (!licenseKey) {
      return NextResponse.json(
        { status: 'error', message: 'License key required' },
        { status: 400 }
      );
    }

    // Look up the license from the real database — no fake keys accepted
    const license = await prisma.license.findUnique({
      where: { key: licenseKey },
    });

    if (!license) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid license key' },
        { status: 403 }
      );
    }

    // Check if revoked
    if (license.status === 'REVOKED') {
      return NextResponse.json(
        { status: 'error', message: 'License revoked' },
        { status: 403 }
      );
    }

    // Check if expired
    if (license.status === 'EXPIRED') {
      return NextResponse.json(
        { status: 'error', message: 'License expired' },
        { status: 403 }
      );
    }

    // Check if already active and assigned to someone else
    if (license.status === 'ACTIVE' && license.assignedTo && license.assignedTo !== accountId) {
      return NextResponse.json(
        { status: 'error', message: 'License already assigned to another account' },
        { status: 403 }
      );
    }

    // Check if already active and not expired
    if (license.status === 'ACTIVE') {
      // Verify not expired
      if (license.type !== 'LIFETIME' && license.expiresAt && new Date(license.expiresAt) < new Date()) {
        await prisma.license.update({
          where: { id: license.id },
          data: { status: 'EXPIRED' },
        });
        return NextResponse.json(
          { status: 'error', message: 'License expired' },
          { status: 403 }
        );
      }

      // Already active and valid — return info
      return NextResponse.json({
        status: 'success',
        data: {
          key: license.key,
          type: license.type,
          status: license.status,
          expiresAt: license.expiresAt,
          assignedTo: license.assignedTo || accountId,
        },
      });
    }

    // Activate the license (was INACTIVE)
    const now = new Date();
    const expiresAt = calculateExpiry(license.type, now);

    const updated = await prisma.license.update({
      where: { id: license.id },
      data: {
        status: 'ACTIVE',
        activatedAt: now,
        expiresAt,
        assignedTo: accountId || null,
      },
    });

    return NextResponse.json({
      status: 'success',
      data: {
        key: updated.key,
        type: updated.type,
        status: updated.status,
        expiresAt: updated.expiresAt,
        assignedTo: updated.assignedTo,
      },
    });
  } catch (error) {
    console.error('License activate error:', error);
    return NextResponse.json({ status: 'error', message: 'Activation failed' }, { status: 500 });
  }
}
