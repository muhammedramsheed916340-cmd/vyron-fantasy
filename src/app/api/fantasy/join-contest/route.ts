import { NextRequest, NextResponse } from 'next/server';
import { joinPlatformContest } from '@/lib/platform-contest-api';

/**
 * POST /api/fantasy/join-contest
 *
 * Join a contest on the platform using an existing team.
 * Calls the platform API directly (Dream11/My11Circle)
 * since the TG API does NOT have a join-contest endpoint.
 *
 * Body:
 *   fantasyApp: string       — "dream11" | "my11circle"
 *   matchId: string|number   — platform match ID
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
      return NextResponse.json({ status: 'fail', message: 'matchId is required' }, { status: 400 });
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

    console.log('[JOIN CONTEST API] Platform:', fantasyApp, 'Match:', matchId, 'Team:', teamId, 'Contest:', contestId);

    const result = await joinPlatformContest(
      fantasyApp,
      matchId,
      authToken,
      teamId,
      contestId,
      challenge,
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
