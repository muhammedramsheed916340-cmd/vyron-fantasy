import { NextRequest, NextResponse } from 'next/server';

const TG_API_BASE = 'https://tgsoftware-api.online/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fantasyApp, mobileNumber, verificationCode, state, reasonCode, challenge } = body;

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

    if (!verificationCode) {
      return NextResponse.json(
        { status: 'fail', message: 'Verification code is required' },
        { status: 400 }
      );
    }

    // Build the request payload matching the real TG API format
    const payload: Record<string, unknown> = {
      fantasyApp,
      mobileNumber,
      verificationCode,
    };

    // Dream11 requires the 'state' from the send-otp response
    if (fantasyApp === 'dream11' && state) {
      payload.state = state;
    }

    // My11Circle requires reasonCode and challenge
    if (fantasyApp === 'my11circle') {
      if (reasonCode) payload.reasonCode = reasonCode;
      if (challenge) payload.challenge = challenge;
    }

    // Forward to the real TG Software API
    try {
      const response = await fetch(`${TG_API_BASE}/fantasy/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      const data = await response.json();

      if (response.status === 200 && data.status === 'success') {
        // Return the full data including token, my11circleChallenge, my11circleUserId
        return NextResponse.json({
          status: 'success',
          data: data.data || {},
        });
      }

      // API returned an error — report honestly
      return NextResponse.json({
        status: 'fail',
        message: data.message || 'OTP verification failed.',
      }, { status: response.status });
    } catch (fetchError) {
      console.error('TG API verify-otp unreachable:', fetchError);
      return NextResponse.json({
        status: 'fail',
        message: 'Backend OTP verification API is unavailable. Please try again later.',
      }, { status: 503 });
    }
  } catch (error) {
    console.error('Verify OTP API Error:', error);
    return NextResponse.json(
      { status: 'fail', message: 'Failed to process verify-otp request.' },
      { status: 500 }
    );
  }
}
