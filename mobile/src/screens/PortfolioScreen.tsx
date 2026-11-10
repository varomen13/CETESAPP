import React, {useMemo, useState} from 'react';
import {Alert, Pressable, Text, TextInput, View} from 'react-native';
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  CirclePlus,
  Clock3,
  Trash2,
} from 'lucide-react-native';
import {
  Button,
  Card,
  formatDate,
  Heading,
  Muted,
  Notice,
  Page,
  SectionTitle,
  colors,
  styles,
} from '../components/ui';
import {useCetes} from '../context/CetesContext';
import {CETES_TERMS, CetesTerm, TERM_LABELS} from '../types';
import {createInvestment, formatCurrency} from '../utils/cetes';
import {sanitizeDateInput, sanitizeDecimalInput} from '../utils/numericInput';
import {PORTFOLIO_SOURCE_STATUS} from '../services/portfolioProvider';

function startOfLocalDay(value: string | Date): number {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function statusForInvestment(item: {
  startDate: string;
  maturityDate: string;
}): {label: string; tone: 'active' | 'past' | 'upcoming'} {
  const today = startOfLocalDay(new Date());
  if (startOfLocalDay(item.startDate) > today) {
    return {label: 'Programada', tone: 'upcoming'};
  }
  if (startOfLocalDay(item.maturityDate) < today) {
    return {label: 'Vencida', tone: 'past'};
  }
  return {label: 'En seguimiento', tone: 'active'};
}

function InfoLine({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.resultRow}>
      <Muted>{label}</Muted>
      <Text style={styles.portfolioDetailValue}>{value}</Text>
    </View>
  );
}

