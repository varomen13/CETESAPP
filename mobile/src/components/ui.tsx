import React, {PropsWithChildren} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

export const colors = {
  navy: '#10233F',
  blue: '#1D4ED8',
  green: '#13845B',
  red: '#C2413A',
  text: '#18263A',
  muted: '#64748B',
  background: '#F3F6FA',
  white: '#FFFFFF',
  border: '#E1E7EF',
  paleBlue: '#EAF1FF',
  paleGreen: '#E7F5EF',
  paleRed: '#FDEEEE',
};

export function Page({children}: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.pageContent,
        {paddingTop: Math.max(insets.top, 16), paddingBottom: 28},
      ]}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Heading({title, subtitle}: {title: string; subtitle?: string}) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({children, style}: PropsWithChildren<{style?: object}>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({children}: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Muted({children}: PropsWithChildren) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Notice({
  children,
  tone = 'info',
}: PropsWithChildren<{tone?: 'info' | 'error' | 'success'}>) {
  const background =
    tone === 'error'
      ? colors.paleRed
      : tone === 'success'
        ? colors.paleGreen
        : colors.paleBlue;
  const foreground =
    tone === 'error' ? colors.red : tone === 'success' ? colors.green : colors.blue;
  return (
    <View style={[styles.notice, {backgroundColor: background}]}>
      <Text style={[styles.noticeText, {color: foreground}]}>{children}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  disabled = false,
  busy = false,
  variant = 'primary',
}: {
  title: string;
  onPress(): void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'secondary' | 'quiet';
}) {
  const background =
    variant === 'primary' ? colors.navy : variant === 'secondary' ? colors.paleBlue : 'transparent';
  const foreground = variant === 'primary' ? colors.white : colors.navy;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({pressed}) => [
        styles.button,
        {backgroundColor: background, opacity: disabled || busy ? 0.5 : pressed ? 0.78 : 1},
      ]}>
      {busy ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <Text style={[styles.buttonText, {color: foreground}]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : date.toLocaleDateString('es-MX', {day: 'numeric', month: 'short', year: 'numeric'});
}

export const styles = StyleSheet.create({
  page: {flex: 1, backgroundColor: colors.background},
  pageContent: {paddingHorizontal: 20, gap: 16},
  heading: {gap: 5, marginBottom: 2},
  title: {fontSize: 28, fontWeight: '800', color: colors.navy},
  subtitle: {fontSize: 14, lineHeight: 20, color: colors.muted},
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  sectionTitle: {fontSize: 17, fontWeight: '700', color: colors.text},
  muted: {fontSize: 13, lineHeight: 19, color: colors.muted},
  notice: {padding: 12, borderRadius: 12},
  noticeText: {fontSize: 13, lineHeight: 19, fontWeight: '600'},
  button: {
    minHeight: 46,
    borderRadius: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {fontSize: 14, fontWeight: '700'},
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.white,
  },
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  chipSelected: {backgroundColor: colors.navy, borderColor: colors.navy, color: colors.white},
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 5,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 6,
  },
  homeDisclaimer: {fontSize: 12, lineHeight: 18, color: '#CBD8EC'},
  educationCallout: {gap: 12},
  educationCalloutIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.paleBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  educationCalloutCopy: {gap: 5},
  educationCalloutButton: {
    minHeight: 46,
    borderRadius: 13,
    paddingHorizontal: 14,
    backgroundColor: colors.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  educationCalloutButtonText: {fontSize: 14, fontWeight: '700', color: colors.white},
  portfolioHero: {backgroundColor: colors.navy, borderColor: colors.navy},
  portfolioHeroLabel: {fontSize: 14, fontWeight: '600', color: '#CBD8EC'},
  portfolioHeroValue: {fontSize: 32, fontWeight: '800', color: colors.white},
  portfolioMetrics: {flexDirection: 'row', gap: 12, marginTop: 4},
  portfolioMetric: {flex: 1, gap: 4},
  portfolioMetricValue: {fontSize: 20, fontWeight: '800', color: colors.white},
  portfolioMetricLabel: {fontSize: 12, lineHeight: 17, color: '#CBD8EC'},
  portfolioSectionHeading: {flexDirection: 'row', alignItems: 'center', gap: 8},
  portfolioUpcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
  },
  portfolioUpcomingCopy: {flex: 1, gap: 3},
  portfolioRecordTitle: {fontSize: 15, fontWeight: '700', color: colors.text},
  portfolioCountdown: {fontSize: 13, fontWeight: '700', color: colors.navy},
  portfolioHistoryHeading: {flexDirection: 'row', alignItems: 'center', gap: 8},
  portfolioRecordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  portfolioRecordIdentity: {flex: 1, gap: 3},
  portfolioOrigin: {fontSize: 12, color: colors.muted},
  portfolioStatus: {borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5},
  portfolioStatusText: {fontSize: 11, fontWeight: '700'},
  portfolioDetailGrid: {gap: 2},
  portfolioDetailValue: {fontSize: 13, fontWeight: '600', color: colors.text},
  portfolioDeleteButton: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.paleRed,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  portfolioDeleteText: {fontSize: 13, fontWeight: '600', color: colors.red},
  portfolioEmptyCard: {alignItems: 'center', paddingVertical: 24},
  portfolioEmptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.paleBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portfolioEmptyTitle: {fontSize: 16, fontWeight: '700', color: colors.navy},
  portfolioEstimateValue: {fontSize: 14, fontWeight: '700', color: colors.green},
  portfolioDisclosure: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  portfolioDisclosureText: {flex: 1, fontSize: 14, fontWeight: '700', color: colors.navy},
  educationChevronOpen: {transform: [{rotate: '180deg'}]},
  portfolioForm: {gap: 12, paddingTop: 10},
  portfolioOptionalLabel: {fontSize: 12, lineHeight: 18, color: colors.muted},
  portfolioFormLabel: {fontSize: 14, fontWeight: '700', color: colors.text},
});
