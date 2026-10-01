import * as stylex from '@stylexjs/stylex';
import { AnimatePresence, motion as m } from 'motion/react';
import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import type { Project } from '../data/types';
import { GOAL_HEX, STATUS_META } from '../lib/meta';
import { cycleInfo, goalProgress, projectsForGoal } from '../lib/insights';
import { prefs } from '../lib/events';
import { color, font, motion, radius, space, text } from '../styles/tokens.stylex';
import { Icon, type IconName } from '../components/Icon';
import { IconButton, Kbd, Swatch } from '../components/ui';
import { ProgressRing } from '../components/Progress';
import { useRouter, type Route } from './router';
import { useDialogs } from './dialogs';

const s = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    backgroundColor: color.panel,
    borderInlineEndWidth: 1,
    borderInlineEndStyle: 'solid',
    borderInlineEndColor: color.line,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    paddingInline: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  mark: {
    position: 'relative',
    display: 'grid',
    placeItems: 'center',
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: color.ink,
    color: color.canvas,
    flexShrink: 0,
  },
  brandText: { display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.15 },
  brandName: { fontFamily: font.display, fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' },
  brandCycle: { fontFamily: font.mono, fontSize: 10, color: color.inkFaint, letterSpacing: '0.03em' },
  search: {
    display: 'flex',
    alignItems: 'center',
    gap: space.sm,
    marginInline: space.md,
    marginBottom: space.sm,
    height: 32,
    paddingInline: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: { default: color.line, ':hover': color.lineStrong },
    backgroundColor: color.surface,
    color: color.inkFaint,
    fontSize: text.ui,
    cursor: 'pointer',
    textAlign: 'start',
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
    transitionProperty: 'border-color',
    transitionDuration: motion.fast,
  },
  searchText: { flex: 1 },
  scroll: { flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: space.md },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingInlineStart: space.lg,
    paddingInlineEnd: space.sm,
    paddingTop: space.md,
    paddingBottom: 4,
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: color.inkFaint,
  },
  nav: { display: 'flex', flexDirection: 'column', gap: 1, paddingInline: space.sm },
  navItem: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    height: 32,
    paddingInline: 10,
    borderWidth: 0,
    borderRadius: radius.sm,
    backgroundColor: { default: 'transparent', ':hover': color.hover },
    color: { default: color.inkMuted, ':hover': color.ink },
    fontSize: text.ui,
    fontWeight: 550,
    textAlign: 'start',
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
    outlineOffset: -2,
  },
  navActive: { color: color.ink },
  navPill: {
    position: 'absolute',
    inset: 0,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    boxShadow: `0 1px 2px ${color.shadow}, 0 0 0 1px ${color.line}`,
  },
  navInner: { position: 'relative', display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  navCount: { marginInlineStart: 'auto', fontFamily: font.mono, fontSize: 10, color: color.inkFaint },
  navBadge: {
    marginInlineStart: 'auto',
    minWidth: 18,
    height: 18,
    paddingInline: 5,
    display: 'inline-grid',
    placeItems: 'center',
    borderRadius: radius.pill,
    backgroundColor: color.redlineSoft,
    color: color.redline,
    fontFamily: font.mono,
    fontSize: 10,
    fontWeight: 600,
  },
  layer: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    height: 28,
    paddingInlineEnd: 8,
    borderWidth: 0,
    borderRadius: radius.xs,
    backgroundColor: { default: 'transparent', ':hover': color.hover },
    color: color.ink,
    fontSize: text.ui,
    textAlign: 'start',
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
    outlineOffset: -2,
  },
  layerSelected: { backgroundColor: { default: color.accentSoft, ':hover': color.accentSoft }, color: color.accent },
  layerChild: { paddingInlineStart: 28, color: color.inkMuted, fontSize: text.small, height: 26 },
  layerText: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chev: {
    display: 'grid',
    placeItems: 'center',
    width: 18,
    height: 18,
    marginInlineStart: 4,
    borderRadius: 3,
    color: color.inkFaint,
    flexShrink: 0,
    transitionProperty: 'transform',
    transitionDuration: motion.base,
    transitionTimingFunction: motion.ease,
  },
  chevOpen: { transform: 'rotate(90deg)' },
  chevButton: {
    borderWidth: 0,
    padding: 0,
    marginInlineStart: 0,
    backgroundColor: { default: 'transparent', ':hover': color.hover },
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
  },
  layerRow: { display: 'flex', alignItems: 'center', gap: 2 },
  layerGoal: { paddingInlineStart: 4, flex: 1, minWidth: 0 },
  pct: { fontFamily: font.mono, fontSize: 10, color: color.inkFaint, fontVariantNumeric: 'tabular-nums' },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: space.sm,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: color.line,
  },
  storage: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingInline: 10,
    paddingBlock: 6,
    fontSize: text.small,
    color: color.inkFaint,
  },
  storageWarn: { color: color.warn },
  layersEmpty: { paddingInline: space.lg, paddingBlock: space.sm, fontSize: text.small, color: color.inkFaint },
});

