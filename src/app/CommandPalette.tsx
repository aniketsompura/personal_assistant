import * as stylex from '@stylexjs/stylex';
import { AnimatePresence, motion as m } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../data/store';
import { GOAL_HEX, STATUS_META } from '../lib/meta';
import { excerpt } from '../components/Markdown';
import { Icon, type IconName } from '../components/Icon';
import { Dot, Kbd, Swatch } from '../components/ui';
import { color, font, radius, space, text } from '../styles/tokens.stylex';
import { useRouter } from './router';
import { useDialogs } from './dialogs';

interface Item {
  id: string;
  group: string;
  label: string;
  sub?: string;
  leading: ReactNode;
  keywords?: string;
  run: () => void;
}

const s = stylex.create({
  scrim: { position: 'fixed', inset: 0, zIndex: 70, backgroundColor: color.scrim },
  holder: {
    position: 'fixed',
    inset: 0,
    zIndex: 71,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingTop: 'min(14vh, 140px)',
    paddingInline: space.lg,
    pointerEvents: 'none',
  },
  panel: {
    pointerEvents: 'auto',
    width: '100%',
    maxWidth: 600,
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    boxShadow: `0 30px 80px -20px ${color.shadow}, 0 4px 12px ${color.shadow}`,
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: space.sm,
    paddingInline: space.lg,
    height: 52,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: color.line,
    color: color.inkFaint,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    borderWidth: 0,
    outline: 'none',
    backgroundColor: 'transparent',
    fontSize: text.lead,
    color: color.ink,
    '::placeholder': { color: color.inkFaint },
  },
  list: { maxHeight: 'min(420px, 60vh)', overflowY: 'auto', padding: space.xs },
  group: {
    paddingInline: space.md,
    paddingTop: space.sm,
    paddingBottom: 4,
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: color.inkFaint,
  },
  item: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: space.md,
    width: '100%',
    minHeight: 40,
    paddingInline: space.md,
    paddingBlock: 6,
    borderWidth: 0,
    borderRadius: radius.sm,
    backgroundColor: 'transparent',
    color: color.ink,
    fontSize: text.body,
    textAlign: 'start',
    cursor: 'pointer',
  },
  highlight: { position: 'absolute', inset: 0, borderRadius: radius.sm, backgroundColor: color.accentSoft },
  leading: { position: 'relative', display: 'grid', placeItems: 'center', width: 18, color: color.inkMuted },
  text: { position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 },
  label: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sub: { fontSize: text.small, color: color.inkFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  enter: { position: 'relative', color: color.accent },
  empty: { padding: space.xl, textAlign: 'center', color: color.inkFaint, fontSize: text.body },
  foot: {
    display: 'flex',
    gap: space.lg,
    paddingInline: space.lg,
    paddingBlock: space.sm,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: color.line,
    fontSize: text.small,
    color: color.inkFaint,
  },
  footItem: { display: 'inline-flex', alignItems: 'center', gap: 6 },
});

