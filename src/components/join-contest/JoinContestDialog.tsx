'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Trophy, X, CheckCircle2, Loader2, ChevronRight, ChevronLeft,
  AlertCircle, Users, DollarSign, Filter, RefreshCw,
} from 'lucide-react';
import {
  JCMatch, JCContest, JCTeam, JCJoinItem, JCProgress,
  JCContestFetchResult,
  parseContest, formatCurrency, getContestTypeColor,
  getExistingPlatformTeams, getPlatformContests, normalizeContests,
  buildJoinItems, getJoinKey,
} from '@/lib/join-contest-service';

// ============ Step Enum ============
type Step = 'matches' | 'teams' | 'contests' | 'joining' | 'result';

// ============ Contest Error State ============
interface ContestErrorState {
  matchId: string;
  error: string;
  errorType: 'auth' | 'network' | 'parse' | 'invalid_match' | 'api_fail';
}

// ============ Props ============
interface JoinContestDialogProps {
  open: boolean;
  onClose: () => void;
  matches: JCMatch[];
  fantasyAccounts: Record<string, { authToken: string; mobileNumber: string; my11circleChallenge?: string | null }>;
}

// ============ Main Dialog ============
export default function JoinContestDialog({
  open, onClose, matches, fantasyAccounts,
}: JoinContestDialogProps) {
  // Step state
  const [step, setStep] = useState<Step>('matches');
  const [platform, setPlatform] = useState<string>('dream11');

  // Match selection
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string | number>>(new Set());

  // Team selection — EXISTING PLATFORM TEAMS
  const [platformTeams, setPlatformTeams] = useState<JCTeam[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string | number>>(new Set());
  const [mixedTeamMode, setMixedTeamMode] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [teamsTokenExpired, setTeamsTokenExpired] = useState(false);

  // Contest selection — with proper error states
  const [contestsMap, setContestsMap] = useState<Map<string, JCContest[]>>(new Map());
  const [selectedContestIds, setSelectedContestIds] = useState<Set<string>>(new Set());
  const [loadingContests, setLoadingContests] = useState(false);
  const [contestErrors, setContestErrors] = useState<ContestErrorState[]>([]);
  const [contestTokenExpired, setContestTokenExpired] = useState(false);

  // Join progress
  const [joinItems, setJoinItems] = useState<JCJoinItem[]>([]);
  const [progress, setProgress] = useState<JCProgress>({ current: 0, total: 0, status: 'idle' });

  // Result
  const [resultItems, setResultItems] = useState<JCJoinItem[]>([]);

  // Available platforms from linked accounts
  const availablePlatforms = useMemo(() => {
    const platforms: string[] = [];
    if (fantasyAccounts.dream11?.authToken) platforms.push('dream11');
    if (fantasyAccounts.my11circle?.authToken) platforms.push('my11circle');
    return platforms;
  }, [fantasyAccounts]);

  const account = fantasyAccounts[platform];

  // Reset on close
  const handleClose = () => {
    setStep('matches');
    setSelectedMatchIds(new Set());
    setPlatformTeams([]);
    setSelectedTeamIds(new Set());
    setMixedTeamMode(false);
    setLoadingTeams(false);
    setTeamsError(null);
    setTeamsTokenExpired(false);
    setContestsMap(new Map());
    setSelectedContestIds(new Set());
    setLoadingContests(false);
    setContestErrors([]);
    setContestTokenExpired(false);
    setJoinItems([]);
    setProgress({ current: 0, total: 0, status: 'idle' });
    setResultItems([]);
    onClose();
  };

  // ============ Match Selection ============
  const toggleMatch = (id: string | number) => {
    setSelectedMatchIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllMatches = () => {
    setSelectedMatchIds(new Set(matches.map(m => m.id)));
  };

  // ============ Load Existing Platform Teams ============
  const loadPlatformTeams = useCallback(async (selectedPlatform?: string) => {
    const plat = selectedPlatform || platform;
    const acc = fantasyAccounts[plat];
    if (!acc?.authToken) {
      setTeamsError('No connected account found. Connect your platform account to load existing teams.');
      setPlatformTeams([]);
      return;
    }

    setLoadingTeams(true);
    setTeamsError(null);
    setTeamsTokenExpired(false);
    setSelectedTeamIds(new Set());

    const allTeams: JCTeam[] = [];
    let firstError: string | null = null;
    let anyTokenExpired = false;

    for (const matchId of selectedMatchIds) {
      const result = await getExistingPlatformTeams(plat, matchId, acc.authToken);
      if (result.teams.length > 0) {
        allTeams.push(...result.teams);
      }
      if (result.tokenExpired) {
        anyTokenExpired = true;
        firstError = result.error || 'Session expired';
      } else if (result.error && !firstError) {
        firstError = result.error;
      }
    }

    setPlatformTeams(allTeams);
    setTeamsError(allTeams.length === 0 ? firstError : null);
    setTeamsTokenExpired(anyTokenExpired);
    setLoadingTeams(false);
  }, [selectedMatchIds, platform, fantasyAccounts]);

  // ============ Team Selection ============
  const toggleTeam = (id: string | number) => {
    setSelectedTeamIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllTeams = () => {
    setSelectedTeamIds(new Set(platformTeams.map(t => t.id)));
  };

  const deselectAllTeams = () => {
    setSelectedTeamIds(new Set());
  };

  // ============ Contest Loading — with proper error differentiation ============
  const loadContests = useCallback(async () => {
    if (!account?.authToken) return;
    setLoadingContests(true);
    setContestErrors([]);
    setContestTokenExpired(false);
    setSelectedContestIds(new Set());

    const newMap = new Map<string, JCContest[]>();
    const errors: ContestErrorState[] = [];
    let anyTokenExpired = false;

    for (const matchId of selectedMatchIds) {
      const match = matches.find(m => m.id === matchId);

      // Use the match ID as the platform match ID.
      // The TG API returns numeric match IDs (e.g., 113672) that are compatible
      // with Dream11/My11Circle platform APIs.
      // CRITICAL: This must be a numeric ID, NOT a display name like "MO vs SUL".
      const platformMatchId = matchId;
      const numericMatchId = typeof matchId === 'string' ? parseInt(matchId, 10) : matchId;

      console.log('[JOIN CONTEST] Selected match:', match?.left_team_name, 'vs', match?.right_team_name);
      console.log('[JOIN CONTEST] Platform:', platform);
      console.log('[JOIN CONTEST] Platform Match ID:', platformMatchId, '(numeric:', numericMatchId, ')');
      console.log('[JOIN CONTEST] Account ID:', account.mobileNumber || 'unknown');
      console.log('[JOIN CONTEST] Sport Index:', match?.sport_index ?? 0);

      // Validate: matchId must be numeric
      if (isNaN(numericMatchId) || numericMatchId <= 0) {
        console.error('[JOIN CONTEST] INVALID matchId:', matchId, '— not a valid numeric ID. This should be a platform match ID like 113672, not a display name.');
        errors.push({
          matchId: String(matchId),
          error: `Invalid match ID "${matchId}". Must be a numeric platform match ID.`,
          errorType: 'invalid_match',
        });
        newMap.set(String(matchId), []);
        continue;
      }

      const result: JCContestFetchResult = await getPlatformContests(
        platform,
        platformMatchId,
        account.authToken,
        match?.sport_index ?? 0,
        account.my11circleChallenge || undefined,
      );

      console.log('[JOIN CONTEST] Contest count:', result.contests.length);
      console.log('[JOIN CONTEST] Error type:', result.errorType);

      if (result.errorType === 'auth') {
        anyTokenExpired = true;
        errors.push({
          matchId: String(matchId),
          error: result.error || 'Session expired',
          errorType: 'auth',
        });
        // Still set empty array for this match
        newMap.set(String(matchId), []);
      } else if (result.errorType && result.errorType !== 'none') {
        errors.push({
          matchId: String(matchId),
          error: result.error || 'Failed to load contests',
          errorType: result.errorType,
        });
        newMap.set(String(matchId), []);
      } else {
        // Success (possibly 0 contests — that's a valid state)
        newMap.set(String(matchId), result.contests);
      }

      // Validate: contest.matchId should match our matchId
      for (const contest of result.contests) {
        if (contest.matchId && contest.matchId !== platformMatchId) {
          console.warn('[JOIN CONTEST] Contest matchId mismatch:', contest.matchId, '!==', platformMatchId, 'for contest:', contest.id);
        }
      }

      console.log('[JOIN CONTEST] Normalized contests for match', platformMatchId, ':', result.contests.length);
    }

    setContestsMap(newMap);
    setContestErrors(errors);
    setContestTokenExpired(anyTokenExpired);
    setLoadingContests(false);
  }, [selectedMatchIds, platform, account, matches]);

  const toggleContest = (id: string) => {
    setSelectedContestIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllContests = () => {
    const allIds: string[] = [];
    for (const contests of contestsMap.values()) {
      for (const c of contests) {
        if (c.joinAvailable) allIds.push(c.id);
      }
    }
    setSelectedContestIds(new Set(allIds));
  };

  const deselectAllContests = () => {
    setSelectedContestIds(new Set());
  };

  // Total contest count across all matches
  const totalContestCount = useMemo(() => {
    let count = 0;
    for (const contests of contestsMap.values()) {
      count += contests.length;
    }
    return count;
  }, [contestsMap]);

  // Total joinable contest count
  const totalJoinableCount = useMemo(() => {
    let count = 0;
    for (const contests of contestsMap.values()) {
      count += contests.filter(c => c.joinAvailable).length;
    }
    return count;
  }, [contestsMap]);

  // ============ Join Execution ============
  const executeJoin = useCallback(async () => {
    const selectedMatches = matches.filter(m => selectedMatchIds.has(m.id));
    const selectedContestsForJoin = new Map<string, JCContest[]>();
    for (const [matchId, contests] of contestsMap.entries()) {
      selectedContestsForJoin.set(matchId, contests.filter(c => selectedContestIds.has(c.id)));
    }

    const items = buildJoinItems(selectedMatches, selectedContestsForJoin, selectedTeamIds, platformTeams, platform);

    if (items.length === 0) {
      setStep('result');
      return;
    }

    setJoinItems(items);
    setProgress({ current: 0, total: items.length, status: 'joining' });
    setStep('joining');

    const updatedItems = [...items];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setProgress(prev => ({ ...prev, current: i + 1 }));
      setJoinItems(prev => prev.map((it, idx) =>
        idx === i ? { ...it, status: 'processing' } : it
      ));

      try {
        const match = matches.find(m => String(m.id) === String(item.matchId));
        // Ensure matchId is numeric for the join API
        const numericMatchId = typeof item.matchId === 'string' ? parseInt(item.matchId, 10) : item.matchId;
        const res = await fetch('/api/fantasy/join-contest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fantasyApp: item.platform || platform,
            matchId: numericMatchId,      // Numeric platform match ID
            authToken: account?.authToken, // Platform session token from verify-otp
            teamId: item.teamId,           // REAL platform team ID (from list-of-teams)
            contestId: item.contestId,     // REAL platform contest ID
            sportIndex: match?.sport_index ?? 0,
            challenge: account?.my11circleChallenge || undefined,
          }),
        });
        const data = await res.json();

        const status = data.status === 'success' ? 'success'
          : data.status === 'already_joined' ? 'already_joined' : 'fail';

        updatedItems[i] = { ...updatedItems[i], status, message: data.message };
        setJoinItems([...updatedItems]);
      } catch {
        updatedItems[i] = { ...updatedItems[i], status: 'fail', message: 'Network error' };
        setJoinItems([...updatedItems]);
      }

      // Rate limit between joins
      await new Promise(r => setTimeout(r, 300));
    }

    setResultItems([...updatedItems]);
    setProgress(prev => ({ ...prev, status: 'done' }));
    setStep('result');
  }, [matches, selectedMatchIds, contestsMap, selectedContestIds, selectedTeamIds, platformTeams, platform, account]);

  // ============ Result Stats ============
  const resultStats = useMemo(() => {
    const items = resultItems.length > 0 ? resultItems : joinItems;
    return {
      total: items.length,
      success: items.filter(i => i.status === 'success').length,
      alreadyJoined: items.filter(i => i.status === 'already_joined').length,
      fail: items.filter(i => i.status === 'fail').length,
    };
  }, [resultItems, joinItems]);

  if (!open) return null;

  // ============ RENDER ============
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-green-600 to-emerald-600 text-white">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6" />
            <h2 className="text-lg font-bold">Join Contest</h2>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-white/20 rounded-lg transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-1 px-6 py-3 bg-gray-50 border-b">
          {(['matches', 'teams', 'contests', 'joining', 'result'] as Step[]).map((s, i) => {
            const labels = ['Match', 'Teams', 'Contests', 'Join', 'Result'];
            const stepOrder = ['matches', 'teams', 'contests', 'joining', 'result'];
            const isActive = step === s;
            const isDone = stepOrder.indexOf(step) > i;
            return (
              <React.Fragment key={s}>
                {i > 0 && <ChevronRight className="w-3 h-3 text-gray-300" />}
                <div className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg transition-all ${
                  isActive ? 'bg-green-100 text-green-700' : isDone ? 'text-green-500' : 'text-gray-400'
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    isActive ? 'bg-green-600 text-white' : isDone ? 'bg-green-200 text-green-600' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {isDone ? '✓' : i + 1}
                  </div>
                  {labels[i]}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ===== STEP: MATCHES ===== */}
          {step === 'matches' && (
            <div className="space-y-4">
              {/* Platform Selection */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Platform</p>
                <div className="flex gap-2">
                  {availablePlatforms.map(p => (
                    <button key={p} onClick={() => setPlatform(p)}
                      className={`flex-1 rounded-xl border-2 p-3 text-center font-semibold text-sm transition-all ${
                        platform === p ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}>
                      {p === 'dream11' ? 'Dream11' : 'My11Circle'}
                    </button>
                  ))}
                </div>
                {availablePlatforms.length === 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                    ⚠️ No connected account found. Link your platform account first via Transfer.
                  </div>
                )}
              </div>

              {/* Match List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Select Matches</p>
                  <button onClick={selectAllMatches} className="text-xs font-semibold text-green-600 hover:text-green-700">
                    Select All
                  </button>
                </div>
                {matches.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No upcoming matches</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {matches.map(match => {
                      const selected = selectedMatchIds.has(match.id);
                      return (
                        <button key={match.id} onClick={() => toggleMatch(match.id)}
                          className={`w-full text-left rounded-xl border-2 p-3 transition-all ${
                            selected ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                              selected ? 'border-green-500 bg-green-500' : 'border-gray-300'
                            }`}>
                              {selected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-sm text-gray-900">
                                {match.left_team_name} vs {match.right_team_name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                <span>{match.match_time}</span>
                                {match.lineup_out === 1 && <span className="text-green-600 font-medium">Lineup Out</span>}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== STEP: TEAMS — EXISTING PLATFORM TEAMS ===== */}
          {step === 'teams' && (
            <div className="space-y-4">
              {/* Loading State */}
              {loadingTeams && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-green-500" />
                  <p className="text-sm text-gray-500 mt-3">Loading existing teams from {platform === 'dream11' ? 'Dream11' : 'My11Circle'}...</p>
                </div>
              )}

              {/* Error State */}
              {!loadingTeams && teamsError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">
                        {teamsTokenExpired ? 'SESSION EXPIRED' : 'Error Loading Teams'}
                      </p>
                      <p className="text-xs text-red-600 mt-0.5">{teamsError}</p>
                    </div>
                  </div>
                  {teamsTokenExpired && (
                    <p className="text-xs text-red-500 mt-2">Reconnect your {platform === 'dream11' ? 'Dream11' : 'My11Circle'} account via Transfer.</p>
                  )}
                  <button onClick={() => loadPlatformTeams()} className="mt-2 flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700">
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                </div>
              )}

              {/* No Account */}
              {!loadingTeams && !teamsError && !account?.authToken && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <p className="text-sm font-semibold text-amber-700">No connected account found</p>
                  <p className="text-xs text-amber-600 mt-1">Connect your {platform === 'dream11' ? 'Dream11' : 'My11Circle'} account to load existing teams.</p>
                </div>
              )}

              {/* Teams List */}
              {!loadingTeams && account?.authToken && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Existing Teams ({platformTeams.length} available)
                    </p>
                    <div className="flex gap-2">
                      <button onClick={selectAllTeams} disabled={platformTeams.length === 0}
                        className="text-xs font-semibold text-green-600 hover:text-green-700 disabled:opacity-40">
                        Select All
                      </button>
                      <button onClick={deselectAllTeams} disabled={selectedTeamIds.size === 0}
                        className="text-xs font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-40">
                        Deselect
                      </button>
                    </div>
                  </div>

                  {/* Mixed Team Toggle */}
                  <button onClick={() => setMixedTeamMode(!mixedTeamMode)}
                    className={`w-full rounded-xl border-2 p-3 transition-all ${
                      mixedTeamMode ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        mixedTeamMode ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <Filter className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-semibold text-sm ${mixedTeamMode ? 'text-purple-700' : 'text-gray-900'}`}>Mixed Team Mode</p>
                        <p className="text-xs text-gray-500">
                          {mixedTeamMode ? 'Combining teams from compatible platform accounts' : 'Enable to mix teams from compatible accounts'}
                        </p>
                      </div>
                      <div className={`w-10 h-6 rounded-full relative transition-all ${mixedTeamMode ? 'bg-purple-500' : 'bg-gray-300'}`}>
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${mixedTeamMode ? 'left-[18px]' : 'left-0.5'}`} />
                      </div>
                    </div>
                  </button>

                  {/* No Teams */}
                  {platformTeams.length === 0 && !teamsError && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
                      <p className="text-sm text-gray-500">No existing teams found on this platform account.</p>
                      <p className="text-xs text-gray-400 mt-1">Create teams on {platform === 'dream11' ? 'Dream11' : 'My11Circle'} first, then join contests.</p>
                    </div>
                  )}

                  {/* Team Cards */}
                  {platformTeams.length > 0 && (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {platformTeams.map(team => {
                        const selected = selectedTeamIds.has(team.id);
                        return (
                          <button key={team.id} onClick={() => toggleTeam(team.id)}
                            className={`w-full text-left rounded-xl border-2 p-3 transition-all ${
                              selected ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                                selected ? 'border-green-500 bg-green-500' : 'border-gray-300'
                              }`}>
                                {selected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-sm text-gray-900">{team.name}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                  <span>{team.playerCount || 11} Players</span>
                                  {team.captain?.name && <span>C: {team.captain.name}</span>}
                                  {team.viceCaptain?.name && <span>VC: {team.viceCaptain.name}</span>}
                                </div>
                              </div>
                              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                ID: {team.platformTeamId}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Selection Count */}
                  {selectedTeamIds.size > 0 && (
                    <p className="text-sm text-green-600 font-medium">
                      Selected: {selectedTeamIds.size} / {platformTeams.length}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===== STEP: CONTESTS — with proper error/loading states ===== */}
          {step === 'contests' && (
            <div className="space-y-4">
              {/* LOADING STATE */}
              {loadingContests && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-green-500" />
                  <p className="text-sm text-gray-500 mt-3">LOADING CONTESTS...</p>
                  <p className="text-xs text-gray-400 mt-1">Fetching contests from {platform === 'dream11' ? 'Dream11' : 'My11Circle'}</p>
                </div>
              )}

              {/* SESSION EXPIRED */}
              {!loadingContests && contestTokenExpired && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">SESSION EXPIRED</p>
                      <p className="text-xs text-red-600 mt-0.5">Your {platform === 'dream11' ? 'Dream11' : 'My11Circle'} session has expired.</p>
                    </div>
                  </div>
                  <p className="text-xs text-red-500 mt-2">Reconnect your account via Transfer to continue.</p>
                  <button onClick={loadContests} className="mt-2 flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700">
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                </div>
              )}

              {/* INVALID MATCH ID */}
              {!loadingContests && !contestTokenExpired && contestErrors.some(e => e.errorType === 'invalid_match') && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-500 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-orange-700">INVALID MATCH</p>
                      <p className="text-xs text-orange-600 mt-0.5">The match ID is not a valid numeric platform match ID.</p>
                    </div>
                  </div>
                  {contestErrors.filter(e => e.errorType === 'invalid_match').map((err, i) => (
                    <p key={i} className="text-xs text-orange-500 mt-1 ml-7">{err.error}</p>
                  ))}
                  <p className="text-xs text-orange-500 mt-2">Match IDs must be numeric (e.g., 113672), not display names like "MO vs SUL".</p>
                </div>
              )}

              {/* API/NETWORK ERRORS — HTTP 404 is NEVER silently converted to "0 contests" */}
              {!loadingContests && !contestTokenExpired && contestErrors.length > 0 && totalContestCount === 0 && (
                <div className="space-y-3">
                  {contestErrors.map((err, i) => {
                    const match = matches.find(m => String(m.id) === err.matchId);
                    const isInvalidMatch = err.errorType === 'invalid_match';
                    if (isInvalidMatch) return null; // Shown in dedicated section above
                    return (
                      <div key={i} className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-red-700">
                              {err.error.includes('404') ? 'HTTP 404 — CONTEST API NOT FOUND' : 'UNABLE TO LOAD CONTESTS'}
                            </p>
                            <p className="text-xs text-red-600 mt-0.5">
                              {match ? `${match.left_team_name} vs ${match.right_team_name}` : `Match ${err.matchId}`}
                            </p>
                            <p className="text-xs text-red-500 mt-0.5">{err.error}</p>
                          </div>
                        </div>
                        <button onClick={loadContests} className="mt-2 flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700">
                          <RefreshCw className="w-3 h-3" /> Retry
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* CONTESTS LIST (when not loading and we have data or genuine zero) */}
              {!loadingContests && !contestTokenExpired && (totalContestCount > 0 || contestErrors.length === 0) && (
                <div className="space-y-4">
                  {/* Select All / Deselect header */}
                  {totalContestCount > 0 && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        CONTESTS ({totalContestCount})
                      </p>
                      <div className="flex gap-2">
                        <button onClick={selectAllContests} disabled={totalJoinableCount === 0}
                          className="text-xs font-semibold text-green-600 hover:text-green-700 disabled:opacity-40">
                          Select All
                        </button>
                        <button onClick={deselectAllContests} disabled={selectedContestIds.size === 0}
                          className="text-xs font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-40">
                          Deselect
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Per-match contest groups */}
                  {Array.from(contestsMap.entries()).map(([matchId, contests]) => {
                    const match = matches.find(m => String(m.id) === matchId);
                    const matchError = contestErrors.find(e => e.matchId === matchId);
                    return (
                      <div key={matchId} className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {match?.left_team_name || '?'} vs {match?.right_team_name || '?'}
                          <span className="ml-2 text-gray-400">({contests.length} contests)</span>
                        </p>

                        {/* Error for this specific match (partial failure) — HTTP 404 shows diagnostic info */}
                        {matchError && contests.length === 0 && (
                          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                              <div>
                                <p className="text-xs font-semibold text-red-700">
                                  {matchError.error.includes('404') ? 'HTTP 404 — CONTEST API NOT FOUND' : 'UNABLE TO LOAD CONTESTS'}
                                </p>
                                <p className="text-[11px] text-red-600 mt-0.5">{matchError.error}</p>
                              </div>
                            </div>
                            <button onClick={loadContests} className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700">
                              <RefreshCw className="w-3 h-3" /> Retry
                            </button>
                          </div>
                        )}

                        {/* Genuine zero contests */}
                        {!matchError && contests.length === 0 && (
                          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                            <p className="text-sm text-gray-500">NO CONTESTS AVAILABLE FOR THIS MATCH</p>
                            <p className="text-xs text-gray-400 mt-1">This match may not have any joinable contests on {platform === 'dream11' ? 'Dream11' : 'My11Circle'}.</p>
                          </div>
                        )}

                        {/* Contest Cards */}
                        {contests.length > 0 && (
                          <div className="space-y-2">
                            {contests.map(contest => {
                              const selected = selectedContestIds.has(contest.id);
                              return (
                                <button key={contest.id} onClick={() => toggleContest(contest.id)}
                                  className={`w-full text-left rounded-xl border-2 p-3 transition-all ${
                                    selected ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'
                                  } ${!contest.joinAvailable ? 'opacity-50' : ''}`}>
                                  <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                                      selected ? 'border-green-500 bg-green-500' : 'border-gray-300'
                                    }`}>
                                      {selected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-semibold text-sm text-gray-900 truncate">{contest.name}</p>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${getContestTypeColor(contest.type)}`}>
                                          {contest.type}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                        <span className="flex items-center gap-0.5"><DollarSign className="w-3 h-3" />{formatCurrency(contest.entryFee)}</span>
                                        <span>Prize: {formatCurrency(contest.prizePool)}</span>
                                        <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{contest.filledSpots}/{contest.totalSpots}</span>
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        {contest.remainingSpots > 0 && (
                                          <p className="text-[10px] text-green-600">{contest.remainingSpots} spots remaining</p>
                                        )}
                                        {!contest.joinAvailable && (
                                          <p className="text-[10px] text-red-500">Full</p>
                                        )}
                                        {contest.joinAvailable && (
                                          <p className="text-[10px] text-green-600 font-medium">JOIN AVAILABLE</p>
                                        )}
                                      </div>
                                    </div>
                                    <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0" title="Platform Contest ID">
                                      {contest.contestId}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Selected contest count */}
                  {selectedContestIds.size > 0 && (
                    <p className="text-sm text-green-600 font-medium">
                      Selected: {selectedContestIds.size} contest{selectedContestIds.size !== 1 ? 's' : ''}
                    </p>
                  )}

                  {/* Zero contests overall (genuine) */}
                  {totalContestCount === 0 && contestErrors.length === 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
                      <p className="text-sm text-gray-500">NO CONTESTS AVAILABLE</p>
                      <p className="text-xs text-gray-400 mt-1">None of the selected matches have joinable contests on {platform === 'dream11' ? 'Dream11' : 'My11Circle'} right now.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===== STEP: JOINING ===== */}
          {step === 'joining' && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-green-700">Joining contests...</span>
                  <span className="text-sm font-bold text-green-700">{progress.current}/{progress.total}</span>
                </div>
                <div className="w-full bg-green-200 rounded-full h-3 overflow-hidden">
                  <div className="bg-green-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }} />
                </div>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-green-600 font-medium">✓ {resultStats.success} joined</span>
                  <span className="text-amber-600 font-medium">⊙ {resultStats.alreadyJoined} already</span>
                  <span className="text-red-500 font-medium">✗ {resultStats.fail} failed</span>
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1.5">
                {joinItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs py-1 px-2 rounded-lg bg-gray-50">
                    {item.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full bg-gray-200 shrink-0" />}
                    {item.status === 'processing' && <Loader2 className="w-3.5 h-3.5 animate-spin text-green-500 shrink-0" />}
                    {item.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                    {item.status === 'already_joined' && <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    {item.status === 'fail' && <X className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                    <span className="text-gray-600 truncate">{item.matchName}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-gray-700 font-medium truncate">{item.contestName}</span>
                    <span className="text-gray-400">→</span>
                    <span className="truncate">{item.teamName}</span>
                    {item.message && item.status !== 'success' && (
                      <span className="text-gray-400 truncate ml-auto">{item.message}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== STEP: RESULT ===== */}
          {step === 'result' && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <Trophy className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">JOIN COMPLETE</h3>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-gray-900">{resultStats.total}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Total</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-green-600">{resultStats.success}</p>
                  <p className="text-[10px] text-green-600 uppercase">Joined</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-amber-600">{resultStats.alreadyJoined}</p>
                  <p className="text-[10px] text-amber-600 uppercase">Already</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-red-500">{resultStats.fail}</p>
                  <p className="text-[10px] text-red-500 uppercase">Failed</p>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {(() => {
                  const byMatch = new Map<string, JCJoinItem[]>();
                  for (const item of (resultItems.length > 0 ? resultItems : joinItems)) {
                    const key = String(item.matchId);
                    if (!byMatch.has(key)) byMatch.set(key, []);
                    byMatch.get(key)!.push(item);
                  }
                  return Array.from(byMatch.entries()).map(([matchId, items]) => (
                    <div key={matchId} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs font-semibold text-gray-700 mb-1">{items[0].matchName}</p>
                      {items.map((item, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px] py-0.5">
                          {item.status === 'success' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                          {item.status === 'already_joined' && <AlertCircle className="w-3 h-3 text-amber-500" />}
                          {item.status === 'fail' && <X className="w-3 h-3 text-red-500" />}
                          <span className="text-gray-600">{item.contestName}</span>
                          <span className="text-gray-400">— {item.teamName}</span>
                          {item.message && <span className="text-gray-400 ml-auto">{item.message}</span>}
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <div>
            {step !== 'matches' && step !== 'joining' && step !== 'result' && (
              <button onClick={() => {
                const prev: Record<Step, Step | null> = {
                  matches: null, teams: 'matches', contests: 'teams',
                  joining: null, result: null,
                };
                const p = prev[step];
                if (p) setStep(p);
              }} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 font-medium">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === 'matches' && (
              <button onClick={() => {
                if (selectedMatchIds.size > 0 && availablePlatforms.length > 0) {
                  setStep('teams');
                  loadPlatformTeams();
                }
              }} disabled={selectedMatchIds.size === 0 || availablePlatforms.length === 0}
                className="px-6 py-2.5 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === 'teams' && (
              <button onClick={() => {
                if (selectedTeamIds.size > 0) {
                  setStep('contests');
                  loadContests();
                }
              }} disabled={selectedTeamIds.size === 0}
                className="px-6 py-2.5 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === 'contests' && (
              <button onClick={executeJoin} disabled={selectedContestIds.size === 0}
                className="px-6 py-2.5 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                JOIN ALL SELECTED ({selectedContestIds.size * selectedTeamIds.size})
              </button>
            )}
            {step === 'result' && (
              <button onClick={handleClose}
                className="px-6 py-2.5 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-all">
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
