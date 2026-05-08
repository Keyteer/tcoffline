/**
 * Polyfills loaded before any app module.
 *
 * 1. FormData — in the New Architecture (newArchEnabled=true) Hermes starts
 *    executing the JS bundle before RN's core polyfills finish registering
 *    globals. Any library that touches `FormData` at module-level crashes
 *    with "Property 'FormData' doesn't exist" in release builds.
 *
 * 2. performance.now — same bootstrap race. React 19's scheduler and other
 *    libraries call `performance.now()` at module-eval time; if RN's
 *    setUpPerformance.js hasn't run yet the app crashes with "Cannot read
 *    property 'now' of undefined". Still reproducible on RN 0.83 / SDK 55.
 *
 * 3. Intl.Locale — Hermes does not ship `Intl.Locale`. `any-date-parser`
 *    (spoken-date parsing) requires it, so we polyfill via @formatjs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g: any = globalThis as any;

// ── 1. FormData ──────────────────────────────────────────────────────────────
if (typeof g.FormData === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  g.FormData = require('react-native/Libraries/Network/FormData').default;
}

// ── 2. performance.now ───────────────────────────────────────────────────────
if (typeof g.performance === 'undefined' || typeof g.performance.now !== 'function') {
  const nativeNow: (() => number) | undefined = g.nativePerformanceNow;
  const epoch = Date.now();
  g.performance = g.performance ?? {};
  g.performance.now = nativeNow ? nativeNow.bind(g) : () => Date.now() - epoch;
}

// ── 3. Intl.Locale ───────────────────────────────────────────────────────────
if (typeof g.Intl === 'undefined' || typeof g.Intl.Locale === 'undefined') {
  if (typeof g.Intl === 'undefined' || typeof g.Intl.getCanonicalLocales === 'undefined') {
    require('@formatjs/intl-getcanonicallocales/polyfill');
  }
  require('@formatjs/intl-locale/polyfill');
}
