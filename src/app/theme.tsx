import * as stylex from '@stylexjs/stylex';
import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { prefs } from '../lib/events';
import { darkTheme, lightTheme } from '../styles/themes.stylex';

export type ThemePref = 'system' | 'light' | 'dark';
const ThemeContext = createContext<{ pref: ThemePref; resolved: 'light' | 'dark'; setPref: (p: ThemePref) => void }>({
  pref: 'system',
  resolved: 'light',
  setPref: () => undefined,
});

function useSystemDark() {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return dark;
}
export const useThemePref = () => useContext(ThemeContext);

/** The theme the host (claude.ai sets data-theme on <html>) asked for, if any. */
function useHostTheme(): 'light' | 'dark' | null {
  const read = (): 'light' | 'dark' | null => {
    const t = document.documentElement.getAttribute('data-theme');
    return t === 'light' || t === 'dark' ? t : null;
  };
  const [host, setHost] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setHost(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return host;
}

/** Applies the forced theme on <body> so portals (dialogs, menus, toasts) get it too. */
export function ThemedApp({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => prefs.get<ThemePref>('theme', 'system'));
  const host = useHostTheme();
  const systemDark = useSystemDark();
  const setPref = (p: ThemePref) => {
    setPrefState(p);
    prefs.set('theme', p);
  };
  const effective = pref !== 'system' ? pref : host;
  useLayoutEffect(() => {
    if (effective) document.documentElement.setAttribute('data-wf-theme', effective);
    else document.documentElement.removeAttribute('data-wf-theme');
  }, [effective]);
  useLayoutEffect(() => {
    const theme = effective === 'dark' ? darkTheme : effective === 'light' ? lightTheme : null;
    if (!theme) return;
    const classes = (stylex.props(theme).className ?? '').split(' ').filter(Boolean);
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, [effective]);
  const resolved = effective ?? (systemDark ? 'dark' : 'light');
  return <ThemeContext.Provider value={{ pref, resolved, setPref }}>{children}</ThemeContext.Provider>;
}

