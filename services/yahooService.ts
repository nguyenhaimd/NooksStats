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

// Utility to pause execution
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Robust fetch with retry logic
const fetchWithRetry = async (url: string, accessToken: string, retries = 3, backoff = 1000): Promise<Response> => {
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
  onProgress?: (status: string) => void
): Promise<LeagueData> => {
  if (!leagueKeys || leagueKeys.length === 0) throw new Error("No leagues selected.");

  // Batch leagues to initial metadata fetch
  const BATCH_SIZE = 10; // Reduce batch size to be safer
  const chunks = [];
  for (let i = 0; i < leagueKeys.length; i += BATCH_SIZE) {
    chunks.push(leagueKeys.slice(i, i + BATCH_SIZE));
  }

  const allSeasons: Season[] = [];
  const allManagersMap = new Map<string, any>();

  for (const chunk of chunks) {
     const keysString = chunk.join(',');
     const targetUrl = `${BASE_URL}/leagues;league_keys=${keysString};out=standings,draftresults,transactions?format=json`;
     
     if (onProgress) onProgress(`Fetching metadata for ${chunk.length} leagues...`);

     const response = await fetchWithRetry(targetUrl, accessToken);

     if (!response.ok) {
        if (response.status === 401) throw new Error("Unauthorized: Token expired");
        console.warn(`Batch failed for keys: ${keysString}`);
        continue;
     }

     const json = await response.json();
     const { managers, seasons } = await transformYahooData(json, accessToken, allManagersMap); 
     
     // Fetch Schedule/Matchups sequentially for each season to avoid timeout/rate-limit
     for (const season of seasons) {
        try {
            if (onProgress) onProgress(`Fetching Matchups: ${season.year}...`);
            
            // Build a map of TeamKey -> ManagerID for this season
            const teamMap = new Map<string, string>();
            season.standings.forEach(s => teamMap.set(s.teamKey, s.managerId));

            // Fetch games with robust chunking
            season.games = await fetchSeasonGames(season.key, accessToken, teamMap);
            
            // Polite delay between seasons
            await wait(500); 

        } catch (e) {
            console.warn(`Failed to fetch matchups for season ${season.year}`, e);
            season.games = [];
        }
     }

     allSeasons.push(...seasons);
  }

  allSeasons.sort((a, b) => a.year - b.year);
  const managers = Array.from(allManagersMap.values()).map(({id, name, avatar}) => ({id, name, avatar}));

  return { managers, seasons: allSeasons };
};

const fetchSeasonGames = async (leagueKey: string, accessToken: string, teamMap: Map<string, string>): Promise<Game[]> => {
    // Split into small chunks of weeks (4 weeks) to prevent large payloads/timeouts
    // A standard fantasy season is ~16-18 weeks.
    const weekChunks = [
        [1,2,3,4],
        [5,6,7,8],
        [9,10,11,12],
        [13,14,15,16],
        [17,18]
    ];
    
    const games: Game[] = [];
    
    // Process chunks sequentially
    for (const weeks of weekChunks) {
        const weeksStr = weeks.join(',');
        const url = `${BASE_URL}/leagues;league_keys=${leagueKey}/scoreboard;week=${weeksStr}?format=json`;
        
        try {
            const response = await fetchWithRetry(url, accessToken, 3, 1500);
            
            if (!response.ok) continue;

            const json = await response.json();
            const leagueNode = json?.fantasy_content?.leagues?.[0]?.league;
            if (!leagueNode) continue;

            const scoreboard = leagueNode.find((x:any) => x.scoreboard)?.scoreboard;
            if (!scoreboard) continue;

            const matchupsNode = scoreboard[0]?.matchups;
            if (!matchupsNode) continue;

            const count = matchupsNode.count;
            for(let i=0; i<count; i++) {
                const matchupWrapper = matchupsNode[i + ""]?.matchup;
                if (!matchupWrapper) continue;

                // Robustly find metadata
                const meta = matchupWrapper.find((x:any) => x.week) || matchupWrapper[0]; 
                const teamsWrapper = matchupWrapper.find((x:any) => x.teams)?.teams;

                if (teamsWrapper) {
                     const team0Data = teamsWrapper["0"]?.team;
                     const team1Data = teamsWrapper["1"]?.team;
                     
                     if (team0Data && team1Data) {
                         const t0Key = team0Data[0]?.find((x:any) => x.team_key)?.team_key;
                         const t0PtsObj = team0Data.find((x:any) => x.team_points)?.team_points;
                         const t0Pts = parseFloat(t0PtsObj?.total || 0);

                         const t1Key = team1Data[0]?.find((x:any) => x.team_key)?.team_key;
                         const t1PtsObj = team1Data.find((x:any) => x.team_points)?.team_points;
                         const t1Pts = parseFloat(t1PtsObj?.total || 0);
                         
                         const mgr0 = teamMap.get(t0Key);
                         const mgr1 = teamMap.get(t1Key);

                         if (mgr0 && mgr1) {
                             games.push({
                                 week: parseInt(meta.week),
                                 isPlayoffs: meta.is_playoffs === '1',
                                 winnerTeamKey: meta.winner_team_key,
                                 isTie: meta.is_tied === '1',
                                 teamA: { managerId: mgr0, teamKey: t0Key, points: t0Pts },
                                 teamB: { managerId: mgr1, teamKey: t1Key, points: t1Pts }
                             });
                         }
                     }
                }
            }
            // Polite delay between chunks
            await wait(300);

        } catch (e) {
            console.warn(`Error fetching games chunk ${weeksStr} for league ${leagueKey}`, e);
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