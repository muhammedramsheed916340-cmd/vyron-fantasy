import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = 'coder_bobby_believer01_tg_software';
const TG_API_BASE = 'https://tgsoftware-api.online/api';

// ============ Platform Name Normalization ============

/**
 * Normalize platform names to consistent lowercase identifiers.
 * The TG API may return varied casing in fantasy_id_list[].name
 * (e.g., "Dream11", "dream11", "My11Circle", "my11circle").
 * All internal references use lowercase: "dream11", "my11circle".
 */
export function normalizePlatformName(name: string): string {
  return name.toLowerCase().replace(/[\s_-]/g, '');
}

/**
 * Resolve a player's platform-specific ID from their fantasy_id_list.
 * Uses case-insensitive matching to handle API casing variations.
 */
export function resolvePlatformPlayerId(
  player: TGPlayer,
  platform: string,
): number | null {
  if (!player.fantasy_id_list || player.fantasy_id_list.length === 0) return null;
  const target = normalizePlatformName(platform);
  const found = player.fantasy_id_list.find(
    f => normalizePlatformName(f.name) === target
  );
  return found ? found.id : null;
}

// Player role constants
export const PLAYER_ROLES = {
  BATSMAN: 0,
  WICKET_KEEPER: 1,
  ALL_ROUNDER: 2,
  BOWLER: 3,
} as const;

export function getRoleName(role: number): string {
  switch (role) {
    case 0: return 'Batsman';
    case 1: return 'Wicket Keeper';
    case 2: return 'All-Rounder';
    case 3: return 'Bowler';
    default: return 'Unknown';
  }
}

export function getRoleShort(role: number): string {
  switch (role) {
    case 0: return 'BAT';
    case 1: return 'WK';
    case 2: return 'AR';
    case 3: return 'BOWL';
    default: return '?';
  }
}

// ============ Lineup Utilities ============

/**
 * Determine lineup mode based on player data.
 * AFTER LINEUP: enough players have playing === 1 to form valid teams.
 *   Requires at least 11 confirmed total AND at least 4 from each team
 *   (due to max-7-from-one-team constraint: 11 - 7 = 4).
 *   If only a few players are confirmed (partial lineup), we stay in
 *   'before' mode so team generation doesn't fail with too few eligible players.
 * BEFORE LINEUP: lineup not fully confirmed yet — all players eligible.
 *
 * BUG FIX: Previously used players.some(p => p.playing === 1) which
 * switched to 'after' mode when even ONE player was confirmed, causing
 * getEligiblePlayers to filter out all non-confirmed players and leaving
 * too few to form valid 11-player teams → 0 teams generated.
 */
export function getLineupMode(players: TGPlayer[]): 'before' | 'after' {
  const confirmed = players.filter(p => p.playing === 1);

  // Need at least 11 confirmed players total to form a valid team
  if (confirmed.length < 11) return 'before';

  // Need at least 4 confirmed from each team
  // (max 7 from one team → need at least 11-7=4 from the other)
  const teamNames = [...new Set(players.map(p => p.team_name))];
  for (const team of teamNames) {
    if (team && confirmed.filter(p => p.team_name === team).length < 4) {
      return 'before';
    }
  }

  return 'after';
}

/**
 * Filter players based on lineup mode.
 * BEFORE LINEUP: all players are eligible (no one confirmed OUT yet).
 * AFTER LINEUP: ONLY players with playing === 1 are eligible.
 */
export function getEligiblePlayers(
  allPlayers: TGPlayer[],
  avoidPlayerIds: Set<number> = new Set(),
): TGPlayer[] {
  const mode = getLineupMode(allPlayers);

  return allPlayers.filter(p => {
    // Avoid players are always excluded
    if (avoidPlayerIds.has(p.pl_id)) return false;

    if (mode === 'after') {
      // AFTER LINEUP: ONLY confirmed Playing XI players
      return p.playing === 1;
    }

    // BEFORE LINEUP: all players eligible
    return true;
  });
}

/**
 * Check if a specific player is eligible based on lineup mode.
 */
export function isPlayerEligible(
  player: TGPlayer,
  allPlayers: TGPlayer[],
  avoidPlayerIds: Set<number> = new Set(),
): { eligible: boolean; reason?: string } {
  if (avoidPlayerIds.has(player.pl_id)) {
    return { eligible: false, reason: 'AVOID' };
  }

  const mode = getLineupMode(allPlayers);

  if (mode === 'after' && player.playing !== 1) {
    return { eligible: false, reason: 'OUT / NOT IN PLAYING XI' };
  }

  return { eligible: true };
}

/**
 * Validate a team for lineup eligibility.
 * Returns list of invalid players with reasons.
 */
export function validateTeamForLineup(
  team: GeneratedTeam,
  allPlayers: TGPlayer[],
  avoidPlayerIds: Set<number> = new Set(),
): { valid: boolean; invalidPlayers: { player: TGPlayer; reason: string }[] } {
  const mode = getLineupMode(allPlayers);
  const invalidPlayers: { player: TGPlayer; reason: string }[] = [];

  for (const player of team.players) {
    if (avoidPlayerIds.has(player.pl_id)) {
      invalidPlayers.push({ player, reason: 'AVOID' });
      continue;
    }

    if (mode === 'after' && player.playing !== 1) {
      invalidPlayers.push({ player, reason: 'OUT / NOT IN PLAYING XI' });
    }
  }

  return { valid: invalidPlayers.length === 0, invalidPlayers };
}

// ============ Combination Utilities ============

export interface RoleCombination {
  wk: number;
  bat: number;
  ar: number;
  bowl: number;
}

export type CombinationMode = 'manual' | 'auto';

/**
 * Get all valid role combinations for an 11-player cricket team.
 */
export function getAllValidCombinations(): RoleCombination[] {
  const combos: RoleCombination[] = [];
  for (let wk = MIN_WK; wk <= MAX_WK; wk++) {
    for (let bat = MIN_BAT; bat <= MAX_BAT; bat++) {
      for (let ar = MIN_AR; ar <= MAX_AR; ar++) {
        const bowl = CRICKET_TEAM_SIZE - wk - bat - ar;
        if (bowl < MIN_BOWL || bowl > MAX_BOWL) continue;
        combos.push({ wk, bat, ar, bowl });
      }
    }
  }
  return combos;
}

/**
 * Check if a role combination is compatible with a set of fixed players.
 */
export function isCombinationCompatibleWithFixed(
  combo: RoleCombination,
  fixedPlayers: TGPlayer[],
): boolean {
  const fixedWK = fixedPlayers.filter(p => p.role === PLAYER_ROLES.WICKET_KEEPER).length;
  const fixedBat = fixedPlayers.filter(p => p.role === PLAYER_ROLES.BATSMAN).length;
  const fixedAR = fixedPlayers.filter(p => p.role === PLAYER_ROLES.ALL_ROUNDER).length;
  const fixedBowl = fixedPlayers.filter(p => p.role === PLAYER_ROLES.BOWLER).length;

  // Fixed players must not exceed combination totals
  if (fixedWK > combo.wk) return false;
  if (fixedBat > combo.bat) return false;
  if (fixedAR > combo.ar) return false;
  if (fixedBowl > combo.bowl) return false;

  // Remaining slots must be fillable
  const remainingPlayers = CRICKET_TEAM_SIZE - fixedPlayers.length;
  const neededWK = combo.wk - fixedWK;
  const neededBat = combo.bat - fixedBat;
  const neededAR = combo.ar - fixedAR;
  const neededBowl = combo.bowl - fixedBowl;

  return (neededWK + neededBat + neededAR + neededBowl) === remainingPlayers;
}

