import {CetesTerm, SavedInvestment} from '../types';

export type SimulationResult = {
  pieces: number;
  pricePerPiece: number;
  invested: number;
  maturityValue: number;
  estimatedReturn: number;
  maturityDate: string;
};

export function simulateCetes(
  amount: number,
  term: CetesTerm,
  annualRate: number,
  startDate = new Date(),
): SimulationResult {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Ingresa una cantidad mayor que cero.');
  }
  if (!Number.isFinite(annualRate) || annualRate <= 0) {
    throw new Error('No hay una tasa válida para este plazo.');
  }

  const pricePerPiece = 10 / (1 + (annualRate / 100) * (term / 360));
  const pieces = Math.floor(amount / pricePerPiece);
  if (pieces < 1) {
    throw new Error('La cantidad no alcanza para adquirir un título de CETES.');
  }

  const invested = pieces * pricePerPiece;
  const maturityValue = pieces * 10;
  const maturity = new Date(startDate);
  maturity.setDate(maturity.getDate() + term);

  return {
    pieces,
    pricePerPiece,
    invested,
    maturityValue,
    estimatedReturn: maturityValue - invested,
    maturityDate: maturity.toISOString(),
  };
}

export function createInvestment(
  amount: number,
  term: CetesTerm,
  annualRate: number,
  kind: SavedInvestment['kind'],
  name: string,
  startDate = new Date(),
  rateSource: SavedInvestment['rateSource'] = 'manual',
): SavedInvestment {
  const result = simulateCetes(amount, term, annualRate, startDate);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || `CETES ${term} días`,
    principal: result.invested,
    term,
    annualRate,
    startDate: startDate.toISOString(),
    maturityDate: result.maturityDate,
    estimatedReturn: result.estimatedReturn,
    kind,
    rateSource,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(amount);
}
