// ============================================================
// JOIN CONTEST MODULE — Completely separate from Transfer
// ============================================================

import { TGPlayer, GeneratedTeam } from './tg-api';

// ============ Session Management ============

/**
 * Verify whether a platform session token is still valid.
 * Calls the verify-session API route which checks with the TG API.
 * Returns 'valid', 'expired', or 'error' (network/unknown).
 */
export async function verifySession(
  platform: string,
  authToken: string,
  matchId?: string | number,
): Promise<{ status: 'valid' | 'expired' | 'error'; message?: string }> {
  console.log('[JOIN CONTEST] Verifying session — Platform:', platform, 'Token length:', authToken?.length || 0);

  try {
    const res = await fetch('/api/fantasy/verify-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fantasyApp: platform,
        authToken,
        matchId: matchId || 1,
      }),
    });

    const data = await res.json();
    console.log('[JOIN CONTEST] Session verification result:', data.status);

    if (data.status === 'valid' || data.status === 'expired') {
      return { status: data.status, message: data.message };
    }

    // 'error' or unknown
    return { status: 'error', message: data.message || 'Unable to verify session.' };
  } catch (err) {
    console.error('[JOIN CONTEST] Session verification network error:', err instanceof Error ? err.message : 'unknown');
    return { status: 'error', message: 'Network error during session verification.' };
  }
}

/**
 * Initiate a session refresh by sending OTP to the stored mobile number.
 * Returns the OTP state needed to complete verification.
 * The CLIENT must collect the OTP from the user and call verify-otp.
 */
export async function initiateSessionRefresh(
  platform: string,
  mobileNumber: string,
): Promise<{
  success: boolean;
  state?: string | null;
  challenge?: string | null;
  reasonCode?: string | null;
  message?: string;
}> {
  console.log('[JOIN CONTEST] Initiating session refresh — Platform:', platform);

  try {
    const res = await fetch('/api/fantasy/refresh-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fantasyApp: platform,
        mobileNumber,
      }),
    });

    const data = await res.json();

    if (data.status === 'success') {
      console.log('[JOIN CONTEST] Session refresh OTP sent successfully');
      return {
        success: true,
        state: data.data?.state,
        challenge: data.data?.challenge,
        reasonCode: data.data?.reasonCode,
        message: data.data?.message,
      };
    }

    console.error('[JOIN CONTEST] Session refresh failed:', data.message);
    return { success: false, message: data.message || 'Failed to initiate session refresh.' };
  } catch (err) {
    console.error('[JOIN CONTEST] Session refresh network error:', err instanceof Error ? err.message : 'unknown');
    return { success: false, message: 'Network error during session refresh.' };
  }
}

/**
 * Complete a session refresh by verifying the OTP.
 * Returns the new auth token if successful.
 */
export async function completeSessionRefresh(
  platform: string,
  mobileNumber: string,
  otp: string,
  state?: string | null,
  challenge?: string | null,
  reasonCode?: string | null,
): Promise<{
  success: boolean;
  token?: string;
  my11circleChallenge?: string | null;
  my11circleUserId?: string | null;
  message?: string;
}> {
  console.log('[JOIN CONTEST] Completing session refresh — Platform:', platform);

  try {
    const payload: Record<string, unknown> = {
      fantasyApp: platform,
      mobileNumber,
      verificationCode: otp,
    };

    // Dream11 requires the 'state' from send-otp
    if (platform === 'dream11' && state) {
      payload.state = state;
    }

    // My11Circle requires challenge and reasonCode
    if (platform === 'my11circle') {
      if (challenge) payload.challenge = challenge;
      if (reasonCode) payload.reasonCode = reasonCode;
    }

    const res = await fetch('/api/fantasy/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (data.status === 'success' && data.data?.token) {
      console.log('[JOIN CONTEST] Session refresh COMPLETE — new token obtained');
      return {
        success: true,
        token: data.data.token,
        my11circleChallenge: data.data.my11circleChallenge || null,
        my11circleUserId: data.data.my11circleUserId || null,
        message: 'Session refreshed successfully.',
      };
    }

    console.error('[JOIN CONTEST] Session refresh verify failed:', data.message);
    return { success: false, message: data.message || 'OTP verification failed.' };
  } catch (err) {
    console.error('[JOIN CONTEST] Session refresh verify network error:', err instanceof Error ? err.message : 'unknown');
    return { success: false, message: 'Network error during OTP verification.' };
  }
}