const ic = (name: IconName) => <Icon name={name} size={16} />;

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useStore();
  const { navigate } = useRouter();
  const dialogs = useDialogs();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const run = (fn: () => void) => () => {
      onClose();
      fn();
    };
    const actions: Item[] = [
      { id: 'a-update', group: 'Actions', label: 'Log an update', leading: ic('plus'), keywords: 'add log progress', run: run(() => dialogs({ kind: 'update' })) },
      { id: 'a-project', group: 'Actions', label: 'New project', leading: ic('projects'), keywords: 'create add', run: run(() => dialogs({ kind: 'project' })) },
      { id: 'a-goal', group: 'Actions', label: 'New goal', leading: ic('goals'), keywords: 'create add objective', run: run(() => dialogs({ kind: 'goal' })) },
      { id: 'g-today', group: 'Go to', label: 'Today', leading: ic('today'), keywords: 'home dashboard', run: run(() => navigate({ name: 'today' })) },
      { id: 'g-goals', group: 'Go to', label: 'Goals', leading: ic('goals'), run: run(() => navigate({ name: 'goals' })) },
      { id: 'g-projects', group: 'Go to', label: 'Projects', leading: ic('board'), keywords: 'board list', run: run(() => navigate({ name: 'projects' })) },
      { id: 'g-journal', group: 'Go to', label: 'Journal', leading: ic('journal'), keywords: 'notes log recap', run: run(() => navigate({ name: 'journal' })) },
      { id: 'g-settings', group: 'Go to', label: 'Settings & data', leading: ic('settings'), keywords: 'export import backup', run: run(() => navigate({ name: 'settings' })) },
    ];
    const projects: Item[] = Object.values(data.projects)
      .sort((a, b) => Number(a.archived) - Number(b.archived) || b.lastActivityAt.localeCompare(a.lastActivityAt))
      .map((p) => ({
        id: `p-${p.id}`,
        group: 'Projects',
        label: p.title,
        sub: `${STATUS_META[p.status].label} · ${p.progress}%${p.archived ? ' · archived' : ''}`,
        leading: <Dot hex={STATUS_META[p.status].hex} />,
        keywords: `${p.summary} ${p.tags.join(' ')} ${p.team}`,
        run: run(() => navigate({ name: 'project', id: p.id })),
      }));
    const goals: Item[] = Object.values(data.goals)
      .sort((a, b) => a.order - b.order)
      .map((g) => ({
        id: `g-${g.id}`,
        group: 'Goals',
        label: g.title,
        sub: g.category || undefined,
        leading: <Swatch hex={GOAL_HEX[g.color]} size={10} />,
        keywords: g.description,
        run: run(() => navigate({ name: 'goal', id: g.id })),
      }));
    const notes: Item[] = Object.values(data.notes)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((n) => ({
        id: `n-${n.id}`,
        group: 'Notes',
        label: n.title || 'Untitled note',
        sub: excerpt(n.body, 80) || undefined,
        leading: ic('note'),
        keywords: n.body.slice(0, 2000),
        run: run(() =>
          n.projectId && data.projects[n.projectId]
            ? navigate({ name: 'project', id: n.projectId, tab: 'notes', noteId: n.id })
            : navigate({ name: 'journal' }),
        ),
      }));
    const all = [...actions, ...projects, ...goals, ...notes];
    const query = q.trim().toLowerCase();
    if (!query) return [...actions.slice(0, 3), ...projects.filter((_, i) => i < 5), ...actions.slice(3)];
    const terms = query.split(/\s+/);
    return all
      .map((it) => {
        const hay = `${it.label} ${it.sub ?? ''} ${it.keywords ?? ''}`.toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return null;
        const score = it.label.toLowerCase().startsWith(query) ? 0 : it.label.toLowerCase().includes(query) ? 1 : 2;
        return { it, score };
      })
      .filter((x): x is { it: Item; score: number } => x !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 40)
      .map((x) => x.it);
  }, [q, data, dialogs, navigate, onClose]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[active]?.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = '';

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <m.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            {...stylex.props(s.scrim)}
          />
          <div key="holder" {...stylex.props(s.holder)}>
            <m.div
              role="dialog"
              aria-modal="true"
              aria-label="Search and commands"
              initial={{ opacity: 0, scale: 0.97, y: -8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.98, y: -4, transition: { duration: 0.1 } }}
              transition={{ type: 'spring', stiffness: 520, damping: 36 }}
              {...stylex.props(s.panel)}
            >
              <div {...stylex.props(s.inputRow)}>
                <Icon name="search" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Search projects, goals, notes, or type a command"
                  aria-label="Search"
                  aria-controls="palette-list"
                  aria-activedescendant={items[active] ? `palette-${items[active].id}` : undefined}
                  {...stylex.props(s.input)}
                />
                <Kbd>esc</Kbd>
              </div>
              <div id="palette-list" role="listbox" ref={listRef} {...stylex.props(s.list)}>
                {items.length === 0 && <div {...stylex.props(s.empty)}>Nothing matches “{q}”.</div>}
                {items.map((it, i) => {
                  const head = it.group !== lastGroup ? it.group : null;
                  lastGroup = it.group;
                  return (
                    <div key={it.id}>
                      {head && <div {...stylex.props(s.group)}>{head}</div>}
                      <button
                        type="button"
                        role="option"
                        id={`palette-${it.id}`}
                        aria-selected={i === active}
                        data-index={i}
                        onMouseMove={() => setActive(i)}
                        onClick={it.run}
                        {...stylex.props(s.item)}
                      >
                        {i === active && (
                          <m.span layoutId="palette-hl" transition={{ type: 'spring', stiffness: 700, damping: 45 }} {...stylex.props(s.highlight)} />
                        )}
                        <span {...stylex.props(s.leading)}>{it.leading}</span>
                        <span {...stylex.props(s.text)}>
                          <span {...stylex.props(s.label)}>{it.label}</span>
                          {it.sub && <span {...stylex.props(s.sub)}>{it.sub}</span>}
                        </span>
                        {i === active && (
                          <span {...stylex.props(s.enter)}>
                            <Icon name="arrowRight" size={14} />
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div {...stylex.props(s.foot)}>
                <span {...stylex.props(s.footItem)}>
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd> to move
                </span>
                <span {...stylex.props(s.footItem)}>
                  <Kbd>↵</Kbd> to open
                </span>
              </div>
            </m.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
