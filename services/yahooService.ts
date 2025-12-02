import { LeagueData, Manager, Season, ManagerSeason, DraftPick, Transaction, LeagueSummary, Game } from '../types';

const PROXY_URL = 'https://corsproxy.io/?';
const BASE_URL = 'https://fantasysports.yahooapis.com/fantasy/v2';

// Game IDs for NFL Fantasy Football from 2011 to 2025
const NFL_GAME_KEYS = [
  461, // 2025 (Future/Current)
  449, // 2024
  423, // 2023
  414, // 2022
  406, // 2021
  399, // 2020
  390, // 2019
  380, // 2018
  371, // 2017
  359, // 2016
  348, // 2015
  331, // 2014
  314, // 2013
  273, // 2012
  257  // 2011
];

export type LogType = 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
export type Logger = (type: LogType, message: string) => void;

// Utility to pause execution
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Robust fetch with retry logic
const fetchWithRetry = async (url: string, accessToken: string, retries = 5, backoff = 2000): Promise<Response> => {
  try {
    const response = await fetch(`${PROXY_URL}${encodeURIComponent(url)}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      // If 429 (Too Many Requests) or 5xx (Server Error), retry
      if ((response.status === 429 || response.status >= 500) && retries > 0) {
        console.warn(`Request failed (${response.status}), retrying in ${backoff}ms...`);
        await wait(backoff);
        return fetchWithRetry(url, accessToken, retries - 1, backoff * 2);
      }
      return response; // Return the error response if not retriable or out of retries
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      console.warn(`Network error, retrying in ${backoff}ms...`, error);
      await wait(backoff);
      return fetchWithRetry(url, accessToken, retries - 1, backoff * 2);
    }
    throw error;
  }
};

// --- HELPER FUNCTIONS FOR ROBUST PARSING ---

// Safely extracts a property from a node that could be an Object OR an Array of Objects
const safeExtract = (node: any, key: string): any => {
  if (!node) return undefined;
  
  // If array, look for the item containing the key
  if (Array.isArray(node)) {
    for (const item of node) {
      if (item && typeof item === 'object' && key in item) {
        return item[key];
      }
    }
    return undefined;
  }
  
  // If object, just return the key
  if (typeof node === 'object') {
    return node[key];
  }

  return undefined;
};

// Extract Team Key safely from weird Yahoo "Team" structure
const getTeamKey = (teamData: any): string | null => {
  if (!teamData) return null;

  // teamData is usually [ [ {team_key: '...'}, ...meta ], {team_points...} ]
  if (Array.isArray(teamData)) {
    const metaList = teamData[0];
    if (Array.isArray(metaList)) {
       const keyObj = metaList.find((x: any) => x && typeof x === 'object' && x.team_key);
       return keyObj ? keyObj.team_key : null;
    }
    // Fallback if metaList is just an object (rare)
    if (metaList && typeof metaList === 'object' && 'team_key' in metaList) {
        return (metaList as any).team_key;
    }
  } 
  else if (typeof teamData === 'object' && teamData.team_key) {
      return teamData.team_key;
  }
  return null;
};

// Extract Points safely
const getTeamPoints = (teamData: any): number => {
    if (!teamData) return 0;
    
    const pointsObj = safeExtract(teamData, 'team_points');
    if (pointsObj && pointsObj.total) {
        return parseFloat(pointsObj.total);
    }
    return 0;
}

// ---------------------------------------------

export const fetchUserLeagues = async (accessToken: string): Promise<LeagueSummary[]> => {
  // Fetch leagues across all known NFL game keys to build a history
  const keysString = NFL_GAME_KEYS.join(',');
  const url = `${BASE_URL}/users;use_login=1/games;game_keys=${keysString}/leagues?format=json`;

  const response = await fetchWithRetry(url, accessToken);

  if (!response.ok) {
     const text = await response.text();
     throw new Error(`Yahoo API Error (${response.status}): ${text.substring(0, 100)}`);
  }

  const json = await response.json();
  const leagues: LeagueSummary[] = [];
  
  const gamesNode = json?.fantasy_content?.users?.[0]?.user?.find((x: any) => x.games)?.games;
  if (!gamesNode) return [];

  const gameCount = gamesNode.count;
  for (let i = 0; i < gameCount; i++) {
    const gameWrapper = gamesNode[i + ""]?.game;
    if (!gameWrapper) continue;

    const gameMeta = gameWrapper[0];
    const seasonYear = parseInt(gameMeta.season);
    
    const leaguesNode = gameWrapper.find((x: any) => x.leagues)?.leagues;
    if (!leaguesNode) continue;

    const leagueCount = leaguesNode.count;
    for (let j = 0; j < leagueCount; j++) {
       const leagueObj = leaguesNode[j + ""]?.league;
       if (!leagueObj) continue;
       
       const meta = leagueObj[0];
       leagues.push({
         key: meta.league_key,
         name: meta.name,
         year: seasonYear,
         logo: meta.logo_url
       });
    }
  }

  // Sort by year desc
  return leagues.sort((a, b) => b.year - a.year);
};

export const fetchYahooData = async (
  accessToken: string, 
  leagueKeys: string[],
  log?: Logger
): Promise<LeagueData> => {
  if (!leagueKeys || leagueKeys.length === 0) throw new Error("No leagues selected.");
  
  const safeLog = (type: LogType, msg: string) => {
      console.log(`[${type}] ${msg}`);
      if (log) log(type, msg);
  };

  // Batch leagues to initial metadata fetch
  const BATCH_SIZE = 10; 
  const chunks = [];
  for (let i = 0; i < leagueKeys.length; i += BATCH_SIZE) {
    chunks.push(leagueKeys.slice(i, i + BATCH_SIZE));
  }

  const allSeasons: Season[] = [];
  const allManagersMap = new Map<string, any>();

  for (const chunk of chunks) {
     const keysString = chunk.join(',');
     const targetUrl = `${BASE_URL}/leagues;league_keys=${keysString};out=standings,draftresults,transactions?format=json`;
     
     safeLog('INFO', `Fetching metadata for ${chunk.length} league(s)...`);

     const response = await fetchWithRetry(targetUrl, accessToken);

     if (!response.ok) {
        if (response.status === 401) throw new Error("Unauthorized: Token expired");
        safeLog('ERROR', `Batch metadata fetch failed for keys: ${keysString}`);
        continue;
     }

     const json = await response.json();
     const { managers, seasons } = await transformYahooData(json, accessToken, allManagersMap); 
     
     safeLog('SUCCESS', `Parsed ${seasons.length} seasons of metadata.`);

     // Fetch Schedule/Matchups sequentially for each season to avoid timeout/rate-limit
     for (const season of seasons) {
        try {
            safeLog('INFO', `Starting matchup sync for ${season.year}...`);
            
            // Build a map of TeamKey -> ManagerID for this season
            const teamMap = new Map<string, string>();
            season.standings.forEach(s => teamMap.set(s.teamKey, s.managerId));

            // Fetch games week by week
            season.games = await fetchSeasonGames(season.key, accessToken, teamMap, season.year, safeLog);
            
            if (season.games.length > 0) {
                safeLog('SUCCESS', `Loaded ${season.games.length} games for ${season.year}.`);
            } else {
                safeLog('WARN', `No games found for ${season.year}.`);
            }
            
            // Polite delay between seasons
            await wait(2000); 

        } catch (e: any) {
            safeLog('ERROR', `Failed to fetch matchups for season ${season.year}: ${e.message}`);
            season.games = [];
        }
     }

     allSeasons.push(...seasons);
  }

  allSeasons.sort((a, b) => a.year - b.year);
  const managers = Array.from(allManagersMap.values()).map(({id, name, avatar}) => ({id, name, avatar}));

  return { managers, seasons: allSeasons };
};

const fetchSeasonGames = async (
    leagueKey: string, 
    accessToken: string, 
    teamMap: Map<string, string>, 
    year: number,
    log: Logger
): Promise<Game[]> => {
    const games: Game[] = [];
    
    // Fetch weeks 1 through 18 sequentially.
    const MAX_WEEKS = 18;
    
    for (let week = 1; week <= MAX_WEEKS; week++) {
        const url = `${BASE_URL}/leagues;league_keys=${leagueKey}/scoreboard;week=${week}?format=json`;
        
        log('INFO', `Fetching ${year} Week ${week} scoreboard...`);

        try {
            // High retry count, generous backoff
            const response = await fetchWithRetry(url, accessToken, 5, 2000);
            
            if (!response.ok) {
                log('WARN', `Skipping Week ${week} (API Status: ${response.status})`);
                continue;
            }

            const json = await response.json();
            
            // ROBUST TRAVERSAL
            // 1. Find League Node
            const fc = json?.fantasy_content;
            const leaguesNode = safeExtract(fc, 'leagues');
            const leagueNode = safeExtract(leaguesNode, 'league');

            if (!leagueNode) {
                // log('WARN', `Week ${week}: No league data found.`);
                continue;
            }

            // 2. Find Scoreboard
            const scoreboard = safeExtract(leagueNode, 'scoreboard');
            if (!scoreboard) {
                // log('WARN', `Week ${week}: No scoreboard found.`);
                continue;
            }

            // 3. Find Matchups
            const matchupsNode = safeExtract(scoreboard, 'matchups');
            if (!matchupsNode) continue;

            // 4. Iterate Matchups
            // Matchups can be an array OR an object with {0:..., 1:..., count: "N"}
            let count = 0;
            let getMatchupByIndex = (i: number) => null;

            if (Array.isArray(matchupsNode)) {
                count = matchupsNode.length;
                getMatchupByIndex = (i) => matchupsNode[i]?.matchup;
            } else if (matchupsNode.count) {
                count = parseInt(matchupsNode.count);
                getMatchupByIndex = (i) => {
                    const wrapper = matchupsNode[String(i)];
                    return wrapper ? wrapper.matchup : null;
                };
            }

            if (count === 0) continue;

            let gamesFound = 0;

            for(let i=0; i<count; i++) {
                const matchupData = getMatchupByIndex(i);
                if (!matchupData) continue;

                // 5. Extract Meta (week, playoffs, etc)
                // Matchup data is usually [ {week:..}, {teams:..} ]
                // Use safeExtract to find the object containing 'week'
                const weekStr = safeExtract(matchupData, 'week');
                const isPlayoffsStr = safeExtract(matchupData, 'is_playoffs');
                const winnerKey = safeExtract(matchupData, 'winner_team_key');
                const isTiedStr = safeExtract(matchupData, 'is_tied');

                // 6. Extract Teams
                const teamsWrapper = safeExtract(matchupData, 'teams');
                if (!teamsWrapper) continue;

                // Teams wrapper is usually {0: {team:..}, 1: {team:..}, count: "2"}
                const team0Wrapper = teamsWrapper["0"]?.team;
                const team1Wrapper = teamsWrapper["1"]?.team;

                if (team0Wrapper && team1Wrapper) {
                     const t0Key = getTeamKey(team0Wrapper);
                     const t1Key = getTeamKey(team1Wrapper);
                     
                     const t0Pts = getTeamPoints(team0Wrapper);
                     const t1Pts = getTeamPoints(team1Wrapper);
                     
                     const mgr0 = t0Key ? teamMap.get(t0Key) : null;
                     const mgr1 = t1Key ? teamMap.get(t1Key) : null;

                     if (mgr0 && mgr1 && t0Key && t1Key) {
                         games.push({
                             week: weekStr ? parseInt(weekStr) : week,
                             isPlayoffs: isPlayoffsStr === '1',
                             winnerTeamKey: winnerKey,
                             isTie: isTiedStr === '1',
                             teamA: { managerId: mgr0, teamKey: t0Key, points: t0Pts },
                             teamB: { managerId: mgr1, teamKey: t1Key, points: t1Pts }
                         });
                         gamesFound++;
                     }
                }
            }
            
            // Polite delay to avoid rate limits (Critical for deep history syncs)
            await wait(1500);

        } catch (e: any) {
            log('ERROR', `Error fetching games for ${year} week ${week}: ${e.message}`);
        }
    }

    // De-duplicate games based on week and team keys to be safe
    const uniqueGames = Array.from(new Map(games.map(g => [`${g.week}-${g.teamA.teamKey}-${g.teamB.teamKey}`, g])).values());
    return uniqueGames.sort((a: any, b: any) => a.week - b.week);
};

export const fetchPlayerDetails = async (accessToken: string, playerKeys: string[]) => {
  const uniqueKeys = Array.from(new Set(playerKeys)).filter(k => !!k);
  if (uniqueKeys.length === 0) return {};

  const map: Record<string, string> = {};
  
  const chunks = [];
  for (let i = 0; i < uniqueKeys.length; i += 25) {
    chunks.push(uniqueKeys.slice(i, i + 25));
  }

  // Process player batches sequentially
  for (const chunk of chunks) {
    const keysStr = chunk.join(',');
    const url = `${BASE_URL}/players;player_keys=${keysStr}?format=json`;
    
    try {
        const res = await fetchWithRetry(url, accessToken);
        if (!res.ok) continue;
        
        const json = await res.json();
        const players = json?.fantasy_content?.players;
        
        if (!players || !players.count) continue;
        
        for (let i = 0; i < players.count; i++) {
           const pObj = players[i + ""]; 
           const pArr = pObj?.player;
           if (!pArr) continue;
           
           const metaArr = Array.isArray(pArr) ? pArr[0] : null;
           
           if (Array.isArray(metaArr)) {
             const pKeyInfo = metaArr.find((x:any) => x.player_key);
             const pNameInfo = metaArr.find((x:any) => x.name);
             
             if (pKeyInfo?.player_key && pNameInfo?.name?.full) {
               map[pKeyInfo.player_key] = pNameInfo.name.full;
             }
           }
        }
        await wait(200);
    } catch(e) { console.error("Error fetching players", e); }
  }

  return map;
};

// Kept for backward compatibility
export const fetchMatchups = async (accessToken: string, teamKeys: string[]) => {
    return [];
};

const transformYahooData = async (data: any, accessToken: string, managersMap: Map<string, any> = new Map()): Promise<{ seasons: Season[], managers: any }> => {
  const teamKeyToManagerId = new Map<string, string>();
  const seasons: Season[] = [];

  const leaguesObj = data?.fantasy_content?.leagues;
  if (!leaguesObj) return { seasons: [], managers: managersMap };

  const count = leaguesObj.count;
  const unknownPlayerKeys = new Set<string>();
  
  for (let i = 0; i < count; i++) {
    const leagueData = leaguesObj[i + ""]?.league;
    if (!leagueData) continue;

    const metadata = leagueData[0];
    const leagueKey = metadata.league_key;
    const year = parseInt(metadata.season);

    const standingsNode = leagueData.find((n: any) => n.standings);
    const draftNode = leagueData.find((n: any) => n.draft_results);
    const transactionsNode = leagueData.find((n: any) => n.transactions);

    const standingsData = standingsNode?.standings?.[0]?.teams;
    const seasonStandings: ManagerSeason[] = [];

    if (standingsData) {
      const teamCount = standingsData.count;
      for (let j = 0; j < teamCount; j++) {
        const teamWrapper = standingsData[j + ""]?.team;
        if (!teamWrapper) continue;

        const teamMeta = teamWrapper[0];
        const teamKey = teamMeta.find((x: any) => x.team_key)?.team_key;
        const teamStandingsObj = teamWrapper[2]?.team_standings;
        
        const managersList = teamMeta.find((x: any) => x.managers)?.managers;
        if (!managersList) continue;

        const managerData = managersList[0]?.manager;
        const guid = managerData.guid;
        const rawNickname = managerData.nickname;
        const teamName = teamMeta.find((x: any) => x.name)?.name?.replace(/&#39;/g, "'") || "Unknown Team";
        const avatar = managerData.image_url || 'https://s.yimg.com/dh/ap/fantasy/img/profile/icon_user_default.png';

        if (teamKey && guid) {
          teamKeyToManagerId.set(teamKey, guid);
        }

        const isHidden = rawNickname === '--hidden--';
        const displayName = isHidden ? teamName : rawNickname;

        const existing = managersMap.get(guid);
        if (!existing) {
          managersMap.set(guid, { 
            id: guid, 
            name: displayName, 
            avatar, 
            _lastSeenYear: year, 
            _isFallback: isHidden 
          });
        } else {
           const existingIsFallback = existing._isFallback;
           const isNewer = year > existing._lastSeenYear;
           if (existingIsFallback && !isHidden) {
             managersMap.set(guid, { id: guid, name: displayName, avatar, _lastSeenYear: year, _isFallback: false });
           } else if (isNewer && (existingIsFallback === isHidden)) {
             managersMap.set(guid, { id: guid, name: displayName, avatar, _lastSeenYear: year, _isFallback: isHidden });
           }
        }

        const outcome = teamStandingsObj.outcome_totals;
        seasonStandings.push({
          managerId: guid,
          teamKey: teamKey || '',
          stats: {
            rank: teamStandingsObj.rank,
            wins: parseInt(outcome.wins),
            losses: parseInt(outcome.losses),
            ties: parseInt(outcome.ties),
            pointsFor: parseFloat(teamStandingsObj.points_for),
            pointsAgainst: parseFloat(teamStandingsObj.points_against),
            isChampion: teamStandingsObj.rank === 1,
            isPlayoff: teamStandingsObj.rank <= 4 
          }
        });
      }
    }

    const draftPicks: DraftPick[] = [];
    if (draftNode && draftNode.draft_results) {
      const draftCount = draftNode.draft_results.count;
      for (let d = 0; d < draftCount; d++) {
        const pickObj = draftNode.draft_results[d + ""]?.draft_result;
        if (!pickObj) continue;
        
        const tKey = pickObj.team_key;
        const mgrId = teamKeyToManagerId.get(tKey) || 'unknown';
        const playerKey = pickObj.player_key;
        
        if (playerKey) unknownPlayerKeys.add(playerKey);

        draftPicks.push({
          round: pickObj.round,
          pick: pickObj.pick,
          player: "Unknown Player", 
          playerKey: playerKey || undefined,
          managerId: mgrId,
          teamKey: tKey
        });
      }
    }

    const transactions: Transaction[] = [];
    if (transactionsNode && transactionsNode.transactions) {
        const txnObj = transactionsNode.transactions;
        const txnCount = txnObj.count;
        for(let t=0; t<txnCount; t++) {
            const txn = txnObj[t + ""]?.transaction;
            if(!txn) continue;
            const txnId = txn[0].transaction_id;
            const type = txn[0].type;
            const timestamp = txn[0].timestamp;
            const playersNode = txn.find((n: any) => n.players)?.players;
            const playersInvolved: any[] = [];
            const mgrsInvolved = new Set<string>();

            if (playersNode) {
            for(let p=0; p<playersNode.count; p++) {
                const pData = playersNode[p + ""]?.player;
                if(!pData) continue;
                const pInfo = pData[0];
                const txnData = pData[1]?.transaction_data;
                const pName = pInfo.find((x:any) => x.name)?.name?.full || 'Unknown';
                const destTeam = txnData?.[0]?.destination_team_key;
                const sourceTeam = txnData?.[0]?.source_team_key;
                if (txnData?.[0]?.type === 'add') {
                    const mId = teamKeyToManagerId.get(destTeam) || '';
                    if(mId) mgrsInvolved.add(mId);
                    playersInvolved.push({ name: pName, type: 'add', managerId: mId });
                } else if (txnData?.[0]?.type === 'drop') {
                    const mId = teamKeyToManagerId.get(sourceTeam) || '';
                    if(mId) mgrsInvolved.add(mId);
                    playersInvolved.push({ name: pName, type: 'drop', managerId: mId });
                }
            }
            }
            transactions.push({
            id: txnId, type, date: parseInt(timestamp) * 1000, managerIds: Array.from(mgrsInvolved), players: playersInvolved
            });
        }
    }

    seasonStandings.sort((a, b) => a.stats.rank - b.stats.rank);

    seasons.push({
      year,
      key: leagueKey,
      championId: seasonStandings[0]?.managerId,
      standings: seasonStandings,
      draft: draftPicks.sort((a,b) => a.pick - b.pick),
      transactions,
      games: [] 
    });
  }

  // Batch resolve names
  if (unknownPlayerKeys.size > 0) {
      try {
          const nameMap = await fetchPlayerDetails(accessToken, Array.from(unknownPlayerKeys));
          if (nameMap) {
              seasons.forEach(season => {
                  if (season.draft) {
                      season.draft.forEach(pick => {
                          if (pick.playerKey && nameMap[pick.playerKey]) {
                              pick.player = nameMap[pick.playerKey];
                          }
                      });
                  }
              });
          }
      } catch (e) {
          console.error("Failed to resolve batch player names", e);
      }
  }

  return { seasons, managers: managersMap };
};