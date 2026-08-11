import { NextRequest, NextResponse } from 'next/server';

const TG_API_BASE = 'https://tgsoftware-api.online/api';

// 🔒 JWT token — server-side only, never exposed to client
const CONTEST_JWT_TOKEN = process.env.CONTEST_JWT_TOKEN || '';

interface JoinContestBody {
  fantasyApp: string;
  matchId: string | number;
  authToken: string;
  teamId: string | number;
  contestId: string;
  sportIndex?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: JoinContestBody = await request.json();
    const { fantasyApp, matchId, authToken, teamId, contestId, sportIndex } = body;

    if (!fantasyApp) {
      return NextResponse.json({ status: 'fail', message: 'fantasyApp is required' }, { status: 400 });
    }
    if (!matchId) {
      return NextResponse.json({ status: 'fail', message: 'matchId is required' }, { status: 400 });
    }
    if (!authToken) {
      return NextResponse.json({ status: 'fail', message: 'authToken is required' }, { status: 400 });
    }
    if (!contestId) {
      return NextResponse.json({ status: 'fail', message: 'contestId is required' }, { status: 400 });
    }
    if (!CONTEST_JWT_TOKEN) {
      return NextResponse.json({ status: 'fail', message: 'Contest JWT token not configured' });
    }

    const numericMatchId = typeof matchId === 'string' ? parseInt(matchId, 10) : matchId;

    const payload: Record<string, unknown> = {
      matchId: numericMatchId,
      fantasyApp,
      authToken,
      teamId,
      contestId,
      sportIndex: sportIndex ?? 0,
      token: CONTEST_JWT_TOKEN,
    };

    try {
      const response = await fetch(`${TG_API_BASE}/fantasy/join-contest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONTEST_JWT_TOKEN}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      let data: any;
      try {
        data = await response.json();
      } catch {
        return NextResponse.json({
          status: 'fail',
          message: `Contest API returned unexpected response (HTTP ${response.status}).`,
        });
      }

      if (data.status === 'success') {
        return NextResponse.json({ status: 'success', data: data.data || {} });
      }

      // Detect "already joined" from API message
      const alreadyJoined = /already.*join|already.*entered|already.*participat/i.test(data.message || '');

      return NextResponse.json({
        status: alreadyJoined ? 'already_joined' : 'fail',
        message: data.message || 'Contest join failed.',
      });
    } catch (fetchError) {
      console.error('TG API join-contest unreachable:', fetchError instanceof Error ? fetchError.message : 'unknown');
      return NextResponse.json({ status: 'fail', message: 'Contest join API unavailable.' });
    }
  } catch (error) {
    console.error('Join Contest Error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ status: 'fail', message: 'Failed to process join contest.' }, { status: 500 });
  }
}
