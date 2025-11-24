import { GoogleGenAI } from "@google/genai";
import { LeagueData } from "../types";

const API_KEY = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey: API_KEY });

export const askLeagueOracle = async (
  question: string, 
  leagueData: LeagueData
): Promise<string> => {
  if (!API_KEY) {
    return "Please set your API_KEY to consult the Oracle.";
  }

  // Summarize data to reduce token count while keeping essential info
  const summary = {
    totalSeasons: leagueData.seasons.length,
    managers: leagueData.managers.map(m => m.name),
    history: leagueData.seasons.map(s => ({
      year: s.year,
      champion: leagueData.managers.find(m => m.id === s.championId)?.name,
      topScorer: s.standings.reduce((prev, curr) => prev.stats.pointsFor > curr.stats.pointsFor ? prev : curr).stats.pointsFor
    }))
  };

  const prompt = `
    You are the "League Oracle", a witty and slightly trash-talking historian for a fantasy football league.
    Here is the league data summary JSON:
    ${JSON.stringify(summary, null, 2)}
    
    User Question: "${question}"
    
    Answer the user based on the data. Be specific about years and names. 
    If you don't know something, make up a funny excuse related to bad waiver wire pickups.
    Keep it under 150 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "The Oracle is silent (No response text).";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The Oracle is currently on IR (Error connecting to AI).";
  }
};