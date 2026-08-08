import fetch from 'node-fetch';
const url = "https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games/leagues?format=json";
console.log("Fetching:", url);
const res = await fetch(url, { headers: { Authorization: "Bearer INVALID" } });
console.log(res.status);
