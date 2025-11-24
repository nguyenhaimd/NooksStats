import { LeagueData, Manager, Season, ManagerSeason, DraftPick } from '../types';

// Provided Yahoo League Keys mapped to implied years
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

const MANAGER_NAMES = [
  "The Commissioner", "Touchdown Tom", "Waiver Wire Wizard", 
  "Draft Day Disaster", "Monday Night Miracle", "The Armchair QB", 
  "Gridiron Guru", "Fantasy Factory", "Hail Mary Heroes", 
  "The Underdogs", "Show Me The Money", "Blitz Brigade"
];

// Seeded random number generator for consistency
const seededRandom = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

export const generateLeagueData = (): LeagueData => {
  // Create Managers
  const managers: Manager[] = MANAGER_NAMES.map((name, index) => ({
    id: `mgr_${index}`,
    name,
    avatar: `https://picsum.photos/seed/${index}/200/200`
  }));

  const seasons: Season[] = LEAGUE_KEYS.map((entry, seasonIndex) => {
    // Shuffle managers for standings using the season year as seed
    const seasonManagers = [...managers].sort((a, b) => 
      seededRandom(entry.year + parseInt(a.id.split('_')[1])) - 0.5
    );

    const standings: ManagerSeason[] = seasonManagers.map((manager, rankIndex) => {
      const wins = Math.floor(seededRandom(entry.year * (rankIndex + 1)) * 10) + 4; // 4-13 wins
      const losses = 14 - wins;
      const pointsFor = 1200 + Math.floor(seededRandom(entry.year * wins) * 600);
      const pointsAgainst = 1200 + Math.floor(seededRandom(entry.year * losses) * 600);
      
      return {
        managerId: manager.id,
        teamKey: `mock.l.${entry.key}.t.${rankIndex}`,
        stats: {
          rank: rankIndex + 1,
          wins,
          losses,
          ties: 0,
          pointsFor,
          pointsAgainst,
          isChampion: rankIndex === 0, // Simplified: First in array is champ
          isPlayoff: rankIndex < 4
        }
      };
    });
    
    // Mock Draft
    const draft: DraftPick[] = [];
    for(let i=0; i<160; i++) {
        draft.push({
            round: Math.floor(i / 12) + 1,
            pick: i + 1,
            player: `Mock Player ${i}`,
            playerKey: `mock.p.${i}`,
            managerId: seasonManagers[i % 12].id,
            teamKey: `mock.l.${entry.key}.t.${i % 12}`
        });
    }

    return {
      year: entry.year,
      key: entry.key,
      championId: standings[0].managerId,
      standings,
      draft
    };
  });

  return { managers, seasons };
};