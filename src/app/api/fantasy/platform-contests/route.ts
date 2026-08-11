import { NextRequest, NextResponse } from 'next/server';
import { fetchPlatformContests } from '@/lib/platform-contest-api';

/**
 * POST /api/fantasy/platform-contests
 *
 * Fetch contests directly from the platform (Dream11/My11Circle)
 * using the auth token from verify-otp.
 *
 * This replaces the broken /api/fantasy/list-contests route
 * which called a non-existent TG API endpoint.
 *
 * Body:
 *   platform: string       — "dream11" | "my11circle"
 *   matchId: string|number — the platform match ID
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
        { status: 'fail', message: 'matchId is required' },
        { status: 400 }
      );
    }

    if (!authToken) {
      return NextResponse.json(
        { status: 'fail', message: 'authToken is required. Connect your platform account first.' },
        { status: 400 }
      );
    }

    console.log('[PLATFORM CONTESTS API] Platform:', platform, 'Match ID:', matchId);

    const result = await fetchPlatformContests(platform, matchId, authToken, challenge);

    console.log('[PLATFORM CONTESTS API] Result — Contests:', result.contests.length, 'Error:', result.error || 'none', 'ErrorType:', result.errorType || 'none');

    if (result.errorType === 'auth') {
      return NextResponse.json({
        status: 'fail',
        message: result.error,
        tokenExpired: true,
      });
    }

    if (result.errorType && result.errorType !== 'none') {
      return NextResponse.json({
        status: 'fail',
        message: result.error,
      });
    }

    // Success — return contests
    return NextResponse.json({
      status: 'success',
      data: {
        contests: result.contests,
        contestCount: result.contests.length,
      },
    });
  } catch (error) {
    console.error('[PLATFORM CONTESTS API] Route error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { status: 'fail', message: 'Failed to fetch contests.' },
      { status: 500 }
    );
  }
}
