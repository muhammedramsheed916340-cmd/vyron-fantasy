import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/admin-auth';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { status: 'error', message: 'Password required' },
        { status: 400 }
      );
    }

    // Server-side password verification — NEVER expose the password
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { status: 'error', message: 'Access denied' },
        { status: 401 }
      );
    }

    // Create admin session token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours

    await prisma.adminSession.create({
      data: { token, expiresAt },
    });

    return NextResponse.json({
      status: 'success',
      data: { token, expiresAt: expiresAt.toISOString() },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal error' },
      { status: 500 }
    );
  }
}
