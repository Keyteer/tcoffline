import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
import 'dayjs/locale/en';

dayjs.extend(relativeTime);

export function formatTimeAgo(date: Date | string | null, locale: string): string {
  if (!date) return '';

  let past: Date;
  if (typeof date === 'string') {
    past = new Date((!date.endsWith('Z') && date.includes('T')) ? date + 'Z' : date);
  } else {
    past = date;
  }

  if (isNaN(past.getTime())) return '';

  // Future dates or very recent (<5s) — show a static "now" string.
  // dayjs fromNow() would say "in a few seconds" for future dates, which
  // is confusing for server timestamps that are slightly ahead of device time.
  const diffInSeconds = Math.floor((Date.now() - past.getTime()) / 1000);
  if (diffInSeconds < 5) {
    return locale.startsWith('es') ? 'ahora' : 'just now';
  }

  return dayjs(past).locale(locale).fromNow();
}
