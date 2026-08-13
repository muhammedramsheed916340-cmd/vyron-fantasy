// ============================================================
// PLATFORM CONTEST API — Direct platform API calls for contests
// The TG API does NOT have list-contests or join-contest endpoints.
// We call the platform APIs directly using the auth token from verify-otp.
//
// ARCHITECTURE:
//   TG API (proxy) has: matches, verify-otp, list-of-teams, add-team, edit-team
//   TG API does NOT have: list-contests, join-contest (HTTP 404)
//   So we call Dream11/My11Circle APIs directly with the platform session token.
//
// The CONTEST_JWT_TOKEN from .env is passed as an additional auth header
// for future TG API support (if they add contest endpoints).
// ============================================================

const DREAM11_API_BASE = 'https://api.dream11.com';
const MY11CIRCLE_API_BASE = 'https://www.my11circle.com';

// ============ Types ============

export interface PlatformContestResult {
  contests: PlatformContest[];
  error?: string;
  errorType?: 'none' | 'auth' | 'network' | 'parse' | 'api_fail' | 'not_supported' | 'http_404';
  rawResponse?: unknown;
  /** Diagnostic info for 404/418 debugging */
  _debug?: {
    platform: string;
    matchId: string | number;
    endpoint: string;
    httpStatus: number;
    responsePreview: string;
  };
}

export interface PlatformContest {
  id: string;
  name: string;
  entryFee: number;
  prizePool: number;
  totalSpots: number;
  filledSpots: number;
  remainingSpots: number;
  joinable: boolean;
  matchId: string;
  platform: string;
  /** Raw contest data for additional fields */
  _raw?: Record<string, unknown>;
}

export interface PlatformJoinResult {
  success: boolean;
  alreadyJoined?: boolean;
  message?: string;
  errorType?: 'none' | 'auth' | 'network' | 'api_fail' | 'not_supported';
}

// ============ Dream11 Contest API ============

/**
 * Fetch contests from Dream11 for a specific match.
 * Uses the auth token from verify-otp as a session token.
 *
 * Dream11 API endpoints (tried in order):
 * 1. GET /1/contest/category/m/{matchId}  — Contest categories with nested contests
 * 2. GET /1/contest/list?matchId={id}     — Direct contest list
 *
 * The auth token is passed as both a cookie and Authorization header.
 * Dream11 uses cookie-based sessions but also accepts Bearer tokens.
 *
 * IMPORTANT: Dream11 returns HTTP 418 ("I'm a teapot") for server-side
 * requests without a valid active session. The user MUST have connected
 * their Dream11 account (verify-otp) and the session MUST be valid.
 */
