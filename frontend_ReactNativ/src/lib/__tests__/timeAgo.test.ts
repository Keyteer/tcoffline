import { formatTimeAgo } from '../timeAgo';

describe('formatTimeAgo', () => {
  it('returns empty string for null', () => {
    expect(formatTimeAgo(null, 'es')).toBe('');
  });

  it('returns empty for invalid date string', () => {
    expect(formatTimeAgo('not-a-date', 'es')).toBe('');
  });

  it('returns "just now" for very recent dates', () => {
    const now = new Date();
    expect(formatTimeAgo(now, 'es')).toMatch(/ahora/);
  });

  it('returns seconds ago', () => {
    const thirtySecsAgo = new Date(Date.now() - 30_000);
    const result = formatTimeAgo(thirtySecsAgo, 'es');
    expect(result).toMatch(/segundo/);
  });

  it('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
    const result = formatTimeAgo(fiveMinAgo, 'es');
    expect(result).toMatch(/5 minuto/);
  });

  it('returns singular minute', () => {
    const oneMinAgo = new Date(Date.now() - 60_000);
    const result = formatTimeAgo(oneMinAgo, 'es');
    expect(result).toMatch(/minuto/);
  });

  it('returns hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600_000);
    const result = formatTimeAgo(threeHoursAgo, 'es');
    expect(result).toMatch(/3 hora/);
  });

  it('returns days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
    const result = formatTimeAgo(twoDaysAgo, 'es');
    expect(result).toMatch(/2 día/);
  });

  it('handles ISO string input', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    const result = formatTimeAgo(fiveMinAgo, 'es');
    expect(result).toMatch(/5 minuto/);
  });

  it('handles ISO string without Z suffix (adds UTC)', () => {
    const now = new Date();
    const isoNoZ = now.toISOString().replace('Z', '');
    const result = formatTimeAgo(isoNoZ, 'es');
    expect(result).toMatch(/ahora/);
  });

  it('returns "just now" for future dates', () => {
    const future = new Date(Date.now() + 60_000);
    expect(formatTimeAgo(future, 'es')).toMatch(/ahora/);
  });
});
