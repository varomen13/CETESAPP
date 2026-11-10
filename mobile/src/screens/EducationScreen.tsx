import React, {useState} from 'react';
import {Pressable, Text, View} from 'react-native';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clock3,
  Gavel,
  Landmark,
  Percent,
  TrendingUp,
} from 'lucide-react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {Card, Heading, Muted, Page, colors, styles} from '../components/ui';
import {RootStackParamList} from '../navigation/types';

const topics = [
  {
    title: '¿Qué son los CETES?',
    summary: 'Instrumentos de deuda emitidos por el Gobierno de México.',
    detail:
      'Al comprar CETES prestas dinero al Gobierno Federal por un plazo definido. Al vencimiento recibes el valor nominal de los títulos; la diferencia con el precio de compra representa el rendimiento antes de impuestos.',
    icon: 'landmark',
  },
  {
    title: '¿Cómo funcionan?',
    summary: 'Se adquieren a un precio menor que su valor al vencimiento.',
    detail:
      'Los CETES se venden a descuento. El rendimiento depende del precio pagado, el plazo y las condiciones de la subasta. El monto final y el rendimiento pueden variar según la operación y la fecha de compra.',
    icon: 'book',
  },
  {
    title: '¿Qué significa una tasa anual?',
    summary: 'Es una referencia expresada como porcentaje por año.',
    detail:
      'La tasa anual permite comparar rendimientos en una base común. No significa que un plazo menor pague ese porcentaje completo: el rendimiento estimado depende también de los días de inversión y del precio de compra.',
    icon: 'percent',
  },
  {
    title: '¿Qué es una subasta?',
    summary: 'Es el mecanismo por el que se determinan precios y tasas.',
    detail:
      'El Banco de México publica resultados de las subastas de valores gubernamentales. Las tasas observadas reflejan esas condiciones de mercado; no garantizan la tasa de una compra futura.',
    icon: 'gavel',
  },
  {
    title: '¿En qué se diferencian los plazos?',
    summary: 'Cada plazo mantiene el dinero invertido durante distinto tiempo.',
    detail:
      'Los plazos disponibles de CETES son 28, 91, 182 y 364 días. Un plazo más largo puede tener una tasa distinta; también implica esperar más para llegar al vencimiento.',
    icon: 'calendar',
  },
  {
    title: '¿Qué es el rendimiento?',
    summary: 'Es la diferencia entre el valor recibido y el costo de compra.',
    detail:
      'En CETES, el rendimiento se obtiene al comprar los títulos a descuento y recibir su valor nominal al vencimiento. Cualquier cifra calculada en esta aplicación es una estimación y no confirma una compra.',
    icon: 'trend',
  },
  {
    title: '¿Qué significa vencimiento?',
    summary: 'Es la fecha en que termina el plazo del instrumento.',
    detail:
      'Al vencimiento se liquida el valor correspondiente a los títulos. Revisa esa fecha para planear la disponibilidad de tu dinero y cualquier reinversión que quieras realizar.',
    icon: 'clock',
  },
] as const;

type TopicIconName = (typeof topics)[number]['icon'];

export function EducationScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [expandedTopic, setExpandedTopic] = useState<number | null>(null);

  return (
    <Page>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('MainTabs', {screen: 'Inicio'})}
        style={({pressed}) => [
          educationStyles.backButton,
          {opacity: pressed ? 0.72 : 1},
        ]}>
        <ArrowLeft size={19} color={colors.navy} />
        <Text style={educationStyles.backText}>Volver a Inicio</Text>
      </Pressable>
      <Heading
        title="Conoce los CETES"
        subtitle="Conceptos claros para entender plazos, tasas y vencimientos."
      />
      {topics.map((topic, index) => {
        const expanded = expandedTopic === index;
        return (
          <Card key={topic.title} style={educationStyles.topicCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{expanded}}
              onPress={() =>
                setExpandedTopic(current => (current === index ? null : index))
              }
              style={({pressed}) => [
                educationStyles.topicHeader,
                {opacity: pressed ? 0.78 : 1},
              ]}>
              <View style={educationStyles.topicIcon}>
                <TopicIcon name={topic.icon} />
              </View>
              <View style={educationStyles.topicCopy}>
                <Text style={educationStyles.topicTitle}>{topic.title}</Text>
                <Muted>{topic.summary}</Muted>
              </View>
              <ChevronDown
                size={18}
                color={colors.muted}
                style={expanded ? styles.educationChevronOpen : undefined}
              />
            </Pressable>
            {expanded ? (
              <Text style={educationStyles.topicDetail}>{topic.detail}</Text>
            ) : null}
          </Card>
        );
      })}
    </Page>
  );
}

function TopicIcon({name}: {name: TopicIconName}) {
  switch (name) {
    case 'landmark':
      return <Landmark size={20} color={colors.navy} />;
    case 'percent':
      return <Percent size={20} color={colors.navy} />;
    case 'gavel':
      return <Gavel size={20} color={colors.navy} />;
    case 'calendar':
      return <CalendarDays size={20} color={colors.navy} />;
    case 'trend':
      return <TrendingUp size={20} color={colors.navy} />;
    case 'clock':
      return <Clock3 size={20} color={colors.navy} />;
    default:
      return <BookOpen size={20} color={colors.navy} />;
  }
}

const educationStyles = {
  backButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    minHeight: 40,
  },
  backText: {fontSize: 14, fontWeight: '700' as const, color: colors.navy},
  topicCard: {paddingVertical: 13},
  topicHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 11,
  },
  topicIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.paleBlue,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  topicCopy: {flex: 1, gap: 3},
  topicTitle: {fontSize: 15, fontWeight: '700' as const, color: colors.text},
  topicDetail: {
    marginTop: 10,
    marginLeft: 51,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
};
