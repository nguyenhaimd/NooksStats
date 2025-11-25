import { LeagueData, Manager, Season, ManagerSeason, DraftPick, Transaction } from '../types';

const LEAGUE_KEYS = [
  { key: '257.l.492507', year: 2011 },
  { key: '273.l.320863', year: 2012 },
  { key: '314.l.593746', year: 2013 },
  { key: '331.l.632785', year: 2014 },
  { key: '348.l.410974', year: 2015 },
  { key: '359.l.394988', year: 2016 },
  { key: '371.l.283892', year: 2017 },
  { key: '380.l.915216', year: 2018 },
  { key: '390.l.192337', year: 2019 },
  { key: '399.l.626629', year: 2020 },
  { key: '406.l.699932', year: 2021 },
  { key: '414.l.776784', year: 2022 },
  { key: '423.l.520268', year: 2023 },
  { key: '449.l.155143', year: 2024 },
  { key: '461.l.51376', year: 2025 },
];

const PROXY_URL = 'https://corsproxy.io/?';
const BASE_URL = 'https://fantasysports.yahooapis.com/fantasy/v2';

export const fetchYahooData = async (accessToken: string): Promise<LeagueData> => {
  // Yahoo API allows max 25 keys per request.
  const keysString = LEAGUE_KEYS.map(k => k.key).join(',');
  
  // Request standings, draft results, and transactions (limited count to avoid payload explosion)
  // We use the 'out' parameter to fetch multiple resources for the leagues collection
  const targetUrl = `${BASE_URL}/leagues;league_keys=${keysString};out=standings,draftresults,transactions?format=json`;
  
  const response = await fetch(`${PROXY_URL}${encodeURIComponent(targetUrl)}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
        throw new Error("Unauthorized");
    }
    throw new Error(`Yahoo API Error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  return transformYahooData(json);
};

export const fetchPlayerDetails = async (accessToken: string, playerKeys: string[]) => {
  const uniqueKeys = Array.from(new Set(playerKeys));
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
        
        // Yahoo returns an object where keys are "0", "1", etc. plus "count"
        for (let i = 0; i < players.count; i++) {
           const pObj = players[i + ""]; // Explicit string conversion for index
           const pArr = pObj?.player;
           if (!pArr) continue;
           
           // pArr[0] is typically the metadata array
           // We look for the object containing 'name'
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
  // Filter out empty or invalid keys to prevent API errors
  // Ensure key structure looks like "123.l.456.t.7"
  const validKeys = teamKeys.filter(k => k && k.includes('.t.'));
  
  if (validKeys.length === 0) return [];
  
  // Yahoo batch limit is technically 25, but fetching matchups is heavy.
  // Reducing batch size to 5 to avoid timeouts and header size issues.
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
      // Continue to next chunk even if one fails
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
    const teamWrapper = teamsObj[i + ""]?.team; // Use string index
    if (!teamWrapper) continue;

    const teamMeta = teamWrapper[0];
    const teamKey = teamMeta?.find((x: any) => x.team_key)?.team_key;
    
    // Matchups are usually at index 1 or found via property
    const matchupsNode = teamWrapper.find((x: any) => x.matchups)?.matchups;
    
    if (matchupsNode && matchupsNode.count) {
      for (let m = 0; m < matchupsNode.count; m++) {
         const matchWrapper = matchupsNode[m + ""]?.matchup; // Use string index
         if (matchWrapper) {
            // Yahoo Matchup structure is messy. Usually:
            // matchWrapper[0] -> metadata { week, status, is_playoffs, winner_team_key, teams: {...} }
            const meta = matchWrapper[0];
            const teamsNode = meta?.teams;

            let parsedTeams: any[] = [];
            
            if (teamsNode && teamsNode.count) {
              for(let t=0; t < teamsNode.count; t++) {
                const teamData = teamsNode[t + ""]?.team;
                if (teamData) {
                  // teamData[0] -> metadata
                  // teamData[1] -> stats (team_points)
                  const tMeta = teamData[0];
                  const tStats = teamData[1];
                  
                  parsedTeams.push({
                    team_key: tMeta?.find((x:any) => x.team_key)?.team_key,
                    name: tMeta?.find((x:any) => x.name)?.name,
                    team_points: tStats?.team_points // { total: "100.00", week: "1" }
                  });
                }
              }
            }

            results.push({
              teamKey, // The key of the primary team we queried
              week: meta?.week,
              status: meta?.status,
              isPlayoffs: meta?.is_playoffs === '1', 
              winner_team_key: meta?.winner_team_key,
              teams: parsedTeams // Now a clean array
            });
         }
      }
    }
  }
  return results;
};

const transformYahooData = (data: any): LeagueData => {
  const managersMap = new Map<string, any>();
  // Map team_key -> manager_id (guid) to link drafts/transactions later
  const teamKeyToManagerId = new Map<string, string>();

  const seasons: Season[] = [];

  const leaguesObj = data?.fantasy_content?.leagues;
  if (!leaguesObj) throw new Error("Invalid Data Format");

  const count = leaguesObj.count;
  
  for (let i = 0; i < count; i++) {
    const leagueData = leaguesObj[i + ""]?.league;
    if (!leagueData) continue;

    // 1. Metadata
    const metadata = leagueData[0];
    const leagueKey = metadata.league_key;
    const yearMapping = LEAGUE_KEYS.find(k => k.key === leagueKey);
    const year = yearMapping ? yearMapping.year : parseInt(metadata.season);

    // 2. Standings (index 1 usually, but order can vary with 'out' param, so we search)
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
        const avatar = managerData.image_url;

        // Register TeamKey -> GUID mapping
        if (teamKey && guid) {
          teamKeyToManagerId.set(teamKey, guid);
        }

        // Manager Processing (Handle hidden names)
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

        // Stats
        const outcome = teamStandingsObj.outcome_totals;
        const pointsFor = parseFloat(teamStandingsObj.points_for);
        const pointsAgainst = parseFloat(teamStandingsObj.points_against);
        const rank = teamStandingsObj.rank;

        seasonStandings.push({
          managerId: guid,
          teamKey: teamKey || '',
          stats: {
            rank: rank,
            wins: parseInt(outcome.wins),
            losses: parseInt(outcome.losses),
            ties: parseInt(outcome.ties),
            pointsFor,
            pointsAgainst,
            isChampion: rank === 1,
            isPlayoff: rank <= 4 
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
        
        draftPicks.push({
          round: pickObj.round,
          pick: pickObj.pick,
          player: "Player #" + playerKey?.split('.').pop(), // Default fallback 
          playerKey: playerKey,
          managerId: mgrId,
          teamKey: tKey
        });
      }
    }

    // 4. Transactions
    const transactions: Transaction[] = [];
    if (transactionsNode && transactionsNode.transactions) {
      const txnObj = transactionsNode.transactions;
      const txnCount = txnObj.count;
      for(let t=0; t<txnCount; t++) {
        const txn = txnObj[t + ""]?.transaction;
        if(!txn) continue;
        
        // Extract metadata
        const txnId = txn[0].transaction_id;
        const type = txn[0].type;
        const timestamp = txn[0].timestamp;
        
        // Players involved
        const playersNode = txn.find((n: any) => n.players)?.players;
        const playersInvolved: any[] = [];
        const mgrsInvolved = new Set<string>();

        if (playersNode) {
           for(let p=0; p<playersNode.count; p++) {
              const pData = playersNode[p + ""]?.player;
              if(!pData) continue;
              
              const pInfo = pData[0]; // metadata
              const txnData = pData[1]?.transaction_data;
              const pName = pInfo.find((x:any) => x.name)?.name?.full || 'Unknown';
              
              const destTeam = txnData?.[0]?.destination_team_key;
              const sourceTeam = txnData?.[0]?.source_team_key;
              
              // Add logic
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
          id: txnId,
          type,
          date: parseInt(timestamp) * 1000,
          managerIds: Array.from(mgrsInvolved),
          players: playersInvolved
        });
      }
    }

    // Sort Standings
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

  seasons.sort((a, b) => a.year - b.year);
  const managers = Array.from(managersMap.values()).map(({id, name, avatar}) => ({id, name, avatar}));

  return { managers, seasons };
};