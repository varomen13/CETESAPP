import {MarketRate} from '../types';

const RATE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function isRateStale(rate: MarketRate, now = Date.now()): boolean {
  const observedAt = new Date(rate.date).getTime();
  return (
    rate.source !== 'official' ||
    !Number.isFinite(observedAt) ||
    now - observedAt > RATE_MAX_AGE_MS
  );
}
