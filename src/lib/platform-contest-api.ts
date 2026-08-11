// ============================================================
// PLATFORM CONTEST API — Direct platform API calls for contests
// The TG API does NOT have list-contests or join-contest endpoints.
// We call the platform APIs directly using the auth token from verify-otp.
// ============================================================

const DREAM11_API_BASE = 'https://api.dream11.com';
const MY11CIRCLE_API_BASE = 'https://www.my11circle.com';

// ============ Types ============

export interface PlatformContestResult {
  contests: PlatformContest[];
  error?: string;
  errorType?: 'none' | 'auth' | 'network' | 'parse' | 'api_fail' | 'not_supported';
  rawResponse?: unknown;
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
 * Dream11 API endpoints:
 * - Contest categories: GET /1/contest/category/m/{matchId}
 * - Contests in category: GET /1/contest/list?matchId={id}&categoryId={catId}
 *
 * The auth token is passed as a cookie (Dream11 uses cookie-based sessions).
 */
async function fetchDream11Contests(
  matchId: string | number,
  authToken: string,
): Promise<PlatformContestResult> {
  console.log('[PLATFORM CONTEST] Dream11 — Match ID:', matchId);

  try {
    // Step 1: Fetch contest categories for the match
    const categoryUrl = `${DREAM11_API_BASE}/1/contest/category/m/${matchId}`;
    console.log('[PLATFORM CONTEST] Dream11 category URL:', categoryUrl);

    const categoryResponse = await fetch(categoryUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Dream11/8.29.0 (Android 12; SM-G991B)',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-platform': 'android',
        'x-app-ver': '8.29.0',
        'x-lang': 'en',
        // Pass auth token as cookie (Dream11 session format)
        'Cookie': `sid=${authToken}`,
        'Authorization': `Bearer ${authToken}`,
      },
      signal: AbortSignal.timeout(15000),
    });

    console.log('[PLATFORM CONTEST] Dream11 category HTTP:', categoryResponse.status);

    if (categoryResponse.status === 418) {
      // Dream11 anti-bot — need valid session token
      return {
        contests: [],
        error: 'Dream11 API requires a valid active session. Your session may have expired or the API is blocking server-side requests. Try reconnecting your account.',
        errorType: 'auth',
      };
    }

    if (categoryResponse.status === 401 || categoryResponse.status === 403) {
      return {
        contests: [],
        error: 'Dream11 session expired. Please reconnect your account.',
        errorType: 'auth',
      };
    }

