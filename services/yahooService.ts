import { LeagueData, Manager, Season, ManagerSeason, DraftPick, Transaction, LeagueSummary } from '../types';

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

export const fetchUserLeagues = async (accessToken: string): Promise<LeagueSummary[]> => {
  // Fetch leagues across all known NFL game keys to build a history
  // Yahoo allows comma-separated game keys
  const keysString = NFL_GAME_KEYS.join(',');
  const url = `${BASE_URL}/users;use_login=1/games;game_keys=${keysString}/leagues?format=json`;

  // Use corsproxy.io to ensure Authorization headers are forwarded
  const response = await fetch(`${PROXY_URL}${encodeURIComponent(url)}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!response.ok) {
     const text = await response.text();
     throw new Error(`Yahoo API Error (${response.status}): ${text.substring(0, 100)}`);
  }

  const json = await response.json();
  const leagues: LeagueSummary[] = [];
  
  // Robustly find the 'games' array (Yahoo structure can vary)
  const gamesNode = json?.fantasy_content?.users?.[0]?.user?.find((x: any) => x.games)?.games;
  if (!gamesNode) return [];

  const gameCount = gamesNode.count;
  for (let i = 0; i < gameCount; i++) {
    const gameWrapper = gamesNode[i + ""]?.game;
    if (!gameWrapper) continue;

    const gameMeta = gameWrapper[0];
    const seasonYear = parseInt(gameMeta.season);
    
    // Robustly find the 'leagues' array inside the game wrapper
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

export const fetchYahooData = async (accessToken: string, leagueKeys: string[]): Promise<LeagueData> => {
  if (!leagueKeys || leagueKeys.length === 0) throw new Error("No leagues selected.");

  // Yahoo API allows max 25 keys per request. We must batch.
  const BATCH_SIZE = 25;
  const chunks = [];
  for (let i = 0; i < leagueKeys.length; i += BATCH_SIZE) {
    chunks.push(leagueKeys.slice(i, i + BATCH_SIZE));
  }

  const allSeasons: Season[] = [];
  const allManagersMap = new Map<string, any>();

  // Process batches sequentially to map managers correctly across batches
  for (const chunk of chunks) {
     const keysString = chunk.join(',');
     const targetUrl = `${BASE_URL}/leagues;league_keys=${keysString};out=standings,draftresults,transactions?format=json`;
     
     const response = await fetch(`${PROXY_URL}${encodeURIComponent(targetUrl)}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
     });

     if (!response.ok) {
        if (response.status === 401) throw new Error("Unauthorized: Token expired");
        console.warn(`Batch failed for keys: ${keysString}`);
        continue;
     }

     const json = await response.json();
     // We await here because transformYahooData now fetches player names
     const { managers, seasons } = await transformYahooData(json, accessToken, allManagersMap); 
     allSeasons.push(...seasons);
  }

  allSeasons.sort((a, b) => a.year - b.year);
  const managers = Array.from(allManagersMap.values()).map(({id, name, avatar}) => ({id, name, avatar}));

  return { managers, seasons: allSeasons };
};

