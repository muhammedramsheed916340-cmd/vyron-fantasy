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
        body: JSON.stringify({ fantasyApp, matchId, authToken }),
        signal: AbortSignal.timeout(10000),
      });

      let data: any;
      try {
        data = await response.json();
      } catch {
        return NextResponse.json({
          status: 'fail',
          message: `API returned unexpected response (HTTP ${response.status}).`,
          tokenExpired: true,
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

      return NextResponse.json({
        status: 'fail',
        message: data.message || 'Auth token is invalid or expired. Please re-login.',
        tokenExpired: true,
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