    if (!categoryResponse.ok) {
      const body = await categoryResponse.text().catch(() => '');
      console.error('[PLATFORM CONTEST] Dream11 category error:', categoryResponse.status, body.slice(0, 200));
      return {
        contests: [],
        error: `Dream11 API error (HTTP ${categoryResponse.status}).`,
        errorType: 'api_fail',
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

    // Step 2: Extract contests from the response
    // The response may contain categories with contest lists, or direct contest list
    const contests = normalizeDream11Contests(categoryData, String(matchId));

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
      error: 'Network error connecting to Dream11.',
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
        for (const key of ['contests', 'contestList', 'list']) {
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
        if (sample.contestId || sample.contest_id || sample.id || sample.entryFee || sample.prizePool) {
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
 */
async function fetchMy11CircleContests(
  matchId: string | number,
  authToken: string,
  challenge?: string,
): Promise<PlatformContestResult> {
  console.log('[PLATFORM CONTEST] My11Circle — Match ID:', matchId);

  try {
    // My11Circle API endpoint for contest listing
    const url = `${MY11CIRCLE_API_BASE}/api/contest/get-contest-list`;
    console.log('[PLATFORM CONTEST] My11Circle URL:', url);

    const payload: Record<string, unknown> = {
      matchId: typeof matchId === 'string' ? parseInt(matchId, 10) : matchId,
      authToken,
    };
    if (challenge) {
      payload.challenge = challenge;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Cookie': `token=${authToken}`,
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    console.log('[PLATFORM CONTEST] My11Circle HTTP:', response.status);

    if (response.status === 401 || response.status === 403) {
      return {
        contests: [],
        error: 'My11Circle session expired. Please reconnect your account.',
        errorType: 'auth',
      };
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('[PLATFORM CONTEST] My11Circle error:', response.status, body.slice(0, 200));
      return {
        contests: [],
        error: `My11Circle API error (HTTP ${response.status}).`,
        errorType: 'api_fail',
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

    const contests = normalizeMy11CircleContests(data, String(matchId));
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
      error: 'Network error connecting to My11Circle.',
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

  const arrayFields = ['contests', 'contestList', 'contest_list', 'data', 'result', 'items'];
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
        if (sample.contestId || sample.contest_id || sample.id || sample.entryFee) {
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
 * Handles various field naming conventions.
 */
function parsePlatformContest(raw: Record<string, unknown>, matchId: string, platform: string): PlatformContest {
  const totalSpots = (raw.totalSpots as number) || (raw.total_spots as number) || (raw.size as number) || (raw.totalSpot as number) || (raw.maxTeam as number) || 0;
  const filledSpots = (raw.filledSpots as number) || (raw.filled_spots as number) || (raw.joined as number) || (raw.spot_filled as number) || (raw.totalJoined as number) || 0;
  const id = String(raw.id || raw.contestId || raw.contest_id || raw._id || '');

  return {
    id,
    name: String(raw.name || raw.contestName || raw.contest_name || raw.title || 'Contest'),
    entryFee: (raw.entryFee as number) || (raw.entry_fee as number) || (raw.entry as number) || (raw.joinAmount as number) || (raw.buyIn as number) || 0,
    prizePool: (raw.prizePool as number) || (raw.prize_pool as number) || (raw.prize as number) || (raw.winningAmount as number) || (raw.totalWinnings as number) || 0,
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
 */
export async function fetchPlatformContests(
  platform: string,
  matchId: string | number,
  authToken: string,
  challenge?: string,
): Promise<PlatformContestResult> {
  console.log('[PLATFORM CONTEST] Fetching — Platform:', platform, 'Match ID:', matchId);

  switch (platform.toLowerCase()) {
    case 'dream11':
      return fetchDream11Contests(matchId, authToken);
    case 'my11circle':
      return fetchMy11CircleContests(matchId, authToken, challenge);
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
 */
export async function joinPlatformContest(
  platform: string,
  matchId: string | number,
  authToken: string,
  teamId: string | number,
  contestId: string,
  challenge?: string,
): Promise<PlatformJoinResult> {
  console.log('[PLATFORM CONTEST] Join — Platform:', platform, 'Match:', matchId, 'Team:', teamId, 'Contest:', contestId);

  const numericMatchId = typeof matchId === 'string' ? parseInt(matchId, 10) : matchId;

  switch (platform.toLowerCase()) {
    case 'dream11':
      return joinDream11Contest(numericMatchId, authToken, teamId, contestId);
    case 'my11circle':
      return joinMy11CircleContest(numericMatchId, authToken, teamId, contestId, challenge);
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
): Promise<PlatformJoinResult> {
  try {
    const url = `${DREAM11_API_BASE}/1/contest/join`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'Dream11/8.29.0 (Android 12; SM-G991B)',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-platform': 'android',
        'x-app-ver': '8.29.0',
        'x-lang': 'en',
        'Cookie': `sid=${authToken}`,
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        matchId,
        teamId,
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
): Promise<PlatformJoinResult> {
  try {
    const url = `${MY11CIRCLE_API_BASE}/api/contest/join`;
    const payload: Record<string, unknown> = { matchId, authToken, teamId, contestId };
    if (challenge) payload.challenge = challenge;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Cookie': `token=${authToken}`,
        'Authorization': `Bearer ${authToken}`,
      },
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
