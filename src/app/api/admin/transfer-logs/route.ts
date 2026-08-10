import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth, prisma } from '@/lib/admin-auth';

// GET /api/admin/transfer-logs — List transfer logs
export async function GET(request: NextRequest) {
  const isValid = await verifyAdminAuth(request);
  if (!isValid) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
    const offset = Number(url.searchParams.get('offset')) || 0;

    const [logs, total] = await Promise.all([
      prisma.transferLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.transferLog.count(),
    ]);

    return NextResponse.json({ status: 'success', data: { logs, total } });
  } catch (error) {
    console.error('Transfer logs error:', error);
    return NextResponse.json({ status: 'error', message: 'Failed to fetch logs' }, { status: 500 });
  }
}
