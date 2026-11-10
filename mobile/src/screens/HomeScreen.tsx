import React from 'react';
import {Text, View, Pressable} from 'react-native';
import {BookOpen, ChevronRight} from 'lucide-react-native';
import {CompositeNavigationProp, useNavigation} from '@react-navigation/native';
import {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Card, Heading, Muted, Page, SectionTitle, colors, styles} from '../components/ui';
import {useCetes} from '../context/CetesContext';
import {formatCurrency} from '../utils/cetes';
import {formatDate} from '../components/ui';
import {MainTabParamList, RootStackParamList} from '../navigation/types';

type HomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Inicio'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const {data, rates} = useCetes();
  const active = data.investments.filter(
    investment =>
      new Date(investment.startDate).getTime() <= Date.now() &&
      new Date(investment.maturityDate).getTime() >= Date.now(),
  );
  const invested = active.reduce((total, item) => total + item.principal, 0);
  const returnEstimate = active.reduce(
    (total, item) =>
      total + (item.rateSource === 'demo' ? 0 : item.estimatedReturn),
    0,
  );
  const savedCalculations = data.simulations.filter(
    calculation => calculation.rateSource !== 'demo',
  );
  const calculatedCapital = savedCalculations.reduce(
    (total, calculation) => total + calculation.principal,
    0,
  );
  const calculatedReturn = savedCalculations.reduce(
    (total, calculation) => total + calculation.estimatedReturn,
    0,
  );
  const next = active.sort(
    (left, right) =>
      new Date(left.maturityDate).getTime() - new Date(right.maturityDate).getTime(),
  )[0];
  const officialRates = rates.filter(rate => rate.source === 'official');
  const best = [...officialRates].sort(
    (a, b) => b.annualRate - a.annualRate,
  )[0];

  return (
    <Page>
      <Heading title="CETES Smart" subtitle="Tu mercado CETES, claro y al día." />

      <Card style={{backgroundColor: colors.navy, borderColor: colors.navy}}>
        <Text style={{color: '#CBD8EC', fontSize: 13}}>Capital en inversiones registradas</Text>
        <Text style={{color: colors.white, fontSize: 28, fontWeight: '800'}}>
          {formatCurrency(invested)}
        </Text>
        <View style={{height: 1, backgroundColor: '#40516A'}} />
        <Text style={{color: '#CBD8EC', fontSize: 13}}>Rendimiento estimado al vencimiento</Text>
        <Text style={{color: '#8EE0B7', fontSize: 20, fontWeight: '700'}}>
          {formatCurrency(returnEstimate)}
        </Text>
        <Text style={styles.homeDisclaimer}>
          Montos declarados por ti; rendimiento estimado.
        </Text>
      </Card>

      <Card>
        <SectionTitle>Tus cálculos guardados</SectionTitle>
        {savedCalculations.length ? (
          <>
            <Text style={styles.sectionTitle}>
              {formatCurrency(calculatedCapital)} en cálculos guardados
            </Text>
            <Muted>
              {savedCalculations.length} {savedCalculations.length === 1 ? 'cálculo' : 'cálculos'} ·
              {' '}rendimiento estimado total {formatCurrency(calculatedReturn)}
            </Muted>
            {savedCalculations.slice(0, 2).map(calculation => (
              <View key={calculation.id} style={styles.resultRow}>
                <View>
                  <Text style={styles.portfolioRecordTitle}>{calculation.name}</Text>
                  <Muted>
                    CETES {calculation.term} días ·{' '}
                    {formatDate(calculation.startDate)}
                  </Muted>
                </View>
                <Text style={styles.portfolioEstimateValue}>
                  {formatCurrency(calculation.principal)}
                </Text>
              </View>
            ))}
            <Muted>
              La suma reúne tus cálculos guardados; no representa dinero invertido ni compras.
            </Muted>
          </>
        ) : (
          <>
            <Muted>
              Guarda cálculos para consultar aquí la suma del capital considerado y su historial.
            </Muted>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>Próximo vencimiento</SectionTitle>
        {next ? (
          <>
            <Text style={styles.sectionTitle}>{next.name}</Text>
            <Muted>
              {formatDate(next.maturityDate)} · {formatCurrency(next.principal)}
            </Muted>
          </>
        ) : (
          <>
            <Muted>
              Aún no tienes inversiones registradas. Elige un capital en Calcular y agrégalo al
              portafolio cuando hayas realizado la compra.
            </Muted>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>Radar del mercado</SectionTitle>
        {best ? (
          <>
            <Text style={{fontSize: 24, fontWeight: '800', color: colors.navy}}>
              {best.annualRate.toFixed(2)}% anual
            </Text>
            <Muted>La tasa más alta consultada: CETES {best.term} días.</Muted>
            <Muted>Dato de Banxico del {formatDate(best.date)}.</Muted>
          </>
        ) : (
          <Muted>Consulta el Radar para ver las tasas disponibles.</Muted>
        )}
      </Card>

      <Card style={styles.educationCallout}>
        <View style={styles.educationCalloutIcon}>
          <BookOpen size={24} color={colors.navy} />
        </View>
        <View style={styles.educationCalloutCopy}>
          <SectionTitle>Aprende sobre CETES</SectionTitle>
          <Muted>Conoce sus plazos, tasas y vencimientos con explicaciones sencillas.</Muted>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Conoce más sobre CETES"
          onPress={() => navigation.navigate('Education')}
          style={({pressed}) => [
            styles.educationCalloutButton,
            {opacity: pressed ? 0.78 : 1},
          ]}>
          <Text style={styles.educationCalloutButtonText}>Conoce más sobre CETES</Text>
          <ChevronRight size={20} color={colors.white} />
        </Pressable>
      </Card>
    </Page>
  );
}