async function fetchDream11Contests(
  matchId: string | number,
  authToken: string,
  contestJwtToken?: string,
): Promise<PlatformContestResult> {
  const numericMatchId = typeof matchId === 'string' ? parseInt(matchId, 10) : matchId;
  console.log('[PLATFORM CONTEST] Dream11 — Match ID:', numericMatchId, '(original:', matchId, ')');

  // Common headers for Dream11 API
  const dream11Headers: Record<string, string> = {
    'User-Agent': 'Dream11/8.29.0 (Android 12; SM-G991B)',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'x-platform': 'android',
    'x-app-ver': '8.29.0',
    'x-lang': 'en',
    // Pass auth token as both cookie and bearer (Dream11 supports both)
    'Cookie': `sid=${authToken}`,
    'Authorization': `Bearer ${authToken}`,
  };

  // Add CONTEST_JWT_TOKEN if available (for future TG API support)
  if (contestJwtToken) {
    dream11Headers['x-contest-token'] = contestJwtToken;
  }

  try {
    // Strategy 1: Fetch contest categories for the match
    const categoryUrl = `${DREAM11_API_BASE}/1/contest/category/m/${numericMatchId}`;
    console.log('[PLATFORM CONTEST] Dream11 strategy 1 (category):', categoryUrl);

    const categoryResponse = await fetch(categoryUrl, {
      method: 'GET',
      headers: dream11Headers,
      signal: AbortSignal.timeout(15000),
    });

    console.log('[PLATFORM CONTEST] Dream11 category HTTP:', categoryResponse.status);

    // Handle specific HTTP status codes
    if (categoryResponse.status === 418) {
      // Dream11 anti-bot — need valid session token from verify-otp
      const debugInfo = {
        platform: 'dream11',
        matchId: numericMatchId,
        endpoint: categoryUrl,
        httpStatus: 418,
        responsePreview: 'I\'m a teapot — Dream11 anti-bot protection',
      };
      console.error('[PLATFORM CONTEST] Dream11 418 — Anti-bot. Platform: dream11, Match ID:', numericMatchId, 'Endpoint:', categoryUrl);
      return {
        contests: [],
        error: 'Dream11 requires a valid active session. Please reconnect your Dream11 account (Send OTP → Verify OTP) and try again. Dream11 blocks server-side requests without proper authentication.',
        errorType: 'auth',
        _debug: debugInfo,
      };
    }

    if (categoryResponse.status === 401 || categoryResponse.status === 403) {
      const debugInfo = {
        platform: 'dream11',
        matchId: numericMatchId,
        endpoint: categoryUrl,
        httpStatus: categoryResponse.status,
        responsePreview: 'Auth failed — session expired or invalid',
      };
      console.error('[PLATFORM CONTEST] Dream11 auth fail:', categoryResponse.status, 'Match ID:', numericMatchId);
      return {
        contests: [],
        error: 'Dream11 session expired or invalid. Please reconnect your account.',
        errorType: 'auth',
        _debug: debugInfo,
      };
    }

    if (categoryResponse.status === 404) {
      // HTTP 404 — either wrong endpoint or wrong matchId
      const body = await categoryResponse.text().catch(() => '');
      const debugInfo = {
        platform: 'dream11',
        matchId: numericMatchId,
        endpoint: categoryUrl,
        httpStatus: 404,
        responsePreview: body.slice(0, 200),
      };
      console.error('[PLATFORM CONTEST] Dream11 HTTP 404! Platform: dream11, Match ID:', numericMatchId, 'Endpoint:', categoryUrl, 'Response:', body.slice(0, 200));

      // Try strategy 2: direct contest list
      console.log('[PLATFORM CONTEST] Dream11 strategy 1 got 404, trying strategy 2...');
      const listUrl = `${DREAM11_API_BASE}/1/contest/list?matchId=${numericMatchId}`;
      const listResponse = await fetch(listUrl, {
        method: 'GET',
        headers: dream11Headers,
        signal: AbortSignal.timeout(15000),
      });

      console.log('[PLATFORM CONTEST] Dream11 strategy 2 (list) HTTP:', listResponse.status);

      if (listResponse.status === 418 || listResponse.status === 401 || listResponse.status === 403) {
        return {
          contests: [],
          error: 'Dream11 session expired. Please reconnect your account.',
          errorType: 'auth',
          _debug: debugInfo,
        };
      }

      if (listResponse.ok) {
        let listData: any;
        try {
          listData = await listResponse.json();
        } catch {
          return {
            contests: [],
            error: 'Failed to parse Dream11 contest list response.',
            errorType: 'parse',
            _debug: debugInfo,
          };
        }

        const contests = normalizeDream11Contests(listData, String(numericMatchId));
        console.log('[PLATFORM CONTEST] Dream11 strategy 2 normalized contests:', contests.length);

        if (contests.length > 0) {
          return { contests, errorType: 'none', rawResponse: listData };
        }
      }

      // Both strategies failed
      return {
        contests: [],
        error: `Dream11 returned HTTP 404 for match ID ${numericMatchId}. This could mean: (1) Invalid match ID, (2) Match not available on Dream11, (3) Contest data not yet available. Verify the match is live on Dream11.`,
        errorType: 'http_404',
        _debug: debugInfo,
      };
    }

    if (!categoryResponse.ok) {
      const body = await categoryResponse.text().catch(() => '');
      const debugInfo = {
        platform: 'dream11',
        matchId: numericMatchId,
        endpoint: categoryUrl,
        httpStatus: categoryResponse.status,
        responsePreview: body.slice(0, 200),
      };
      console.error('[PLATFORM CONTEST] Dream11 error:', categoryResponse.status, body.slice(0, 200));
      return {
        contests: [],
        error: `Dream11 API error (HTTP ${categoryResponse.status}). Platform: dream11, Match ID: ${numericMatchId}, Endpoint: ${categoryUrl}`,
        errorType: 'api_fail',
        _debug: debugInfo,
      };
    }

    let categoryData: any;
    try {
      categoryData = await categoryResponse.json();
    } catch {
      return {
        contests: [],
        error: 'Failed to parse Dream11 contest category response.',
        errorType: 'parse',
      };
    }

    console.log('[PLATFORM CONTEST] Dream11 category response keys:', Object.keys(categoryData));

    // Extract contests from the response
    const contests = normalizeDream11Contests(categoryData, String(numericMatchId));

    console.log('[PLATFORM CONTEST] Dream11 normalized contests:', contests.length);
    if (contests.length === 0) {
      console.log('[PLATFORM CONTEST] Dream11 raw response structure:', JSON.stringify(categoryData, null, 2).slice(0, 500));
    }

    return {
      contests,
      errorType: contests.length === 0 ? undefined : 'none',
      rawResponse: categoryData,
    };
  } catch (err) {
    console.error('[PLATFORM CONTEST] Dream11 network error:', err instanceof Error ? err.message : 'unknown');
    return {
      contests: [],
      error: `Network error connecting to Dream11. Match ID: ${matchId}. ${err instanceof Error ? err.message : 'Unknown error'}`,
      errorType: 'network',
    };
  }
}

