import type { TranslationKeys } from '../config/lang_es';

export function formatTimeAgo(date: Date | string | null, t: TranslationKeys['timeAgo']): string {
  if (!date) return '';

  const now = new Date();
  let past: Date;

  // Parse the date string properly - handle ISO strings with or without 'Z'
  if (typeof date === 'string') {
    // If string doesn't end with Z and looks like ISO format, add Z for UTC
    if (!date.endsWith('Z') && date.includes('T')) {
      past = new Date(date + 'Z');
    } else {
      past = new Date(date);
    }
  } else {
    past = date;
  }

  // Check if date is valid
  if (isNaN(past.getTime())) {
    return '';
  }

  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  // Handle negative differences (future dates or clock skew)
  if (diffInSeconds < 0) {
    return t.justNow;
  }

  if (diffInSeconds < 5) {
    return t.justNow;
  }

  if (diffInSeconds < 60) {
    return diffInSeconds === 1
      ? t.secondsAgo.replace('{count}', '1')
      : t.secondsAgoPlural.replace('{count}', String(diffInSeconds));
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return diffInMinutes === 1
      ? t.minutesAgo.replace('{count}', '1')
      : t.minutesAgoPlural.replace('{count}', String(diffInMinutes));
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return diffInHours === 1
      ? t.hoursAgo.replace('{count}', '1')
      : t.hoursAgoPlural.replace('{count}', String(diffInHours));
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return diffInDays === 1
      ? t.daysAgo.replace('{count}', '1')
      : t.daysAgoPlural.replace('{count}', String(diffInDays));
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return diffInWeeks === 1
      ? t.weeksAgo.replace('{count}', '1')
      : t.weeksAgoPlural.replace('{count}', String(diffInWeeks));
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return diffInMonths === 1
      ? t.monthsAgo.replace('{count}', '1')
      : t.monthsAgoPlural.replace('{count}', String(diffInMonths));
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return diffInYears === 1
    ? t.yearsAgo.replace('{count}', '1')
    : t.yearsAgoPlural.replace('{count}', String(diffInYears));
}
