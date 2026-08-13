import { NextRequest, NextResponse } from 'next/server';
import { joinPlatformContest } from '@/lib/platform-contest-api';

/**
 * POST /api/fantasy/join-contest
 *
 * Join a contest on the platform using an existing team.
 * Calls the platform API directly (Dream11/My11Circle)
 * since the TG API does NOT have a join-contest endpoint (HTTP 404).
 *
 * The CONTEST_JWT_TOKEN from .env is passed as additional auth
 * for future TG API contest endpoint support.
 *
 * Body:
 *   fantasyApp: string       — "dream11" | "my11circle"
 *   matchId: string|number   — platform match ID (numeric)
 *   authToken: string        — platform session token from verify-otp
 *   teamId: string|number    — REAL platform team ID (from list-of-teams)
 *   contestId: string        — REAL platform contest ID
 *   sportIndex?: number      — sport index (default 0)
 *   challenge?: string       — My11Circle challenge token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fantasyApp, matchId, authToken, teamId, contestId, sportIndex, challenge } = body;

    if (!fantasyApp) {
      return NextResponse.json({ status: 'fail', message: 'fantasyApp is required' }, { status: 400 });
    }
    if (!matchId) {
      return NextResponse.json({ status: 'fail', message: 'matchId is required (numeric platform match ID)' }, { status: 400 });
    }

    // Validate matchId is numeric
    const numericMatchId = typeof matchId === 'string' ? parseInt(matchId, 10) : matchId;
    if (isNaN(numericMatchId) || numericMatchId <= 0) {
      return NextResponse.json({
        status: 'fail',
        message: `matchId must be a valid positive number. Got: "${matchId}"`,
      }, { status: 400 });
    }

    if (!authToken) {
      return NextResponse.json({ status: 'fail', message: 'authToken is required' }, { status: 400 });
    }
    if (!teamId) {
      return NextResponse.json({ status: 'fail', message: 'teamId is required. Use an existing platform team.' }, { status: 400 });
    }
    if (!contestId) {
      return NextResponse.json({ status: 'fail', message: 'contestId is required' }, { status: 400 });
    }

    // Read CONTEST_JWT_TOKEN from server env
    const contestJwtToken = process.env.CONTEST_JWT_TOKEN || undefined;

    console.log('[JOIN CONTEST API] Platform:', fantasyApp, 'Match:', numericMatchId, 'Team:', teamId, 'Contest:', contestId, 'Has JWT:', !!contestJwtToken);

    const result = await joinPlatformContest(
      fantasyApp,
      numericMatchId,
      authToken,
      teamId,
      contestId,
      challenge,
      contestJwtToken,
    );

    console.log('[JOIN CONTEST API] Result:', result.success ? 'SUCCESS' : result.alreadyJoined ? 'ALREADY_JOINED' : 'FAIL', result.message);

    if (result.success) {
      return NextResponse.json({
        status: 'success',
        message: result.message || 'Contest joined successfully.',
      });
    }

    if (result.alreadyJoined) {
      return NextResponse.json({
        status: 'already_joined',
        message: result.message || 'Already joined this contest.',
      });
    }

    // Auth error
    if (result.errorType === 'auth') {
      return NextResponse.json({
        status: 'fail',
        message: result.message || 'Session expired. Reconnect your account.',
        tokenExpired: true,
      });
    }

    return NextResponse.json({
      status: 'fail',
      message: result.message || 'Contest join failed.',
    });
  } catch (error) {
    console.error('[JOIN CONTEST API] Route error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ status: 'fail', message: 'Failed to process join contest.' }, { status: 500 });
  }
}