/**
 * Normalize Dream11 contest data into our standard format.
 * Handles various response structures from the Dream11 API.
 */
function normalizeDream11Contests(data: any, matchId: string): PlatformContest[] {
  const contests: PlatformContest[] = [];

  if (!data || typeof data !== 'object') return contests;

  // Try to find contest arrays in the response
  let contestArrays: any[][] = [];

  // Direct array
  if (Array.isArray(data)) {
    contestArrays.push(data);
  }

  // Common field names that might contain contest arrays
  const arrayFields = ['contests', 'contestList', 'contest_list', 'data', 'result', 'items', 'categories'];
  for (const field of arrayFields) {
    if (Array.isArray(data[field])) {
      contestArrays.push(data[field]);
    }
  }

  // Categories with nested contests
  if (Array.isArray(data.categories)) {
    for (const cat of data.categories) {
      if (cat && typeof cat === 'object') {
        for (const key of ['contests', 'contestList', 'list', 'challengeList', 'challenges']) {
          if (Array.isArray(cat[key])) {
            contestArrays.push(cat[key]);
          }
        }
      }
    }
  }

  // Heuristic: find any array of objects that look like contests
  if (contestArrays.length === 0) {
    for (const [key, val] of Object.entries(data)) {
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
        const sample = val[0];
        if (sample.contestId || sample.contest_id || sample.id || sample.entryFee || sample.prizePool || sample.challengeId) {
          contestArrays.push(val);
        }
      }
    }
  }

  // Normalize each contest
  for (const arr of contestArrays) {
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const contest = parsePlatformContest(item, matchId, 'dream11');
      if (contest.id) contests.push(contest);
    }
  }

  // Deduplicate by ID
  const seen = new Set<string>();
  return contests.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

// ============ My11Circle Contest API ============

/**
 * Fetch contests from My11Circle for a specific match.
 * Uses the auth token and challenge from verify-otp.
 *
 * My11Circle contest endpoints (tried in order):
 * 1. POST /api/contest/get-contest-list  — Standard contest listing
 * 2. GET  /api/contest/list?matchId={id}  — Alternative format
 *
 * The auth token is passed as both a cookie and Authorization header.
 */
