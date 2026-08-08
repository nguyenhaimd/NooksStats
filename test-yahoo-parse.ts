import fetch from 'node-fetch';

const mockJson = {
  fantasy_content: {
    users: {
      0: {
        user: [
          { guid: "..." },
          {
            games: {
              0: {
                game: [
                  { game_key: "449", code: "nfl", season: "2024" },
                  { leagues: { 0: { league: [{ league_key: "449.l.123", name: "My League", logo_url: "" }] }, count: 1 } }
                ]
              },
              count: 1
            }
          }
        ]
      }
    }
  }
};

const gamesNode = mockJson?.fantasy_content?.users?.[0]?.user?.find((x: any) => x.games)?.games;
if (gamesNode) {
    const gameCount = gamesNode.count;
    for (let i = 0; i < gameCount; i++) {
      const gameWrapper = gamesNode[i + ""]?.game;
      if (!gameWrapper) continue;

      const gameMeta = gameWrapper[0];
      
      // Filter strictly for NFL fantasy football
      if (gameMeta.code !== 'nfl') continue;

      const seasonYear = parseInt(gameMeta.season);
      console.log("Season:", seasonYear);
      
      const leaguesNode = gameWrapper.find((x: any) => x.leagues)?.leagues;
      if (!leaguesNode) continue;

      const leagueCount = leaguesNode.count;
      for (let j = 0; j < leagueCount; j++) {
         const leagueObj = leaguesNode[j + ""]?.league;
         if (!leagueObj) continue;
         
         const meta = leagueObj[0];
         console.log(meta.name);
      }
    }
}