// ============ Types ============

export interface JCMatch {
  id: string | number;
  left_team_name: string;
  right_team_name: string;
  match_time: string;
  sport_index: number;
  lineup_out: number;
  fantasy_list: string[];
}

export interface JCContest {
  id: string;
  contestId: string;       // REAL platform contest ID
  name: string;
  type: string;           // GL, SL, H2H, etc.
  entryFee: number;
  prizePool: number;
  totalSpots: number;
  filledSpots: number;
  remainingSpots: number;
  joinAvailable: boolean;
  maxTeamsPerUser?: number;
  matchId?: string;       // Platform match ID for validation
  platform?: string;      // Which platform this contest belongs to
}

/** Contest fetch result with proper error differentiation */
export interface JCContestFetchResult {
  contests: JCContest[];
  error?: string;
  errorType?: 'none' | 'auth' | 'network' | 'parse' | 'invalid_match' | 'api_fail';
  rawResponse?: unknown;   // For debug logging
  rawKeys?: string[];      // Top-level keys in the response for debugging
}

export interface JCTeam {
  id: string | number;         // Unique ID for selection tracking
  platformTeamId: string | number;  // REAL platform team ID for join API
  name: string;
  players: TGPlayer[];
  captain: TGPlayer;
  viceCaptain: TGPlayer;
  matchId?: string | number;
  platform?: string;           // Which platform this team belongs to
  accountId?: string;          // Which account this team belongs to
  playerCount?: number;        // Number of players in the team
}

export interface JCJoinItem {
  matchId: string | number;
  matchName: string;
  contestId: string;
  contestName: string;
  teamId: string | number;
  teamName: string;
  platform: string;
  status: 'pending' | 'processing' | 'success' | 'fail' | 'already_joined';
  message?: string;
}

export interface JCJoinResult {
  totalSelected: number;
  successCount: number;
  alreadyJoinedCount: number;
  failCount: number;
  items: JCJoinItem[];
}

export interface JCProgress {
  current: number;
  total: number;
  status: 'idle' | 'loading_contests' | 'joining' | 'done' | 'error';
  message?: string;
}

// ============ Duplicate Protection ============

/**
 * Build a unique key for match+contest+team combination
 * to prevent duplicate joins.
 */
export function getJoinKey(matchId: string | number, contestId: string, teamId: string | number): string {
  return `${matchId}::${contestId}::${teamId}`;
}

/**
 * Filter out duplicate join items (same match+contest+team).
 * Keeps the first occurrence, removes subsequent duplicates.
 */
export function deduplicateJoinItems(items: JCJoinItem[]): JCJoinItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = getJoinKey(item.matchId, item.contestId, item.teamId);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ============ Contest Helpers ============

/**
 * Parse contest data from TG API response into JCContest format.
 * Handles various field naming conventions from the API.
 */
export function parseContest(raw: Record<string, unknown>, platformMatchId?: string, platform?: string): JCContest {
  const totalSpots = (raw.totalSpots as number) || (raw.total_spots as number) || (raw.size as number) || (raw.totalSpot as number) || 0;
  const filledSpots = (raw.filledSpots as number) || (raw.filled_spots as number) || (raw.joined as number) || (raw.spot_filled as number) || 0;
  const contestId = String(raw.id || raw.contestId || raw.contest_id || raw._id || '');

  return {
    id: contestId,
    contestId,                                    // REAL platform contest ID
    name: String(raw.name || raw.contestName || raw.contest_name || raw.title || 'Contest'),
    type: String(raw.type || raw.contestType || raw.contest_type || 'GL'),
    entryFee: (raw.entryFee as number) || (raw.entry_fee as number) || (raw.entry as number) || (raw.joinAmount as number) || 0,
    prizePool: (raw.prizePool as number) || (raw.prize_pool as number) || (raw.prize as number) || (raw.winningAmount as number) || 0,
    totalSpots,
    filledSpots,
    remainingSpots: Math.max(0, totalSpots - filledSpots),
    joinAvailable: totalSpots === 0 || filledSpots < totalSpots,
    maxTeamsPerUser: (raw.maxTeamsPerUser as number) || (raw.max_teams as number) || (raw.maxTeamPerUser as number) || undefined,
    matchId: platformMatchId,
    platform,
  };
}

