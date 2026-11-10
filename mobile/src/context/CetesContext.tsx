import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {createInvestment} from '../utils/cetes';
import {EMPTY_DATA, loadData, saveData} from '../storage';
import {
  acknowledgeWearAction,
  checkWearableConnection,
  WearConnectionStatus,
  buildWearSnapshot,
  getPendingWearActions,
  listenToWearActions,
  syncWithDebugBridge,
  syncWithWearable,
} from '../services/wear';
import {fetchCetesRates} from '../services/banxico';
import {
  cancelMaturityNotifications,
  notifyFavoriteRateChange,
  scheduleMaturityNotifications,
} from '../services/notifications';
import {
  CETES_TERMS,
  CetesTerm,
  MarketRate,
  NotificationSettings,
  PersistedData,
  SavedInvestment,
} from '../types';

type ContextValue = {
  data: PersistedData;
  rates: MarketRate[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  wearableConnected: boolean | null;
  wearableStatus: WearConnectionStatus | null;
  wearableMessage: string;
  refreshRates(): Promise<void>;
  setFavorite(term: CetesTerm): Promise<void>;
  addInvestment(investment: SavedInvestment): Promise<void>;
  removeInvestment(id: string): Promise<void>;
  addSimulation(simulation: SavedInvestment): Promise<void>;
  updateNotifications(settings: NotificationSettings): Promise<void>;
  syncNow(): Promise<string>;
};

const CetesContext = createContext<ContextValue | null>(null);

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}

function wearableMessageFrom(error: unknown): string {
  const message = messageFrom(error);
  return /API_UNAVAILABLE|Wearable\.API is not available/i.test(message)
    ? 'Wear OS no está disponible en este teléfono. Instala la app Wear OS y comprueba el emparejamiento.'
    : message;
}