/**
 * Get combinations compatible with fixed players and available player pool.
 */
export function getCompatibleCombinations(
  fixedPlayers: TGPlayer[],
  eligiblePlayers: TGPlayer[],
): RoleCombination[] {
  const all = getAllValidCombinations();
  const fixedIds = new Set(fixedPlayers.map(p => p.pl_id));
  const remaining = eligiblePlayers.filter(p => !fixedIds.has(p.pl_id));

  const remWK = remaining.filter(p => p.role === PLAYER_ROLES.WICKET_KEEPER).length;
  const remBat = remaining.filter(p => p.role === PLAYER_ROLES.BATSMAN).length;
  const remAR = remaining.filter(p => p.role === PLAYER_ROLES.ALL_ROUNDER).length;
  const remBowl = remaining.filter(p => p.role === PLAYER_ROLES.BOWLER).length;

  return all.filter(combo => {
    if (!isCombinationCompatibleWithFixed(combo, fixedPlayers)) return false;

    const fixedWK = fixedPlayers.filter(p => p.role === PLAYER_ROLES.WICKET_KEEPER).length;
    const fixedBat = fixedPlayers.filter(p => p.role === PLAYER_ROLES.BATSMAN).length;
    const fixedAR = fixedPlayers.filter(p => p.role === PLAYER_ROLES.ALL_ROUNDER).length;
    const fixedBowl = fixedPlayers.filter(p => p.role === PLAYER_ROLES.BOWLER).length;

    if (remWK < combo.wk - fixedWK) return false;
    if (remBat < combo.bat - fixedBat) return false;
    if (remAR < combo.ar - fixedAR) return false;
    if (remBowl < combo.bowl - fixedBowl) return false;

    return true;
  });
}

/**
 * Auto-select the best combination based on player pool and category.
 * For multiple teams, rotates combinations intelligently.
 */
export function autoSelectCombination(
  eligiblePlayers: TGPlayer[],
  category: string,
  fixedPlayers: TGPlayer[] = [],
  teamIndex: number = 0,
): RoleCombination {
  const compatible = getCompatibleCombinations(fixedPlayers, eligiblePlayers);

  if (compatible.length === 0) {
    return { wk: 1, bat: 4, ar: 2, bowl: 4 };
  }

  // Category-preferred patterns
  const preferredPatterns: RoleCombination[] =
    category === 'H2H'
      ? [{ wk: 1, bat: 5, ar: 2, bowl: 3 }, { wk: 1, bat: 4, ar: 2, bowl: 4 }, { wk: 1, bat: 3, ar: 3, bowl: 4 }]
      : category === 'SL'
      ? [{ wk: 1, bat: 4, ar: 2, bowl: 4 }, { wk: 1, bat: 3, ar: 3, bowl: 4 }, { wk: 2, bat: 3, ar: 2, bowl: 4 }]
      : [ // Mega GL
        { wk: 1, bat: 3, ar: 2, bowl: 5 }, { wk: 1, bat: 4, ar: 1, bowl: 5 },
        { wk: 1, bat: 3, ar: 3, bowl: 4 }, { wk: 1, bat: 4, ar: 2, bowl: 4 },
        { wk: 2, bat: 3, ar: 2, bowl: 4 }, { wk: 1, bat: 5, ar: 1, bowl: 4 },
        { wk: 2, bat: 3, ar: 1, bowl: 5 }, { wk: 1, bat: 4, ar: 3, bowl: 3 },
        { wk: 2, bat: 4, ar: 1, bowl: 4 }, { wk: 1, bat: 3, ar: 1, bowl: 6 },
        { wk: 2, bat: 2, ar: 3, bowl: 4 }, { wk: 1, bat: 5, ar: 2, bowl: 3 },
      ];

  const preferredCompatible = preferredPatterns.filter(p =>
    compatible.some(c => c.wk === p.wk && c.bat === p.bat && c.ar === p.ar && c.bowl === p.bowl)
  );

  const pool = preferredCompatible.length > 0 ? preferredCompatible : compatible;
  const index = teamIndex % pool.length;

  return pool[index];
}

/**
 * Validate a manual combination against available players.
 */
export function validateCombination(
  combo: RoleCombination,
  eligiblePlayers: TGPlayer[],
  fixedPlayers: TGPlayer[] = [],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (combo.wk + combo.bat + combo.ar + combo.bowl !== CRICKET_TEAM_SIZE) {
    errors.push(`Total players must be 11 (got ${combo.wk + combo.bat + combo.ar + combo.bowl})`);
  }

  if (combo.wk < MIN_WK || combo.wk > MAX_WK) errors.push(`WK must be ${MIN_WK}-${MAX_WK}`);
  if (combo.bat < MIN_BAT || combo.bat > MAX_BAT) errors.push(`BAT must be ${MIN_BAT}-${MAX_BAT}`);
  if (combo.ar < MIN_AR || combo.ar > MAX_AR) errors.push(`AR must be ${MIN_AR}-${MAX_AR}`);
  if (combo.bowl < MIN_BOWL || combo.bowl > MAX_BOWL) errors.push(`BOWL must be ${MIN_BOWL}-${MAX_BOWL}`);

  if (fixedPlayers.length > 0 && !isCombinationCompatibleWithFixed(combo, fixedPlayers)) {
    errors.push('Combination is not compatible with selected fixed players');
  }

  const fixedIds = new Set(fixedPlayers.map(p => p.pl_id));
  const remaining = eligiblePlayers.filter(p => !fixedIds.has(p.pl_id));

  const fixedWK = fixedPlayers.filter(p => p.role === PLAYER_ROLES.WICKET_KEEPER).length;
  const fixedBat = fixedPlayers.filter(p => p.role === PLAYER_ROLES.BATSMAN).length;
  const fixedAR = fixedPlayers.filter(p => p.role === PLAYER_ROLES.ALL_ROUNDER).length;
  const fixedBowl = fixedPlayers.filter(p => p.role === PLAYER_ROLES.BOWLER).length;

  const needWK = Math.max(0, combo.wk - fixedWK);
  const needBat = Math.max(0, combo.bat - fixedBat);
  const needAR = Math.max(0, combo.ar - fixedAR);
  const needBowl = Math.max(0, combo.bowl - fixedBowl);

  const availWK = remaining.filter(p => p.role === PLAYER_ROLES.WICKET_KEEPER).length;
  const availBat = remaining.filter(p => p.role === PLAYER_ROLES.BATSMAN).length;
  const availAR = remaining.filter(p => p.role === PLAYER_ROLES.ALL_ROUNDER).length;
  const availBowl = remaining.filter(p => p.role === PLAYER_ROLES.BOWLER).length;

  if (availWK < needWK) errors.push(`Need ${needWK} WK but only ${availWK} available`);
  if (availBat < needBat) errors.push(`Need ${needBat} BAT but only ${availBat} available`);
  if (availAR < needAR) errors.push(`Need ${needAR} AR but only ${availAR} available`);
  if (availBowl < needBowl) errors.push(`Need ${needBowl} BOWL but only ${availBowl} available`);

  return { valid: errors.length === 0, errors };
}

