import { NextRequest, NextResponse } from 'next/server';

const TG_API_BASE = 'https://tgsoftware-api.online/api';

/**
 * POST /api/fantasy/refresh-session
 *
 * Refresh an expired session for an already-connected platform account.
 * Uses the stored mobile number to re-authenticate via the TG API:
 *   1. Send OTP to the stored mobile number
 *   2. Wait for the OTP to be delivered (the user must provide it)
 *
 * IMPORTANT: This route does NOT auto-verify the OTP. That would be a
 * security risk (we can't receive SMS). Instead, it initiates the
 * re-auth flow and returns the OTP state so the client can collect
 * the OTP and verify it.
 *
 * For Dream11: returns the 'state' from send-otp (required for verify-otp)
 * For My11Circle: returns the 'challenge' and 'reasonCode' if available
 *
 * Body:
 *   fantasyApp: string      — "dream11" | "my11circle"
 *   mobileNumber: string    — the stored mobile number for re-auth
 *
 * Returns:
 *   { status: 'success', data: { state?, challenge?, reasonCode? } }
 *   { status: 'fail', message }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fantasyApp, mobileNumber } = body;

    if (!fantasyApp) {
      return NextResponse.json(
        { status: 'fail', message: 'fantasyApp is required' },
        { status: 400 }
      );
    }

    if (!mobileNumber) {
      return NextResponse.json(
        { status: 'fail', message: 'mobileNumber is required. This is the stored number for the connected account.' },
        { status: 400 }
      );
    }

    console.log('[REFRESH SESSION] Platform:', fantasyApp, 'Mobile:', mobileNumber.slice(0, 4) + '****');

    // Step 1: Send OTP via the TG API
    try {
      const sendOtpResponse = await fetch(`${TG_API_BASE}/fantasy/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fantasyApp, mobileNumber }),
        signal: AbortSignal.timeout(10000),
      });

      const sendOtpData = await sendOtpResponse.json();

      if (sendOtpResponse.status === 200 && sendOtpData.status === 'success') {
        console.log('[REFRESH SESSION] OTP sent successfully. Returning OTP state for client verification.');

        // Return the OTP state so the client can complete verification
        // The client will need to collect the OTP from the user and call verify-otp
        return NextResponse.json({
          status: 'success',
          data: {
            otpSent: true,
            // Dream11 state (required for verify-otp)
            state: sendOtpData.data?.state || null,
            // My11Circle challenge/reasonCode
            challenge: sendOtpData.data?.challenge || sendOtpData.data?.reasonCode || null,
            reasonCode: sendOtpData.data?.reasonCode || null,
            message: sendOtpData.message || 'OTP sent to your registered mobile number.',
          },
        });
      }

      // Send OTP failed
      console.error('[REFRESH SESSION] Send OTP failed:', sendOtpData.message);
      return NextResponse.json({
        status: 'fail',
        message: sendOtpData.message || 'Failed to send OTP for re-authentication. Please try again.',
      }, { status: sendOtpResponse.status });
    } catch (fetchError) {
      console.error('[REFRESH SESSION] TG API send-otp unreachable:', fetchError instanceof Error ? fetchError.message : 'unknown');
      return NextResponse.json({
        status: 'fail',
        message: 'Backend API is unavailable. Cannot refresh session right now.',
      }, { status: 503 });
    }
  } catch (error) {
    console.error('[REFRESH SESSION] Route error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { status: 'fail', message: 'Failed to refresh session.' },
      { status: 500 }
    );
  }
}
