import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth, prisma, calculateExpiry } from '@/lib/admin-auth';

// PATCH /api/admin/licenses/update — Update license (activate, deactivate, revoke, delete)
export async function PATCH(request: NextRequest) {
  const isValid = await verifyAdminAuth(request);
  if (!isValid) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, action, assignedTo, notes } = body;

    if (!id || !action) {
      return NextResponse.json({ status: 'error', message: 'License ID and action required' }, { status: 400 });
    }

    const license = await prisma.license.findUnique({ where: { id } });
    if (!license) {
      return NextResponse.json({ status: 'error', message: 'License not found' }, { status: 404 });
    }

    switch (action) {
      case 'activate': {
        const now = new Date();
        const expiresAt = calculateExpiry(license.type, now);
        const updated = await prisma.license.update({
          where: { id },
          data: {
            status: 'ACTIVE',
            activatedAt: now,
            expiresAt,
            assignedTo: assignedTo || license.assignedTo,
          },
        });
        return NextResponse.json({ status: 'success', data: updated });
      }

      case 'deactivate': {
        const updated = await prisma.license.update({
          where: { id },
          data: { status: 'INACTIVE' },
        });
        return NextResponse.json({ status: 'success', data: updated });
      }

      case 'revoke': {
        const updated = await prisma.license.update({
          where: { id },
          data: { status: 'REVOKED' },
        });
        return NextResponse.json({ status: 'success', data: updated });
      }

      case 'delete': {
        await prisma.license.delete({ where: { id } });
        return NextResponse.json({ status: 'success', data: { deleted: true } });
      }

      case 'update_notes': {
        const updated = await prisma.license.update({
          where: { id },
          data: { notes: notes || null },
        });
        return NextResponse.json({ status: 'success', data: updated });
      }

      case 'assign': {
        const updated = await prisma.license.update({
          where: { id },
          data: { assignedTo: assignedTo || null },
        });
        return NextResponse.json({ status: 'success', data: updated });
      }

      default:
        return NextResponse.json({ status: 'error', message: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Update license error:', error);
    return NextResponse.json({ status: 'error', message: 'Failed to update license' }, { status: 500 });
  }
}
