import { NextRequest, NextResponse } from 'next/server';

const TG_API_BASE = 'https://tgsoftware-api.online/api';

/**
 * POST /api/fantasy/verify-session
 *
 * Verify whether a stored platform session token is still valid.
 * Uses the TG API's list-of-teams endpoint as a lightweight check.
 * This does NOT create any teams — it just checks auth validity.
 *
 * Body:
 *   fantasyApp: string  — "dream11" | "my11circle"
 *   authToken: string   — platform session token from verify-otp
 *   matchId?: number    — optional match ID for the check (defaults to 1)
 *
 * Returns:
 *   { status: 'valid' }               — token is still valid
 *   { status: 'expired', message }     — token is expired/invalid
 *   { status: 'error', message }       — other error (network, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fantasyApp, authToken, matchId } = body;

    if (!fantasyApp) {
      return NextResponse.json(
        { status: 'error', message: 'fantasyApp is required' },
        { status: 400 }
      );
    }

    if (!authToken) {
      return NextResponse.json(
        { status: 'expired', message: 'No auth token provided. Account session is missing.' }
      );
    }

    console.log('[VERIFY SESSION] Platform:', fantasyApp, 'Has token:', !!authToken, 'Token length:', authToken.length);

    // Use the TG API's list-of-teams endpoint as a lightweight session check.
    // We pass matchId=1 (or the provided one) just to validate the token.
    // If the token is valid, the API will return success (possibly with empty teams).
    // If the token is expired, the API will return an auth error.
    const checkMatchId = matchId || 1;

    try {
      const response = await fetch(`${TG_API_BASE}/fantasy/list-of-teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fantasyApp,
          matchId: typeof checkMatchId === 'string' ? parseInt(checkMatchId, 10) : checkMatchId,
          authToken,
        }),
        signal: AbortSignal.timeout(10000),
      });

      console.log('[VERIFY SESSION] TG API HTTP status:', response.status);

      let data: any;
      try {
        data = await response.json();
      } catch {
        // JSON parse failure — if HTTP was 401/403, it's expired
        if (response.status === 401 || response.status === 403) {
          console.log('[VERIFY SESSION] Token EXPIRED (HTTP', response.status, ')');
          return NextResponse.json({
            status: 'expired',
            message: 'Session token is expired or invalid. The platform rejected the authentication.',
          });
        }
        // Other non-parse responses — likely network/proxy issues
        console.log('[VERIFY SESSION] Token status UNKNOWN (parse error, HTTP', response.status, ')');
        return NextResponse.json({
          status: 'error',
          message: `Unable to verify session. API returned HTTP ${response.status} with non-JSON response.`,
        });
      }

      // Successful response — token is valid
      if (response.status === 200 && data.status === 'success') {
        console.log('[VERIFY SESSION] Token VALID — session is active');
        return NextResponse.json({
          status: 'valid',
          message: 'Session is active and valid.',
        });
      }

      // Auth-specific errors from the TG API
      // CRITICAL: Only mark as EXPIRED for true auth failures.
      // Rate-limit errors (429), server errors (5xx), and generic API errors
      // must NOT be treated as session expiry — they cause false SESSION EXPIRED
      // which blocks the user from proceeding.
      const msg = (data.message || '').toLowerCase();
      const isTrueAuthError =
        response.status === 401 ||
        response.status === 403 ||
        msg.includes('token expired') ||
        msg.includes('tokenexpired') ||
        msg.includes('unauthorized') ||
        msg.includes('re-login') ||
        msg.includes('relogin') ||
        (msg.includes('expire') && (msg.includes('token') || msg.includes('session')));

      if (isTrueAuthError) {
        console.log('[VERIFY SESSION] Token EXPIRED — API message:', data.message);
        return NextResponse.json({
          status: 'expired',
          message: data.message || 'Session token is expired. Please re-authenticate.',
        });
      }

      // Rate-limit — NOT an auth failure
      if (response.status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
        console.log('[VERIFY SESSION] Rate limited — NOT treating as expired. API message:', data.message);
        return NextResponse.json({
          status: 'error',
          message: 'Rate limited by platform. Cannot verify session right now.',
        });
      }

      // Other API errors (rate limit, server error, etc.) — don't assume expired
      console.log('[VERIFY SESSION] Token status UNCERTAIN — API returned error but not auth-related:', data.message);
      return NextResponse.json({
        status: 'error',
        message: data.message || `Unable to verify session (API returned: ${data.status}).`,
      });
    } catch (fetchError) {
      console.error('[VERIFY SESSION] TG API unreachable:', fetchError instanceof Error ? fetchError.message : 'unknown');
      return NextResponse.json({
        status: 'error',
        message: 'Backend API is unavailable. Cannot verify session right now.',
      });
    }
  } catch (error) {
    console.error('[VERIFY SESSION] Route error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { status: 'error', message: 'Failed to verify session.' },
      { status: 500 }
    );
  }
}
