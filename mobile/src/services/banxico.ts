import axios from 'axios';
import {BANXICO_API_TOKEN} from '@env';
import {CETES_TERMS, CetesTerm, MarketRate} from '../types';

const API_BASE = 'https://www.banxico.org.mx/SieAPIRest/service/v1';

export const CETES_SERIES: Record<CetesTerm, string> = {
  28: 'SF43936',
  91: 'SF43939',
  182: 'SF43942',
  364: 'SF43945',
};

type BanxicoObservation = {fecha?: string; dato?: string};
type BanxicoSeries = {
  idSerie?: string;
  titulo?: string;
  datos?: BanxicoObservation[];
};
type BanxicoResponse = {bmx?: {series?: BanxicoSeries[]}};

function parseDate(value: string): Date {
  const parts = value.split('/');
  const parsed =
    parts.length === 3
      ? new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]))
      : new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`Banxico devolvió una fecha no válida: ${value}`);
  }
  return parsed;
}

function seriesFrom(response: BanxicoResponse, expectedTerm: CetesTerm): BanxicoSeries {
  const series = response.bmx?.series?.[0];
  if (!series?.titulo || !series.datos?.length) {
    throw new Error(`Banxico no devolvió datos para CETES de ${expectedTerm} días.`);
  }
  const title = series.titulo.toLocaleLowerCase('es-MX');
  if (!title.includes('cetes') || !title.includes(String(expectedTerm))) {
    throw new Error(
      `La serie ${series.idSerie ?? 'desconocida'} no corresponde a CETES de ${expectedTerm} días (${series.titulo}).`,
    );
  }
  return series;
}

async function fetchSeries(term: CetesTerm, token: string): Promise<MarketRate> {
  const seriesId = CETES_SERIES[term];
  const metadataResponse = await axios.get<BanxicoResponse>(
    `${API_BASE}/series/${seriesId}`,
    {headers: {'Bmx-Token': token}, timeout: 15000},
  );
  const metadata = metadataResponse.data.bmx?.series?.[0];
  if (!metadata?.titulo) {
    throw new Error(`Banxico no confirmó los metadatos de la serie ${seriesId}.`);
  }
  const title = metadata.titulo.toLocaleLowerCase('es-MX');
  if (!title.includes('cetes') || !title.includes(String(term))) {
    throw new Error(
      `La serie ${seriesId} no coincide con CETES de ${term} días: ${metadata.titulo}.`,
    );
  }

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 180);
  const datePart = (date: Date) => date.toISOString().slice(0, 10);
  const response = await axios.get<BanxicoResponse>(
    `${API_BASE}/series/${seriesId}/datos/${datePart(start)}/${datePart(end)}`,
    {headers: {'Bmx-Token': token}, timeout: 20000},
  );
  const series = seriesFrom(response.data, term);
  const observations = (series.datos ?? [])
    .map(item => ({date: item.fecha ?? '', value: Number(item.dato)}))
    .filter(item => item.date && Number.isFinite(item.value))
    .sort((left, right) => parseDate(left.date).getTime() - parseDate(right.date).getTime());
  const latest = observations.at(-1);
  const previous = observations.at(-2);
  if (!latest) {
    throw new Error(`No hay observaciones válidas para CETES de ${term} días.`);
  }

  return {
    term,
    seriesId,
    annualRate: latest.value,
    date: parseDate(latest.date).toISOString(),
    previousRate: previous?.value ?? null,
    change: previous ? latest.value - previous.value : null,
    source: 'official',
  };
}

export async function fetchCetesRates(): Promise<MarketRate[]> {
  const token = BANXICO_API_TOKEN?.trim();
  if (!token) {
    throw new Error(
      'Falta BANXICO_API_TOKEN. Copia mobile/.env.example a mobile/.env y agrega tu token de Banxico.',
    );
  }
  return Promise.all(CETES_TERMS.map(term => fetchSeries(term, token)));
}