/**
 * Format entry fee / prize pool for display.
 */
export function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount}`;
}

/**
 * Get contest type badge color.
 */
export function getContestTypeColor(type: string): string {
  switch (type.toUpperCase()) {
    case 'GL': case 'MEGA': return 'bg-purple-100 text-purple-700';
    case 'SL': case 'SMALL': return 'bg-blue-100 text-blue-700';
    case 'H2H': case 'HEAD-TO-HEAD': return 'bg-orange-100 text-orange-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

/**
 * Normalize raw contest data from the TG API into JCContest[].
 * Handles various response structures from different platform APIs.
 *
 * The TG API may return contests in various nested structures:
 * - data.contests
 * - data.contest_list
 * - data.result
 * - data.data (nested)
 * - data.list
 * - or the data itself may be an array
 */
export function normalizeContests(
  rawData: unknown,
  platformMatchId?: string,
  platform?: string,
): { contests: JCContest[]; rawKeys: string[] } {
  const rawKeys: string[] = [];
  let contestArray: unknown[] | null = null;

  if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
    const obj = rawData as Record<string, unknown>;
    rawKeys.push(...Object.keys(obj));

    // Try known field names for contest arrays
    const arrayFields = [
      'contests', 'contest_list', 'contestList', 'list',
      'result', 'data', 'items', 'records',
    ];
    for (const field of arrayFields) {
      if (Array.isArray(obj[field])) {
        contestArray = obj[field] as unknown[];
        break;
      }
    }

    // If still not found, check if any value is an array of objects that look like contests
    if (!contestArray) {
      for (const [key, val] of Object.entries(obj)) {
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
          const sample = val[0] as Record<string, unknown>;
          // Heuristic: if it has any contest-like fields, treat as contests
          if (sample.id || sample.contestId || sample.contest_id || sample.name || sample.entryFee || sample.entry_fee) {
            contestArray = val as unknown[];
            break;
          }
        }
      }
    }
  } else if (Array.isArray(rawData)) {
    contestArray = rawData;
    rawKeys.push('(root array)');
  }

  if (!contestArray || contestArray.length === 0) {
    return { contests: [], rawKeys };
  }

  const contests: JCContest[] = [];
  for (const item of contestArray) {
    if (item && typeof item === 'object') {
      const contest = parseContest(item as Record<string, unknown>, platformMatchId, platform);
      // Only include contests that have a valid ID
      if (contest.id && contest.id !== '') {
        contests.push(contest);
      }
    }
  }

  return { contests, rawKeys };
}

/**
 * Fetch contests from the platform for a specific match.
 * Uses the platform-contests API route which calls Dream11/My11Circle directly.
 * The old list-contests route called a non-existent TG API endpoint (404).
 * Returns proper error differentiation instead of silently returning [].
 */
export async function getPlatformContests(
  platform: string,
  matchId: string | number,
  authToken: string,
  sportIndex?: number,
  challenge?: string,
): Promise<JCContestFetchResult> {
  // Ensure matchId is numeric — the platform APIs require numeric match IDs
  const numericMatchId = typeof matchId === 'string' ? parseInt(matchId, 10) : matchId;
  if (isNaN(numericMatchId) || numericMatchId <= 0) {
    console.error('[JOIN CONTEST] INVALID matchId:', matchId, 'Platform:', platform);
    return {
      contests: [],
      error: `Invalid match ID "${matchId}". A valid numeric platform match ID is required.`,
      errorType: 'invalid_match',
    };
  }

  console.log('[JOIN CONTEST] Fetching contests — Platform:', platform, 'Match ID:', numericMatchId, '(original:', matchId, ') Sport Index:', sportIndex);

  try {
    const res = await fetch('/api/fantasy/platform-contests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        matchId: numericMatchId,  // Always pass numeric matchId
        authToken,
        challenge,
      }),
    });

    console.log('[JOIN CONTEST] HTTP status:', res.status);

    // CRITICAL: HTTP 404 from our own API route — diagnose root cause
    if (res.status === 404) {
      console.error('[JOIN CONTEST] HTTP 404 from /api/fantasy/platform-contests! Platform:', platform, 'Match ID:', numericMatchId);
      return {
        contests: [],
        error: `Contest API returned HTTP 404. Platform: ${platform}, Match ID: ${numericMatchId}. The API route may be misconfigured or the platform API endpoint changed.`,
        errorType: 'api_fail',
      };
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return {
          contests: [],
          error: 'Session expired. Reconnect your account.',
          errorType: 'auth',
        };
      }
      return {
        contests: [],
        error: `API error (HTTP ${res.status}). Platform: ${platform}, Match ID: ${numericMatchId}.`,
        errorType: 'api_fail',
      };
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      return {
        contests: [],
        error: 'Invalid response from server.',
        errorType: 'parse',
      };
    }

    console.log('[JOIN CONTEST] API response status:', data.status);
    console.log('[JOIN CONTEST] Response data:', data.data ? `contests: ${data.data.contestCount}` : 'no data');
    if (data._debug) {
      console.log('[JOIN CONTEST] Debug info:', JSON.stringify(data._debug));
    }

    // API-level HTTP 404 from the platform — NEVER silently convert to empty
    if (data.httpStatus === 404 || data.errorType === 'http_404') {
      console.error('[JOIN CONTEST] Platform returned HTTP 404! Debug:', JSON.stringify(data._debug));
      return {
        contests: [],
        error: data.message || `Platform ${platform} returned HTTP 404 for match ID ${numericMatchId}. This could mean: (1) Invalid match ID, (2) Match not available on ${platform}, (3) Contest API endpoint changed.`,
        errorType: 'api_fail',
        rawResponse: data,
      };
    }

    // API-level auth/token error
    if (data.tokenExpired || data.status === 'token_expired') {
      return {
        contests: [],
        error: data.message || 'Session expired. Reconnect your account.',
        errorType: 'auth',
        rawResponse: data,
      };
    }

    // API-level failure
    if (data.status === 'fail' || data.status === 'error') {
      const msg = data.message || 'Failed to load contests.';
      if (msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('token') || msg.toLowerCase().includes('expire') || msg.toLowerCase().includes('session') || msg.toLowerCase().includes('reconnect')) {
        return {
          contests: [],
          error: msg,
          errorType: 'auth',
          rawResponse: data,
        };
      }
      return {
        contests: [],
        error: msg,
        errorType: 'api_fail',
        rawResponse: data,
      };
    }

    // Success — convert platform contests to JCContest format
    if (data.status === 'success' && data.data?.contests) {
      const platformContests = data.data.contests as Record<string, unknown>[];
      const contests: JCContest[] = platformContests.map((c) => {
        const contest = parseContest(c, String(numericMatchId), platform);
        return contest;
      });

      console.log('[JOIN CONTEST] Contests loaded:', contests.length);
      if (contests.length === 0 && platformContests.length > 0) {
        console.log('[JOIN CONTEST] WARNING: 0 contests after parsing from', platformContests.length, 'raw items');
      }

      return {
        contests,
        errorType: 'none',
        rawResponse: data,
        rawKeys: Object.keys(data.data),
      };
    }

    // Unknown response format
    console.log('[JOIN CONTEST] Unexpected response:', JSON.stringify(data, null, 2).slice(0, 300));
    return {
      contests: [],
      error: 'Unexpected response format from contest API.',
      errorType: 'parse',
      rawResponse: data,
    };
  } catch (err) {
    console.error('[JOIN CONTEST] Network error:', err instanceof Error ? err.message : 'unknown');
    return {
      contests: [],
      error: 'Network error. Please check your connection and try again.',
      errorType: 'network',
    };
  }
}

// ============ Team Helpers ============

/**
 * Fetch existing teams from the platform for a given match.
 * Uses the list-of-teams API — does NOT create/transfer any teams.
 * Returns teams with their REAL platform team IDs.
 */
export async function getExistingPlatformTeams(
  platform: string,
  matchId: string | number,
  authToken: string,
): Promise<{ teams: JCTeam[]; error?: string; tokenExpired?: boolean }> {
  try {
    const res = await fetch('/api/fantasy/list-of-teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fantasyApp: platform,
        matchId,
        authToken,
      }),
    });

    const data = await res.json();

    if (data.status === 'success' && data.data?.teamsList) {
      const teams: JCTeam[] = (data.data.teamsList as Record<string, unknown>[]).map((t, i) => {
        const teamId = (t.id as string | number) || (t._id as string | number) || i + 1;
        return {
          id: teamId,
          platformTeamId: teamId,  // REAL platform team ID
          name: (t.name as string) || `Team ${i + 1}`,
          players: [],              // Platform doesn't return full player list in list-of-teams
          captain: { name: String(t.captain || ''), pl_id: 0, fantasy_id_list: [] } as unknown as TGPlayer,
          viceCaptain: { name: String(t.vice_captain || t.viceCaptain || ''), pl_id: 0, fantasy_id_list: [] } as unknown as TGPlayer,
          matchId,
          platform,
          playerCount: (t.players as number) || (t.player_count as number) || (t.totalPlayers as number) || 11,
        };
      });
      return { teams };
    }

    // Token expired
    if (data.tokenExpired) {
      return { teams: [], error: 'Session expired. Reconnect your account.', tokenExpired: true };
    }

    return { teams: [], error: data.message || 'Failed to load teams' };
  } catch {
    return { teams: [], error: 'Network error. Please try again.' };
  }
}

/**
 * Convert GeneratedTeam to JCTeam format.
 * NOTE: This is kept for backward compatibility but should NOT be used
 * for Join Contest — use getExistingPlatformTeams() instead.
 */
export function generatedTeamToJCTeam(
  team: GeneratedTeam,
  index: number,
  matchId?: string | number,
): JCTeam {
  return {
    id: `gen-${index}`,
    platformTeamId: `gen-${index}`,
    name: `Team ${index + 1}`,
    players: team.players,
    captain: team.captain,
    viceCaptain: team.viceCaptain,
    matchId,
  };
}

/**
 * Build all join items from user selections.
 * Maps selected teams × selected contests for each match.
 */
export function buildJoinItems(
  selectedMatches: JCMatch[],
  selectedContests: Map<string, JCContest[]>,   // matchId → contests
  selectedTeamIds: Set<string | number>,
  allTeams: JCTeam[],
  platform: string,
): JCJoinItem[] {
  const items: JCJoinItem[] = [];

  for (const match of selectedMatches) {
    const matchId = match.id;
    const matchName = `${match.left_team_name} vs ${match.right_team_name}`;
    const contests = selectedContests.get(String(matchId)) || [];
    const teamsForMatch = allTeams.filter(t =>
      selectedTeamIds.has(t.id) && String(t.matchId) === String(matchId)
    );

    for (const contest of contests) {
      for (const team of teamsForMatch) {
        items.push({
          matchId,
          matchName,
          contestId: contest.id,
          contestName: contest.name,
          teamId: team.platformTeamId,  // Use REAL platform team ID for join
          teamName: team.name,
          platform: team.platform || platform,
          status: 'pending',
        });
      }
    }
  }

  return deduplicateJoinItems(items);
}
