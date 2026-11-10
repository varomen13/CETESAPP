import React, {useState} from 'react';
import {Pressable, Text, View} from 'react-native';
import {BANXICO_API_TOKEN} from '@env';
import {Button, Card, Heading, Muted, Notice, Page, SectionTitle, colors} from '../components/ui';
import {useCetes} from '../context/CetesContext';

export function SettingsScreen() {
  const {
    data,
    wearableConnected,
    wearableMessage,
    syncNow,
    updateNotifications,
  } = useCetes();
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const toggle = async (key: 'enabled' | 'favoriteRateChanges') => {
    setError(null);
    try {
      await updateNotifications({
        ...data.notifications,
        [key]: !data.notifications[key],
      });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'No se guardó la preferencia.');
    }
  };
  const requestSync = async () => {
    setSyncing(true);
    setSyncResult('Sincronizando…');
    try {
      setSyncResult(await syncNow());
    } catch (syncError) {
      setSyncResult(
        syncError instanceof Error
          ? syncError.message
          : 'No se pudo completar la sincronización.',
      );
    } finally {
      setSyncing(false);
    }
  };
  const syncTone = syncing
    ? 'info'
    : syncResult
      ? syncResult.startsWith('Sincronizado a las')
        ? 'success'
        : 'error'
      : wearableConnected
        ? 'success'
        : 'info';

  return (
    <Page>
      <Heading title="Ajustes" subtitle="Preferencias locales y estado de tus dispositivos." />
      <Card>
        <SectionTitle>Conexión con smartwatch</SectionTitle>
        <Notice tone={syncTone}>
          {syncResult ?? wearableMessage}
        </Notice>
        <Button title="Sincronizar ahora" onPress={() => void requestSync()} busy={syncing} />
      </Card>
      <Card>
        <SectionTitle>Notificaciones</SectionTitle>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Preference
          title="Recordatorios de vencimiento"
          subtitle={`Avisar ${data.notifications.daysBeforeMaturity} días antes.`}
          value={data.notifications.enabled}
          onPress={() => void toggle('enabled')}
        />
        <Preference
          title="Cambios en plazos favoritos"
          subtitle="Avisar si una tasa favorita cambia al menos 0.10 puntos."
          value={data.notifications.favoriteRateChanges}
          onPress={() => void toggle('favoriteRateChanges')}
        />
      </Card>
      <Card>
        <SectionTitle>API de Banco de México</SectionTitle>
        <Notice tone={BANXICO_API_TOKEN?.trim() ? 'success' : 'info'}>
          {BANXICO_API_TOKEN?.trim()
            ? 'Token configurado para desarrollo.'
            : 'Token no configurado. Copia mobile/.env.example a mobile/.env y agrega BANXICO_API_TOKEN.'}
        </Notice>
        <Muted>
          Las consultas usan series SIE y se validan contra sus metadatos antes de mostrarse.
          Si no hay conexión, solo se conservan los últimos datos consultados y se indica su fecha.
        </Muted>
        <Muted>
          La clave incluida en una app móvil puede extraerse del APK. No distribuyas esta versión
          con un token; para producción utiliza un servicio intermedio.
        </Muted>
      </Card>
      <Card>
        <SectionTitle>Datos del dispositivo</SectionTitle>
        <Muted>
          Simulaciones, inversiones y preferencias se guardan en AsyncStorage en este teléfono.
          No se realizan compras ni se conectan cuentas financieras.
        </Muted>
      </Card>
    </Page>
  );
}

function Preference({
  title,
  subtitle,
  value,
  onPress,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{checked: value}}
      onPress={onPress}
      style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12}}>
      <View style={{flex: 1, gap: 3}}>
        <Text style={{fontWeight: '700', color: colors.text}}>{title}</Text>
        <Muted>{subtitle}</Muted>
      </View>
      <View
        style={{
          width: 42,
          height: 24,
          borderRadius: 12,
          padding: 3,
          justifyContent: 'center',
          backgroundColor: value ? colors.green : '#CBD5E1',
        }}>
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: colors.white,
            alignSelf: value ? 'flex-end' : 'flex-start',
          }}
        />
      </View>
    </Pressable>
  );
}
