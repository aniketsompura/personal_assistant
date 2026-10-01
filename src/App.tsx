import * as stylex from '@stylexjs/stylex';
import { AnimatePresence, MotionConfig, motion as m } from 'motion/react';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { StoreProvider, useStore } from './data/store';
import { RouterProvider, routeKey, useRouter } from './app/router';
import { DialogProvider, useDialogs } from './app/dialogs';
import { Sidebar } from './app/Sidebar';
import { CommandPalette } from './app/CommandPalette';
import { ToastProvider } from './components/Toast';
import { Confetti } from './components/Confetti';
import { Icon } from './components/Icon';
import { Button, IconButton } from './components/ui';
import { color, font, space, text } from './styles/tokens.stylex';
import { ThemedApp, useThemePref } from './app/theme';
import { TodayView } from './views/Today';
import { GoalsView } from './views/Goals';
import { GoalDetailView } from './views/GoalDetail';
import { ProjectsView } from './views/Projects';
import { ProjectDetailView } from './views/ProjectDetail';
import { JournalView } from './views/Journal';
import { SettingsView } from './views/Settings';

/* ------------------------------------------------------------------------ */
/* Theme                                                                     */
/* ------------------------------------------------------------------------ */

/* ------------------------------------------------------------------------ */
/* Shell                                                                     */
/* ------------------------------------------------------------------------ */

const s = stylex.create({
  root: {
    display: 'grid',
    gridTemplateColumns: { default: '264px minmax(0, 1fr)', '@media (max-width: 900px)': 'minmax(0, 1fr)' },
    height: '100%',
    minHeight: 0,
    backgroundColor: color.canvas,
    color: color.ink,
    fontFamily: font.body,
  },
  sideDesktop: { minHeight: 0, display: { default: 'block', '@media (max-width: 900px)': 'none' } },
  drawerScrim: { position: 'fixed', inset: 0, zIndex: 40, backgroundColor: color.scrim },
  drawer: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 41,
    width: 'min(300px, 86vw)',
    paddingTop: 'env(safe-area-inset-top, 0px)',
    backgroundColor: color.panel,
    boxShadow: `12px 0 40px -12px ${color.shadow}`,
  },
  column: { display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 },
  topbar: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    gap: space.sm,
    height: 52,
    paddingInline: { default: space.xl, '@media (max-width: 640px)': space.lg },
    backgroundColor: color.panel,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: color.line,
  },
  menuBtn: { display: { default: 'none', '@media (max-width: 900px)': 'inline-flex' } },
  crumbs: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    flex: 1,
    fontFamily: font.mono,
    fontSize: text.small,
    color: color.inkFaint,
  },
  crumb: {
    borderWidth: 0,
    padding: 0,
    backgroundColor: 'transparent',
    color: { default: color.inkFaint, ':hover': color.ink },
    font: 'inherit',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  crumbCurrent: {
    color: color.ink,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
  save: {
    display: { default: 'inline-flex', '@media (max-width: 640px)': 'none' },
    alignItems: 'center',
    gap: 6,
    fontSize: text.small,
    color: color.inkFaint,
    whiteSpace: 'nowrap',
  },
  saveDot: { width: 7, height: 7, borderRadius: '50%', backgroundColor: color.good },
  saveDotBusy: { backgroundColor: color.accent },
  saveDotWarn: { backgroundColor: color.warn },
  themeBtn: {
    display: 'grid',
    placeItems: 'center',
    width: 32,
    height: 32,
    flexShrink: 0,
    borderWidth: 0,
    borderRadius: 5,
    backgroundColor: { default: 'transparent', ':hover': color.hover },
    color: { default: color.inkMuted, ':hover': color.ink },
    cursor: 'pointer',
    overflow: 'hidden',
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
  },
  logLabel: { display: { default: 'inline', '@media (max-width: 520px)': 'none' } },
  main: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    backgroundImage: `radial-gradient(${color.canvasDot} 1px, transparent 1.2px)`,
    backgroundSize: '22px 22px',
    backgroundPosition: '11px 11px',
    scrollbarGutter: 'stable',
  },
  page: {
    width: '100%',
    maxWidth: 1180,
    marginInline: 'auto',
    paddingInline: { default: space.xxl, '@media (max-width: 900px)': space.xl, '@media (max-width: 640px)': space.lg },
    paddingBlock: { default: space.xxl, '@media (max-width: 640px)': space.xl },
    paddingBottom: 96,
  },
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: space.sm,
    paddingInline: space.xl,
    paddingBlock: space.sm,
    backgroundColor: color.warnSoft,
    color: color.warn,
    fontSize: text.small,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: color.line,
  },
  loading: { display: 'flex', flexDirection: 'column', gap: space.lg },
  shimmer: {
    height: 120,
    borderRadius: 8,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
  },
  loadingTitle: { fontFamily: font.mono, fontSize: text.small, color: color.inkFaint },
});

