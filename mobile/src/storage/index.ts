import AsyncStorage from '@react-native-async-storage/async-storage';
import {CETES_TERMS, PersistedData} from '../types';

const STORAGE_KEY = '@cetes-smart/data-v1';

export const EMPTY_DATA: PersistedData = {
  rates: [],
  ratesFetchedAt: null,
  investments: [],
  simulations: [],
  favorites: [],
  dismissedNotificationIds: [],
  processedWearActionIds: [],
  notifications: {
    enabled: false,
    daysBeforeMaturity: 3,
    favoriteRateChanges: false,
  },
};

export async function loadData(): Promise<PersistedData> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return EMPTY_DATA;
  }

  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') {
    throw new Error('Los datos guardados de CETES Smart no tienen un formato válido.');
  }

  const stored = value as Partial<PersistedData>;
  const favorites = Array.isArray(stored.favorites)
    ? stored.favorites.filter(term => CETES_TERMS.includes(term))
    : [];
  const rates = Array.isArray(stored.rates)
    ? stored.rates.filter(
        rate =>
          rate &&
          CETES_TERMS.includes(rate.term) &&
          Number.isFinite(rate.annualRate) &&
          (rate.source === 'official' || rate.source === 'demo'),
      )
    : [];
  return {
    ...EMPTY_DATA,
    ...stored,
    rates,
    investments: Array.isArray(stored.investments) ? stored.investments : [],
    simulations: Array.isArray(stored.simulations) ? stored.simulations : [],
    favorites,
    dismissedNotificationIds: Array.isArray(stored.dismissedNotificationIds)
      ? stored.dismissedNotificationIds.filter(id => typeof id === 'string')
      : [],
    processedWearActionIds: Array.isArray(stored.processedWearActionIds)
      ? stored.processedWearActionIds.filter(id => typeof id === 'string').slice(-100)
      : [],
    notifications: {
      ...EMPTY_DATA.notifications,
      ...stored.notifications,
    },
  };
}

export async function saveData(data: PersistedData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
