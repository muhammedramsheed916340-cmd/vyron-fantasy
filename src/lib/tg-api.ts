import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = 'coder_bobby_believer01_tg_software';
const TG_API_BASE = 'https://tgsoftware-api.online/api';

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
const CRICKET_TEAM_SIZE = 11;
const MIN_WK = 1;
const MAX_WK = 4;
const MIN_BAT = 3;
const MAX_BAT = 6;
const MIN_AR = 1;
const MAX_AR = 4;
const MIN_BOWL = 3;
const MAX_BOWL = 6;
const MAX_CREDITS = 100;
const MAX_FROM_ONE_TEAM = 7;

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
  seed: number = Date.now()
): GeneratedTeam[] {
  const allPlayers = [...leftPlayers, ...rightPlayers];
  const leftTeamName = leftPlayers[0]?.team_name || 'A';
  const rightTeamName = rightPlayers[0]?.team_name || 'B';

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

      // Determine role counts based on category
      let wkCount, batCount, arCount, bowlCount;

      if (isH2H) {
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
  } = input;

  const allPlayers = [...leftPlayers, ...rightPlayers];
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

  for (let t = 0; t < count; t++) {
    let attempts = 0;
    let team: TGPlayer[] | null = null;
    let teamC: TGPlayer | null = null;
    let teamVC: TGPlayer | null = null;

    while (!team && attempts < 500) {
      attempts++;
      const sr = seededRandom(seed + t * 1000 + attempts);

      // We need `neededPlayers` more players (3)
      // Determine target role counts for the full 11-player team
      let targetWK, targetBat, targetAR, targetBowl;

      if (isH2H) {
        targetWK = MIN_WK + (sr() > 0.5 ? 1 : 0);
        targetAR = MIN_AR + (sr() > 0.6 ? 1 : 0);
        targetBat = Math.max(MIN_BAT, 5 - targetWK + (sr() > 0.5 ? 1 : 0));
        targetBowl = CRICKET_TEAM_SIZE - targetWK - targetBat - targetAR;
      } else if (isSL) {
        targetWK = 1 + (sr() > 0.7 ? 1 : 0);
        targetAR = 2 + (sr() > 0.5 ? 1 : 0);
        targetBat = 3 + (sr() > 0.5 ? 1 : 0);
        targetBowl = CRICKET_TEAM_SIZE - targetWK - targetBat - targetAR;
      } else {
        const patterns = [
          [1, 3, 2, 5], [1, 4, 1, 5], [1, 3, 3, 4], [1, 4, 2, 4],
          [2, 3, 2, 4], [1, 5, 1, 4], [2, 3, 1, 5], [1, 4, 3, 3],
          [2, 4, 1, 4], [1, 3, 1, 6], [2, 2, 3, 4], [1, 5, 2, 3],
        ];
        const pattern = patterns[Math.floor(sr() * patterns.length)];
        [targetWK, targetBat, targetAR, targetBowl] = pattern;
      }

      // Validate total counts
      if (targetWK < MIN_WK || targetWK > MAX_WK) continue;
      if (targetBat < MIN_BAT || targetBat > MAX_BAT) continue;
      if (targetAR < MIN_AR || targetAR > MAX_AR) continue;
      if (targetBowl < MIN_BOWL || targetBowl > MAX_BOWL) continue;
      if (targetWK + targetBat + targetAR + targetBowl !== CRICKET_TEAM_SIZE) continue;

      // How many more of each role do we need?
      const needWK = Math.max(0, targetWK - fixedWKCount);
      const needBat = Math.max(0, targetBat - fixedBatCount);
      const needAR = Math.max(0, targetAR - fixedARCount);
      const needBowl = Math.max(0, targetBowl - fixedBowlCount);

      // Total needed must equal neededPlayers (3)
      if (needWK + needBat + needAR + needBowl !== neededPlayers) continue;

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

      team = fullTeam;
      teamC = combo.c;
      teamVC = combo.vc;
    }

    if (team && teamC && teamVC) {
      teams.push({
        id: t + 1,
        captain: teamC,
        viceCaptain: teamVC,
        players: team,
      });
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
  const allPlayers = [...leftPlayers, ...rightPlayers];
  const leftTeamName = leftPlayers[0]?.team_name || 'A';
  const rightTeamName = rightPlayers[0]?.team_name || 'B';

  // Filter out avoided players and unconfirmed players when lineup is out
  const eligible = allPlayers.filter(p => {
    if (avoidPlayerIds.has(p.pl_id)) return false;
    if (p.playing === 0) {
      const hasConfirmed = allPlayers.some(ap => ap.playing === 1);
      if (hasConfirmed) return false;
    }
    return true;
  });

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