function SaveIndicator() {
  const { meta } = useStore();
  if (meta.backend === 'pending') return null;
  const warn = meta.backend === 'browser' && (meta.fallback || !meta.persistent);
  const label = meta.readOnly
    ? 'View only'
    : meta.saving
      ? 'Saving…'
      : meta.error
        ? 'Not saved'
        : meta.backend === 'claude'
          ? 'All changes saved'
          : warn
            ? 'Saved in this browser only'
            : 'Saved locally';
  return (
    <span {...stylex.props(s.save)} aria-live="polite">
      <m.span
        animate={meta.saving ? { scale: [1, 1.5, 1], opacity: [1, 0.6, 1] } : { scale: 1, opacity: 1 }}
        transition={meta.saving ? { repeat: Infinity, duration: 0.9 } : { duration: 0.2 }}
        {...stylex.props(s.saveDot, meta.saving && s.saveDotBusy, (warn || !!meta.error) && s.saveDotWarn)}
      />
      {label}
    </span>
  );
}

/** Flips between light and dark. "Match system" lives in Settings. */
function ThemeToggle() {
  const { resolved, setPref } = useThemePref();
  const next = resolved === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={(e) => {
        const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (!doc.startViewTransition || reduce) {
          setPref(next);
          return;
        }
        // Reveal the new theme in a circle growing from the button.
        const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
        const x = left + width / 2;
        const y = top + height / 2;
        const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        const vt = doc.startViewTransition(() => flushSync(() => setPref(next)));
        vt.ready
          .then(() =>
            document.documentElement.animate(
              { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
              { duration: 480, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
            ),
          )
          .catch(() => undefined);
      }}
      {...stylex.props(s.themeBtn)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={resolved}
          initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          style={{ display: 'grid' }}
        >
          <Icon name={resolved === 'dark' ? 'moon' : 'sun'} />
        </m.span>
      </AnimatePresence>
    </button>
  );
}

function Breadcrumbs() {
  const { route, navigate } = useRouter();
  const { data } = useStore();
  const parts: { label: string; go?: () => void }[] = [];
  switch (route.name) {
    case 'today':
      parts.push({ label: 'Today' });
      break;
    case 'goals':
      parts.push({ label: 'Goals' });
      break;
    case 'goal':
      parts.push({ label: 'Goals', go: () => navigate({ name: 'goals' }) }, { label: data.goals[route.id]?.title ?? 'Goal' });
      break;
    case 'projects':
      parts.push({ label: 'Projects' });
      break;
    case 'project':
      parts.push(
        { label: 'Projects', go: () => navigate({ name: 'projects' }) },
        { label: data.projects[route.id]?.title ?? 'Project' },
      );
      break;
    case 'journal':
      parts.push({ label: 'Journal' });
      break;
    case 'settings':
      parts.push({ label: 'Settings & data' });
      break;
  }
  return (
    <div {...stylex.props(s.crumbs)} aria-label="Breadcrumb">
      <span aria-hidden="true">/</span>
      {parts.map((p, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 && <span aria-hidden="true">/</span>}
          {p.go ? (
            <button type="button" onClick={p.go} {...stylex.props(s.crumb)}>
              {p.label}
            </button>
          ) : (
            <span aria-current="page" {...stylex.props(s.crumbCurrent)}>
              {p.label}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function CurrentView() {
  const { route } = useRouter();
  switch (route.name) {
    case 'today':
      return <TodayView />;
    case 'goals':
      return <GoalsView />;
    case 'goal':
      return <GoalDetailView id={route.id} />;
    case 'projects':
      return <ProjectsView />;
    case 'project':
      return <ProjectDetailView id={route.id} tab={route.tab} noteId={route.noteId} />;
    case 'journal':
      return <JournalView />;
    case 'settings':
      return <SettingsView />;
  }
}

function Loading() {
  return (
    <div {...stylex.props(s.loading)} aria-busy="true">
      <span {...stylex.props(s.loadingTitle)}>Opening your Workfile…</span>
      {[0, 1, 2].map((i) => (
        <m.div
          key={i}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.15 }}
          {...stylex.props(s.shimmer)}
        />
      ))}
    </div>
  );
}

function Shell() {
  const { ready, meta } = useStore();
  const { route } = useRouter();
  const dialogs = useDialogs();
  const [palette, setPalette] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      } else if (!typing && e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => setDrawer(false), [route]);

  const projectId = route.name === 'project' ? route.id : undefined;

  return (
    <div {...stylex.props(s.root)}>
      <aside {...stylex.props(s.sideDesktop)}>
        <Sidebar onOpenPalette={() => setPalette(true)} />
      </aside>

      <AnimatePresence>
        {drawer && (
          <>
            <m.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
              {...stylex.props(s.drawerScrim)}
            />
            <m.aside
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 40 }}
              {...stylex.props(s.drawer)}
            >
              <Sidebar onNavigate={() => setDrawer(false)} onOpenPalette={() => { setDrawer(false); setPalette(true); }} />
            </m.aside>
          </>
        )}
      </AnimatePresence>

      <div {...stylex.props(s.column)}>
        <header {...stylex.props(s.topbar)}>
          <IconButton icon="menu" label="Open navigation" xstyle={s.menuBtn} onClick={() => setDrawer(true)} />
          <Breadcrumbs />
          <SaveIndicator />
          <ThemeToggle />
          <IconButton icon="search" label="Search (⌘K)" onClick={() => setPalette(true)} />
          <Button
            variant="primary"
            icon="plus"
            disabled={!ready || meta.readOnly}
            onClick={() => dialogs({ kind: 'update', projectId })}
          >
            <span {...stylex.props(s.logLabel)}>Log update</span>
          </Button>
        </header>
        {meta.fallback && (
          <div {...stylex.props(s.banner)} role="status">
            <Icon name="alert" size={14} />
            Claude storage isn't available in this view, so changes are saved in this browser only. Export from Settings to keep a copy.
          </div>
        )}
        {meta.error && (
          <div {...stylex.props(s.banner)} role="alert">
            <Icon name="alert" size={14} />
            {meta.error}
          </div>
        )}
        <main id="main-scroll" {...stylex.props(s.main)}>
          <div {...stylex.props(s.page)}>
            {!ready ? (
              <Loading />
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <m.div
                  key={routeKey(route)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
                  transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                >
                  <CurrentView />
                </m.div>
              </AnimatePresence>
            )}
          </div>
        </main>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <Confetti />
    </div>
  );
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ThemedApp>
        <ToastProvider>
          <StoreProvider>
            <RouterProvider>
              <DialogProvider>
                <Shell />
              </DialogProvider>
            </RouterProvider>
          </StoreProvider>
        </ToastProvider>
      </ThemedApp>
    </MotionConfig>
  );
}

