import { NextRequest, NextResponse } from 'next/server';

const TG_API_BASE = 'https://tgsoftware-api.online/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fantasyApp, mobileNumber } = body;

    if (!mobileNumber) {
      return NextResponse.json(
        { status: 'fail', message: 'Mobile number is required' },
        { status: 400 }
      );
    }

    if (!fantasyApp) {
      return NextResponse.json(
        { status: 'fail', message: 'Fantasy app is required' },
        { status: 400 }
      );
    }

    // Forward to the real TG Software API
    try {
      const response = await fetch(`${TG_API_BASE}/fantasy/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fantasyApp, mobileNumber }),
        signal: AbortSignal.timeout(10000),
      });

      const data = await response.json();

      if (response.status === 200 && data.status === 'success') {
        return NextResponse.json({
          status: 'success',
          data: data.data || {},
          message: data.message || 'OTP sent successfully',
        });
      }

      // API returned an error — report honestly
      return NextResponse.json({
        status: 'fail',
        message: data.message || 'Failed to send OTP from the platform.',
      }, { status: response.status });
    } catch (fetchError) {
      console.error('TG API send-otp unreachable:', fetchError);
      return NextResponse.json({
        status: 'fail',
        message: 'Backend OTP API is unavailable. Please try again later.',
      }, { status: 503 });
    }
  } catch (error) {
    console.error('Send OTP API Error:', error);
    return NextResponse.json(
      { status: 'fail', message: 'Failed to process send-otp request.' },
      { status: 500 }
    );
  }
}
