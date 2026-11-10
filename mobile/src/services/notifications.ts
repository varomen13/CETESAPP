import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  TriggerType,
} from '@notifee/react-native';
import {SavedInvestment} from '../types';

export async function scheduleMaturityNotifications(
  investments: SavedInvestment[],
  daysBefore: number,
  dismissedIds: string[],
): Promise<void> {
  const permission = await notifee.requestPermission();
  if (
    permission.authorizationStatus !== AuthorizationStatus.AUTHORIZED &&
    permission.authorizationStatus !== AuthorizationStatus.PROVISIONAL
  ) {
    throw new Error('Las notificaciones están desactivadas en Android.');
  }
  const channelId = await notifee.createChannel({
    id: 'vencimientos',
    name: 'Vencimientos de CETES',
    importance: AndroidImportance.DEFAULT,
  });
  const existing = await notifee.getTriggerNotificationIds();
  await Promise.all(
    existing
      .filter(id => id.startsWith('cetes-vencimiento-'))
      .map(id => notifee.cancelTriggerNotification(id)),
  );

  const now = Date.now();
  for (const investment of investments) {
    if (dismissedIds.includes(investment.id)) {
      continue;
    }
    const triggerDate = new Date(investment.maturityDate);
    triggerDate.setDate(triggerDate.getDate() - daysBefore);
    triggerDate.setHours(9, 0, 0, 0);
    if (triggerDate.getTime() <= now) {
      continue;
    }

    await notifee.createTriggerNotification(
      {
        id: `cetes-vencimiento-${investment.id}`,
        title: 'Próximo vencimiento de CETES',
        body: `${investment.name} vence el ${new Date(
          investment.maturityDate,
        ).toLocaleDateString('es-MX')}.`,
        android: {channelId, pressAction: {id: 'default'}},
      },
      {type: TriggerType.TIMESTAMP, timestamp: triggerDate.getTime()},
    );
  }
}

export async function cancelMaturityNotifications(): Promise<void> {
  const existing = await notifee.getTriggerNotificationIds();
  await Promise.all(
    existing
      .filter(id => id.startsWith('cetes-vencimiento-'))
      .map(id => notifee.cancelTriggerNotification(id)),
  );
}

export async function notifyFavoriteRateChange(
  term: number,
  change: number,
  date?: string,
): Promise<void> {
  const channelId = await notifee.createChannel({
    id: 'vencimientos',
    name: 'Vencimientos y tasas de CETES',
    importance: AndroidImportance.DEFAULT,
  });
  await notifee.displayNotification({
    title: `Cambio en CETES ${term} días`,
    body: `La tasa cambió ${change > 0 ? '+' : ''}${change.toFixed(2)} puntos porcentuales.${
      date ? ` Dato del ${new Date(date).toLocaleDateString('es-MX')}.` : ''
    }`,
    android: {channelId},
  });
}
