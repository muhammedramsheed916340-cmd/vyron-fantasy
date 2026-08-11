import { NextRequest, NextResponse } from 'next/server';

const TG_API_BASE = 'https://tgsoftware-api.online/api';

// ============================================================
// 🔒 HIDDEN JWT TOKEN — Only server-side, never exposed to client
// Replace this with the actual JWT token when provided
// ============================================================
const CONTEST_JWT_TOKEN = process.env.CONTEST_JWT_TOKEN || 'PLACEHOLDER_REPLACE_WITH_REAL_TOKEN';

interface JoinContestBody {
  fantasyApp: string;
  matchId: string | number;
  authToken: string;
  teamId: string | number;
  sportIndex?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: JoinContestBody = await request.json();
    const { fantasyApp, matchId, authToken, teamId, sportIndex } = body;

    // Validate required fields
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
      return NextResponse.json({ status: 'fail', message: 'teamId is required' }, { status: 400 });
    }

    // Check JWT token is configured
    if (CONTEST_JWT_TOKEN === 'PLACEHOLDER_REPLACE_WITH_REAL_TOKEN') {
      console.warn('Join Contest: JWT token not configured yet');
      return NextResponse.json({
        status: 'fail',
        message: 'Contest joining is not configured. Contact admin.',
      });
    }

    const numericMatchId = typeof matchId === 'string' ? parseInt(matchId, 10) : matchId;

    // Build payload for TG API join-contest
    const payload: Record<string, unknown> = {
      matchId: numericMatchId,
      fantasyApp,
      authToken,
      teamId,
      sportIndex: sportIndex ?? 0,
      token: CONTEST_JWT_TOKEN,  // JWT token — hidden from client
    };

    // Call TG API join-contest endpoint
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
        console.error('TG API join-contest returned non-JSON, status:', response.status);
        return NextResponse.json({
          status: 'fail',
          message: `Contest API returned unexpected response (HTTP ${response.status}).`,
        });
      }

      if (data.status === 'success') {
        return NextResponse.json({
          status: 'success',
          data: data.data || {},
        });
      }

      return NextResponse.json({
        status: 'fail',
        message: data.message || 'Contest join failed at the platform API.',
      });
    } catch (fetchError) {
      const errMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      console.error('TG API join-contest unreachable:', errMsg);
      return NextResponse.json({
        status: 'fail',
        message: 'Contest join API is unavailable. Please try again later.',
      });
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Join Contest API Error:', errMsg);
    return NextResponse.json(
      { status: 'fail', message: 'Failed to process join contest request.' },
      { status: 500 }
    );
  }
}
