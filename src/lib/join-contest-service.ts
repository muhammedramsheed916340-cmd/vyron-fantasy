// ============================================================
// JOIN CONTEST MODULE — Completely separate from Transfer
// ============================================================

import { TGPlayer, GeneratedTeam } from './tg-api';

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
  name: string;
  type: string;           // GL, SL, H2H, etc.
  entryFee: number;
  prizePool: number;
  totalSpots: number;
  filledSpots: number;
  remainingSpots: number;
  joinAvailable: boolean;
  maxTeamsPerUser?: number;
}

export interface JCTeam {
  id: string | number;
  name: string;
  players: TGPlayer[];
  captain: TGPlayer;
  viceCaptain: TGPlayer;
  matchId?: string | number;
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
export function parseContest(raw: Record<string, unknown>): JCContest {
  const totalSpots = (raw.totalSpots as number) || (raw.total_spots as number) || (raw.size as number) || 0;
  const filledSpots = (raw.filledSpots as number) || (raw.filled_spots as number) || (raw.joined as number) || 0;

  return {
    id: String(raw.id || raw.contestId || raw.contest_id || ''),
    name: String(raw.name || raw.contestName || raw.contest_name || 'Contest'),
    type: String(raw.type || raw.contestType || raw.contest_type || 'GL'),
    entryFee: (raw.entryFee as number) || (raw.entry_fee as number) || (raw.entry as number) || 0,
    prizePool: (raw.prizePool as number) || (raw.prize_pool as number) || (raw.prize as number) || 0,
    totalSpots,
    filledSpots,
    remainingSpots: Math.max(0, totalSpots - filledSpots),
    joinAvailable: totalSpots === 0 || filledSpots < totalSpots,
    maxTeamsPerUser: (raw.maxTeamsPerUser as number) || (raw.max_teams as number) || undefined,
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

// ============ Team Helpers ============

/**
 * Convert GeneratedTeam to JCTeam format for the join contest module.
 */
export function generatedTeamToJCTeam(
  team: GeneratedTeam,
  index: number,
  matchId?: string | number,
): JCTeam {
  return {
    id: `gen-${index}`,
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
          teamId: team.id,
          teamName: team.name,
          platform,
          status: 'pending',
        });
      }
    }
  }

  return deduplicateJoinItems(items);
}