export interface TGPlayer {
  name: string;
  image: string;
  playing: number;
  last_play: number;
  last_play_text: string;
  role: number;
  credits: number;
  points: number;
  selected_by: number;
  captain_percentage: number;
  vice_captain_percentage: number;
  team_index: number;
  team_name: string;
  player_fixed_id: number;
  pl_id: number;
  player_type: string;
  fantasy_id_list: { name: string; id: number }[];
  player_index: number;
}

export interface TGMatch {
  _id: string;
  id: string;
  tour_id: string;
  left_team_name: string;
  right_team_name: string;
  left_team_image: string;
  right_team_image: string;
  series_name: string;
  match_time: string;
  sport_index: number;
  lineup_out: number;
  automatic: boolean;
  match_type: string;
  apiSource: string | null;
  prime_team: number;
  prime_booking: number;
  group_team: unknown[];
  group_booking: unknown[];
  expert_video: number;
  expert_teams: number;
  expert_prediction: number;
  direct_teams: number;
  cb11_key: string;
  fantasy_list: string[];
  createdAt: string;
  categories: string[];
}

export interface TGMatchDetail {
  _id: string;
  id: string;
  left_team_name: string;
  right_team_name: string;
  left_team_image: string;
  right_team_image: string;
  match_time: string;
  match_type: string;
  sport_index: number;
  lineup_status: number;
  toss: string;
  left_team_players: TGPlayer[];
  right_team_players: TGPlayer[];
  fantasy_version: { name: string; version: number }[];
}

export interface TGPromotion {
  _id: string;
  label: string;
  imageUrl: string;
  notificationUrl: string;
  urlType: number;
  order: number;
  active: boolean;
  createdAt: string;
}

function decryptField(encrypted: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) return encrypted;
    return decrypted;
  } catch {
    return encrypted;
  }
}

function decryptPlayerData(encrypted: string): TGPlayer | null {
  try {
    const decrypted = decryptField(encrypted);
    const parsed = JSON.parse(decrypted);
    return {
      name: parsed.name || '',
      image: parsed.image || '',
      playing: parsed.playing ?? 0,
      last_play: parsed.last_play ?? 0,
      last_play_text: parsed.last_play_text || '',
      role: parsed.role ?? 0,
      credits: parsed.credits ?? 0,
      points: parsed.points ?? 0,
      selected_by: parsed.selected_by ?? 0,
      captain_percentage: parsed.captain_percentage ?? 0,
      vice_captain_percentage: parsed.vice_captain_percentage ?? 0,
      team_index: parsed.team_index ?? 0,
      team_name: parsed.team_name || '',
      player_fixed_id: parsed.player_fixed_id ?? 0,
      pl_id: parsed.pl_id ?? 0,
      player_type: parsed.player_type || '',
      fantasy_id_list: parsed.fantasy_id_list || [],
      player_index: parsed.player_index ?? 0,
    };
  } catch {
    return null;
  }
}

function decryptMatchData(encryptedMatch: string): TGMatch | null {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedMatch, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) return null;
    const parsed = JSON.parse(decrypted);

    const match: TGMatch = {
      _id: parsed._id || '',
      id: parsed.id || '',
      tour_id: parsed.tour_id || '',
      left_team_name: parsed.left_team_name || '',
      right_team_name: parsed.right_team_name || '',
      left_team_image: parsed.left_team_image || '',
      right_team_image: parsed.right_team_image || '',
      series_name: parsed.series_name || '',
      match_time: parsed.match_time || '',
      sport_index: parsed.sport_index ?? 0,
      lineup_out: parsed.lineup_out ?? 0,
      automatic: parsed.automatic ?? false,
      match_type: parsed.match_type || 'normal',
      apiSource: parsed.apiSource || null,
      prime_team: parsed.prime_team ?? 0,
      prime_booking: parsed.prime_booking ?? 0,
      group_team: parsed.group_team || [],
      group_booking: parsed.group_booking || [],
      expert_video: parsed.expert_video ?? 0,
      expert_teams: parsed.expert_teams ?? 0,
      expert_prediction: parsed.expert_prediction ?? 0,
      direct_teams: parsed.direct_teams ?? 0,
      cb11_key: parsed.cb11_key || 'NA',
      fantasy_list: parsed.fantasy_list || [],
      createdAt: parsed.createdAt || '',
      categories: parsed.categories || ['Mega GL', 'SL', 'H2H'],
    };

    return match;
  } catch (error) {
    console.error('Error decrypting match data:', error);
    return null;
  }
}

