import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/admin-auth';

const TG_API_BASE = 'https://tgsoftware-api.online/api';

interface TransferRequestBody {
  fantasyApp: string;
  matchId: string | number;
  authToken: string;
  type: 'new' | 'edit';
  sportIndex?: number;
  players: number[];
  captain: number;
  vice_captain: number;
  id?: string | number;
  joinContest?: boolean;
  my11circleChallenge?: string;
  licenseAccountId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: TransferRequestBody = await request.json();

    const {
      fantasyApp,
      matchId,
      authToken,
      type,
      sportIndex,
      players,
      captain,
      vice_captain,
      id,
      joinContest,
      my11circleChallenge,
      licenseAccountId,
    } = body;

    // No license gate — transfer is open to all users

    // Validate required fields
    if (!fantasyApp) {
      return NextResponse.json({ status: 'fail', message: 'fantasyApp is required' }, { status: 400 });
    }
    if (!authToken) {
      return NextResponse.json({ status: 'fail', message: 'authToken is required' }, { status: 400 });
    }
    if (!matchId) {
      return NextResponse.json({ status: 'fail', message: 'matchId is required' }, { status: 400 });
    }
    if (!type || (type !== 'new' && type !== 'edit')) {
      return NextResponse.json({ status: 'fail', message: 'type must be "new" or "edit"' }, { status: 400 });
    }
    if (!players || !Array.isArray(players) || players.length === 0) {
      return NextResponse.json({ status: 'fail', message: 'players must be a non-empty array' }, { status: 400 });
    }
    if (captain === undefined || captain === null) {
      return NextResponse.json({ status: 'fail', message: 'captain is required' }, { status: 400 });
    }
    if (vice_captain === undefined || vice_captain === null) {
      return NextResponse.json({ status: 'fail', message: 'vice_captain is required' }, { status: 400 });
    }
    if (type === 'edit' && !id) {
      return NextResponse.json({ status: 'fail', message: 'id is required for edit mode' }, { status: 400 });
    }

    // Determine endpoint
    const endpoint = type === 'new' ? 'add-team' : 'edit-team';
    const url = `${TG_API_BASE}/fantasy/${endpoint}`;

    // Build payload for TG API
    // IMPORTANT: TG API expects matchId as a NUMBER, not a string
    const numericMatchId = typeof matchId === 'string' ? parseInt(matchId, 10) : matchId;

    const payload: Record<string, unknown> = {
      matchId: numericMatchId,
      captain,
      vice_captain,
      players,
      fantasyApp,
      authToken,
      sportIndex: sportIndex ?? 0,
      type,
    };

    if (type === 'edit' && id) {
      payload.id = id;
    }
    // joinContest flag — if true, after team creation we'll call join-contest API
    // The JWT token is handled server-side only (never exposed to client)
    // No contestId or JWT is added to the add-team payload itself
    // Use case-insensitive check for my11circle challenge token
    if (fantasyApp.toLowerCase() === 'my11circle' && my11circleChallenge) {
      payload.my11circleChallenge = my11circleChallenge;
    }

    // Call the TG Software API
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      // Safely parse JSON response
      let data: any;
      try {
        data = await response.json();
      } catch {
        console.error('TG API returned non-JSON response, status:', response.status);
        return NextResponse.json({
          status: 'fail',
          message: `Transfer API returned unexpected response (HTTP ${response.status}).`,
        });
      }

      // Log the transfer to database (non-blocking)
      try {
        await prisma.transferLog.create({
          data: {
            licenseKey: null,
            platform: fantasyApp,
            matchId: String(matchId),
            transferType: type,
            contestId: contestId || null,
            teamCount: 1,
            successCount: data.status === 'success' ? 1 : 0,
            failCount: data.status === 'success' ? 0 : 1,
            performedBy: licenseAccountId || null,
          },
        });
      } catch (logErr) {
        // Log failure shouldn't block the transfer response
        console.error('Transfer log write failed:', logErr instanceof Error ? logErr.message : 'unknown');
      }

      // Return the API response
      if (data.status === 'success') {
        // If joinContest is enabled, attempt to join the team to a contest
        // This is a best-effort follow-up — failure won't fail the team creation
        let contestJoined = false;
        let contestMessage = '';

        if (joinContest) {
          try {
            const teamId = data.data?.teamId || data.data?.id || data.data?.team_id;
            if (teamId) {
              const contestRes = await fetch(`${TG_API_BASE}/fantasy/join-contest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  matchId: numericMatchId,
                  fantasyApp,
                  authToken,
                  teamId,
                  sportIndex: sportIndex ?? 0,
                }),
                signal: AbortSignal.timeout(10000),
              });
              const contestData = await contestRes.json();
              contestJoined = contestData.status === 'success';
              contestMessage = contestJoined ? 'Contest joined' : (contestData.message || 'Contest join failed');
            } else {
              contestMessage = 'No teamId returned — cannot join contest';
            }
          } catch (contestErr) {
            contestMessage = 'Contest join request failed';
            console.error('Join contest error:', contestErr instanceof Error ? contestErr.message : 'unknown');
          }
        }

        return NextResponse.json({
          status: 'success',
          data: data.data || {},
          contestJoined,
          contestMessage,
        });
      }

      // Pass through the real TG API error message
      return NextResponse.json({
        status: 'fail',
        message: data.message || 'Team transfer failed at the platform API.',
      });
    } catch (fetchError) {
      const errMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      console.error('TG API unreachable:', errMsg);
      return NextResponse.json({
        status: 'fail',
        message: 'Backend transfer API is unavailable. Please try again later.',
      });
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Transfer API Error:', errMsg);
    return NextResponse.json(
      { status: 'fail', message: 'Failed to process transfer request.' },
      { status: 500 }
    );
  }
}
