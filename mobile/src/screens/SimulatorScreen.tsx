import React, {useMemo, useState} from 'react';
import {Alert, Text, TextInput, View} from 'react-native';
import {Button, Card, Heading, Muted, Notice, Page, SectionTitle, colors, styles} from '../components/ui';
import {useCetes} from '../context/CetesContext';
import {CETES_TERMS, CetesTerm, TERM_LABELS} from '../types';
import {
  createInvestment,
  formatCurrency,
  simulateCetes,
} from '../utils/cetes';
import type {SimulationResult} from '../utils/cetes';
import {isRateStale} from '../utils/market';
import {sanitizeDecimalInput} from '../utils/numericInput';

function amountValue(value: string): number {
  return Number(value.replace(',', '.'));
}

export function SimulatorScreen() {
  const {rates, addInvestment, addSimulation} = useCetes();
  const [amount, setAmount] = useState('10000');
  const [term, setTerm] = useState<CetesTerm>(28);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const currentRate = rates.find(
    rate => rate.term === term && rate.source === 'official',
  );
  const isStale = currentRate ? isRateStale(currentRate) : false;
  const amountNumber = amountValue(amount);
  const calculation = useMemo((): {
    result: SimulationResult | null;
    error: string | null;
  } => {
    if (!currentRate || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      return {result: null, error: null};
    }
    try {
      return {
        result: simulateCetes(amountNumber, term, currentRate.annualRate),
        error: null,
      };
    } catch (calculationFailure) {
      return {
        result: null,
        error:
          calculationFailure instanceof Error
            ? calculationFailure.message
            : 'No se pudo calcular el rendimiento.',
      };
    }
  }, [amountNumber, currentRate, term]);
  const {result, error: calculationError} = calculation;

  const save = async () => {
    if (!currentRate || !result) {
      setMessage('Consulta una tasa válida y revisa la cantidad antes de guardar.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const simulation = createInvestment(
        amountNumber,
        term,
        currentRate.annualRate,
        'simulation',
        `Cálculo CETES ${term} días`,
        new Date(),
        'official',
      );
      await addSimulation(simulation);
      setMessage('Cálculo guardado. Es una estimación; no se realizó ninguna operación.');
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : 'No se pudo guardar el cálculo.');
    } finally {
      setSaving(false);
    }
  };

  const saveInvestment = async () => {
    if (!currentRate || !result) {
      setMessage('Consulta una tasa válida y revisa el capital antes de continuar.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const investment = createInvestment(
        amountNumber,
        term,
        currentRate.annualRate,
        'real',
        `Registro CETES ${term} días`,
        new Date(),
        'official',
      );
      await addInvestment({...investment, origin: 'user'});
      setMessage(
        `Registro agregado al portafolio con ${formatCurrency(investment.principal)} de capital estimado. No confirma ni ejecuta una compra.`,
      );
    } catch (saveError) {
      setMessage(
        saveError instanceof Error
          ? saveError.message
          : 'No se pudo agregar el registro al portafolio.',
      );
    } finally {
      setSaving(false);
    }
  };

  const registerInvestment = () => {
    if (!currentRate || !result) {
      setMessage('Consulta una tasa válida y revisa el capital antes de continuar.');
      return;
    }
    Alert.alert(
      'Registrar inversión',
      'Agrega este monto al portafolio solo si ya realizaste la compra. CETES Smart no ejecuta ni verifica operaciones.',
      [
        {text: 'Cancelar', style: 'cancel'},
        {
          text: 'Sí, ya la realicé',
          onPress: saveInvestment,
        },
      ],
    );
  };

  return (
    <Page>
      <Heading
        title="Calculadora de rendimientos"
        subtitle="Consulta una estimación con la tasa de CETES disponible para cada plazo."
      />
      {message ? <Notice>{message}</Notice> : null}
      <Card>
        <SectionTitle>Capital a invertir</SectionTitle>
        <TextInput
          accessibilityLabel="Capital a invertir en pesos"
          accessibilityHint="Hasta 9 cifras enteras y 2 decimales."
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={value => setAmount(sanitizeDecimalInput(value, 9))}
          maxLength={12}
          placeholder="Capital en pesos"
          style={styles.input}
        />
        <Muted>Elige un monto de referencia o escribe otro:</Muted>
        <View style={styles.chips}>
          {[5000, 10000, 25000].map(value => (
            <Text
              key={value}
              onPress={() => setAmount(String(value))}
              accessibilityRole="button"
              accessibilityLabel={`Usar ${formatCurrency(value)} como capital`}
              style={[
                styles.chip,
                amountNumber === value && styles.chipSelected,
              ]}>
              {formatCurrency(value)}
            </Text>
          ))}
        </View>
        <Muted>El resultado es estimado; no realiza una operación.</Muted>
        <SectionTitle>Plazo de inversión</SectionTitle>
        <View style={styles.chips}>
          {CETES_TERMS.map(value => (
            <Text
              key={value}
              onPress={() => setTerm(value)}
              accessibilityRole="button"
              style={[styles.chip, term === value && styles.chipSelected]}>
              {TERM_LABELS[value]}
            </Text>
          ))}
        </View>
        {currentRate ? (
          <>
            <Muted>
              Tasa de Banxico: {currentRate.annualRate.toFixed(2)}% · al{' '}
              {new Date(currentRate.date).toLocaleDateString('es-MX')}.
            </Muted>
            {isStale ? (
              <Notice tone="error">
                La tasa puede estar desactualizada. Consulta el Radar antes de usar este cálculo.
              </Notice>
            ) : null}
          </>
        ) : (
          <Notice>No hay una tasa disponible para este plazo. Consulta el Radar.</Notice>
        )}
      </Card>

      {result ? (
        <Card>
          <SectionTitle>Rendimiento estimado</SectionTitle>
          <ResultRow label="Títulos estimados" value={String(result.pieces)} />
          <ResultRow label="Capital ingresado" value={formatCurrency(amountNumber)} />
          <ResultRow label="Capital estimado en títulos" value={formatCurrency(result.invested)} />
          <ResultRow label="Rendimiento estimado" value={formatCurrency(result.estimatedReturn)} positive />
          <ResultRow label="Monto al vencimiento" value={formatCurrency(result.maturityValue)} />
          <Muted>Fecha de vencimiento estimada: {new Date(result.maturityDate).toLocaleDateString('es-MX')}.</Muted>
          <Muted>
            Es una estimación antes de impuestos. La tasa puede cambiar en subasta; el monto exacto
            depende del precio y la fecha de compra.
          </Muted>
          <Button title="Guardar cálculo" onPress={save} busy={saving} />
          <Muted>
            Cuando hayas confirmado la compra fuera de CETES Smart, puedes agregar el registro a tu
            portafolio. Este registro es declarado por ti; la aplicación no ejecuta ni verifica la
            operación.
          </Muted>
          <Button
            title="Agregar al portafolio"
            variant="secondary"
            onPress={registerInvestment}
            busy={saving}
            disabled={!currentRate}
          />
        </Card>
      ) : (
        currentRate ? (
          <Notice>
            {calculationError ?? 'Ingresa un capital válido para calcular el rendimiento.'}
          </Notice>
        ) : null
      )}

      <Card>
        <SectionTitle>Comparar plazos</SectionTitle>
        {CETES_TERMS.map(value => {
          const rate = rates.find(
            item => item.term === value && item.source === 'official',
          );
          let comparison: ReturnType<typeof simulateCetes> | null = null;
          if (rate && Number.isFinite(amountNumber) && amountNumber > 0) {
            try {
              comparison = simulateCetes(amountNumber, value, rate.annualRate);
            } catch {
              comparison = null;
            }
          }
          return (
            <View key={value} style={styles.resultRow}>
              <View style={{gap: 2}}>
                <Text style={{fontWeight: '700', color: colors.text}}>{TERM_LABELS[value]}</Text>
                <Muted>{rate ? `${rate.annualRate.toFixed(2)}% anual` : 'Sin tasa'}</Muted>
              </View>
              <Text style={{fontWeight: '700', color: colors.green}}>
                {comparison ? formatCurrency(comparison.estimatedReturn) : '—'}
              </Text>
            </View>
          );
        })}
      </Card>
    </Page>
  );
}

function ResultRow({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <View style={styles.resultRow}>
      <Muted>{label}</Muted>
      <Text style={{fontSize: 15, fontWeight: '700', color: positive ? colors.green : colors.text}}>
        {value}
      </Text>
    </View>
  );
}
