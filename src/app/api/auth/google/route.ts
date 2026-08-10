import { NextRequest, NextResponse } from 'next/server';

const TG_API_BASE = 'https://tgsoftware-api.online/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, bypass } = body;

    // If bypass mode, return a local auth token directly
    if (bypass) {
      // Try to register/authenticate with the TG API first
      try {
        const response = await fetch(`${TG_API_BASE}/auth/register4642`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'tg_web' }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success' && data.data) {
            return NextResponse.json({
              status: 'success',
              data: data.data,
            });
          }
        }
      } catch {
        // TG API unavailable, use local auth
      }

      // Return a local auth token
      return NextResponse.json({
        status: 'success',
        data: {
          token: 'tg_local_' + Date.now(),
          user: {
            name: 'TG User',
            email: 'user@teamgeneration.in',
            picture: '',
            role: 'user',
            hasMobileNumber: false,
          },
        },
      });
    }

    // Normal Google OAuth flow
    if (!code) {
      return NextResponse.json(
        { status: 'fail', message: 'Authorization code is required' },
        { status: 400 }
      );
    }

    // Forward to the TG API
    try {
      const response = await fetch(`${TG_API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    } catch {
      return NextResponse.json(
        { status: 'fail', message: 'Authentication service unavailable' },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('Google Auth API Error:', error);
    return NextResponse.json(
      { status: 'fail', message: 'Authentication failed' },
      { status: 500 }
    );
  }
}