function NavItem({
  icon,
  label,
  route,
  active,
  trailing,
  onNavigate,
}: {
  icon: IconName;
  label: string;
  route: Route;
  active: boolean;
  trailing?: React.ReactNode;
  onNavigate: (r: Route) => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={() => onNavigate(route)}
      {...stylex.props(s.navItem, active && s.navActive)}
    >
      {active && <m.span layoutId="nav-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} {...stylex.props(s.navPill)} />}
      <span {...stylex.props(s.navInner)}>
        <Icon name={icon} />
        {label}
        {trailing}
      </span>
    </button>
  );
}

export function Sidebar({ onNavigate, onOpenPalette }: { onNavigate?: () => void; onOpenPalette: () => void }) {
  const { data, meta } = useStore();
  const { route, navigate } = useRouter();
  const open = useDialogs();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => prefs.get('layers', {}));
  const cycle = cycleInfo(data.settings);

  const go = (r: Route) => {
    navigate(r);
    onNavigate?.();
  };
  const toggle = (id: string) =>
    setExpanded((e) => {
      const next = { ...e, [id]: !(e[id] ?? true) };
      prefs.set('layers', next);
      return next;
    });

  const goals = useMemo(() => Object.values(data.goals).sort((a, b) => a.order - b.order), [data.goals]);
  const unlinked = useMemo(
    () => Object.values(data.projects).filter((p) => !p.archived && p.goalIds.every((g) => !data.goals[g])),
    [data.projects, data.goals],
  );
  const activeCount = Object.values(data.projects).filter((p) => !p.archived && p.status !== 'shipped').length;

  const projectRow = (p: Project, key: string) => {
    const selected = route.name === 'project' && route.id === p.id;
    return (
      <m.li key={key} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }}>
        <button
          type="button"
          onClick={() => go({ name: 'project', id: p.id })}
          aria-current={selected ? 'page' : undefined}
          {...stylex.props(s.layer, s.layerChild, selected && s.layerSelected)}
        >
          <ProgressRing value={p.progress} size={14} stroke={2.5} hex={STATUS_META[p.status].hex} showValue={false} />
          <span {...stylex.props(s.layerText)}>{p.title}</span>
        </button>
      </m.li>
    );
  };

  return (
    <nav aria-label="Workfile" {...stylex.props(s.root)}>
      <div {...stylex.props(s.brand)}>
        <span {...stylex.props(s.mark)} aria-hidden="true">
          <Icon name="frame" size={16} strokeWidth={1.8} />
        </span>
        <span {...stylex.props(s.brandText)}>
          <span {...stylex.props(s.brandName)}>Workfile</span>
          <span {...stylex.props(s.brandCycle)}>
            {data.settings.cycleLabel} · day {cycle.day}/{cycle.totalDays}
          </span>
        </span>
      </div>

      <button type="button" onClick={onOpenPalette} {...stylex.props(s.search)}>
        <Icon name="search" size={14} />
        <span {...stylex.props(s.searchText)}>Search or jump to…</span>
        <Kbd>⌘K</Kbd>
      </button>

      <div {...stylex.props(s.scroll)}>
        <div {...stylex.props(s.sectionHead)}>Pages</div>
        <div {...stylex.props(s.nav)}>
          <NavItem icon="today" label="Today" route={{ name: 'today' }} active={route.name === 'today'} onNavigate={go} />
          <NavItem
            icon="goals"
            label="Goals"
            route={{ name: 'goals' }}
            active={route.name === 'goals' || route.name === 'goal'}
            onNavigate={go}
            trailing={<span {...stylex.props(s.navCount)}>{goals.length || ''}</span>}
          />
          <NavItem
            icon="projects"
            label="Projects"
            route={{ name: 'projects' }}
            active={route.name === 'projects' || route.name === 'project'}
            onNavigate={go}
            trailing={<span {...stylex.props(s.navCount)}>{activeCount || ''}</span>}
          />
          <NavItem icon="journal" label="Journal" route={{ name: 'journal' }} active={route.name === 'journal'} onNavigate={go} />
        </div>

        <div {...stylex.props(s.sectionHead)}>
          <span>Layers</span>
          <IconButton icon="plus" label="New goal" size="sm" onClick={() => open({ kind: 'goal' })} />
        </div>
        {goals.length === 0 && unlinked.length === 0 && (
          <p {...stylex.props(s.layersEmpty)}>Your goals and their projects appear here.</p>
        )}
        <ul role="tree" aria-label="Goals and projects" style={{ listStyle: 'none', margin: 0, padding: '0 8px' }}>
          {goals.map((g) => {
            const projects = projectsForGoal(g.id, data.projects);
            const isOpen = expanded[g.id] ?? true;
            const selected = route.name === 'goal' && route.id === g.id;
            return (
              <li key={g.id} role="treeitem" aria-expanded={isOpen}>
                <div {...stylex.props(s.layerRow)}>
                  <button
                    type="button"
                    aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${g.title}`}
                    onClick={() => toggle(g.id)}
                    {...stylex.props(s.chev, s.chevButton, isOpen && s.chevOpen)}
                  >
                    <Icon name="chevronRight" size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => go({ name: 'goal', id: g.id })}
                    aria-current={selected ? 'page' : undefined}
                    {...stylex.props(s.layer, s.layerGoal, selected && s.layerSelected)}
                  >
                    <Swatch hex={GOAL_HEX[g.color]} size={10} />
                    <span {...stylex.props(s.layerText)}>{g.title}</span>
                    <span {...stylex.props(s.pct)}>{goalProgress(g, data.projects).value}%</span>
                  </button>
                </div>
                <AnimatePresence initial={false}>
                  {isOpen && projects.length > 0 && (
                    <m.ul
                      role="group"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 38 }}
                      style={{ listStyle: 'none', margin: 0, padding: 0, overflow: 'hidden' }}
                    >
                      {projects.map((p) => projectRow(p, `${g.id}-${p.id}`))}
                    </m.ul>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
          {unlinked.length > 0 && (
            <li role="treeitem" aria-expanded={expanded.__unlinked ?? true}>
              <button type="button" onClick={() => toggle('__unlinked')} {...stylex.props(s.layer)}>
                <span aria-hidden="true" {...stylex.props(s.chev, (expanded.__unlinked ?? true) && s.chevOpen)}>
                  <Icon name="chevronRight" size={12} />
                </span>
                <Swatch hex="transparent" size={10} />
                <span {...stylex.props(s.layerText)}>Not linked to a goal</span>
                <span {...stylex.props(s.pct)}>{unlinked.length}</span>
              </button>
              {(expanded.__unlinked ?? true) && (
                <ul role="group" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {unlinked.map((p) => projectRow(p, `u-${p.id}`))}
                </ul>
              )}
            </li>
          )}
        </ul>
      </div>

      <div {...stylex.props(s.footer)}>
        <NavItem icon="settings" label="Settings & data" route={{ name: 'settings' }} active={route.name === 'settings'} onNavigate={go} />
        <div
          {...stylex.props(s.storage, (meta.fallback || !meta.persistent) && s.storageWarn)}
          title={
            meta.backend === 'claude'
              ? 'Saved in this artifact’s database on Claude'
              : meta.fallback
                ? 'Claude storage was unavailable, so changes are saved in this browser only'
                : 'Saved in this browser (local mode)'
          }
        >
          <Icon name={meta.backend === 'claude' ? 'cloud' : meta.fallback || !meta.persistent ? 'alert' : 'laptop'} size={14} />
          {meta.backend === 'pending'
            ? 'Connecting…'
            : meta.backend === 'claude'
              ? meta.readOnly
                ? 'View only'
                : 'Synced with Claude'
              : meta.fallback
                ? 'This browser only'
                : meta.persistent
                  ? 'Saved in this browser'
                  : 'Not saved: storage blocked'}
        </div>
      </div>
    </nav>
  );
}