async function fetchMy11CircleContests(
  matchId: string | number,
  authToken: string,
  challenge?: string,
  contestJwtToken?: string,
): Promise<PlatformContestResult> {
  const numericMatchId = typeof matchId === 'string' ? parseInt(matchId, 10) : matchId;
  console.log('[PLATFORM CONTEST] My11Circle — Match ID:', numericMatchId, '(original:', matchId, ')');

  try {
    // Strategy 1: POST to get-contest-list (standard My11Circle API)
    const url = `${MY11CIRCLE_API_BASE}/api/contest/get-contest-list`;
    console.log('[PLATFORM CONTEST] My11Circle strategy 1 URL:', url);

    const payload: Record<string, unknown> = {
      matchId: numericMatchId,
      authToken,
    };
    if (challenge) {
      payload.challenge = challenge;
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Cookie': `token=${authToken}`,
      'Authorization': `Bearer ${authToken}`,
    };

    if (contestJwtToken) {
      headers['x-contest-token'] = contestJwtToken;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    console.log('[PLATFORM CONTEST] My11Circle HTTP:', response.status);

    if (response.status === 401 || response.status === 403) {
      const debugInfo = {
        platform: 'my11circle',
        matchId: numericMatchId,
        endpoint: url,
        httpStatus: response.status,
        responsePreview: 'Auth failed',
      };
      console.error('[PLATFORM CONTEST] My11Circle auth fail:', response.status, 'Match ID:', numericMatchId);
      return {
        contests: [],
        error: 'My11Circle session expired. Please reconnect your account.',
        errorType: 'auth',
        _debug: debugInfo,
      };
    }

    if (response.status === 404) {
      // HTTP 404 — either wrong endpoint or wrong matchId
      const body = await response.text().catch(() => '');
      const debugInfo = {
        platform: 'my11circle',
        matchId: numericMatchId,
        endpoint: url,
        httpStatus: 404,
        responsePreview: body.slice(0, 200),
      };
      console.error('[PLATFORM CONTEST] My11Circle HTTP 404! Platform: my11circle, Match ID:', numericMatchId, 'Endpoint:', url, 'Response:', body.slice(0, 200));

      // Try strategy 2: GET contest list
      const altUrl = `${MY11CIRCLE_API_BASE}/api/contest/list?matchId=${numericMatchId}`;
      console.log('[PLATFORM CONTEST] My11Circle strategy 2:', altUrl);

      const altResponse = await fetch(altUrl, {
        method: 'GET',
        headers: {
          ...headers,
          'Content-Type': undefined as any, // Remove for GET
        },
        signal: AbortSignal.timeout(15000),
      });

      console.log('[PLATFORM CONTEST] My11Circle strategy 2 HTTP:', altResponse.status);

      if (altResponse.ok) {
        let altData: any;
        try { altData = await altResponse.json(); } catch { /* parse fail */ }

        if (altData) {
          const contests = normalizeMy11CircleContests(altData, String(numericMatchId));
          if (contests.length > 0) {
            return { contests, errorType: 'none', rawResponse: altData };
          }
        }
      }

      return {
        contests: [],
        error: `My11Circle returned HTTP 404 for match ID ${numericMatchId}. This could mean: (1) Invalid match ID, (2) Match not available on My11Circle, (3) Contest API endpoint changed. Verify the match is live on My11Circle.`,
        errorType: 'http_404',
        _debug: debugInfo,
      };
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const debugInfo = {
        platform: 'my11circle',
        matchId: numericMatchId,
        endpoint: url,
        httpStatus: response.status,
        responsePreview: body.slice(0, 200),
      };
      console.error('[PLATFORM CONTEST] My11Circle error:', response.status, body.slice(0, 200));
      return {
        contests: [],
        error: `My11Circle API error (HTTP ${response.status}). Platform: my11circle, Match ID: ${numericMatchId}, Endpoint: ${url}`,
        errorType: 'api_fail',
        _debug: debugInfo,
      };
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      return {
        contests: [],
        error: 'Failed to parse My11Circle contest response.',
        errorType: 'parse',
      };
    }

    console.log('[PLATFORM CONTEST] My11Circle response keys:', Object.keys(data));

    const contests = normalizeMy11CircleContests(data, String(numericMatchId));
    console.log('[PLATFORM CONTEST] My11Circle normalized contests:', contests.length);

    if (contests.length === 0) {
      console.log('[PLATFORM CONTEST] My11Circle raw response:', JSON.stringify(data, null, 2).slice(0, 500));
    }

    return {
      contests,
      errorType: contests.length === 0 ? undefined : 'none',
      rawResponse: data,
    };
  } catch (err) {
    console.error('[PLATFORM CONTEST] My11Circle network error:', err instanceof Error ? err.message : 'unknown');
    return {
      contests: [],
      error: `Network error connecting to My11Circle. Match ID: ${matchId}. ${err instanceof Error ? err.message : 'Unknown error'}`,
      errorType: 'network',
    };
  }
}

/**
 * Normalize My11Circle contest data into our standard format.
 */
function normalizeMy11CircleContests(data: any, matchId: string): PlatformContest[] {
  const contests: PlatformContest[] = [];
  if (!data || typeof data !== 'object') return contests;

  let contestArrays: any[][] = [];

  if (Array.isArray(data)) {
    contestArrays.push(data);
  }

  const arrayFields = ['contests', 'contestList', 'contest_list', 'data', 'result', 'items', 'challengeList', 'challenges'];
  for (const field of arrayFields) {
    if (Array.isArray(data[field])) {
      contestArrays.push(data[field]);
    }
  }

  // Heuristic
  if (contestArrays.length === 0) {
    for (const [key, val] of Object.entries(data)) {
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
        const sample = val[0];
        if (sample.contestId || sample.contest_id || sample.id || sample.entryFee || sample.challengeId) {
          contestArrays.push(val);
        }
      }
    }
  }

  for (const arr of contestArrays) {
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const contest = parsePlatformContest(item, matchId, 'my11circle');
      if (contest.id) contests.push(contest);
    }
  }

  const seen = new Set<string>();
  return contests.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

