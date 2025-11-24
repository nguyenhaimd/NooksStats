export interface Manager {
  id: string;
  name: string;
  avatar: string;
}

export interface SeasonStats {
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  isChampion: boolean;
  isPlayoff: boolean;
}

export interface ManagerSeason {
  managerId: string;
  teamKey: string;
  stats: SeasonStats;
}

export interface DraftPick {
  round: number;
  pick: number;
  player: string;
  playerKey?: string; // New field for API lookups
  managerId: string;
  teamKey: string;
}

export interface Transaction {
  id: string;
  type: 'add/drop' | 'trade' | 'commish';
  date: number; // Timestamp
  managerIds: string[]; // Who was involved
  players: {
    name: string;
    type: 'add' | 'drop';
    managerId: string;
  }[];
}

export interface Season {
  year: number;
  key: string;
  championId: string;
  standings: ManagerSeason[];
  draft?: DraftPick[];
  transactions?: Transaction[];
}

export interface LeagueData {
  managers: Manager[];
  seasons: Season[];
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  STANDINGS = 'STANDINGS',
  HISTORY = 'HISTORY',
  DRAFT = 'DRAFT',
  TRANSACTIONS = 'TRANSACTIONS',
  VERSUS = 'VERSUS',
  ORACLE = 'ORACLE'
}