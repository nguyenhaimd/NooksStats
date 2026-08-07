import fetch from 'node-fetch';
const NFL_GAME_KEYS = [461, 449, 423, 414, 406, 399, 390, 380, 371, 359, 348, 331, 314, 273, 257];
const url = "https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_keys=" + NFL_GAME_KEYS.join(',') + "/leagues?format=json";
console.log("Fetching:", url);
const res = await fetch(url, { headers: { Authorization: "Bearer INVALID" } });
console.log(res.status);
const text = await res.text();
console.log(text.substring(0, 100));
