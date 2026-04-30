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

// ---------------------------------------------------------------------------
// Command-mic helpers (hands-free field switching)
// ---------------------------------------------------------------------------

export type CommandVocab<F extends string> = Record<F, string[]>;

export interface CommandSegment<F extends string> {
  field: F;
  value: string;
}

export interface CommandParseOptions<F extends string> {
  /**
   * Aliases that mean "advance to the next field" (e.g. "next", "siguiente").
   * Resolved against `fieldOrder` (or the order of `vocab` keys when omitted).
   */
  nextAliases?: string[];
  /** Explicit field order for resolving the `next` alias. */
  fieldOrder?: F[];
}

/**
 * Strips diacritics and lowercases. Used to make keyword matching robust to
 * accents and capitalization differences in STT output across engines.
 */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\.,;:!?¿¡]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses a free-form transcript into an ordered sequence of
 * `{ field, value }` segments by splitting on field-name keywords.
 *
 * Vocab values are alias arrays; the longer aliases are tried first so
 * "fecha de nacimiento" wins over "nacimiento". Tokens that appear before
 * the first recognized keyword are attributed to `defaultField` (if any).
 *
 * Self-switch suppression: a keyword that maps to the field already active
 * at that point is treated as part of the value instead of a focus switch.
 * This lets the user say "habitación box 3" and get "box 3" written into
 * the room field rather than "3".
 *
 * Special "next" aliases (passed via `options.nextAliases`) advance to the
 * next field in `options.fieldOrder` (or `Object.keys(vocab)`).
 */
export function parseCommandTranscript<F extends string>(
  input: string,
  vocab: CommandVocab<F>,
  defaultField: F | null = null,
  options: CommandParseOptions<F> = {},
): CommandSegment<F>[] {
  if (!input) return [];
  const text = ' ' + norm(input) + ' ';

  const NEXT_MARKER = '__next__' as const;
  type HitField = F | typeof NEXT_MARKER;

  // Build a flat list of [normalizedAlias, field], sorted by descending word
  // count so multi-word aliases match before their single-word substrings.
  const aliases: Array<{ alias: string; field: HitField; words: number }> = [];
  for (const field of Object.keys(vocab) as F[]) {
    for (const a of vocab[field]) {
      const n = norm(a);
      if (!n) continue;
      aliases.push({ alias: n, field, words: n.split(' ').length });
    }
  }
  for (const a of options.nextAliases ?? []) {
    const n = norm(a);
    if (!n) continue;
    aliases.push({ alias: n, field: NEXT_MARKER, words: n.split(' ').length });
  }
  aliases.sort((a, b) => b.words - a.words || b.alias.length - a.alias.length);

  // Find all keyword hits (non-overlapping) by scanning the text.
  type Hit = { start: number; end: number; field: HitField };
  const hits: Hit[] = [];
  for (const { alias, field } of aliases) {
    const needle = ` ${alias} `;
    let from = 0;
    while (true) {
      const idx = text.indexOf(needle, from);
      if (idx === -1) break;
      const start = idx + 1;
      const end = start + alias.length;
      const overlaps = hits.some((h) => start < h.end && end > h.start);
      if (!overlaps) hits.push({ start, end, field });
      from = end;
    }
  }
  hits.sort((a, b) => a.start - b.start);

  // Resolve `next` markers and suppress self-switches against the current
  // active field, walking left-to-right.
  const fieldOrder = options.fieldOrder ?? (Object.keys(vocab) as F[]);
  const indexOfField = (f: F | null): number =>
    f ? fieldOrder.indexOf(f) : -1;

  type ResolvedHit = { start: number; end: number; field: F };
  const accepted: ResolvedHit[] = [];
  let currentField: F | null = defaultField;
  for (const h of hits) {
    let target: F | null;
    if (h.field === NEXT_MARKER) {
      const i = indexOfField(currentField);
      if (i === -1 || fieldOrder.length === 0) continue; // no anchor → drop
      target = fieldOrder[(i + 1) % fieldOrder.length];
    } else {
      target = h.field as F;
    }
    if (target === currentField) continue; // self-switch → fold into value
    accepted.push({ start: h.start, end: h.end, field: target });
    currentField = target;
  }

  const segments: CommandSegment<F>[] = [];

  if (accepted.length === 0) {
    if (defaultField) {
      const v = text.trim();
      if (v) segments.push({ field: defaultField, value: v });
    }
    return segments;
  }

  const leading = text.slice(0, accepted[0].start).trim();
  if (leading && defaultField) {
    segments.push({ field: defaultField, value: leading });
  }

  for (let i = 0; i < accepted.length; i++) {
    const h = accepted[i];
    const next = accepted[i + 1];
    const value = text.slice(h.end, next ? next.start : text.length).trim();
    segments.push({ field: h.field, value });
  }

  return segments;
}

/**
 * Picks the best matching option for a spoken value against a list of
 * options (or an alias map of `{optionValue: aliases[]}`). Uses normalized
 * substring matching first, then a simple token-overlap score. Returns
 * `null` when nothing matches.
 *
 * Works for free-text picker values (episode type, clinical unit) and for
 * fixed-code pickers (sex M/F/O/U) when called with an alias map.
 */
export function fuzzyMatchOption(
  spoken: string,
  options: string[] | Record<string, string[]>,
): string | null {
  if (!spoken) return null;
  const target = norm(spoken);
  if (!target) return null;
  const targetTokens = target.split(' ');

  // Normalize options into [value, aliases[]] pairs.
  const entries: Array<[string, string[]]> = Array.isArray(options)
    ? options.map((o) => [o, [o]])
    : (Object.keys(options) as string[]).map((k) => [k, options[k]]);

  let best: { value: string; score: number } | null = null;
  for (const [value, aliases] of entries) {
    for (const alias of aliases) {
      const a = norm(alias);
      if (!a) continue;
      let score = 0;
      if (a === target) score = 1000;
      else if (target.includes(a) || a.includes(target)) score = 500 + Math.min(a.length, target.length);
      else {
        const aTokens = a.split(' ');
        const overlap = aTokens.filter((tk) => targetTokens.includes(tk)).length;
        if (overlap > 0) score = overlap * 10;
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { value, score };
      }
    }
  }
  return best ? best.value : null;
}
