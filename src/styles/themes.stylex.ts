import * as stylex from '@stylexjs/stylex';
import { color } from './tokens.stylex';

// Forced themes, applied on the app root when the viewer (claude.ai sets
// data-theme on <html>) or the in-app setting picks light or dark explicitly.

export const lightTheme = stylex.createTheme(color, {
  canvas: '#ECEEF2',
  canvasDot: 'rgba(28, 34, 52, 0.13)',
  panel: '#F8F9FB',
  surface: '#FFFFFF',
  sunken: '#F3F4F7',
  hover: 'rgba(28, 34, 52, 0.05)',
  ink: '#14161B',
  inkMuted: '#565C6B',
  inkFaint: '#878D9C',
  line: '#DEE1E7',
  lineStrong: '#C6CBD4',
  accent: '#2E5BFF',
  accentHover: '#1F48E6',
  accentInk: '#FFFFFF',
  accentSoft: 'rgba(46, 91, 255, 0.10)',
  redline: '#E5484D',
  redlineSoft: 'rgba(229, 72, 77, 0.10)',
  good: '#178A57',
  goodSoft: 'rgba(23, 138, 87, 0.10)',
  warn: '#B86E00',
  warnSoft: 'rgba(184, 110, 0, 0.10)',
  shadow: 'rgba(20, 24, 40, 0.08)',
  scrim: 'rgba(15, 18, 28, 0.32)',
});

export const darkTheme = stylex.createTheme(color, {
  canvas: '#0F1013',
  canvasDot: 'rgba(220, 226, 255, 0.075)',
  panel: '#131418',
  surface: '#181A1F',
  sunken: '#1E2026',
  hover: 'rgba(220, 226, 255, 0.06)',
  ink: '#ECEEF3',
  inkMuted: '#A3A9B7',
  inkFaint: '#6F7584',
  line: '#262930',
  lineStrong: '#363A44',
  accent: '#6F8DFF',
  accentHover: '#8AA2FF',
  accentInk: '#0B0D14',
  accentSoft: 'rgba(111, 141, 255, 0.16)',
  redline: '#FF6B70',
  redlineSoft: 'rgba(255, 107, 112, 0.14)',
  good: '#40CF8C',
  goodSoft: 'rgba(64, 207, 140, 0.14)',
  warn: '#F2B24B',
  warnSoft: 'rgba(242, 178, 75, 0.14)',
  shadow: 'rgba(0, 0, 0, 0.45)',
  scrim: 'rgba(0, 0, 0, 0.55)',
});
