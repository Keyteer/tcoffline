/**
 * Polyfills for Intl APIs not shipped by Hermes (Android).
 *
 * `any-date-parser` (used for spoken-date parsing) requires `Intl.Locale`,
 * which Hermes does not include by default. We install a minimal polyfill
 * if it's missing. Imports are inlined inside the guard so bundlers don't
 * pull the polyfill on platforms that don't need it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g: any = globalThis as any;

if (typeof g.Intl === 'undefined' || typeof g.Intl.Locale === 'undefined') {
  // getCanonicalLocales is a prerequisite for Intl.Locale.
  if (typeof g.Intl === 'undefined' || typeof g.Intl.getCanonicalLocales === 'undefined') {
    require('@formatjs/intl-getcanonicallocales/polyfill');
  }
  require('@formatjs/intl-locale/polyfill');
}
