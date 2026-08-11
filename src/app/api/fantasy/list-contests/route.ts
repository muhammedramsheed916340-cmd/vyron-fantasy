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

    console.log('[LIST-CONTESTS API] Platform:', fantasyApp, 'Match ID:', numericMatchId, 'Sport Index:', sportIndex ?? 0);

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

      console.log('[LIST-CONTESTS API] TG API HTTP status:', response.status);

      let data: any;
      try {
        data = await response.json();
      } catch {
        console.error('[LIST-CONTESTS API] Failed to parse TG API response as JSON');
        return NextResponse.json({
          status: 'fail',
          message: `Contest list API returned unexpected response (HTTP ${response.status}).`,
        });
      }

      console.log('[LIST-CONTESTS API] TG API response status:', data.status);
      console.log('[LIST-CONTESTS API] TG API response keys:', Object.keys(data));
      console.log('[LIST-CONTESTS API] TG API data keys:', data.data ? (typeof data.data === 'object' ? Object.keys(data.data) : typeof data.data) : 'no data');

      // Auth/token expiration detection
      if (data.tokenExpired || data.status === 'token_expired') {
        return NextResponse.json({
          status: 'fail',
          message: data.message || 'Auth token expired. Please re-login.',
          tokenExpired: true,
        });
      }

      if (data.status === 'success') {
        // Pass through the FULL data object so the client can normalize it
        // The data.data may contain contests in various nested structures
        return NextResponse.json({
          status: 'success',
          data: data.data || {},
          // Also include top-level contest arrays if present
          _debug: {
            httpStatus: response.status,
            topLevelKeys: Object.keys(data),
            dataKeys: data.data && typeof data.data === 'object' ? Object.keys(data.data) : null,
            dataType: typeof data.data,
            isDataArray: Array.isArray(data.data),
          },
        });
      }

      // Detect auth errors from the message
      const msg = data.message || 'Failed to load contests.';
      const isAuthError = msg.toLowerCase().includes('auth') ||
        msg.toLowerCase().includes('token') ||
        msg.toLowerCase().includes('expire') ||
        msg.toLowerCase().includes('login') ||
        msg.toLowerCase().includes('session');

      return NextResponse.json({
        status: 'fail',
        message: msg,
        tokenExpired: isAuthError,
      });
    } catch (fetchError) {
      console.error('[LIST-CONTESTS API] TG API unreachable:', fetchError instanceof Error ? fetchError.message : 'unknown');
      return NextResponse.json({
        status: 'fail',
        message: 'Contest list API unavailable. Please try again.',
      });
    }
  } catch (error) {
    console.error('[LIST-CONTESTS API] Route error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ status: 'fail', message: 'Failed to list contests.' }, { status: 500 });
  }
}
