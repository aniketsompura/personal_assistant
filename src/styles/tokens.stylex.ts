import * as stylex from '@stylexjs/stylex';

/*
 * Workfile design tokens.
 * Layout concept: your work year laid out like a design file. A layers panel
 * on the left, a dotted canvas in the middle, an inspector on the right.
 *
 * Light values are the defaults. Dark values apply through the OS preference,
 * and `darkTheme` / `lightTheme` (themes.stylex.ts) force either one when the
 * viewer or the app picks a theme explicitly.
 */

const DARK = '@media (prefers-color-scheme: dark)';

export const color = stylex.defineVars({
  canvas: { default: '#ECEEF2', [DARK]: '#0F1013' },
  canvasDot: { default: 'rgba(28, 34, 52, 0.13)', [DARK]: 'rgba(220, 226, 255, 0.075)' },
  panel: { default: '#F8F9FB', [DARK]: '#131418' },
  surface: { default: '#FFFFFF', [DARK]: '#181A1F' },
  sunken: { default: '#F3F4F7', [DARK]: '#1E2026' },
  hover: { default: 'rgba(28, 34, 52, 0.05)', [DARK]: 'rgba(220, 226, 255, 0.06)' },
  ink: { default: '#14161B', [DARK]: '#ECEEF3' },
  inkMuted: { default: '#565C6B', [DARK]: '#A3A9B7' },
  inkFaint: { default: '#878D9C', [DARK]: '#6F7584' },
  line: { default: '#DEE1E7', [DARK]: '#262930' },
  lineStrong: { default: '#C6CBD4', [DARK]: '#363A44' },
  // Selection blue: focus, active layer, primary actions.
  accent: { default: '#2E5BFF', [DARK]: '#6F8DFF' },
  accentHover: { default: '#1F48E6', [DARK]: '#8AA2FF' },
  accentInk: { default: '#FFFFFF', [DARK]: '#0B0D14' },
  accentSoft: { default: 'rgba(46, 91, 255, 0.10)', [DARK]: 'rgba(111, 141, 255, 0.16)' },
  // Redline: spec annotations, pace markers, things that need attention.
  redline: { default: '#E5484D', [DARK]: '#FF6B70' },
  redlineSoft: { default: 'rgba(229, 72, 77, 0.10)', [DARK]: 'rgba(255, 107, 112, 0.14)' },
  good: { default: '#178A57', [DARK]: '#40CF8C' },
  goodSoft: { default: 'rgba(23, 138, 87, 0.10)', [DARK]: 'rgba(64, 207, 140, 0.14)' },
  warn: { default: '#B86E00', [DARK]: '#F2B24B' },
  warnSoft: { default: 'rgba(184, 110, 0, 0.10)', [DARK]: 'rgba(242, 178, 75, 0.14)' },
  shadow: { default: 'rgba(20, 24, 40, 0.08)', [DARK]: 'rgba(0, 0, 0, 0.45)' },
  scrim: { default: 'rgba(15, 18, 28, 0.32)', [DARK]: 'rgba(0, 0, 0, 0.55)' },
});

export const font = stylex.defineVars({
  display: '"Bricolage Grotesque", "Instrument Sans", ui-sans-serif, system-ui, sans-serif',
  body: '"Instrument Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
});

// Type scale (px): 11 label · 12 small · 13 ui · 14 body · 16 lead · 20 h3 · 28 h2 · 40 h1
export const text = stylex.defineVars({
  label: '11px',
  small: '12px',
  ui: '13px',
  body: '14px',
  lead: '16px',
  h3: '20px',
  h2: '28px',
  h1: 'clamp(30px, 4.2vw, 42px)',
});

export const space = stylex.defineVars({
  xxs: '2px',
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
  xxxl: '48px',
});

export const radius = stylex.defineVars({
  xs: '3px',
  sm: '5px',
  md: '7px',
  lg: '10px',
  pill: '999px',
});

export const motion = stylex.defineVars({
  fast: '120ms',
  base: '200ms',
  slow: '360ms',
  ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
});
