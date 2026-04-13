import { formatTimeAgo } from '../timeAgo';

// Mock translation keys matching the Spanish lang structure
const mockT = {
  justNow: 'Justo ahora',
  secondsAgo: 'Hace {count} segundo',
  secondsAgoPlural: 'Hace {count} segundos',
  minutesAgo: 'Hace {count} minuto',
  minutesAgoPlural: 'Hace {count} minutos',
  hoursAgo: 'Hace {count} hora',
  hoursAgoPlural: 'Hace {count} horas',
  daysAgo: 'Hace {count} día',
  daysAgoPlural: 'Hace {count} días',
  weeksAgo: 'Hace {count} semana',
  weeksAgoPlural: 'Hace {count} semanas',
  monthsAgo: 'Hace {count} mes',
  monthsAgoPlural: 'Hace {count} meses',
  yearsAgo: 'Hace {count} año',
  yearsAgoPlural: 'Hace {count} años',
};

describe('formatTimeAgo', () => {
  it('returns empty string for null', () => {
    expect(formatTimeAgo(null, mockT)).toBe('');
  });

  it('returns empty for invalid date string', () => {
    expect(formatTimeAgo('not-a-date', mockT)).toBe('');
  });

  it('returns "just now" for very recent dates', () => {
    const now = new Date();
    expect(formatTimeAgo(now, mockT)).toBe('Justo ahora');
  });

  it('returns seconds ago', () => {
    const thirtySecsAgo = new Date(Date.now() - 30_000);
    const result = formatTimeAgo(thirtySecsAgo, mockT);
    expect(result).toMatch(/Hace \d+ segundos/);
  });

  it('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
    const result = formatTimeAgo(fiveMinAgo, mockT);
    expect(result).toBe('Hace 5 minutos');
  });

  it('returns singular minute', () => {
    const oneMinAgo = new Date(Date.now() - 60_000);
    const result = formatTimeAgo(oneMinAgo, mockT);
    expect(result).toBe('Hace 1 minuto');
  });

  it('returns hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600_000);
    const result = formatTimeAgo(threeHoursAgo, mockT);
    expect(result).toBe('Hace 3 horas');
  });

  it('returns days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
    const result = formatTimeAgo(twoDaysAgo, mockT);
    expect(result).toBe('Hace 2 días');
  });

  it('handles ISO string input', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    const result = formatTimeAgo(fiveMinAgo, mockT);
    expect(result).toBe('Hace 5 minutos');
  });

  it('handles ISO string without Z suffix (adds UTC)', () => {
    // The function appends 'Z' to strings with 'T' but no 'Z'
    const now = new Date();
    const isoNoZ = now.toISOString().replace('Z', '');
    const result = formatTimeAgo(isoNoZ, mockT);
    expect(result).toBe('Justo ahora');
  });

  it('returns "just now" for future dates', () => {
    const future = new Date(Date.now() + 60_000);
    expect(formatTimeAgo(future, mockT)).toBe('Justo ahora');
  });
});
