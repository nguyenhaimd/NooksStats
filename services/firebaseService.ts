import firebase from 'firebase/compat/app';
import { getDatabase, ref, set, get, child, update } from 'firebase/database';
import { LeagueData } from '../types';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

let app: any;
let db: any;

export const initFirebase = (config: FirebaseConfig) => {
  if (firebase.apps.length === 0) {
    app = firebase.initializeApp(config);
  } else {
    app = firebase.app();
  }
  db = getDatabase(app);
  return app;
};

export const getFirebaseInstance = () => db;

// -- API --

const sanitizeData = (data: any) => {
  // Recursively remove undefined values by serializing/deserializing
  // JSON.stringify automatically strips keys with undefined values
  return JSON.parse(JSON.stringify(data));
};

export const saveLeagueToFirebase = async (leagueId: string, leagueName: string, data: LeagueData) => {
  if (!db) throw new Error("Database not initialized");
  
  const cleanId = leagueId.replace(/\./g, '_'); // Firebase keys can't contain '.'
  
  // Clean the data to ensure no undefined values exist
  const cleanData = sanitizeData(data);
  
  // Save Meta
  await update(ref(db, `leagues/${cleanId}/meta`), {
    id: leagueId,
    name: leagueName,
    lastUpdated: Date.now(),
    seasonCount: cleanData.seasons.length,
    latestSeason: cleanData.seasons[cleanData.seasons.length - 1]?.year
  });

  // Save Data
  await set(ref(db, `leagues/${cleanId}/data`), cleanData);
};

export const fetchLeagueFromFirebase = async (leagueId: string): Promise<LeagueData | null> => {
  if (!db) throw new Error("Database not initialized");
  
  const cleanId = leagueId.replace(/\./g, '_');
  const snapshot = await get(child(ref(db), `leagues/${cleanId}/data`));
  
  if (snapshot.exists()) {
    return snapshot.val() as LeagueData;
  }
  return null;
};

export const fetchLeagueList = async () => {
  if (!db) throw new Error("Database not initialized");
  
  const snapshot = await get(child(ref(db), `leagues`));
  if (snapshot.exists()) {
    const val = snapshot.val();
    // Return array of meta objects
    return Object.keys(val).map(key => ({
      key: val[key].meta.id,
      ...val[key].meta
    })).sort((a,b) => b.lastUpdated - a.lastUpdated);
  }
  return [];
};