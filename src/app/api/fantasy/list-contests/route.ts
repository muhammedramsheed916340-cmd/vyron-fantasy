import { NextRequest, NextResponse } from 'next/server';

const TG_API_BASE = 'https://tgsoftware-api.online/api';
const CONTEST_JWT_TOKEN = process.env.CONTEST_JWT_TOKEN || '';

interface ListContestsBody {
  fantasyApp: string;
  matchId: string | number;
  authToken: string;
  sportIndex?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: ListContestsBody = await request.json();
    const { fantasyApp, matchId, authToken, sportIndex } = body;

    if (!fantasyApp || !matchId || !authToken) {
      return NextResponse.json({ status: 'fail', message: 'fantasyApp, matchId, and authToken are required' }, { status: 400 });
    }

    const numericMatchId = typeof matchId === 'string' ? parseInt(matchId, 10) : matchId;

    try {
      const response = await fetch(`${TG_API_BASE}/fantasy/list-contests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(CONTEST_JWT_TOKEN ? { 'Authorization': `Bearer ${CONTEST_JWT_TOKEN}` } : {}),
        },
        body: JSON.stringify({
          matchId: numericMatchId,
          fantasyApp,
          authToken,
          sportIndex: sportIndex ?? 0,
          ...(CONTEST_JWT_TOKEN ? { token: CONTEST_JWT_TOKEN } : {}),
        }),
        signal: AbortSignal.timeout(15000),
      });

      let data: any;
      try {
        data = await response.json();
      } catch {
        return NextResponse.json({ status: 'fail', message: `Contest list API error (HTTP ${response.status})` });
      }

      if (data.status === 'success') {
        return NextResponse.json({ status: 'success', data: data.data || {} });
      }

      return NextResponse.json({ status: 'fail', message: data.message || 'Failed to load contests.' });
    } catch (fetchError) {
      console.error('TG API list-contests unreachable:', fetchError instanceof Error ? fetchError.message : 'unknown');
      return NextResponse.json({ status: 'fail', message: 'Contest list API unavailable.' });
    }
  } catch (error) {
    return NextResponse.json({ status: 'fail', message: 'Failed to list contests.' }, { status: 500 });
  }
}