// ============ Common Parser ============

/**
 * Parse a single contest from platform response into our standard format.
 * Handles various field naming conventions from Dream11 and My11Circle.
 *
 * IMPORTANT: Preserves the REAL platform contest ID — never generates fake IDs.
 */
function parsePlatformContest(raw: Record<string, unknown>, matchId: string, platform: string): PlatformContest {
  const totalSpots = (raw.totalSpots as number) || (raw.total_spots as number) || (raw.size as number) || (raw.totalSpot as number) || (raw.maxTeam as number) || (raw.maximumSpot as number) || 0;
  const filledSpots = (raw.filledSpots as number) || (raw.filled_spots as number) || (raw.joined as number) || (raw.spot_filled as number) || (raw.totalJoined as number) || (raw.spotFilled as number) || 0;
  // REAL platform contest ID — never fake
  const id = String(raw.id || raw.contestId || raw.contest_id || raw.challengeId || raw.challenge_id || raw._id || '');

  return {
    id,
    name: String(raw.name || raw.contestName || raw.contest_name || raw.challengeName || raw.challenge_name || raw.title || 'Contest'),
    entryFee: (raw.entryFee as number) || (raw.entry_fee as number) || (raw.entry as number) || (raw.joinAmount as number) || (raw.buyIn as number) || (raw.joiningAmount as number) || 0,
    prizePool: (raw.prizePool as number) || (raw.prize_pool as number) || (raw.prize as number) || (raw.winningAmount as number) || (raw.totalWinnings as number) || (raw.totalPrize as number) || 0,
    totalSpots,
    filledSpots,
    remainingSpots: Math.max(0, totalSpots - filledSpots),
    joinable: totalSpots === 0 || filledSpots < totalSpots,
    matchId,
    platform,
    _raw: raw,
  };
}

// ============ Main Export ============

/**
 * Fetch contests from the platform for a specific match.
 * Routes to the correct platform-specific implementation.
 *
 * Since the TG API does NOT have list-contests (returns HTTP 404),
 * we call the platform APIs directly with the session token from verify-otp.
 *
 * The CONTEST_JWT_TOKEN from .env is passed as an additional auth header
 * for future TG API contest endpoint support.
 */
export async function fetchPlatformContests(
  platform: string,
  matchId: string | number,
  authToken: string,
  challenge?: string,
  contestJwtToken?: string,
): Promise<PlatformContestResult> {
  const numericMatchId = typeof matchId === 'string' ? parseInt(matchId, 10) : matchId;
  console.log('[PLATFORM CONTEST] Fetching — Platform:', platform, 'Match ID:', numericMatchId, '(original:', matchId, ')');

  // Validate matchId — must be a positive number
  if (!matchId || numericMatchId <= 0 || isNaN(numericMatchId)) {
    console.error('[PLATFORM CONTEST] INVALID matchId:', matchId, 'Platform:', platform);
    return {
      contests: [],
      error: `Invalid match ID "${matchId}". A valid numeric platform match ID is required.`,
      errorType: 'api_fail',
      _debug: {
        platform,
        matchId: String(matchId),
        endpoint: 'N/A',
        httpStatus: 0,
        responsePreview: 'Invalid matchId — not a positive number',
      },
    };
  }

  switch (platform.toLowerCase()) {
    case 'dream11':
      return fetchDream11Contests(numericMatchId, authToken, contestJwtToken);
    case 'my11circle':
      return fetchMy11CircleContests(numericMatchId, authToken, challenge, contestJwtToken);
    default:
      return {
        contests: [],
        error: `Contest listing is not supported for platform "${platform}". Supported: Dream11, My11Circle.`,
        errorType: 'not_supported',
      };
  }
}

/**
 * Join a contest on the platform using an existing team.
 * Calls the platform's join-contest API directly.
 *
 * IMPORTANT: Sends REAL platformTeamId, platformContestId, platformMatchId, accountId.
 * Never sends generated team data.
 *
 * Since the TG API does NOT have join-contest (returns HTTP 404),
 * we call the platform APIs directly.
 */
