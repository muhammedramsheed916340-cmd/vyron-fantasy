import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const isValid = await verifyAdminAuth(request);
  
  if (!isValid) {
    return NextResponse.json(
      { status: 'error', message: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.json({ status: 'success', data: { valid: true } });
}
