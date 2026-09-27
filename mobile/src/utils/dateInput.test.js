import { formatDateWithSlashes, parseTrDateParts } from './dateInput';

describe('dateInput', () => {
  test('inserts slashes while typing', () => {
    expect(formatDateWithSlashes('23')).toBe('23');
    expect(formatDateWithSlashes('2309')).toBe('23/09');
    expect(formatDateWithSlashes('23091990')).toBe('23/09/1990');
    expect(formatDateWithSlashes('23.09.1990')).toBe('23/09/1990');
  });

  test('parses valid TR date and rejects invalid', () => {
    expect(parseTrDateParts('23/09/1990')).toEqual({
      day: 23,
      month: 9,
      year: 1990,
      stored: '23/09/1990',
    });
    expect(parseTrDateParts('31/02/2020')).toBeNull();
    expect(parseTrDateParts('2309')).toBeNull();
  });
});
