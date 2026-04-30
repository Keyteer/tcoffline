/**
 * Helpers to normalize free-form spoken input into structured field values.
 * Used by MicButton consumers to clean up STT transcripts before saving.
 *
 * Natural-language date parsing is delegated to `any-date-parser`. That lib
 * relies on `Intl.Locale`, which Hermes does not ship by default; the
 * polyfill is installed in `src/lib/intlPolyfill.ts` (loaded from `index.ts`).
 */

import parser from 'any-date-parser';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Numeric fast path for `dd/mm/yyyy`, `dd-mm-yyyy`, `dd.mm.yyyy` (with 2- or
 * 4-digit year). We do this before delegating to `any-date-parser` because we
 * always want day-first interpretation regardless of locale, and we want to
 * accept 2-digit years (the library treats those as invalid).
 */
function parseNumeric(raw: string): string | null {
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const m = parseInt(iso[2], 10);
    const d = parseInt(iso[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${iso[1]}-${pad2(m)}-${pad2(d)}`;
    }
  }
  const numeric = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (numeric) {
    const d = parseInt(numeric[1], 10);
    const m = parseInt(numeric[2], 10);
    let y = parseInt(numeric[3], 10);
    if (y < 100) y += y < 30 ? 2000 : 1900;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${pad2(m)}-${pad2(d)}`;
    }
  }
  return null;
}

/**
 * Try to parse a spoken date into ISO `YYYY-MM-DD`. Uses `any-date-parser`
 * for natural-language formats in Spanish and English (e.g.
 * "12 de marzo de 1980", "march 12 1980"). Returns the original trimmed
 * string when the format is not recognized so the caller can keep the raw
 * transcript and let normal validation surface the error.
 */
export function parseSpokenDate(input: string): string {
  if (!input) return input;
  const trimmed = input.trim();
  const lowered = trimmed.toLowerCase();

  const numeric = parseNumeric(lowered);
  if (numeric) return numeric;

  // `any-date-parser` accepts "del" only partially in es; strip filler words
  // that are common in dictation but not in its grammar.
  const cleaned = lowered
    .replace(/\s+/g, ' ')
    .trim();

  for (const candidate of [trimmed, cleaned]) {
    for (const locale of ['es', 'en']) {
      try {
        const d = parser.fromString(candidate, locale);
        // `MaybeValidDate` exposes `.invalid` (string | null). Treat it as
        // valid only when invalid is null/undefined AND the timestamp is real.
        if (d && (d as { invalid?: unknown }).invalid == null && !isNaN(d.getTime())) {
          return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
        }
      } catch {
        // try next locale / candidate
      }
    }
  }

  return trimmed;
}

/**
 * Cleans a spoken RUT transcript so it can be fed into `formatRUT`.
 * Replaces the spoken word "guion"/"guión"/"dash"/"hyphen" with `-`,
 * removes spaces and dots, and uppercases the verifier.
 */
export function cleanSpokenRut(input: string): string {
  if (!input) return input;
  return input
    .toLowerCase()
    .replace(/\b(gui[oó]n|dash|hyphen|menos)\b/g, '-')
    .replace(/[.\s]/g, '')
    .replace(/k$/i, 'K')
    .toUpperCase();
}

/**
 * Formats a spoken name or lastname string to capitalize each word
 */
export function parseSpokenName(input: string): string {
    if (!input) return input;
    return input
        .toLowerCase()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}