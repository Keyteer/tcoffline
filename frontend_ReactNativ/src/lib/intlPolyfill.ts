/**
 * Polyfills loaded before any app module.
 *
 * 1. FormData — in the New Architecture (newArchEnabled=true) Hermes starts
 *    executing the JS bundle before RN's core polyfills finish registering
 *    globals. Any library that touches `FormData` at module-level crashes with
 *    "Property 'FormData' doesn't exist". We install it manually if missing.
 *
 * 2. Intl.Locale — Hermes on Android omits this. `any-date-parser` (spoken-
 *    date parsing) requires it, so we polyfill via @formatjs when absent.
 *
 * 3. performance.now — same race as FormData. React 19's scheduler and other
 *    libraries call `performance.now()` at module-eval time; if RN's
 *    setUpPerformance.js hasn't run yet, `global.performance` is undefined and
 *    the app crashes with "Cannot read property 'now' of undefined" right
 *    after AppRegistry runs "main" (Hermes release builds only).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g: any = globalThis as any;

// ── 1. FormData ──────────────────────────────────────────────────────────────
if (typeof g.FormData === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  g.FormData = require('react-native/Libraries/Network/FormData').default;
}

// ── 1b. performance.now ──────────────────────────────────────────────────────
if (typeof g.performance === 'undefined' || typeof g.performance.now !== 'function') {
  const nativeNow: (() => number) | undefined = g.nativePerformanceNow;
  const epoch = Date.now();
  g.performance = g.performance ?? {};
  g.performance.now = nativeNow ? nativeNow.bind(g) : () => Date.now() - epoch;
}

// ── 2. Intl.Locale ───────────────────────────────────────────────────────────
if (typeof g.Intl === 'undefined' || typeof g.Intl.Locale === 'undefined') {
  // getCanonicalLocales is a prerequisite for Intl.Locale.
  if (typeof g.Intl === 'undefined' || typeof g.Intl.getCanonicalLocales === 'undefined') {
    require('@formatjs/intl-getcanonicallocales/polyfill');
  }
  require('@formatjs/intl-locale/polyfill');
}