export const fetchPlayerDetails = async (accessToken: string, playerKeys: string[]) => {
  const uniqueKeys = Array.from(new Set(playerKeys)).filter(k => !!k);
  if (uniqueKeys.length === 0) return {};

  const map: Record<string, string> = {};
  
  // Yahoo allows up to 25 keys per request.
  const chunks = [];
  for (let i = 0; i < uniqueKeys.length; i += 25) {
    chunks.push(uniqueKeys.slice(i, i + 25));
  }

  await Promise.all(chunks.map(async (chunk) => {
    const keysStr = chunk.join(',');
    const url = `${BASE_URL}/players;player_keys=${keysStr}?format=json`;
    
    try {
        const res = await fetch(`${PROXY_URL}${encodeURIComponent(url)}`, {
             headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!res.ok) {
            console.error(`Failed to fetch players chunk: ${res.status}`);
            return;
        }
        const json = await res.json();
        const players = json?.fantasy_content?.players;
        
        if (!players || !players.count) return;
        
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
    } catch(e) { console.error("Error fetching players", e); }
  }));

  return map;
};

export const fetchMatchups = async (accessToken: string, teamKeys: string[]) => {
  const validKeys = teamKeys.filter(k => k && k.includes('.t.'));
  
  if (validKeys.length === 0) return [];
  
  const BATCH_SIZE = 5;
  const chunks = [];
  for(let i=0; i<validKeys.length; i+=BATCH_SIZE) {
      chunks.push(validKeys.slice(i, i+BATCH_SIZE));
  }

  const allResults: any[] = [];

  for (const chunk of chunks) {
    const keysStr = chunk.join(',');
    const targetUrl = `${BASE_URL}/teams;team_keys=${keysStr}/matchups?format=json`;

    try {
      const response = await fetch(`${PROXY_URL}${encodeURIComponent(targetUrl)}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        console.warn(`Matchup batch failed with status ${response.status}`);
        continue; 
      }
      
      const json = await response.json();
      const batchResults = parseMatchups(json);
      allResults.push(...batchResults);
      
    } catch (e) {
      console.error("Matchup fetch error", e);
    }
  }

  return allResults;
};

const parseMatchups = (json: any) => {
  const teamsObj = json?.fantasy_content?.teams;
  if (!teamsObj) return [];

  const results: any[] = [];
  const count = teamsObj.count;

  for (let i = 0; i < count; i++) {
    const teamWrapper = teamsObj[i + ""]?.team;
    if (!teamWrapper) continue;

    const teamMeta = teamWrapper[0];
    const teamKey = teamMeta?.find((x: any) => x.team_key)?.team_key;
    const matchupsNode = teamWrapper.find((x: any) => x.matchups)?.matchups;
    
    if (matchupsNode && matchupsNode.count) {
      for (let m = 0; m < matchupsNode.count; m++) {
         const matchWrapper = matchupsNode[m + ""]?.matchup;
         if (matchWrapper) {
            const meta = matchWrapper[0];
            const teamsNode = meta?.teams;

            let parsedTeams: any[] = [];
            
            if (teamsNode && teamsNode.count) {
              for(let t=0; t < teamsNode.count; t++) {
                const teamData = teamsNode[t + ""]?.team;
                if (teamData) {
                  const tMeta = teamData[0];
                  const tStats = teamData[1];
                  
                  parsedTeams.push({
                    team_key: tMeta?.find((x:any) => x.team_key)?.team_key,
                    name: tMeta?.find((x:any) => x.name)?.name,
                    team_points: tStats?.team_points 
                  });
                }
              }
            }

            results.push({
              teamKey, 
              week: meta?.week,
              status: meta?.status,
              isPlayoffs: meta?.is_playoffs === '1', 
              winner_team_key: meta?.winner_team_key,
              teams: parsedTeams
            });
         }
      }
    }
  }
  return results;
};

// Async transformation to allow resolving names
const transformYahooData = async (data: any, accessToken: string, managersMap: Map<string, any> = new Map()): Promise<{ seasons: Season[], managers: any }> => {
  const teamKeyToManagerId = new Map<string, string>();
  const seasons: Season[] = [];

  const leaguesObj = data?.fantasy_content?.leagues;
  if (!leaguesObj) return { seasons: [], managers: managersMap };

  const count = leaguesObj.count;
  const unknownPlayerKeys = new Set<string>();
  
  // First Pass: Extract structure and collect unknown player keys
  for (let i = 0; i < count; i++) {
    const leagueData = leaguesObj[i + ""]?.league;
    if (!leagueData) continue;

    // 1. Metadata
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

    // 3. Draft Results
    const draftPicks: DraftPick[] = [];
    if (draftNode && draftNode.draft_results) {
      const draftCount = draftNode.draft_results.count;
      for (let d = 0; d < draftCount; d++) {
        const pickObj = draftNode.draft_results[d + ""]?.draft_result;
        if (!pickObj) continue;
        
        const tKey = pickObj.team_key;
        const mgrId = teamKeyToManagerId.get(tKey) || 'unknown';
        const playerKey = pickObj.player_key;
        
        // Collect key for resolving
        if (playerKey) unknownPlayerKeys.add(playerKey);

        draftPicks.push({
          round: pickObj.round,
          pick: pickObj.pick,
          player: "Unknown Player", // Placeholder, will update later
          playerKey: playerKey || undefined,
          managerId: mgrId,
          teamKey: tKey
        });
      }
    }

    // 4. Transactions
    const transactions: Transaction[] = [];
    if (transactionsNode && transactionsNode.transactions) {
        // ... (Transaction logic remains similar, simplified for brevity as request was to remove page)
        // Keeping logic in case data is needed later
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
      transactions
    });
  }

  // --- RESOLVE PLAYER NAMES ---
  // This runs once per batch of seasons, updating the draft objects in place
  if (unknownPlayerKeys.size > 0) {
      console.log(`Resolving names for ${unknownPlayerKeys.size} players...`);
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
