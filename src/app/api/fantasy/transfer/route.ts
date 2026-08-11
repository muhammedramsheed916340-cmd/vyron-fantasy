import { NextRequest, NextResponse } from 'next/server';
import { findActiveLicenseForAccount, prisma } from '@/lib/admin-auth';

const TG_API_BASE = 'https://tgsoftware-api.online/api';

// The TG Software API expects these exact field names:
// - "players" (not "playerList")
// - "vice_captain" (not "vicecaptain")
// - "sportIndex" (required)
// - "authToken" in body (not Bearer header)
interface TransferRequestBody {
  fantasyApp: string; // "dream11" | "my11circle"
  matchId: string | number;
  authToken: string;
  type: 'new' | 'edit';
  sportIndex?: number; // 0=cricket, 1=football, 2=basketball, 3=kabaddi
  players: number[]; // Platform-specific player IDs (mapped from fantasy_id_list)
  captain: number; // Captain's platform-specific player ID
  vice_captain: number; // Vice-captain's platform-specific player ID (NOTE: underscore!)
  id?: string | number; // Required for edit mode
  my11circleChallenge?: string; // For my11circle
  licenseAccountId?: string; // Account identifier for license validation
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
      my11circleChallenge,
      licenseAccountId,
    } = body;

    // ========== LICENSE GATE ==========
    // A valid active license is REQUIRED before any transfer operation.
    // This check is server-side only — frontend cannot bypass this.
    if (licenseAccountId) {
      const licenseCheck = await findActiveLicenseForAccount(licenseAccountId);
      if (!licenseCheck.valid) {
        return NextResponse.json(
          { status: 'LICENSE_REQUIRED', message: 'An active license is required to use team transfer.' },
          { status: 403 }
        );
      }
    } else {
      // No account ID provided — cannot validate license
      return NextResponse.json(
        { status: 'LICENSE_REQUIRED', message: 'An active license is required to use team transfer.' },
        { status: 403 }
      );
    }
    // ========== END LICENSE GATE ==========

    // Validate required fields
    if (!fantasyApp) {
      return NextResponse.json(
        { status: 'fail', message: 'fantasyApp is required' },
        { status: 400 }
      );
    }

    if (!authToken) {
      return NextResponse.json(
        { status: 'fail', message: 'authToken is required' },
        { status: 400 }
      );
    }

    if (!matchId) {
      return NextResponse.json(
        { status: 'fail', message: 'matchId is required' },
        { status: 400 }
      );
    }

    if (!type || (type !== 'new' && type !== 'edit')) {
      return NextResponse.json(
        { status: 'fail', message: 'type must be "new" or "edit"' },
        { status: 400 }
      );
    }

    if (!players || !Array.isArray(players) || players.length === 0) {
      return NextResponse.json(
        { status: 'fail', message: 'players must be a non-empty array' },
        { status: 400 }
      );
    }

    if (captain === undefined || captain === null) {
      return NextResponse.json(
        { status: 'fail', message: 'captain is required' },
        { status: 400 }
      );
    }

    if (vice_captain === undefined || vice_captain === null) {
      return NextResponse.json(
        { status: 'fail', message: 'vice_captain is required' },
        { status: 400 }
      );
    }

    if (type === 'edit' && !id) {
      return NextResponse.json(
        { status: 'fail', message: 'id is required for edit mode' },
        { status: 400 }
      );
    }

    // Determine endpoint based on type
    const endpoint = type === 'new' ? 'add-team' : 'edit-team';
    const url = `${TG_API_BASE}/fantasy/${endpoint}`;

    // Build the EXACT payload the TG API expects
    // Field names MUST match what the original teamgeneration.in sends:
    //   matchId, captain, vice_captain, players, fantasyApp, authToken, sportIndex, type
    const payload: Record<string, unknown> = {
      matchId,
      captain,
      vice_captain,
      players,
      fantasyApp,
      authToken,
      sportIndex: sportIndex ?? 0, // Default to cricket (0)
      type,
    };

    // For edit mode, include the team ID to replace
    if (type === 'edit' && id) {
      payload.id = id;
    }

    // For my11circle, include the challenge token
    if (fantasyApp === 'my11circle' && my11circleChallenge) {
      payload.my11circleChallenge = my11circleChallenge;
    }

    // Call the real TG Software API
    // NOTE: authToken goes in the body, NOT as a Bearer header
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      const data = await response.json();

      // Log the transfer
      try {
        await prisma.transferLog.create({
          data: {
            licenseKey: null,
            platform: fantasyApp,
            matchId: String(matchId),
            transferType: type,
            teamCount: 1,
            successCount: data.status === 'success' ? 1 : 0,
            failCount: data.status === 'success' ? 0 : 1,
            performedBy: licenseAccountId || null,
          },
        });
      } catch {
        // Log failure shouldn't block the transfer response
      }

      // Return the real API response as-is
      if (data.status === 'success') {
        return NextResponse.json({
          status: 'success',
          data: data.data || {},
        });
      }

      // API returned a failure response - pass the real error message
      return NextResponse.json({
        status: 'fail',
        message: data.message || 'Team transfer failed at the platform API.',
      });
    } catch (fetchError) {
      // API is unreachable
      console.error('TG API unreachable:', fetchError);
      return NextResponse.json({
        status: 'fail',
        message: 'Backend transfer API is unavailable for direct in-app transfer.',
      });
    }
  } catch (error) {
    console.error('Transfer API Error:', error);
    return NextResponse.json(
      { status: 'fail', message: 'Failed to process transfer request.' },
      { status: 500 }
    );
  }
}
