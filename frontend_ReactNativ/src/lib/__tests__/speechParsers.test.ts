import { parseSpokenDate, cleanSpokenRut } from '../speechParsers';

describe('parseSpokenDate', () => {
  test('returns ISO when already ISO', () => {
    expect(parseSpokenDate('1980-03-12')).toBe('1980-03-12');
    expect(parseSpokenDate('1980-3-2')).toBe('1980-03-02');
  });

  test('parses dd/mm/yyyy', () => {
    expect(parseSpokenDate('12/03/1980')).toBe('1980-03-12');
    expect(parseSpokenDate('1-1-2024')).toBe('2024-01-01');
    expect(parseSpokenDate('1.1.99')).toBe('1999-01-01');
  });

  test('parses spoken Spanish date', () => {
    expect(parseSpokenDate('12 de marzo de 1980')).toBe('1980-03-12');
    expect(parseSpokenDate('1 de enero de 2024')).toBe('2024-01-01');
  });

  test('parses spoken English date', () => {
    expect(parseSpokenDate('march 12 1980')).toBe('1980-03-12');
    expect(parseSpokenDate('12 of march 1980')).toBe('1980-03-12');
  });

  test('returns trimmed input when not parseable', () => {
    expect(parseSpokenDate('  hello world  ')).toBe('hello world');
  });
});

describe('cleanSpokenRut', () => {
  test('replaces spoken hyphen words', () => {
    expect(cleanSpokenRut('12345678 guion 9')).toBe('12345678-9');
    expect(cleanSpokenRut('12345678 guión 9')).toBe('12345678-9');
    expect(cleanSpokenRut('12345678 dash K')).toBe('12345678-K');
  });

  test('strips dots and spaces', () => {
    expect(cleanSpokenRut('12.345.678-9')).toBe('12345678-9');
  });

  test('uppercases trailing K', () => {
    expect(cleanSpokenRut('12345678-k')).toBe('12345678-K');
  });
});