export async function fetchMatches(sport: string = 'cricket'): Promise<TGMatch[]> {
  try {
    const response = await fetch(`${TG_API_BASE}/fantasy/matches/${sport}`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch matches: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'success' || !Array.isArray(data.data)) {
      return [];
    }

    const matches: TGMatch[] = [];
    for (const encryptedMatch of data.data) {
      const match = decryptMatchData(encryptedMatch);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  } catch (error) {
    console.error('Error fetching matches:', error);
    return [];
  }
}

export async function fetchMatchDetail(matchId: string | number): Promise<TGMatchDetail | null> {
  try {
    const response = await fetch(`${TG_API_BASE}/fantasy/match/${matchId}`, {
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch match detail: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'success' || !data.data) {
      return null;
    }

    const raw = data.data;

    // Decrypt player lists
    const leftPlayers: TGPlayer[] = [];
    if (Array.isArray(raw.left_team_players)) {
      for (const ep of raw.left_team_players) {
        const player = decryptPlayerData(ep);
        if (player) leftPlayers.push(player);
      }
    }

    const rightPlayers: TGPlayer[] = [];
    if (Array.isArray(raw.right_team_players)) {
      for (const ep of raw.right_team_players) {
        const player = decryptPlayerData(ep);
        if (player) rightPlayers.push(player);
      }
    }

    return {
      _id: raw._id || '',
      id: raw.id || '',
      left_team_name: decryptField(raw.left_team_name || ''),
      right_team_name: decryptField(raw.right_team_name || ''),
      left_team_image: decryptField(raw.left_team_image || ''),
      right_team_image: decryptField(raw.right_team_image || ''),
      match_time: decryptField(raw.match_time || ''),
      match_type: raw.match_type || 'normal',
      sport_index: raw.sport_index ?? 0,
      lineup_status: raw.lineup_status ?? 0,
      toss: raw.toss || 'NA',
      left_team_players: leftPlayers,
      right_team_players: rightPlayers,
      fantasy_version: raw.fantasy_version || [],
    };
  } catch (error) {
    console.error('Error fetching match detail:', error);
    return null;
  }
}

export async function fetchPromotions(): Promise<TGPromotion[]> {
  try {
    const response = await fetch(`${TG_API_BASE}/promotion/getlist`, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch promotions: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'success' || !Array.isArray(data.data)) {
      return [];
    }

    return data.data
      .filter((p: TGPromotion) => p.active)
      .sort((a: TGPromotion, b: TGPromotion) => a.order - b.order);
  } catch (error) {
    console.error('Error fetching promotions:', error);
    return [];
  }
}

// ============ Team Generation Algorithm ============

export interface GeneratedTeam {
  id: number;
  captain: TGPlayer;
  viceCaptain: TGPlayer;
  players: TGPlayer[];
}

// Cricket team constraints
export const CRICKET_TEAM_SIZE = 11;
export const MIN_WK = 1;
export const MAX_WK = 4;
export const MIN_BAT = 3;
export const MAX_BAT = 6;
export const MIN_AR = 1;
export const MAX_AR = 4;
export const MIN_BOWL = 3;
export const MAX_BOWL = 6;
export const MAX_CREDITS = 100;
export const MAX_FROM_ONE_TEAM = 7;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function generateTeams(
  leftPlayers: TGPlayer[],
  rightPlayers: TGPlayer[],
  category: string,
  count: number,
  seed: number = Date.now(),
  avoidPlayerIds: Set<number> = new Set(),
  combination: RoleCombination | null = null,
): GeneratedTeam[] {
  // Apply lineup-aware filtering: AFTER LINEUP only playing=1, BEFORE LINEUP all
  const allPlayersRaw = [...leftPlayers, ...rightPlayers];
  const allPlayers = getEligiblePlayers(allPlayersRaw, avoidPlayerIds);
  const leftTeamName = leftPlayers[0]?.team_name || 'A';
  const rightTeamName = rightPlayers[0]?.team_name || 'B';

  // After filtering, rebuild left/right pools for team distribution checks
  const eligibleLeft = allPlayers.filter(p => p.team_name === leftTeamName);
  const eligibleRight = allPlayers.filter(p => p.team_name === rightTeamName);

  // Separate by role
  const wk = allPlayers.filter(p => p.role === PLAYER_ROLES.WICKET_KEEPER);
  const bat = allPlayers.filter(p => p.role === PLAYER_ROLES.BATSMAN);
  const ar = allPlayers.filter(p => p.role === PLAYER_ROLES.ALL_ROUNDER);
  const bowl = allPlayers.filter(p => p.role === PLAYER_ROLES.BOWLER);

  const teams: GeneratedTeam[] = [];
  const rng = seededRandom(seed);

  // Category-specific strategies
  const isH2H = category === 'H2H';
  const isSL = category === 'SL';

  for (let t = 0; t < count; t++) {
    let attempts = 0;
    let team: TGPlayer[] | null = null;

    while (!team && attempts < 200) {
      attempts++;
      const sr = seededRandom(seed + t * 1000 + attempts);

      // Determine role counts based on category or explicit combination
      let wkCount, batCount, arCount, bowlCount;

      if (combination) {
        // Use explicit combination (manual or auto-selected)
        wkCount = combination.wk;
        batCount = combination.bat;
        arCount = combination.ar;
        bowlCount = combination.bowl;
      } else if (isH2H) {
        // H2H: More conservative, popular players
        wkCount = MIN_WK + (sr() > 0.5 ? 1 : 0);
        arCount = MIN_AR + (sr() > 0.6 ? 1 : 0);
        batCount = Math.max(MIN_BAT, 5 - wkCount + (sr() > 0.5 ? 1 : 0));
        bowlCount = CRICKET_TEAM_SIZE - wkCount - batCount - arCount;
      } else if (isSL) {
        // SL: Balanced
        wkCount = 1 + (sr() > 0.7 ? 1 : 0);
        arCount = 2 + (sr() > 0.5 ? 1 : 0);
        batCount = 3 + (sr() > 0.5 ? 1 : 0);
        bowlCount = CRICKET_TEAM_SIZE - wkCount - batCount - arCount;
      } else {
        // Mega GL: More differential picks, varied combinations
        const patterns = [
          [1, 3, 2, 5], [1, 4, 1, 5], [1, 3, 3, 4], [1, 4, 2, 4],
          [2, 3, 2, 4], [1, 5, 1, 4], [2, 3, 1, 5], [1, 4, 3, 3],
          [2, 4, 1, 4], [1, 3, 1, 6], [2, 2, 3, 4], [1, 5, 2, 3],
        ];
        const pattern = patterns[Math.floor(sr() * patterns.length)];
        [wkCount, batCount, arCount, bowlCount] = pattern;
      }

      // Validate counts
      if (wkCount < MIN_WK || wkCount > MAX_WK) continue;
      if (batCount < MIN_BAT || batCount > MAX_BAT) continue;
      if (arCount < MIN_AR || arCount > MAX_AR) continue;
      if (bowlCount < MIN_BOWL || bowlCount > MAX_BOWL) continue;
      if (wkCount + batCount + arCount + bowlCount !== CRICKET_TEAM_SIZE) continue;

      // Pick players for each role
      const shuffledWK = shuffleArray(wk, sr);
      const shuffledBat = shuffleArray(bat, sr);
      const shuffledAR = shuffleArray(ar, sr);
      const shuffledBowl = shuffleArray(bowl, sr);

      // For Mega GL, sort by selected_by sometimes to get differential picks
      let selectedWK, selectedBat, selectedAR, selectedBowl;

      if (!isH2H && sr() > 0.4) {
        // Sort some roles by selection % to mix popular and differential
        const sortFn = (a: TGPlayer, b: TGPlayer) => a.selected_by - b.selected_by;
        selectedWK = shuffleArray([...wk].sort(sortFn), sr).slice(0, wkCount);
        selectedBat = shuffleArray([...bat].sort(sortFn), sr).slice(0, batCount);
        selectedAR = shuffleArray([...ar].sort(sortFn), sr).slice(0, arCount);
        selectedBowl = shuffleArray([...bowl].sort(sortFn), sr).slice(0, bowlCount);
      } else if (isH2H) {
        // H2H: Pick most selected players
        const sortFn = (a: TGPlayer, b: TGPlayer) => b.selected_by - a.selected_by;
        selectedWK = [...wk].sort(sortFn).slice(0, wkCount);
        selectedBat = shuffleArray([...bat].sort(sortFn), sr).slice(0, batCount);
        selectedAR = [...ar].sort(sortFn).slice(0, arCount);
        selectedBowl = shuffleArray([...bowl].sort(sortFn), sr).slice(0, bowlCount);
      } else {
        selectedWK = shuffledWK.slice(0, wkCount);
        selectedBat = shuffledBat.slice(0, batCount);
        selectedAR = shuffledAR.slice(0, arCount);
        selectedBowl = shuffledBowl.slice(0, bowlCount);
      }

      // Check if we have enough players
      if (selectedWK.length < wkCount || selectedBat.length < batCount ||
          selectedAR.length < arCount || selectedBowl.length < bowlCount) continue;

      const selected = [...selectedWK, ...selectedBat, ...selectedAR, ...selectedBowl];

      // Check total credits
      const totalCredits = selected.reduce((sum, p) => sum + p.credits, 0);
      if (totalCredits > MAX_CREDITS) continue;

      // Check team distribution (max 7 from one team)
      const leftCount = selected.filter(p => p.team_name === leftTeamName).length;
      const rightCount = selected.filter(p => p.team_name === rightTeamName).length;
      if (leftCount > MAX_FROM_ONE_TEAM || rightCount > MAX_FROM_ONE_TEAM) continue;

      // Ensure at least 1 from each team
      if (leftCount < 1 || rightCount < 1) continue;

      team = selected;
    }

    if (team) {
      // Select Captain & Vice-Captain
      // Sort by a combination of points and selection % for C/VC
      const sorted = [...team].sort((a, b) =>
        (b.points * 0.4 + b.selected_by * 0.3 + b.captain_percentage * 0.3) -
        (a.points * 0.4 + a.selected_by * 0.3 + a.captain_percentage * 0.3)
      );

      const captain = sorted[0];
      const viceCaptain = sorted.length > 1 ? sorted[1] : sorted[0];

      teams.push({
        id: t + 1,
        captain,
        viceCaptain,
        players: team,
      });
    }
  }

  return teams;
}

// ============ Extra Team Generation Algorithm ============
// 8 Fixed Players + remaining players filled by engine
// 5 Captain options + 5 Vice Captain options distributed across teams

export interface ExtraTeamGenInput {
  fixedPlayers: TGPlayer[];      // Exactly 8 fixed players
  captainOptions: TGPlayer[];    // Exactly 5 captain options
  viceCaptainOptions: TGPlayer[]; // Exactly 5 vice captain options
  leftPlayers: TGPlayer[];       // Full left team player pool
  rightPlayers: TGPlayer[];      // Full right team player pool
  category: string;              // 'Mega GL' | 'SL' | 'H2H'
  count: number;                 // Number of teams to generate
  seed?: number;
  avoidPlayerIds?: Set<number>;  // Players to avoid
  combination?: RoleCombination | null; // Explicit role combination
}

export function generateExtraTeams(input: ExtraTeamGenInput): GeneratedTeam[] {
  const {
    fixedPlayers,
    captainOptions,
    viceCaptainOptions,
    leftPlayers,
    rightPlayers,
    category,
    count,
    seed = Date.now(),
    avoidPlayerIds = new Set(),
    combination = null,
  } = input;

  // Apply lineup-aware filtering to the full player pool
  const allPlayersRaw = [...leftPlayers, ...rightPlayers];
  const allPlayers = getEligiblePlayers(allPlayersRaw, avoidPlayerIds);
  const leftTeamName = leftPlayers[0]?.team_name || 'A';
  const rightTeamName = rightPlayers[0]?.team_name || 'B';

  // Pool of players excluding the 8 fixed ones (use pl_id for identity)
  const fixedIds = new Set(fixedPlayers.map(p => p.pl_id));
  const remainingPool = allPlayers.filter(p => !fixedIds.has(p.pl_id));

  // Separate remaining pool by role
  const remWK = remainingPool.filter(p => p.role === PLAYER_ROLES.WICKET_KEEPER);
  const remBat = remainingPool.filter(p => p.role === PLAYER_ROLES.BATSMAN);
  const remAR = remainingPool.filter(p => p.role === PLAYER_ROLES.ALL_ROUNDER);
  const remBowl = remainingPool.filter(p => p.role === PLAYER_ROLES.BOWLER);

  // Count fixed players by role
  const fixedWKCount = fixedPlayers.filter(p => p.role === PLAYER_ROLES.WICKET_KEEPER).length;
  const fixedBatCount = fixedPlayers.filter(p => p.role === PLAYER_ROLES.BATSMAN).length;
  const fixedARCount = fixedPlayers.filter(p => p.role === PLAYER_ROLES.ALL_ROUNDER).length;
  const fixedBowlCount = fixedPlayers.filter(p => p.role === PLAYER_ROLES.BOWLER).length;

  const fixedCredits = fixedPlayers.reduce((sum, p) => sum + p.credits, 0);
  const remainingCredits = MAX_CREDITS - fixedCredits;
  const neededPlayers = CRICKET_TEAM_SIZE - fixedPlayers.length; // 3

  const teams: GeneratedTeam[] = [];

  // Pre-validate: fixed players must have credits <= 100
  if (fixedCredits > MAX_CREDITS) return teams;

  // Pre-validate: fixed players must respect max 7 from one team
  const fixedLeftCount = fixedPlayers.filter(p => p.team_name === leftTeamName).length;
  const fixedRightCount = fixedPlayers.filter(p => p.team_name === rightTeamName).length;
  if (fixedLeftCount > MAX_FROM_ONE_TEAM || fixedRightCount > MAX_FROM_ONE_TEAM) return teams;

  // Generate all valid C/VC combinations from the 5C and 5VC options
  // C must be in the team, VC must be in the team, C ≠ VC
  const cVCCombos: { c: TGPlayer; vc: TGPlayer }[] = [];
  for (const c of captainOptions) {
    for (const vc of viceCaptainOptions) {
      if (c.pl_id !== vc.pl_id) {
        cVCCombos.push({ c, vc });
      }
    }
  }
  // If no valid combos, return empty
  if (cVCCombos.length === 0) return teams;

  // Category-specific role distribution preferences for remaining players
  const isH2H = category === 'H2H';
  const isSL = category === 'SL';

  // Pre-compute all valid target role distributions that are compatible with fixed players
  // This avoids wasting attempts on patterns that can never work
  const categoryPatterns: number[][] = isH2H
    ? [] // H2H uses dynamic generation below
    : isSL
    ? [] // SL uses dynamic generation below
    : [
        [1, 3, 2, 5], [1, 4, 1, 5], [1, 3, 3, 4], [1, 4, 2, 4],
        [2, 3, 2, 4], [1, 5, 1, 4], [2, 3, 1, 5], [1, 4, 3, 3],
        [2, 4, 1, 4], [1, 3, 1, 6], [2, 2, 3, 4], [1, 5, 2, 3],
      ];

  // Build list of valid target distributions: [WK, BAT, AR, BOWL]
  const validDistributions: number[][] = [];
  for (let wk = MIN_WK; wk <= MAX_WK; wk++) {
    for (let bat = MIN_BAT; bat <= MAX_BAT; bat++) {
      for (let ar = MIN_AR; ar <= MAX_AR; ar++) {
        const bowl = CRICKET_TEAM_SIZE - wk - bat - ar;
        if (bowl < MIN_BOWL || bowl > MAX_BOWL) continue;
        // Check compatibility with fixed players
        const nWK = Math.max(0, wk - fixedWKCount);
        const nBat = Math.max(0, bat - fixedBatCount);
        const nAR = Math.max(0, ar - fixedARCount);
        const nBowl = Math.max(0, bowl - fixedBowlCount);
        if (nWK + nBat + nAR + nBowl !== neededPlayers) continue;
        // Check we have enough remaining players for each role
        if (remWK.length < nWK || remBat.length < nBat || remAR.length < nAR || remBowl.length < nBowl) continue;
        // For Mega GL / SL / H2H: prefer category-specific patterns but include all valid ones
        validDistributions.push([wk, bat, ar, bowl]);
      }
    }
  }

  // Sort: prefer category-specific patterns first, then others
  if (categoryPatterns.length > 0) {
    const patternSet = new Set(categoryPatterns.map(p => p.join(',')));
    validDistributions.sort((a, b) => {
      const aInCat = patternSet.has(a.join(',')) ? 0 : 1;
      const bInCat = patternSet.has(b.join(',')) ? 0 : 1;
      return aInCat - bInCat;
    });
  }

  if (validDistributions.length === 0) {
    return teams;
  }

  // Team signature function for uniqueness check across generated teams
  // Uses sorted player IDs + C/VC IDs to create a unique fingerprint
  const teamSignatures = new Set<string>();
  const makeTeamSignature = (players: TGPlayer[], c: TGPlayer, vc: TGPlayer): string => {
    const playerIds = players.map(p => p.pl_id).sort((a, b) => a - b).join(',');
    return `${playerIds}|C${c.pl_id}|VC${vc.pl_id}`;
  };

  // Generation loop with retry: keep trying until we have `count` unique teams
  // or we exhaust the maximum total attempts
  const MAX_TOTAL_ATTEMPTS = count * 500; // generous budget
  let totalAttempts = 0;

  for (let t = 0; t < count && totalAttempts < MAX_TOTAL_ATTEMPTS; t++) {
    let attempts = 0;
    let team: TGPlayer[] | null = null;
    let teamC: TGPlayer | null = null;
    let teamVC: TGPlayer | null = null;

    while (!team && attempts < 500) {
      attempts++;
      totalAttempts++;
      const sr = seededRandom(seed + t * 1000 + attempts);

      // Pick a valid target distribution (or use explicit combination)
      let targetWK: number, targetBat: number, targetAR: number, targetBowl: number;

      if (combination) {
        // Use explicit combination
        targetWK = combination.wk;
        targetBat = combination.bat;
        targetAR = combination.ar;
        targetBowl = combination.bowl;
      } else if (validDistributions.length === 1) {
        [targetWK, targetBat, targetAR, targetBowl] = validDistributions[0];
      } else {
        // Bias towards category-preferred patterns (first half of sorted list)
        const idx = sr() < 0.7
          ? Math.floor(sr() * Math.ceil(validDistributions.length / 2)) // 70% chance from preferred half
          : Math.floor(sr() * validDistributions.length); // 30% from any
        [targetWK, targetBat, targetAR, targetBowl] = validDistributions[Math.min(idx, validDistributions.length - 1)];
      }

      // How many more of each role do we need?
      const needWK = Math.max(0, targetWK - fixedWKCount);
      const needBat = Math.max(0, targetBat - fixedBatCount);
      const needAR = Math.max(0, targetAR - fixedARCount);
      const needBowl = Math.max(0, targetBowl - fixedBowlCount);

      // Check if we have enough remaining players for each role
      if (remWK.length < needWK || remBat.length < needBat ||
          remAR.length < needAR || remBowl.length < needBowl) continue;

      // Pick remaining players for each role
      let pickedWK: TGPlayer[], pickedBat: TGPlayer[], pickedAR: TGPlayer[], pickedBowl: TGPlayer[];

      if (!isH2H && sr() > 0.4) {
        const sortFn = (a: TGPlayer, b: TGPlayer) => a.selected_by - b.selected_by;
        pickedWK = shuffleArray([...remWK].sort(sortFn), sr).slice(0, needWK);
        pickedBat = shuffleArray([...remBat].sort(sortFn), sr).slice(0, needBat);
        pickedAR = shuffleArray([...remAR].sort(sortFn), sr).slice(0, needAR);
        pickedBowl = shuffleArray([...remBowl].sort(sortFn), sr).slice(0, needBowl);
      } else if (isH2H) {
        const sortFn = (a: TGPlayer, b: TGPlayer) => b.selected_by - a.selected_by;
        pickedWK = [...remWK].sort(sortFn).slice(0, needWK);
        pickedBat = shuffleArray([...remBat].sort(sortFn), sr).slice(0, needBat);
        pickedAR = [...remAR].sort(sortFn).slice(0, needAR);
        pickedBowl = shuffleArray([...remBowl].sort(sortFn), sr).slice(0, needBowl);
      } else {
        pickedWK = shuffleArray(remWK, sr).slice(0, needWK);
        pickedBat = shuffleArray(remBat, sr).slice(0, needBat);
        pickedAR = shuffleArray(remAR, sr).slice(0, needAR);
        pickedBowl = shuffleArray(remBowl, sr).slice(0, needBowl);
      }

      if (pickedWK.length < needWK || pickedBat.length < needBat ||
          pickedAR.length < needAR || pickedBowl.length < needBowl) continue;

      const remaining = [...pickedWK, ...pickedBat, ...pickedAR, ...pickedBowl];
      const fullTeam = [...fixedPlayers, ...remaining];

      // Check no duplicates (shouldn't happen but safety check)
      const uniqueIds = new Set(fullTeam.map(p => p.pl_id));
      if (uniqueIds.size !== fullTeam.length) continue;

      // Check total credits
      const totalCredits = fullTeam.reduce((sum, p) => sum + p.credits, 0);
      if (totalCredits > MAX_CREDITS) continue;

      // Check team distribution
      const leftCount = fullTeam.filter(p => p.team_name === leftTeamName).length;
      const rightCount = fullTeam.filter(p => p.team_name === rightTeamName).length;
      if (leftCount > MAX_FROM_ONE_TEAM || rightCount > MAX_FROM_ONE_TEAM) continue;
      if (leftCount < 1 || rightCount < 1) continue;

      // Select C/VC combination for this team
      // Round-robin through the valid combos, also try to ensure C and VC are in the team
      const comboIndex = (t + attempts) % cVCCombos.length;
      let combo = cVCCombos[comboIndex];

      // Ensure C and VC are in this team
      const teamPlayerIds = new Set(fullTeam.map(p => p.pl_id));
      if (!teamPlayerIds.has(combo.c.pl_id) || !teamPlayerIds.has(combo.vc.pl_id)) {
        // Try to find a valid combo where both C and VC are in the team
        let foundValidCombo = false;
        for (let ci = 0; ci < cVCCombos.length; ci++) {
          const tryCombo = cVCCombos[(comboIndex + ci) % cVCCombos.length];
          if (teamPlayerIds.has(tryCombo.c.pl_id) && teamPlayerIds.has(tryCombo.vc.pl_id)) {
            combo = tryCombo;
            foundValidCombo = true;
            break;
          }
        }
        if (!foundValidCombo) {
          // Fallback: use top players in team as C/VC
          const sorted = [...fullTeam].sort((a, b) =>
            (b.points * 0.4 + b.selected_by * 0.3 + b.captain_percentage * 0.3) -
            (a.points * 0.4 + a.selected_by * 0.3 + a.captain_percentage * 0.3)
          );
          combo = { c: sorted[0], vc: sorted.length > 1 ? sorted[1] : sorted[0] };
        }
      }

      // Uniqueness check: skip if this team signature already exists
      const signature = makeTeamSignature(fullTeam, combo.c, combo.vc);
      if (teamSignatures.has(signature)) continue;

      team = fullTeam;
      teamC = combo.c;
      teamVC = combo.vc;
      teamSignatures.add(signature);
    }

    if (team && teamC && teamVC) {
      teams.push({
        id: teams.length + 1,
        captain: teamC,
        viceCaptain: teamVC,
        players: team,
      });
    } else {
      // If we failed to generate a unique team for this slot,
      // try extra attempts with different seeds before giving up
      let extraAttempts = 0;
      const MAX_EXTRA = 200;
      while (teams.length < count && extraAttempts < MAX_EXTRA && totalAttempts < MAX_TOTAL_ATTEMPTS) {
        extraAttempts++;
        totalAttempts++;
        const extraSeed = seed + count * 1000 + extraAttempts * 37;
        const sr = seededRandom(extraSeed);

        // Pick distribution (or use explicit combination)
        let targetWK: number, targetBat: number, targetAR: number, targetBowl: number;
        if (combination) {
          targetWK = combination.wk;
          targetBat = combination.bat;
          targetAR = combination.ar;
          targetBowl = combination.bowl;
        } else if (validDistributions.length === 1) {
          [targetWK, targetBat, targetAR, targetBowl] = validDistributions[0];
        } else {
          const idx = Math.floor(sr() * validDistributions.length);
          [targetWK, targetBat, targetAR, targetBowl] = validDistributions[idx];
        }

        const needWK = Math.max(0, targetWK - fixedWKCount);
        const needBat = Math.max(0, targetBat - fixedBatCount);
        const needAR = Math.max(0, targetAR - fixedARCount);
        const needBowl = Math.max(0, targetBowl - fixedBowlCount);

        if (remWK.length < needWK || remBat.length < needBat ||
            remAR.length < needAR || remBowl.length < needBowl) continue;

        const sortFn = (a: TGPlayer, b: TGPlayer) => a.selected_by - b.selected_by;
        const pickedWK = shuffleArray([...remWK].sort(sortFn), sr).slice(0, needWK);
        const pickedBat = shuffleArray([...remBat].sort(sortFn), sr).slice(0, needBat);
        const pickedAR = shuffleArray([...remAR].sort(sortFn), sr).slice(0, needAR);
        const pickedBowl = shuffleArray([...remBowl].sort(sortFn), sr).slice(0, needBowl);

        if (pickedWK.length < needWK || pickedBat.length < needBat ||
            pickedAR.length < needAR || pickedBowl.length < needBowl) continue;

        const remaining = [...pickedWK, ...pickedBat, ...pickedAR, ...pickedBowl];
        const fullTeam = [...fixedPlayers, ...remaining];

        const uniqueIds = new Set(fullTeam.map(p => p.pl_id));
        if (uniqueIds.size !== fullTeam.length) continue;

        const totalCredits = fullTeam.reduce((sum, p) => sum + p.credits, 0);
        if (totalCredits > MAX_CREDITS) continue;

        const leftCount = fullTeam.filter(p => p.team_name === leftTeamName).length;
        const rightCount = fullTeam.filter(p => p.team_name === rightTeamName).length;
        if (leftCount > MAX_FROM_ONE_TEAM || rightCount > MAX_FROM_ONE_TEAM) continue;
        if (leftCount < 1 || rightCount < 1) continue;

        // C/VC selection
        const comboIndex = extraAttempts % cVCCombos.length;
        let combo = cVCCombos[comboIndex];
        const teamPlayerIds = new Set(fullTeam.map(p => p.pl_id));
        if (!teamPlayerIds.has(combo.c.pl_id) || !teamPlayerIds.has(combo.vc.pl_id)) {
          let foundValidCombo = false;
          for (let ci = 0; ci < cVCCombos.length; ci++) {
            const tryCombo = cVCCombos[(comboIndex + ci) % cVCCombos.length];
            if (teamPlayerIds.has(tryCombo.c.pl_id) && teamPlayerIds.has(tryCombo.vc.pl_id)) {
              combo = tryCombo;
              foundValidCombo = true;
              break;
            }
          }
          if (!foundValidCombo) {
            const sorted = [...fullTeam].sort((a, b) =>
              (b.points * 0.4 + b.selected_by * 0.3 + b.captain_percentage * 0.3) -
              (a.points * 0.4 + a.selected_by * 0.3 + a.captain_percentage * 0.3)
            );
            combo = { c: sorted[0], vc: sorted.length > 1 ? sorted[1] : sorted[0] };
          }
        }

        const signature = makeTeamSignature(fullTeam, combo.c, combo.vc);
        if (teamSignatures.has(signature)) continue;
        teamSignatures.add(signature);

        teams.push({
          id: teams.length + 1,
          captain: combo.c,
          viceCaptain: combo.vc,
          players: fullTeam,
        });
        break; // Successfully added a team, move on
      }
    }
  }

  return teams;
}

// ============ Auto Select for Extra Team Generation ============
// Uses real player data (selection %, captain %, points, credits, role, team balance)
// to intelligently pick 8 FIX, 5 C, and 5 VC

export interface AutoSelectResult {
  fixedPlayers: TGPlayer[];
  captainOptions: TGPlayer[];
  viceCaptainOptions: TGPlayer[];
}

// Player scoring for auto-selection: higher = better pick
function playerScore(p: TGPlayer): number {
  return (
    p.selected_by * 0.35 +       // selection % - most important for GL
    p.captain_percentage * 0.25 + // captain % - indicates trust
    p.points * 0.2 +             // points - performance indicator
    p.vice_captain_percentage * 0.1 + // VC %
    (p.playing === 1 ? 10 : 0) + // confirmed playing bonus
    (p.role === PLAYER_ROLES.ALL_ROUNDER ? 3 : 0) + // AR bonus (flexible)
    (p.role === PLAYER_ROLES.WICKET_KEEPER ? 1 : 0) // WK slight bonus
  );
}

export function autoSelectExtraPlayers(
  leftPlayers: TGPlayer[],
  rightPlayers: TGPlayer[],
  avoidPlayerIds: Set<number> = new Set(),
): AutoSelectResult {
  const allPlayersRaw = [...leftPlayers, ...rightPlayers];
  const leftTeamName = leftPlayers[0]?.team_name || 'A';
  const rightTeamName = rightPlayers[0]?.team_name || 'B';

  // Use lineup-aware eligibility filter
  const eligible = getEligiblePlayers(allPlayersRaw, avoidPlayerIds);

  const eligibleLeft = eligible.filter(p => p.team_name === leftTeamName);
  const eligibleRight = eligible.filter(p => p.team_name === rightTeamName);

  // Sort by score descending
  const sortByScore = (a: TGPlayer, b: TGPlayer) => playerScore(b) - playerScore(a);
  const sortedLeft = [...eligibleLeft].sort(sortByScore);
  const sortedRight = [...eligibleRight].sort(sortByScore);

  // === SELECT 8 FIX PLAYERS ===
  // Strategy: balanced 4-5 from each team, role-diverse
  const fixedPlayers: TGPlayer[] = [];
  const fixedIds = new Set<number>();

  const targetLeft = Math.min(4, sortedLeft.length);
  const targetRight = Math.min(4, sortedRight.length);

  // Pick diverse players ensuring role coverage
  const pickDiverse = (pool: TGPlayer[], count: number, existing: TGPlayer[]): TGPlayer[] => {
    const picked: TGPlayer[] = [];
    const usedIds = new Set(existing.map(p => p.pl_id));
    const existingRoles = {
      wk: existing.filter(p => p.role === PLAYER_ROLES.WICKET_KEEPER).length,
      bat: existing.filter(p => p.role === PLAYER_ROLES.BATSMAN).length,
      ar: existing.filter(p => p.role === PLAYER_ROLES.ALL_ROUNDER).length,
      bowl: existing.filter(p => p.role === PLAYER_ROLES.BOWLER).length,
    };

    // First pass: fill role gaps
    const roleNeeds = [
      { role: PLAYER_ROLES.WICKET_KEEPER, need: Math.max(0, 1 - existingRoles.wk), pool: pool.filter(p => p.role === PLAYER_ROLES.WICKET_KEEPER && !usedIds.has(p.pl_id)) },
      { role: PLAYER_ROLES.ALL_ROUNDER, need: Math.max(0, 1 - existingRoles.ar), pool: pool.filter(p => p.role === PLAYER_ROLES.ALL_ROUNDER && !usedIds.has(p.pl_id)) },
      { role: PLAYER_ROLES.BATSMAN, need: Math.max(0, 2 - existingRoles.bat), pool: pool.filter(p => p.role === PLAYER_ROLES.BATSMAN && !usedIds.has(p.pl_id)) },
      { role: PLAYER_ROLES.BOWLER, need: Math.max(0, 2 - existingRoles.bowl), pool: pool.filter(p => p.role === PLAYER_ROLES.BOWLER && !usedIds.has(p.pl_id)) },
    ];

    for (const rn of roleNeeds) {
      for (let i = 0; i < rn.need && picked.length < count; i++) {
        const candidate = rn.pool.find(p => !picked.some(pp => pp.pl_id === p.pl_id));
        if (candidate) picked.push(candidate);
      }
    }

    // Second pass: fill remaining with top-scored players
    const remaining = pool.filter(p => !usedIds.has(p.pl_id) && !picked.some(pp => pp.pl_id === p.pl_id));
    for (const p of remaining) {
      if (picked.length >= count) break;
      picked.push(p);
    }

    return picked;
  };

  const leftPicks = pickDiverse(sortedLeft, targetLeft, []);
  for (const p of leftPicks) { fixedPlayers.push(p); fixedIds.add(p.pl_id); }

  const rightPicks = pickDiverse(sortedRight, targetRight, fixedPlayers);
  for (const p of rightPicks) { fixedPlayers.push(p); fixedIds.add(p.pl_id); }

  // Fill to 8 if needed
  if (fixedPlayers.length < 8) {
    const remaining = eligible.filter(p => !fixedIds.has(p.pl_id)).sort(sortByScore);
    for (const p of remaining) {
      if (fixedPlayers.length >= 8) break;
      fixedPlayers.push(p); fixedIds.add(p.pl_id);
    }
  }

  // Trim to 8 if over
  while (fixedPlayers.length > 8) {
    let minIdx = 0; let minScore = playerScore(fixedPlayers[0]);
    for (let i = 1; i < fixedPlayers.length; i++) {
      const s = playerScore(fixedPlayers[i]);
      if (s < minScore) { minScore = s; minIdx = i; }
    }
    const removed = fixedPlayers.splice(minIdx, 1)[0];
    fixedIds.delete(removed.pl_id);
  }

  // === SELECT 5 CAPTAIN OPTIONS ===
  const cCandidates = eligible
    .filter(p => !avoidPlayerIds.has(p.pl_id))
    .sort((a, b) => {
      const scoreA = a.captain_percentage * 0.4 + a.selected_by * 0.3 + a.points * 0.2 + (a.role === PLAYER_ROLES.ALL_ROUNDER ? 5 : 0);
      const scoreB = b.captain_percentage * 0.4 + b.selected_by * 0.3 + b.points * 0.2 + (b.role === PLAYER_ROLES.ALL_ROUNDER ? 5 : 0);
      return scoreB - scoreA;
    })
    .slice(0, 5);

  // === SELECT 5 VICE CAPTAIN OPTIONS ===
  const vcCandidates: TGPlayer[] = [];
  const vcPool = eligible
    .filter(p => !avoidPlayerIds.has(p.pl_id))
    .sort((a, b) => {
      const scoreA = a.vice_captain_percentage * 0.35 + a.selected_by * 0.3 + a.points * 0.2 + (a.role === PLAYER_ROLES.ALL_ROUNDER ? 4 : 0);
      const scoreB = b.vice_captain_percentage * 0.35 + b.selected_by * 0.3 + b.points * 0.2 + (b.role === PLAYER_ROLES.ALL_ROUNDER ? 4 : 0);
      return scoreB - scoreA;
    });

  for (const p of vcPool) {
    if (vcCandidates.length >= 5) break;
    vcCandidates.push(p);
  }

  return {
    fixedPlayers: fixedPlayers.slice(0, 8),
    captainOptions: cCandidates.slice(0, 5),
    viceCaptainOptions: vcCandidates.slice(0, 5),
  };
}

// Auto-replace a removed player in a list with the next best eligible player
export function autoReplacePlayer(
  removedPlayer: TGPlayer,
  currentList: TGPlayer[],
  allPlayers: TGPlayer[],
  avoidPlayerIds: Set<number>,
  scoringFn: (p: TGPlayer) => number = playerScore,
): TGPlayer[] {
  const currentIds = new Set(currentList.map(p => p.pl_id));
  const eligible = allPlayers.filter(p =>
    !currentIds.has(p.pl_id) && !avoidPlayerIds.has(p.pl_id) && p.pl_id !== removedPlayer.pl_id
  );
  const sorted = eligible.sort((a, b) => scoringFn(b) - scoringFn(a));
  const replacement = sorted[0];
  if (replacement) return [...currentList, replacement];
  return currentList;
}
