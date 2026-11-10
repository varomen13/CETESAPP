export type CetesTerm = 28 | 91 | 182 | 364;

export type MarketRate = {
  term: CetesTerm;
  seriesId: string;
  annualRate: number;
  date: string;
  previousRate: number | null;
  change: number | null;
  source: 'official' | 'demo';
};

export type SavedInvestment = {
  id: string;
  name: string;
  principal: number;
  term: CetesTerm;
  annualRate: number;
  startDate: string;
  maturityDate: string;
  estimatedReturn: number;
  kind: 'real' | 'simulation';
  rateSource: 'official' | 'demo' | 'manual';
  origin?: 'user' | 'authorized';
};

export type NotificationSettings = {
  enabled: boolean;
  daysBeforeMaturity: number;
  favoriteRateChanges: boolean;
};

export type PersistedData = {
  rates: MarketRate[];
  ratesFetchedAt: string | null;
  investments: SavedInvestment[];
  simulations: SavedInvestment[];
  favorites: CetesTerm[];
  dismissedNotificationIds: string[];
  processedWearActionIds: string[];
  notifications: NotificationSettings;
};

export const CETES_TERMS: CetesTerm[] = [28, 91, 182, 364];

export const TERM_LABELS: Record<CetesTerm, string> = {
  28: '28 días',
  91: '91 días',
  182: '182 días',
  364: '364 días',
};
