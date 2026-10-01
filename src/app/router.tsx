import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { prefs } from '../lib/events';

/*
 * In-memory routing. The Artifact frame only passes plain #anchors through, so
 * routes live in React state (with a back stack) instead of the URL. The last
 * place you were is remembered per browser.
 */

export type ProjectTab = 'overview' | 'updates' | 'requirements' | 'notes' | 'links';

export type Route =
  | { name: 'today' }
  | { name: 'goals' }
  | { name: 'goal'; id: string }
  | { name: 'projects' }
  | { name: 'project'; id: string; tab?: ProjectTab; noteId?: string }
  | { name: 'journal' }
  | { name: 'settings' };

export const routeKey = (r: Route) => ('id' in r ? `${r.name}:${r.id}` : r.name);

interface RouterValue {
  route: Route;
  navigate: (r: Route) => void;
  back: () => void;
  canGoBack: boolean;
}

const RouterContext = createContext<RouterValue | null>(null);

function initialRoute(): Route {
  const hash = typeof location !== 'undefined' ? location.hash.replace('#', '') : '';
  if (['today', 'goals', 'projects', 'journal', 'settings'].includes(hash)) return { name: hash } as Route;
  const saved = prefs.get<Route | null>('route', null);
  return saved && typeof saved === 'object' && 'name' in saved ? saved : { name: 'today' };
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>(() => [initialRoute()]);
  const route = stack[stack.length - 1];

  const navigate = useCallback((r: Route) => {
    setStack((s) => {
      const cur = s[s.length - 1];
      if (routeKey(cur) === routeKey(r) && JSON.stringify(cur) === JSON.stringify(r)) return s;
      // Same page with a different tab replaces, so Back leaves the page.
      const next = routeKey(cur) === routeKey(r) ? [...s.slice(0, -1), r] : [...s.slice(-30), r];
      prefs.set('route', r);
      return next;
    });
    document.getElementById('main-scroll')?.scrollTo({ top: 0 });
  }, []);

  const back = useCallback(() => {
    setStack((s) => {
      const next = s.length > 1 ? s.slice(0, -1) : [{ name: 'today' } as Route];
      prefs.set('route', next[next.length - 1]);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ route, navigate, back, canGoBack: stack.length > 1 }), [route, navigate, back, stack.length]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const v = useContext(RouterContext);
  if (!v) throw new Error('useRouter must be used inside <RouterProvider>');
  return v;
}
