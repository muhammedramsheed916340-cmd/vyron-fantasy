import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth, prisma } from '@/lib/admin-auth';

// GET /api/admin/licenses — List all licenses (with optional search)
export async function GET(request: NextRequest) {
  const isValid = await verifyAdminAuth(request);
  if (!isValid) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const statusFilter = url.searchParams.get('status') || '';
    const typeFilter = url.searchParams.get('type') || '';

    const where: Record<string, unknown> = {};
    
    if (search) {
      where.OR = [
        { key: { contains: search } },
        { assignedTo: { contains: search } },
        { notes: { contains: search } },
      ];
    }
    if (statusFilter) {
      where.status = statusFilter;
    }
    if (typeFilter) {
      where.type = typeFilter;
    }

    const licenses = await prisma.license.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Auto-check expired licenses
    const now = new Date();
    for (const lic of licenses) {
      if (lic.status === 'ACTIVE' && lic.type !== 'LIFETIME' && lic.expiresAt && new Date(lic.expiresAt) < now) {
        await prisma.license.update({
          where: { id: lic.id },
          data: { status: 'EXPIRED' },
        });
        lic.status = 'EXPIRED';
      }
    }

    return NextResponse.json({ status: 'success', data: licenses });
  } catch (error) {
    console.error('List licenses error:', error);
    return NextResponse.json({ status: 'error', message: 'Failed to list licenses' }, { status: 500 });
  }
}
