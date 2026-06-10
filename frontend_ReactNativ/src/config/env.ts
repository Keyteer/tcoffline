/**
 * Centralized app configuration from environment variables.
 * All EXPO_PUBLIC_* vars are embedded at build time by Expo.
 * Change values in .env (development) or set them in EAS build secrets (production).
 */

/** Default backend URL. Set EXPO_PUBLIC_SERVER_URL in .env before building. */
export const DEFAULT_SERVER_URL =
  process.env.EXPO_PUBLIC_SERVER_URL ?? '';

/** How often (ms) the connectivity check polls the backend. */
export const CONNECTIVITY_POLL_INTERVAL =
  Number(process.env.EXPO_PUBLIC_CONNECTIVITY_POLL_INTERVAL) || 10_000;

/** How often (ms) the episodes list auto-refreshes. */
export const EPISODES_REFRESH_INTERVAL =
  Number(process.env.EXPO_PUBLIC_EPISODES_REFRESH_INTERVAL) || 15_000;

/** How often (ms) the read-only mode flag is re-checked. */
export const READ_ONLY_CHECK_INTERVAL =
  Number(process.env.EXPO_PUBLIC_READ_ONLY_CHECK_INTERVAL) || 8_000;

/** Timeout (ms) for backend connection test requests. */
export const CONNECTION_TEST_TIMEOUT =
  Number(process.env.EXPO_PUBLIC_CONNECTION_TEST_TIMEOUT) || 5_000;

/** Default timeout (ms) for authenticated API requests. */
export const API_REQUEST_TIMEOUT =
  Number(process.env.EXPO_PUBLIC_API_REQUEST_TIMEOUT) || 20_000;

/** Timeout (ms) for lightweight health checks (used for connectivity polling). */
export const HEALTH_CHECK_TIMEOUT =
  Number(process.env.EXPO_PUBLIC_HEALTH_CHECK_TIMEOUT) || 8_000;

/** Number of items loaded per page in scrollable lists (episodes, users). */
export const PAGE_SIZE =
  Number(process.env.EXPO_PUBLIC_PAGE_SIZE) || 20;
