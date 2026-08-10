import { NextRequest, NextResponse } from 'next/server';
import { validateLicense, findActiveLicenseForAccount } from '@/lib/admin-auth';

// POST /api/license/validate — Validate a license or check license for an account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { licenseKey, accountId } = body;

    // If accountId provided, find active license for that account
    if (accountId) {
      const result = await findActiveLicenseForAccount(accountId);
      return NextResponse.json({ status: 'success', data: result });
    }

    // If licenseKey provided, validate that specific key
    if (licenseKey) {
      const result = await validateLicense(licenseKey);
      return NextResponse.json({ status: 'success', data: result });
    }

    return NextResponse.json(
      { status: 'error', message: 'licenseKey or accountId required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('License validate error:', error);
    return NextResponse.json({ status: 'error', message: 'Validation failed' }, { status: 500 });
  }
}
