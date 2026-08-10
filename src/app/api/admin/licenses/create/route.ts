import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth, prisma, generateLicenseKey, calculateExpiry } from '@/lib/admin-auth';

const VALID_TYPES = ['MONTHLY', 'THREE_MONTHS', 'SIX_MONTHS', 'LIFETIME'];

export async function POST(request: NextRequest) {
  const isValid = await verifyAdminAuth(request);
  if (!isValid) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, notes, count } = body;

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid license type. Must be: MONTHLY, THREE_MONTHS, SIX_MONTHS, or LIFETIME' },
        { status: 400 }
      );
    }

    const licenseCount = Math.min(Math.max(Number(count) || 1, 1), 50); // 1-50 at a time
    const createdLicenses = [];

    for (let i = 0; i < licenseCount; i++) {
      let key = generateLicenseKey();
      // Ensure uniqueness
      let exists = await prisma.license.findUnique({ where: { key } });
      while (exists) {
        key = generateLicenseKey();
        exists = await prisma.license.findUnique({ where: { key } });
      }

      const license = await prisma.license.create({
        data: {
          key,
          type,
          status: 'INACTIVE',
          notes: notes || null,
        },
      });

      createdLicenses.push(license);
    }

    return NextResponse.json({
      status: 'success',
      data: createdLicenses,
    });
  } catch (error) {
    console.error('Create license error:', error);
    return NextResponse.json({ status: 'error', message: 'Failed to create license' }, { status: 500 });
  }
}
