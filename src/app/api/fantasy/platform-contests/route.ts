import { NextRequest, NextResponse } from 'next/server';
import { fetchPlatformContests } from '@/lib/platform-contest-api';

/**
 * POST /api/fantasy/platform-contests
 *
 * Fetch contests directly from the platform (Dream11/My11Circle)
 * using the auth token from verify-otp.
 *
 * This replaces the broken /api/fantasy/list-contests route
 * which called a non-existent TG API endpoint (HTTP 404).
 *
 * The TG API does NOT have list-contests or join-contest endpoints.
 * We call the platform APIs directly with the session token from verify-otp.
 *
 * The CONTEST_JWT_TOKEN from .env is passed as additional auth
 * for future TG API contest endpoint support.
 *
 * Body:
 *   platform: string       — "dream11" | "my11circle"
 *   matchId: string|number — the platform match ID (numeric, e.g., 113672)
 *   authToken: string      — platform session token from verify-otp
 *   challenge?: string     — My11Circle challenge token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, matchId, authToken, challenge } = body;

    if (!platform) {
      return NextResponse.json(
        { status: 'fail', message: 'platform is required (dream11 or my11circle)' },
        { status: 400 }
      );
    }

    if (!matchId) {
      return NextResponse.json(
        { status: 'fail', message: 'matchId is required. This must be the numeric platform match ID (e.g., 113672), not a display name like "MO vs SUL".' },
        { status: 400 }
      );
    }

    // Validate matchId is numeric
    const numericMatchId = typeof matchId === 'string' ? parseInt(matchId, 10) : matchId;
    if (isNaN(numericMatchId) || numericMatchId <= 0) {
      return NextResponse.json(
        {
          status: 'fail',
          message: `matchId must be a valid positive number. Got: "${matchId}". Use the platform match ID from the match list, not a display name.`,
          _debug: { platform, matchId, issue: 'non_numeric_matchId' },
        },
        { status: 400 }
      );
    }

    if (!authToken) {
      return NextResponse.json(
        { status: 'fail', message: 'authToken is required. Connect your platform account first (Send OTP → Verify OTP).' },
        { status: 400 }
      );
    }

    // Read CONTEST_JWT_TOKEN from server env (never exposed to client)
    const contestJwtToken = process.env.CONTEST_JWT_TOKEN || undefined;

    console.log('[PLATFORM CONTESTS API] Platform:', platform, 'Match ID:', numericMatchId, 'Has JWT:', !!contestJwtToken);

    const result = await fetchPlatformContests(platform, numericMatchId, authToken, challenge, contestJwtToken);

    console.log('[PLATFORM CONTESTS API] Result — Contests:', result.contests.length, 'Error:', result.error || 'none', 'ErrorType:', result.errorType || 'none');

    // Auth error — session expired
    if (result.errorType === 'auth') {
      return NextResponse.json({
        status: 'fail',
        message: result.error,
        tokenExpired: true,
        _debug: result._debug,
      });
    }

    // HTTP 404 — NEVER silently convert to empty contests
    if (result.errorType === 'http_404') {
      return NextResponse.json({
        status: 'fail',
        message: result.error,
        httpStatus: 404,
        _debug: result._debug,
      });
    }

    // Other errors
    if (result.errorType && result.errorType !== 'none') {
      return NextResponse.json({
        status: 'fail',
        message: result.error,
        _debug: result._debug,
      });
    }

    // Success — return contests (even if 0, which is a valid state)
    return NextResponse.json({
      status: 'success',
      data: {
        contests: result.contests,
        contestCount: result.contests.length,
      },
      _debug: result._debug,
    });
  } catch (error) {
    console.error('[PLATFORM CONTESTS API] Route error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { status: 'fail', message: 'Failed to fetch contests.' },
      { status: 500 }
    );
  }
}
