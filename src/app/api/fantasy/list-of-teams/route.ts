import { NextRequest, NextResponse } from 'next/server';

const TG_API_BASE = 'https://tgsoftware-api.online/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fantasyApp, matchId, authToken } = body;

    if (!fantasyApp || !matchId || !authToken) {
      return NextResponse.json(
        { status: 'fail', message: 'fantasyApp, matchId, and authToken are required' },
        { status: 400 }
      );
    }

    try {
      const response = await fetch(`${TG_API_BASE}/fantasy/list-of-teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fantasyApp, matchId: typeof matchId === 'string' ? parseInt(matchId, 10) : matchId, authToken }),
        signal: AbortSignal.timeout(10000),
      });

      let data: any;
      try {
        data = await response.json();
      } catch {
        // JSON parse failure — only mark as token expired if HTTP status indicates auth issue
        const isAuthError = response.status === 401 || response.status === 403;
        return NextResponse.json({
          status: 'fail',
          message: isAuthError
            ? 'Session expired. Please re-authenticate.'
            : `API returned unexpected response (HTTP ${response.status}).`,
          tokenExpired: isAuthError,
        });
      }

      if (response.status === 200 && data.status === 'success') {
        return NextResponse.json({
          status: 'success',
          data: {
            teamsList: data.teams_list || [],
            existingTeamCount: (data.teams_list || []).length,
          },
        });
      }

      // Determine if this is an auth/token error vs a different kind of error
      // CRITICAL: Only mark as auth error for TRUE auth failures.
      // Rate-limit errors (429), server errors (5xx), and generic errors
      // must NOT be treated as token expired — they cause false SESSION EXPIRED.
      const msg = (data.message || '').toLowerCase();
      const isTrueAuthError = (
        response.status === 401 ||
        response.status === 403 ||
        msg.includes('token expired') ||
        msg.includes('tokenexpired') ||
        msg.includes('unauthorized') ||
        msg.includes('re-login') ||
        msg.includes('relogin') ||
        (msg.includes('expire') && (msg.includes('token') || msg.includes('session')))
      );

      // Rate-limit — NOT an auth error
      if (response.status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
        return NextResponse.json({
          status: 'fail',
          message: data.message || 'Rate limited by platform. Please wait and try again.',
          tokenExpired: false,
        });
      }

      return NextResponse.json({
        status: 'fail',
        message: data.message || (isTrueAuthError ? 'Session expired. Please re-authenticate.' : 'Failed to load teams.'),
        tokenExpired: isTrueAuthError,
      });
    } catch (fetchError) {
      console.error('TG API list-of-teams unreachable:', fetchError instanceof Error ? fetchError.message : 'unknown');
      return NextResponse.json({
        status: 'fail',
        message: 'Backend API is unavailable. Please try again later.',
      });
    }
  } catch (error) {
    console.error('List-of-teams API Error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { status: 'fail', message: 'Failed to verify account.' },
      { status: 500 }
    );
  }
}
