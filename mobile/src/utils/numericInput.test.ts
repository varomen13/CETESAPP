import {sanitizeDateInput, sanitizeDecimalInput} from './numericInput';

describe('numeric input sanitizers', () => {
  it('keeps decimal amounts within digit limits and accepts a comma separator', () => {
    expect(sanitizeDecimalInput('1234567890,987', 9)).toBe('123456789.98');
  });

  it('removes non-numeric characters and extra decimal separators', () => {
    expect(sanitizeDecimalInput('a12.3.45', 9)).toBe('12.34');
  });

  it('formats a date from at most eight digits', () => {
    expect(sanitizeDateInput('20261109abc')).toBe('2026-11-09');
  });
});
