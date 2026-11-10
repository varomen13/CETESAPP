import React, {useMemo} from 'react';
import {Text, View} from 'react-native';
import Svg, {Rect} from 'react-native-svg';
import {Button, Card, Heading, Muted, Notice, Page, SectionTitle, colors} from '../components/ui';
import {useCetes} from '../context/CetesContext';
import {CETES_TERMS, TERM_LABELS} from '../types';
import {formatDate} from '../components/ui';

export function RadarScreen() {
  const {data, rates, error, refreshing, refreshRates, setFavorite} = useCetes();
  const highest = useMemo(
    () => [...rates].sort((a, b) => b.annualRate - a.annualRate)[0],
    [rates],
  );
  const mostIncreased = useMemo(
    () => rates.filter(rate => rate.change !== null).sort((a, b) => b.change! - a.change!)[0],
    [rates],
  );
  const mostDecreased = useMemo(
    () => rates.filter(rate => rate.change !== null).sort((a, b) => a.change! - b.change!)[0],
    [rates],
  );
  const unchanged = rates.filter(rate => rate.change === 0);
  const chartHeight = 100;
  const maxRate = Math.max(1, ...rates.map(rate => rate.annualRate));
  const isStale =
    data.ratesFetchedAt !== null &&
    Date.now() - new Date(data.ratesFetchedAt).getTime() > 7 * 86400000;

  return (
    <Page>
      <Heading title="Radar CETES" subtitle="Tasas oficiales de Banxico, sin recomendaciones automáticas." />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button
        title="Actualizar tasas"
        onPress={() => void refreshRates().catch(() => undefined)}
        busy={refreshing}
      />
      {data.ratesFetchedAt ? (
        <Notice tone={isStale ? 'error' : 'success'}>
          {isStale ? 'Datos almacenados no verificados recientemente. ' : 'Datos descargados de Banxico. '}
          Última consulta: {formatDate(data.ratesFetchedAt)}.
        </Notice>
      ) : null}

      {rates.length ? (
        <>
          <Card>
            <SectionTitle>Todos los plazos</SectionTitle>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end'}}>
              {CETES_TERMS.map(term => {
                const rate = rates.find(item => item.term === term);
                const height = rate ? Math.max(8, (rate.annualRate / maxRate) * chartHeight) : 5;
                return (
                  <View key={term} style={{alignItems: 'center', gap: 5, width: '22%'}}>
                    <Svg width="48" height={chartHeight}>
                      <Rect
                        x="8"
                        y={chartHeight - height}
                        width="32"
                        height={height}
                        rx="6"
                        fill={colors.blue}
                        opacity={rate ? 0.88 : 0.15}
                      />
                    </Svg>
                    <Text style={{fontSize: 11, fontWeight: '700', color: colors.text}}>
                      {TERM_LABELS[term]}
                    </Text>
                    <Text style={{fontSize: 11, color: colors.muted}}>
                      {rate ? `${rate.annualRate.toFixed(2)}%` : '—'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>
          <Card>
            <SectionTitle>Señales del mercado</SectionTitle>
            <Muted>
              Tasa anual más alta: {highest ? `${highest.annualRate.toFixed(2)}% · ${TERM_LABELS[highest.term]}` : 'sin datos'}.
            </Muted>
            <Muted>
              Mayor incremento: {mostIncreased?.change !== null && mostIncreased
                ? `${mostIncreased.change! > 0 ? '+' : ''}${mostIncreased.change!.toFixed(2)} puntos · ${TERM_LABELS[mostIncreased.term]}`
                : 'sin variaciones disponibles'}.
            </Muted>
            <Muted>
              Mayor disminución: {mostDecreased?.change !== null && mostDecreased
                ? `${mostDecreased.change!.toFixed(2)} puntos · ${TERM_LABELS[mostDecreased.term]}`
                : 'sin variaciones disponibles'}.
            </Muted>
            <Muted>
              Sin cambios: {unchanged.length ? unchanged.map(item => TERM_LABELS[item.term]).join(', ') : 'ningún plazo'}.
            </Muted>
          </Card>
        </>
      ) : null}

      {CETES_TERMS.map(term => {
        const rate = rates.find(item => item.term === term);
        const favorite = data.favorites.includes(term);
        return (
          <Card key={term}>
            <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
              <View style={{gap: 3}}>
                <SectionTitle>CETES {TERM_LABELS[term]}</SectionTitle>
                <Muted>
                  {rate
                    ? `Dato oficial del ${formatDate(rate.date)}`
                    : 'Sin observaciones guardadas'}
                </Muted>
              </View>
              <Text
                onPress={() => void setFavorite(term)}
                accessibilityRole="button"
                style={{fontSize: 24, color: favorite ? '#D39212' : colors.muted}}>
                {favorite ? '★' : '☆'}
              </Text>
            </View>
            <Text style={{fontSize: 25, fontWeight: '800', color: colors.navy}}>
              {rate ? `${rate.annualRate.toFixed(2)}%` : '—'}
            </Text>
            {rate?.change !== null && rate?.change !== undefined ? (
              <Muted>
                Variación vs. dato anterior: {rate.change > 0 ? '+' : ''}{rate.change.toFixed(2)} puntos
              </Muted>
            ) : (
              <Muted>Variación no disponible.</Muted>
            )}
          </Card>
        );
      })}
    </Page>
  );
}
