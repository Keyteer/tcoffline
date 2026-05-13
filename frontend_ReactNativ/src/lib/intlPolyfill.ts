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
 * Intl.Locale — needed by `any-date-parser` (spoken-date parsing). Hermes
 * does not ship it, so we polyfill via @formatjs. PluralRules and
 * RelativeTimeFormat are not needed: `formatTimeAgo` uses dayjs instead.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g: any = globalThis as any;

// Some RN deep-import modules use CommonJS (`module.exports = X`) and others
// use ESM-style `export default X`. Resolve both shapes safely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pickDefault = (mod: any) => (mod && mod.default ? mod.default : mod);

// Wrap deep `react-native/Libraries/...` requires in try/catch: requiring them
// at module-eval pulls in sub-modules that themselves touch globals (Blob,
// WebSocket, etc.) and can throw on Hermes New Architecture before RN's
// InitializeCore has run. Failing silently is preferable to a hard crash —
// RN's own InitializeCore will install the real globals shortly after.
// NOTE: Metro disallows dynamic `require(id)` calls, so each require must be
// a literal string at the call site.
const safeFormData = (): unknown => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return pickDefault(require('react-native/Libraries/Network/FormData'));
  } catch {
    return undefined;
  }
};
const safeWebSocket = (): unknown => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return pickDefault(require('react-native/Libraries/WebSocket/WebSocket'));
  } catch {
    return undefined;
  }
};

// ── 1. FormData ──────────────────────────────────────────────────────────────
if (typeof g.FormData === 'undefined') {
  const FD = safeFormData();
  if (FD) g.FormData = FD;
}

// ── 1b. WebSocket ─────────────────────────────────────────────────────────────
// Same New Architecture race as FormData: expo-dev-client and some Expo modules
// access WebSocket at module-eval time before RN's JSI globals are installed.
// We try to load RN's real implementation first; if its transitive imports
// throw under Hermes New Architecture, fall back to an inert stub so bare
// `WebSocket` references resolve. RN's InitializeCore will overwrite the
// global with the real implementation shortly after.
if (typeof g.WebSocket === 'undefined') {
  const WS = safeWebSocket();
  if (WS) {
    g.WebSocket = WS;
  } else {
    class WebSocketStub {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      readyState = 3;
      url = '';
      addEventListener() {}
      removeEventListener() {}
      send() {}
      close() {}
    }
    g.WebSocket = WebSocketStub;
  }
}

// ── 1c. setImmediate / clearImmediate ─────────────────────────────────────────
// Hermes/New Architecture: timer globals may not be registered yet at
// module-eval time in release builds. Fall back to setTimeout(fn, 0).
if (typeof g.setImmediate === 'undefined') {
  g.setImmediate = (fn: (...args: unknown[]) => void, ...args: unknown[]) =>
    setTimeout(fn, 0, ...args);
  g.clearImmediate = (id: ReturnType<typeof setTimeout>) => clearTimeout(id);
}

// ── 1d. window ────────────────────────────────────────────────────────────────
// Some packages (including @react-native-community/datetimepicker) guard
// web-only code with `typeof window !== 'undefined'` at module-eval time.
// In Hermes New Architecture builds `window` is not yet aliased to `global`
// when these modules initialise, causing a hard crash.
if (typeof g.window === 'undefined') {
  g.window = g;
}

// ── 2. performance.now ───────────────────────────────────────────────────────
if (typeof g.performance === 'undefined' || typeof g.performance.now !== 'function') {
  const nativeNow: (() => number) | undefined = g.nativePerformanceNow;
  const epoch = Date.now();
  g.performance = g.performance ?? {};
  g.performance.now = nativeNow ? nativeNow.bind(g) : () => Date.now() - epoch;
}

// ── 3. Intl.Locale ───────────────────────────────────────────────────────────
// Required by `any-date-parser` (spoken-date parsing). Hermes does not ship it.
if (typeof g.Intl === 'undefined' || typeof g.Intl.Locale === 'undefined') {
  if (typeof g.Intl === 'undefined' || typeof g.Intl.getCanonicalLocales === 'undefined') {
    require('@formatjs/intl-getcanonicallocales/polyfill');
  }
  require('@formatjs/intl-locale/polyfill');
}
