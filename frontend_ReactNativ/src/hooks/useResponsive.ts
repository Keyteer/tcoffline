import { useWindowDimensions } from 'react-native';

// Centralised responsive helper for phone / tablet / desktop layouts.
// Breakpoints are width-based (in dp) and roughly aligned with common device
// classes:
//   < 600   → phone (portrait phones)
//   600-899 → tablet portrait / large phone landscape
//   900-1199→ tablet landscape / small desktop / web small window
//   >= 1200 → desktop / web large
//
// Components should prefer reading from this hook rather than calling
// useWindowDimensions directly, so the breakpoints stay consistent across the
// app and can be tuned in one place.
export type FormFactor = 'phone' | 'tabletPortrait' | 'tabletLandscape' | 'desktop';

export type ResponsiveInfo = {
  width: number;
  height: number;
  isPortrait: boolean;
  isLandscape: boolean;
  formFactor: FormFactor;
  isPhone: boolean;
  isTablet: boolean;          // any tablet (portrait or landscape)
  isWide: boolean;            // tabletLandscape or desktop
  /** Suggested column count for grid/list layouts. */
  columns: 1 | 2 | 3;
};

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();
  const isPortrait = height >= width;

  let formFactor: FormFactor;
  if (width < 600) formFactor = 'phone';
  else if (width < 900) formFactor = 'tabletPortrait';
  else if (width < 1200) formFactor = 'tabletLandscape';
  else formFactor = 'desktop';

  const isPhone = formFactor === 'phone';
  const isTablet = formFactor === 'tabletPortrait' || formFactor === 'tabletLandscape';
  const isWide = formFactor === 'tabletLandscape' || formFactor === 'desktop';

  let columns: 1 | 2 | 3 = 1;
  if (formFactor === 'desktop') columns = 3;
  else if (isWide || formFactor === 'tabletPortrait') columns = 2;

  return {
    width,
    height,
    isPortrait,
    isLandscape: !isPortrait,
    formFactor,
    isPhone,
    isTablet,
    isWide,
    columns,
  };
}

// Shared content-width caps. Keep these conservative so text-heavy screens
// remain readable on very wide windows (web / desktop).
export const LAYOUT_MAX = {
  /** Main list / dashboard content (Episodes list, etc.). */
  content: 1200,
  /** Form-heavy screens (NewEpisode, ClinicalNote). */
  form: 900,
  /** Narrow auth / discovery cards. */
  auth: 460,
  /** SyncPipeline diagram — keep narrow so the chain stays legible. */
  pipeline: 640,
} as const;
