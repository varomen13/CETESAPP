import {NativeEventEmitter, NativeModules} from 'react-native';
import {CetesTerm, MarketRate, PersistedData} from '../types';

type WearableModule = {
  getConnectionStatus(): Promise<'connected' | 'watch_unavailable' | 'watch_app_not_installed'>;
  syncSnapshot(payload: string): Promise<void>;
  getPendingActions(): Promise<string[]>;
  acknowledgeAction(id: string): Promise<void>;
  logDebugSync?(message: string, isError: boolean): void;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
};

export type WearConnectionStatus = {
  connected: boolean;
  message: string;
};

export type WearSnapshot = {
  rates: Array<Pick<MarketRate, 'term' | 'annualRate'>>;
  ratesFetchedAt: string | null;
  bestTerm: CetesTerm | null;
  lastCalculation: {
    name: string;
    principal: number;
    term: CetesTerm;
    annualRate: number;
    estimatedReturn: number;
    maturityValue: number;
    maturityDate: string;
  } | null;
  favorites: CetesTerm[];
  notifications: {
    maturityRemindersEnabled: boolean;
    favoriteRateChangesEnabled: boolean;
  };
};

const module = NativeModules.WearSync as WearableModule | undefined;
const emitter = module ? new NativeEventEmitter(module as never) : null;

export async function checkWearableConnection(): Promise<WearConnectionStatus> {
  if (!module) {
    throw new Error('No está disponible el módulo nativo de sincronización Wear OS.');
  }
  const status = await module.getConnectionStatus();
  const connected = status === 'connected';
  return {
    connected,
    message:
      status === 'watch_app_not_installed'
        ? 'La app del reloj no está instalada. Instala CETES Smart y vuelve a sincronizar.'
        : status === 'watch_unavailable'
          ? 'No se encontró ningún reloj emparejado. Comprueba que esté encendido y conectado.'
          : 'Reloj conectado.',
  };
}

export function buildWearSnapshot(data: PersistedData): WearSnapshot {
  const rates = data.rates
    .filter(rate => rate.source === 'official')
    .map(({term, annualRate}) => ({term, annualRate}));
  const bestRate = rates.reduce<typeof rates[number] | null>(
    (best, rate) => (!best || rate.annualRate > best.annualRate ? rate : best),
    null,
  );
  const lastCalculation =
    [...data.simulations]
      .filter(item => item.rateSource === 'official')
      .sort(
        (left, right) =>
          new Date(right.startDate).getTime() - new Date(left.startDate).getTime(),
      )[0] ?? null;

  return {
    rates,
    ratesFetchedAt: data.ratesFetchedAt,
    bestTerm: bestRate?.term ?? null,
    lastCalculation: lastCalculation
      ? {
          name: lastCalculation.name,
          principal: lastCalculation.principal,
          term: lastCalculation.term,
          annualRate: lastCalculation.annualRate,
          estimatedReturn: lastCalculation.estimatedReturn,
          maturityValue: lastCalculation.principal + lastCalculation.estimatedReturn,
          maturityDate: lastCalculation.maturityDate,
        }
      : null,
    favorites: data.favorites,
    notifications: {
      maturityRemindersEnabled: data.notifications.enabled,
      favoriteRateChangesEnabled: data.notifications.favoriteRateChanges,
    },
  };
}

export async function syncWithWearable(data: WearSnapshot): Promise<void> {
  if (!module) {
    throw new Error('No está disponible el módulo nativo de sincronización Wear OS.');
  }
  await module.syncSnapshot(JSON.stringify(data));
}

export async function syncWithDebugBridge(data: WearSnapshot): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    logDebugBridge('Enviando instantánea al reloj.');
    const response = await fetch('http://10.0.2.2:8765/sync', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    const body = await response.text();
    if (!response.ok) {
      let detail = `El reloj respondió con HTTP ${response.status}.`;
      try {
        const errorBody: unknown = JSON.parse(body);
        if (
          errorBody &&
          typeof errorBody === 'object' &&
          'error' in errorBody &&
          typeof errorBody.error === 'string'
        ) {
          detail = errorBody.error;
        }
      } catch {
        // Keep the HTTP status when the server response is not JSON.
      }
      throw new Error(detail);
    }
    logDebugBridge('Instantánea recibida por el reloj.');
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Se agotó el tiempo de espera del reloj. Ejecuta sync-puente.ps1 y vuelve a intentar.'
        : error instanceof Error
          ? error.message
          : 'Error de red desconocido.';
    logDebugBridge(`Falló el envío: ${message}`, true);
    throw new Error(
      `No se pudo enviar la instantánea al reloj. Ejecuta sync-puente.ps1 y verifica que la app del reloj esté abierta. ${message}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function logDebugBridge(message: string, isError = false) {
  const taggedMessage = `[CetesSync] ${message}`;
  if (isError) console.error(taggedMessage);
  else console.info(taggedMessage);
  module?.logDebugSync?.(message, isError);
}

export async function getPendingWearActions(): Promise<string[]> {
  if (!module) {
    throw new Error('No está disponible el módulo nativo de sincronización Wear OS.');
  }
  return module.getPendingActions();
}

export async function acknowledgeWearAction(id: string): Promise<void> {
  if (!module) {
    throw new Error('No está disponible el módulo nativo de sincronización Wear OS.');
  }
  await module.acknowledgeAction(id);
}

export function listenToWearActions(
  listener: (event: {path: string; payload: string}) => void,
): {remove(): void} | null {
  return emitter?.addListener('WearableMessage', listener) ?? null;
}
