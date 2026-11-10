import {createInvestment, formatCurrency, simulateCetes} from './cetes';

describe('CETES estimates', () => {
  it('uses the 360-day simple-yield discount price and whole titles', () => {
    const result = simulateCetes(1000, 28, 10, new Date('2026-01-01T12:00:00.000Z'));

    expect(result.pieces).toBe(100);
    expect(result.invested).toBeCloseTo(992.283, 2);
    expect(result.maturityValue).toBe(1000);
    expect(result.estimatedReturn).toBeCloseTo(7.717, 2);
    expect(result.maturityDate).toBe('2026-01-29T12:00:00.000Z');
  });

  it('rejects invalid amounts and rates instead of returning a fake result', () => {
    expect(() => simulateCetes(0, 28, 10)).toThrow('Ingresa una cantidad mayor que cero.');
    expect(() => simulateCetes(1000, 28, Number.NaN)).toThrow(
      'No hay una tasa válida para este plazo.',
    );
    expect(() => simulateCetes(1, 28, 10)).toThrow(
      'La cantidad no alcanza para adquirir un título de CETES.',
    );
  });

  it('preserves the investment kind and formats Mexican pesos', () => {
    const investment = createInvestment(1000, 91, 9.5, 'simulation', 'Mi cálculo');

    expect(investment.kind).toBe('simulation');
    expect(investment.name).toBe('Mi cálculo');
    expect(formatCurrency(1000)).toContain('1,000.00');
  });
});
