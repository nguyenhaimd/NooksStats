import fetch from 'node-fetch';
const url = "https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_keys=461/leagues?format=json";
console.log("Fetching:", url);
const res = await fetch(url, { headers: { Authorization: "Bearer INVALID" } });
console.log(res.status);
const text = await res.text();
console.log(text.substring(0, 100));