export function CetesProvider({children}: PropsWithChildren) {
  const [data, setData] = useState<PersistedData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wearableConnected, setWearableConnected] = useState<boolean | null>(null);
  const [wearableStatus, setWearableStatus] =
    useState<WearConnectionStatus | null>(null);
  const [wearableMessage, setWearableMessage] = useState('Comprobando conexión…');
  const dataRef = useRef(data);
  const processingWearActionIds = useRef(new Set<string>());
  dataRef.current = data;

  const syncSnapshot = useCallback(async (nextData: PersistedData): Promise<string> => {
    const snapshot = buildWearSnapshot(nextData);
    const syncWithLocalBridge = async () => {
      if (!__DEV__) {
        throw new Error('El envío por conexión local solo está disponible en la versión debug.');
      }
      await syncWithDebugBridge(snapshot);
      const syncedAt = new Date().toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const message = `Sincronizado a las ${syncedAt} · Conexión local`;
      setWearableMessage(message);
      return message;
    };

    try {
      await syncWithWearable(snapshot);
      const connection = await checkWearableConnection();
      setWearableStatus(connection);
      setWearableConnected(connection.connected);
      if (!connection.connected) {
        if (__DEV__) {
          console.info(`[CetesSync] ${connection.message} Se usará la conexión local.`);
          return await syncWithLocalBridge();
        }
        setWearableMessage(connection.message);
        return connection.message;
      }
      const syncedAt = new Date().toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setWearableMessage(`Sincronizado a las ${syncedAt}`);
      return `Sincronizado a las ${syncedAt}`;
    } catch (syncError) {
      const connection = await checkWearableConnection().catch(() => null);
      if (connection) {
        setWearableStatus(connection);
        setWearableConnected(connection.connected);
      } else {
        setWearableConnected(false);
      }
      if (__DEV__ && (!connection || !connection.connected)) {
        console.info('[CetesSync] Data Layer no disponible; se intentará la conexión local.');
        try {
          return await syncWithLocalBridge();
        } catch (bridgeError) {
          const message = messageFrom(bridgeError);
          setWearableMessage(message);
          return message;
        }
      }
      const message =
        connection && !connection.connected
          ? connection.message
          : wearableMessageFrom(syncError);
      setWearableMessage(message);
      return message;
    }
  }, []);

  const updateData = useCallback(
    async (nextData: PersistedData) => {
      await saveData(nextData);
      dataRef.current = nextData;
      setData(nextData);
      setError(null);
      await syncSnapshot(nextData);
    },
    [syncSnapshot],
  );

  const importWearAction = useCallback(
    async (payload: string, path = '/cetes/simulation') => {
      const action: unknown = JSON.parse(payload);
      if (
        !action ||
        typeof action !== 'object' ||
        !('id' in action) ||
        typeof action.id !== 'string' ||
        !('type' in action)
      ) {
        throw new Error('El reloj envió una acción que no se reconoce.');
      }
      if (action.type === 'notification-dismissed' && path === '/cetes/notification-dismissed') {
        if (!('notificationId' in action) || typeof action.notificationId !== 'string') {
          throw new Error('El reloj envió un vencimiento que no se reconoce.');
        }
        const current = dataRef.current;
        const dismissedNotificationIds = current.dismissedNotificationIds.includes(
          action.notificationId,
        )
          ? current.dismissedNotificationIds
          : [...current.dismissedNotificationIds, action.notificationId];
        await updateData({...current, dismissedNotificationIds});
        const {default: notifee} = await import('@notifee/react-native');
        await notifee.cancelTriggerNotification(
          `cetes-vencimiento-${action.notificationId}-previo`,
        );
        await notifee.cancelTriggerNotification(
          `cetes-vencimiento-${action.notificationId}-hoy`,
        );
        await acknowledgeWearAction(action.id);
        return;
      }
      if (
        action.type !== 'simulation' ||
        path !== '/cetes/simulation' ||
        !('amount' in action) ||
        !('term' in action) ||
        !('annualRate' in action)
      ) {
        throw new Error('El reloj envió una acción que no se reconoce.');
      }
      const record = action as {
        id: string;
        type: 'simulation';
        amount: number;
        term: CetesTerm;
        annualRate: number;
        name?: string;
      };
      if (
        !Number.isFinite(record.amount) ||
        !Number.isFinite(record.annualRate) ||
        ![28, 91, 182, 364].includes(record.term)
      ) {
        throw new Error('El reloj envió datos de simulación no válidos.');
      }
      const current = dataRef.current;
      if (current.processedWearActionIds.includes(record.id)) {
        await acknowledgeWearAction(record.id);
        return;
      }
      if (processingWearActionIds.current.has(record.id)) {
        return;
      }
      processingWearActionIds.current.add(record.id);
      try {
        const simulation = createInvestment(
          record.amount,
          record.term,
          record.annualRate,
          'simulation',
          typeof record.name === 'string'
            ? record.name
            : `Simulación desde reloj: CETES ${record.term} días`,
          new Date(),
          'official',
        );
        await updateData({
          ...current,
          simulations: [simulation, ...current.simulations],
          processedWearActionIds: [...current.processedWearActionIds, record.id].slice(-100),
        });
        await acknowledgeWearAction(record.id);
      } finally {
        processingWearActionIds.current.delete(record.id);
      }
    },
    [updateData],
  );

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        const stored = await loadData();
        if (!active) {
          return;
        }
        setData(stored);
        dataRef.current = stored;
        await syncSnapshot(stored);
        const pending = await getPendingWearActions();
        for (const payload of pending) {
          if (active) {
            try {
              const action = JSON.parse(payload) as {type?: string};
              const path =
                action.type === 'notification-dismissed'
                  ? '/cetes/notification-dismissed'
                  : '/cetes/simulation';
              await importWearAction(payload, path);
            } catch (actionError) {
              setError(`No se pudo importar una acción pendiente del reloj: ${messageFrom(actionError)}`);
            }
          }
        }
        if (stored.notifications.enabled) {
          await scheduleMaturityNotifications(
            stored.investments,
            stored.notifications.daysBeforeMaturity,
            stored.dismissedNotificationIds,
          );
        }
      } catch (initializeError) {
        if (active) {
          setError(messageFrom(initializeError));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void initialize();
    return () => {
      active = false;
    };
  }, [importWearAction, syncSnapshot]);

  useEffect(() => {
    const subscription = listenToWearActions(event => {
      if (event.path === '/cetes/simulation') {
        void importWearAction(event.payload).catch(receiveError =>
          setError(messageFrom(receiveError)),
        );
      } else if (event.path === '/cetes/notification-dismissed') {
        void importWearAction(event.payload, event.path).catch(receiveError =>
          setError(messageFrom(receiveError)),
        );
      }
    });
    return () => subscription?.remove();
  }, [importWearAction]);

  const refreshRates = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const fetchedRates = await fetchCetesRates();
      const current = dataRef.current;
      const ratesByTerm = new Map(current.rates.map(rate => [rate.term, rate]));
      fetchedRates.forEach(rate => ratesByTerm.set(rate.term, rate));
      const rates = CETES_TERMS.flatMap(term => {
        const rate = ratesByTerm.get(term);
        return rate ? [rate] : [];
      });
      const next = {...current, rates, ratesFetchedAt: new Date().toISOString()};
      await updateData(next);
      const movedFavorites = fetchedRates.filter(
        rate =>
          next.notifications.favoriteRateChanges &&
          next.favorites.includes(rate.term) &&
          rate.change !== null &&
          Math.abs(rate.change) >= 0.1 &&
          current.rates.find(previous => previous.term === rate.term)?.date !== rate.date,
      );
      await Promise.all(
        movedFavorites.map(rate =>
          notifyFavoriteRateChange(rate.term, rate.change!, rate.date),
        ),
      );
      const missingTerms = CETES_TERMS.filter(
        term => !fetchedRates.some(rate => rate.term === term),
      );
      if (missingTerms.length) {
        setError(previousError => {
          const warning = `Banxico no devolvió tasas nuevas para ${missingTerms.join(', ')} días; se conservaron los últimos datos disponibles.`;
          return previousError ? `${previousError} ${warning}` : warning;
        });
      }
    } catch (refreshError) {
      setError(messageFrom(refreshError));
      throw refreshError;
    } finally {
      setRefreshing(false);
    }
  }, [updateData]);

  const setFavorite = useCallback(
    async (term: CetesTerm) => {
      const favorites = data.favorites.includes(term)
        ? data.favorites.filter(item => item !== term)
        : [...data.favorites, term];
      try {
        await updateData({...data, favorites});
      } catch (favoriteError) {
        setError(messageFrom(favoriteError));
      }
    },
    [data, updateData],
  );

  const addInvestment = useCallback(
    async (investment: SavedInvestment) => {
      const investments = [investment, ...data.investments];
      await updateData({...data, investments});
      if (data.notifications.enabled) {
        try {
          await scheduleMaturityNotifications(
            investments,
            data.notifications.daysBeforeMaturity,
            data.dismissedNotificationIds,
          );
        } catch (notificationError) {
          setError(`Inversión guardada, pero no se programaron recordatorios: ${messageFrom(notificationError)}`);
        }
      }
    },
    [data, updateData],
  );

  const removeInvestment = useCallback(
    async (id: string) => {
      const investments = data.investments.filter(item => item.id !== id);
      await updateData({...data, investments});
      if (data.notifications.enabled) {
        try {
          await scheduleMaturityNotifications(
            investments,
            data.notifications.daysBeforeMaturity,
            data.dismissedNotificationIds,
          );
        } catch (notificationError) {
          setError(`Registro eliminado, pero no se actualizaron recordatorios: ${messageFrom(notificationError)}`);
        }
      }
    },
    [data, updateData],
  );

  const addSimulation = useCallback(
    async (simulation: SavedInvestment) => {
      await updateData({...data, simulations: [simulation, ...data.simulations]});
    },
    [data, updateData],
  );

  const updateNotifications = useCallback(
    async (notifications: NotificationSettings) => {
      const next = {...data, notifications};
      if (notifications.enabled) {
        await scheduleMaturityNotifications(
          data.investments,
          notifications.daysBeforeMaturity,
          data.dismissedNotificationIds,
        );
      } else {
        await cancelMaturityNotifications();
      }
      await updateData(next);
    },
    [data, updateData],
  );

  const syncNow = useCallback(async () => {
    setWearableMessage('Sincronizando…');
    return syncSnapshot(data);
  }, [data, syncSnapshot]);

  const value = useMemo(
    () => ({
      data,
      rates: data.rates.filter(rate => rate.source === 'official'),
      loading,
      refreshing,
      error,
      wearableConnected,
      wearableStatus,
      wearableMessage,
      refreshRates,
      setFavorite,
      addInvestment,
      removeInvestment,
      addSimulation,
      updateNotifications,
      syncNow,
    }),
    [
      data,
      loading,
      refreshing,
      error,
      wearableConnected,
      wearableStatus,
      wearableMessage,
      refreshRates,
      setFavorite,
      addInvestment,
      removeInvestment,
      addSimulation,
      updateNotifications,
      syncNow,
    ],
  );

  return <CetesContext.Provider value={value}>{children}</CetesContext.Provider>;
}

export function useCetes(): ContextValue {
  const context = useContext(CetesContext);
  if (!context) {
    throw new Error('useCetes debe utilizarse dentro de CetesProvider.');
  }
  return context;
}