export async function joinPlatformContest(
  platform: string,
  matchId: string | number,
  authToken: string,
  teamId: string | number,
  contestId: string,
  challenge?: string,
  contestJwtToken?: string,
): Promise<PlatformJoinResult> {
  const numericMatchId = typeof matchId === 'string' ? parseInt(matchId, 10) : matchId;
  console.log('[PLATFORM CONTEST] Join — Platform:', platform, 'Match:', numericMatchId, 'Team:', teamId, 'Contest:', contestId);

  switch (platform.toLowerCase()) {
    case 'dream11':
      return joinDream11Contest(numericMatchId, authToken, teamId, contestId, contestJwtToken);
    case 'my11circle':
      return joinMy11CircleContest(numericMatchId, authToken, teamId, contestId, challenge, contestJwtToken);
    default:
      return {
        success: false,
        message: `Contest joining is not supported for platform "${platform}".`,
        errorType: 'not_supported',
      };
  }
}

async function joinDream11Contest(
  matchId: number,
  authToken: string,
  teamId: string | number,
  contestId: string,
  contestJwtToken?: string,
): Promise<PlatformJoinResult> {
  try {
    const url = `${DREAM11_API_BASE}/1/contest/join`;
    const headers: Record<string, string> = {
      'User-Agent': 'Dream11/8.29.0 (Android 12; SM-G991B)',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'x-platform': 'android',
      'x-app-ver': '8.29.0',
      'x-lang': 'en',
      'Cookie': `sid=${authToken}`,
      'Authorization': `Bearer ${authToken}`,
    };
    if (contestJwtToken) {
      headers['x-contest-token'] = contestJwtToken;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        matchId,
        teamId: typeof teamId === 'string' ? parseInt(teamId, 10) : teamId,
        contestId,
      }),
      signal: AbortSignal.timeout(15000),
    });

    console.log('[PLATFORM CONTEST] Dream11 join HTTP:', response.status);

    if (response.status === 418) {
      return { success: false, message: 'Dream11 API blocked. Reconnect your account.', errorType: 'auth' };
    }
    if (response.status === 401 || response.status === 403) {
      return { success: false, message: 'Session expired. Reconnect your account.', errorType: 'auth' };
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      return { success: false, message: `Join failed (HTTP ${response.status}).`, errorType: 'api_fail' };
    }

    if (data.status === 'success') {
      return { success: true, message: data.message || 'Contest joined successfully.' };
    }

    // Already joined detection
    const msg = data.message || '';
    if (/already.*join|already.*entered|already.*participat/i.test(msg)) {
      return { success: false, alreadyJoined: true, message: msg };
    }

    return { success: false, message: msg || 'Join failed.', errorType: 'api_fail' };
  } catch (err) {
    console.error('[PLATFORM CONTEST] Dream11 join error:', err instanceof Error ? err.message : 'unknown');
    return { success: false, message: 'Network error.', errorType: 'network' };
  }
}

async function joinMy11CircleContest(
  matchId: number,
  authToken: string,
  teamId: string | number,
  contestId: string,
  challenge?: string,
  contestJwtToken?: string,
): Promise<PlatformJoinResult> {
  try {
    const url = `${MY11CIRCLE_API_BASE}/api/contest/join`;
    const payload: Record<string, unknown> = {
      matchId,
      authToken,
      teamId: typeof teamId === 'string' ? parseInt(teamId, 10) : teamId,
      contestId,
    };
    if (challenge) payload.challenge = challenge;

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Cookie': `token=${authToken}`,
      'Authorization': `Bearer ${authToken}`,
    };
    if (contestJwtToken) {
      headers['x-contest-token'] = contestJwtToken;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    console.log('[PLATFORM CONTEST] My11Circle join HTTP:', response.status);

    if (response.status === 401 || response.status === 403) {
      return { success: false, message: 'Session expired. Reconnect your account.', errorType: 'auth' };
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      return { success: false, message: `Join failed (HTTP ${response.status}).`, errorType: 'api_fail' };
    }

    if (data.status === 'success') {
      return { success: true, message: data.message || 'Contest joined successfully.' };
    }

    const msg = data.message || '';
    if (/already.*join|already.*entered|already.*participat/i.test(msg)) {
      return { success: false, alreadyJoined: true, message: msg };
    }

    return { success: false, message: msg || 'Join failed.', errorType: 'api_fail' };
  } catch (err) {
    console.error('[PLATFORM CONTEST] My11Circle join error:', err instanceof Error ? err.message : 'unknown');
    return { success: false, message: 'Network error.', errorType: 'network' };
  }
}