export function PortfolioScreen() {
  const {data, rates, addInvestment, removeInvestment} = useCetes();
  const [formExpanded, setFormExpanded] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState<CetesTerm>(28);
  const [rate, setRate] = useState('');
  const [startDate, setStartDate] = useState(dateInputValue(new Date()));
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const currentRate = data.rates.find(
    item => item.term === term && item.source === 'official',
  )?.annualRate;

  const investments = useMemo(
    () =>
      [...data.investments].sort(
        (left, right) =>
          new Date(right.startDate).getTime() - new Date(left.startDate).getTime(),
      ),
    [data.investments],
  );
  const active = useMemo(
    () => investments.filter(item => statusForInvestment(item).tone === 'active'),
    [investments],
  );
  const upcoming = useMemo(
    () =>
      investments
        .filter(item => statusForInvestment(item).tone === 'active')
        .sort(
          (left, right) =>
            new Date(left.maturityDate).getTime() -
            new Date(right.maturityDate).getTime(),
        ),
    [investments],
  );
  const capital = active.reduce((total, item) => total + item.principal, 0);
  const estimatedReturn = active.reduce(
    (total, item) =>
      total + (item.rateSource === 'demo' ? 0 : item.estimatedReturn),
    0,
  );
  const savedCalculations = data.simulations.filter(
    item => item.rateSource !== 'demo',
  );
  const calculatedCapital = savedCalculations.reduce(
    (total, item) => total + item.principal,
    0,
  );
  const calculatedReturn = savedCalculations.reduce(
    (total, item) => total + item.estimatedReturn,
    0,
  );

  const save = async () => {
    const principal = Number(amount.replace(',', '.'));
    const annualRate = Number(rate.replace(',', '.'));
    const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate);
    const parsedDate = dateParts
      ? new Date(
          Number(dateParts[1]),
          Number(dateParts[2]) - 1,
          Number(dateParts[3]),
          12,
        )
      : new Date(Number.NaN);

    if (!Number.isFinite(principal) || principal <= 0) {
      setMessage('Ingresa un capital mayor que cero.');
      return;
    }
    if (!Number.isFinite(annualRate) || annualRate <= 0) {
      setMessage('Ingresa una tasa anual válida.');
      return;
    }
    if (
      Number.isNaN(parsedDate.getTime()) ||
      dateInputValue(parsedDate) !== startDate
    ) {
      setMessage('Revisa la fecha de inicio. Usa el formato AAAA-MM-DD.');
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const sourceRate = rates.find(
        item =>
          item.term === term &&
          item.annualRate === annualRate &&
          item.source === 'official',
      );
      await addInvestment(
        createInvestment(
          principal,
          term,
          annualRate,
          'real',
          name.trim() || `Registro CETES ${term} días`,
          parsedDate,
          sourceRate?.source ?? 'manual',
        ),
      );
      setName('');
      setAmount('');
      setMessage('Registro agregado; no confirma una operación.');
    } catch {
      setMessage('No se pudo guardar el registro. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const confirmRemoval = (id: string, label: string) => {
    Alert.alert('Eliminar registro', `¿Eliminar “${label}” de este dispositivo?`, [
      {text: 'Cancelar', style: 'cancel'},
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
        void removeInvestment(id).catch(() =>
          setMessage('No se pudo eliminar el registro. Inténtalo de nuevo.'),
        );
        },
      },
    ]);
  };

  return (
    <Page>
      <Heading
        title="Mi portafolio"
        subtitle="Una vista clara de tus registros y próximos vencimientos."
      />

      <Notice>{PORTFOLIO_SOURCE_STATUS.message}</Notice>

      <Card style={styles.portfolioHero}>
        <Text style={styles.portfolioHeroLabel}>Capital registrado</Text>
        <Text style={styles.portfolioHeroValue}>{formatCurrency(capital)}</Text>
        <View style={styles.portfolioMetrics}>
          <View style={styles.portfolioMetric}>
            <Text style={styles.portfolioMetricValue}>{active.length}</Text>
            <Text style={styles.portfolioMetricLabel}>Registros activos</Text>
          </View>
          <View style={styles.portfolioMetric}>
            <Text style={[styles.portfolioMetricValue, {color: '#8EE0B7'}]}>
              {formatCurrency(estimatedReturn)}
            </Text>
            <Text style={styles.portfolioMetricLabel}>Rendimiento estimado</Text>
          </View>
        </View>
      </Card>

      <Card>
        <View style={styles.portfolioSectionHeading}>
          <CalendarDays size={20} color={colors.navy} />
          <SectionTitle>Próximos vencimientos</SectionTitle>
        </View>
        {upcoming.length ? (
          upcoming.slice(0, 3).map(item => {
            const remaining = Math.max(
              0,
              Math.round(
                (startOfLocalDay(item.maturityDate) -
                  startOfLocalDay(new Date())) /
                  86400000,
              ),
            );
            return (
              <View key={item.id} style={styles.portfolioUpcomingRow}>
                <View style={styles.portfolioUpcomingCopy}>
                  <Text style={styles.portfolioRecordTitle}>{item.name}</Text>
                  <Muted>
                    {new Date(item.maturityDate).toLocaleDateString('es-MX')} ·{' '}
                    {formatCurrency(item.principal)}
                  </Muted>
                </View>
                <Text style={styles.portfolioCountdown}>{remaining} días</Text>
              </View>
            );
          })
        ) : (
          <Muted>Los vencimientos de tus registros activos aparecerán aquí.</Muted>
        )}
      </Card>

      <View style={styles.portfolioHistoryHeading}>
        <BriefcaseBusiness size={20} color={colors.navy} />
        <SectionTitle>Historial de inversiones</SectionTitle>
      </View>
      {investments.length ? (
        investments.map(item => {
          const status = statusForInvestment(item);
          const statusColors = {
            active: {background: colors.paleGreen, foreground: colors.green},
            past: {background: colors.background, foreground: colors.muted},
            upcoming: {background: colors.paleBlue, foreground: colors.blue},
          }[status.tone];
          return (
            <Card key={item.id}>
              <View style={styles.portfolioRecordHeader}>
                <View style={styles.portfolioRecordIdentity}>
                  <Text style={styles.portfolioRecordTitle}>{item.name}</Text>
                  <Text style={styles.portfolioOrigin}>
                    {item.origin === 'authorized'
                      ? 'Fuente autorizada'
                      : 'Registro personal'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.portfolioStatus,
                    {backgroundColor: statusColors.background},
                  ]}>
                  <Text style={[styles.portfolioStatusText, {color: statusColors.foreground}]}>
                    {status.label}
                  </Text>
                </View>
              </View>
              <View style={styles.portfolioDetailGrid}>
                <InfoLine label="Capital declarado" value={formatCurrency(item.principal)} />
                <InfoLine label="Plazo" value={TERM_LABELS[item.term]} />
                <InfoLine
                  label="Tasa anual"
                  value={
                    item.rateSource === 'demo'
                      ? 'No disponible'
                      : `${item.annualRate.toFixed(2)}%`
                  }
                />
                <InfoLine
                  label="Rendimiento estimado"
                  value={
                    item.rateSource === 'demo'
                      ? 'No disponible'
                      : formatCurrency(item.estimatedReturn)
                  }
                />
                <InfoLine
                  label="Inicio"
                  value={new Date(item.startDate).toLocaleDateString('es-MX')}
                />
                <InfoLine
                  label="Vencimiento estimado"
                  value={new Date(item.maturityDate).toLocaleDateString('es-MX')}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Eliminar ${item.name}`}
                onPress={() => confirmRemoval(item.id, item.name)}
                style={({pressed}) => [
                  styles.portfolioDeleteButton,
                  {opacity: pressed ? 0.72 : 1},
                ]}>
                <Trash2 size={16} color={colors.red} />
                <Text style={styles.portfolioDeleteText}>Eliminar registro</Text>
              </Pressable>
            </Card>
          );
        })
      ) : (
        <Card style={styles.portfolioEmptyCard}>
          <View style={styles.portfolioEmptyIcon}>
            <BriefcaseBusiness size={24} color={colors.navy} />
          </View>
          <Text style={styles.portfolioEmptyTitle}>Tu portafolio está listo</Text>
          <Muted>
            Agrega un registro para consultar sus plazos y próximos vencimientos.
          </Muted>
        </Card>
      )}

      <Card>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{expanded: formExpanded}}
          onPress={() => setFormExpanded(expanded => !expanded)}
          style={({pressed}) => [
            styles.portfolioDisclosure,
            {opacity: pressed ? 0.75 : 1},
          ]}>
          <CirclePlus size={19} color={colors.navy} />
          <Text style={styles.portfolioDisclosureText}>Agregar registro de inversión</Text>
          <ChevronDown
            size={18}
            color={colors.muted}
            style={formExpanded ? styles.educationChevronOpen : undefined}
          />
        </Pressable>
        {formExpanded ? (
          <View style={styles.portfolioForm}>
            <Text style={styles.portfolioOptionalLabel}>
              Datos ingresados por ti. El rendimiento y el vencimiento son estimados.
            </Text>
            {message ? <Notice>{message}</Notice> : null}
            <TextInput
              accessibilityLabel="Nombre opcional del registro"
              value={name}
              onChangeText={setName}
              placeholder="Nombre opcional"
              style={styles.input}
            />
            <TextInput
              accessibilityLabel="Capital a registrar en pesos"
              accessibilityHint="Hasta 9 cifras enteras y 2 decimales."
              value={amount}
              onChangeText={value => setAmount(sanitizeDecimalInput(value, 9))}
              keyboardType="decimal-pad"
              maxLength={12}
              placeholder="Capital (MXN)"
              style={styles.input}
            />
            <Text style={styles.portfolioFormLabel}>Plazo de inversión</Text>
            <View style={styles.chips}>
              {CETES_TERMS.map(value => (
                <Text
                  key={value}
                  onPress={() => {
                    setTerm(value);
                    const suggestion = data.rates.find(
                      item => item.term === value,
                    )?.annualRate;
                    setRate(suggestion?.toString() ?? '');
                  }}
                  accessibilityRole="button"
                  accessibilityState={{selected: term === value}}
                  style={[styles.chip, term === value && styles.chipSelected]}>
                  {TERM_LABELS[value]}
                </Text>
              ))}
            </View>
            <TextInput
              accessibilityLabel="Tasa anual para la estimación"
              accessibilityHint="Hasta 3 cifras enteras y 2 decimales."
              value={rate}
              onChangeText={value => setRate(sanitizeDecimalInput(value, 3))}
              keyboardType="decimal-pad"
              maxLength={6}
              placeholder={
                currentRate
                  ? `Tasa de Banxico ${currentRate}%`
                  : 'Tasa anual (%)'
              }
              style={styles.input}
            />
            <TextInput
              accessibilityLabel="Fecha de inicio en formato año mes día"
              value={startDate}
              onChangeText={value => setStartDate(sanitizeDateInput(value))}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="AAAA-MM-DD"
              style={styles.input}
            />
            <Button
              title="Guardar registro"
              onPress={() => void save()}
              busy={saving}
            />
          </View>
        ) : null}
      </Card>

      <Card>
        <View style={styles.portfolioSectionHeading}>
          <Clock3 size={20} color={colors.navy} />
          <SectionTitle>Historial de cálculos ({data.simulations.length})</SectionTitle>
        </View>
        <Muted>
          La suma reúne los montos de tus cálculos guardados; no representa dinero invertido ni
          compras. El rendimiento también es estimado.
        </Muted>
        {savedCalculations.length ? (
          <>
            <InfoLine
              label="Suma del capital considerado"
              value={formatCurrency(calculatedCapital)}
            />
            <InfoLine
              label="Rendimiento estimado total"
              value={formatCurrency(calculatedReturn)}
            />
          </>
        ) : null}
        {data.simulations.slice(0, 5).map(item => (
          <View key={item.id} style={styles.portfolioUpcomingRow}>
            <View style={styles.portfolioUpcomingCopy}>
              <Text style={styles.portfolioRecordTitle}>{item.name}</Text>
              <Muted>
                {item.rateSource === 'demo'
                  ? 'Tasa no disponible'
                  : `${TERM_LABELS[item.term]} · ${formatCurrency(item.principal)} · ${
                      formatDate(item.startDate)
                    }`}
              </Muted>
            </View>
            <Text style={styles.portfolioEstimateValue}>
              {item.rateSource === 'demo'
                ? '—'
                : `+${formatCurrency(item.estimatedReturn)}`}
            </Text>
          </View>
        ))}
        {!data.simulations.length ? <Muted>Aún no hay cálculos guardados.</Muted> : null}
      </Card>
    </Page>
  );
}
