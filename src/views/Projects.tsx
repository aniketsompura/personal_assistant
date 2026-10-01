import * as stylex from '@stylexjs/stylex';
import { LayoutGroup, motion as m } from 'motion/react';
import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { useRouter } from '../app/router';
import { useDialogs } from '../app/dialogs';
import type { Project, ProjectStatus } from '../data/types';
import { PRIORITY_META, STATUS_FLOW, STATUS_META, GOAL_HEX } from '../lib/meta';
import { lastUpdateFor } from '../lib/insights';
import { prefs } from '../lib/events';
import { relativeDays } from '../lib/dates';
import { color, font, motion, radius, space, text } from '../styles/tokens.stylex';
import { EmptyState, PageHeader, PriorityBars, StatusPill } from '../components/domain';
import { ProjectCard, dueLabel } from '../components/ProjectCard';
import { ProgressBar } from '../components/Progress';
import { Segmented } from '../components/Segmented';
import { Button, Dot, IconButton, Swatch, TextInput } from '../components/ui';
import { Icon } from '../components/Icon';

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

function sortProjects(list: Project[]) {
  return [...list].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
      a.title.localeCompare(b.title),
  );
}

const s = stylex.create({
  page: { display: 'flex', flexDirection: 'column', gap: space.xl },
  toolbar: { display: 'flex', flexDirection: 'column', gap: space.md },
  toolRow: { display: 'flex', flexWrap: 'wrap', gap: space.md, alignItems: 'center', justifyContent: 'space-between' },
  search: { position: 'relative', flex: '0 1 260px', minWidth: 180 },
  searchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: color.inkFaint, pointerEvents: 'none' },
  searchInput: { paddingInlineStart: 32 },
  chips: {
    display: 'flex',
    flexWrap: 'nowrap',
    gap: 6,
    minWidth: 0,
    overflowX: 'auto',
    scrollbarWidth: 'none',
    paddingBottom: 2,
    maskImage: 'linear-gradient(to right, black calc(100% - 32px), transparent)',
  },
  chipText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 28,
    maxWidth: 240,
    flexShrink: 0,
    paddingInline: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: { default: color.line, ':hover': color.lineStrong },
    backgroundColor: color.surface,
    color: color.inkMuted,
    fontSize: text.small,
    fontWeight: 550,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transitionProperty: 'background-color, border-color, color',
    transitionDuration: motion.fast,
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
  },
  chipOn: { borderColor: color.ink, color: color.ink, backgroundColor: color.sunken },
  archived: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: text.small, color: color.inkMuted, cursor: 'pointer' },
  board: {
    display: 'grid',
    gridAutoFlow: 'column',
    gridAutoColumns: 'minmax(236px, 1fr)',
    gap: space.md,
    overflowX: 'auto',
    paddingBottom: space.md,
    marginInline: -4,
    paddingInline: 4,
    scrollSnapType: 'x proximity',
    alignItems: 'start',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.sm,
    minHeight: 160,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'transparent',
    backgroundColor: color.hover,
    scrollSnapAlign: 'start',
    transitionProperty: 'background-color, border-color',
    transitionDuration: motion.fast,
  },
  columnOver: { borderColor: color.accent, backgroundColor: color.accentSoft },
  colHead: { display: 'flex', alignItems: 'center', gap: space.sm, paddingInline: 4, height: 28 },
  colTitle: { fontSize: text.ui, fontWeight: 650 },
  colCount: { fontFamily: font.mono, fontSize: text.label, color: color.inkFaint },
  colAdd: { marginInlineStart: 'auto' },
  colEmpty: {
    display: 'grid',
    placeItems: 'center',
    minHeight: 80,
    borderRadius: radius.sm,
    fontSize: text.small,
    color: color.inkFaint,
    textAlign: 'center',
    paddingInline: space.md,
  },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 720 },
  tableWrap: {
    overflowX: 'auto',
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    backgroundColor: color.surface,
  },
  th: {
    position: 'sticky',
    top: 0,
    paddingInline: space.md,
    height: 36,
    textAlign: 'start',
    fontFamily: font.mono,
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: color.inkFaint,
    backgroundColor: color.sunken,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: color.line,
    whiteSpace: 'nowrap',
  },
  sortBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    font: 'inherit',
    letterSpacing: 'inherit',
    textTransform: 'inherit',
    color: { default: 'inherit', ':hover': color.ink },
    cursor: 'pointer',
  },
  tr: {
    cursor: 'pointer',
    backgroundColor: { default: 'transparent', ':hover': color.hover },
    transitionProperty: 'background-color',
    transitionDuration: motion.fast,
  },
  td: {
    paddingInline: space.md,
    height: 52,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: color.line,
    fontSize: text.ui,
    verticalAlign: 'middle',
  },
  titleCell: { display: 'flex', alignItems: 'center', gap: space.sm, minWidth: 0, maxWidth: 380 },
  titleBtn: {
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    font: 'inherit',
    fontWeight: 600,
    color: color.ink,
    textAlign: 'start',
    cursor: 'pointer',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
  },
  swatches: { display: 'inline-flex', gap: 3, flexShrink: 0 },
  progressCell: { display: 'flex', alignItems: 'center', gap: space.sm, minWidth: 140 },
  mono: { fontFamily: font.mono, fontSize: text.label, color: color.inkMuted, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
  late: { color: color.redline, fontWeight: 600 },
  soon: { color: color.warn, fontWeight: 600 },
});

type SortKey = 'title' | 'status' | 'progress' | 'due' | 'updated' | 'priority';

export function ProjectsView() {
  const { data, actions, meta } = useStore();
  const { navigate } = useRouter();
  const dialogs = useDialogs();
  const [view, setView] = useState<'board' | 'list'>(() => prefs.get('projectsView', 'board'));
  const [query, setQuery] = useState('');
  const [goalFilter, setGoalFilter] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<ProjectStatus | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'status', dir: 1 });

  const goals = useMemo(() => Object.values(data.goals).sort((a, b) => a.order - b.order), [data.goals]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(data.projects).filter((p) => {
      if (!showArchived && p.archived) return false;
      if (goalFilter === '__none' && p.goalIds.some((g) => data.goals[g])) return false;
      if (goalFilter && goalFilter !== '__none' && !p.goalIds.includes(goalFilter)) return false;
      if (q && !`${p.title} ${p.summary} ${p.tags.join(' ')} ${p.team}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.projects, data.goals, query, goalFilter, showArchived]);

  const listSorted = useMemo(() => {
    const val = (p: Project): string | number => {
      switch (sort.key) {
        case 'title':
          return p.title.toLowerCase();
        case 'status':
          return STATUS_FLOW.indexOf(p.status);
        case 'progress':
          return p.progress;
        case 'due':
          return p.dueDate ?? '9999';
        case 'updated':
          return lastUpdateFor(p.id, data.updates)?.date ?? '0000';
        case 'priority':
          return PRIORITY_RANK[p.priority];
      }
    };
    return [...filtered].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir || a.title.localeCompare(b.title);
    });
  }, [filtered, sort, data.updates]);

  const setViewPersist = (v: 'board' | 'list') => {
    setView(v);
    prefs.set('projectsView', v);
  };

  const onDrop = (status: ProjectStatus) => {
    setOverCol(null);
    if (!dragId) return;
    const p = data.projects[dragId];
    setDragId(null);
    if (p && p.status !== status) actions.updateProject(p.id, { status });
  };

  const sortHead = (key: SortKey, label: string) => (
    <th {...stylex.props(s.th)} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => setSort((cur) => ({ key, dir: cur.key === key ? (cur.dir === 1 ? -1 : 1) : 1 }))}
        {...stylex.props(s.sortBtn)}
      >
        {label}
        {sort.key === key && <Icon name={sort.dir === 1 ? 'chevronDown' : 'chevronRight'} size={10} />}
      </button>
    </th>
  );

  const total = Object.values(data.projects).filter((p) => !p.archived).length;
  const shipped = Object.values(data.projects).filter((p) => !p.archived && p.status === 'shipped').length;

  return (
    <div {...stylex.props(s.page)}>
      <PageHeader
        eyebrow={`${data.settings.cycleLabel} · ${total} project${total === 1 ? '' : 's'} · ${shipped} shipped`}
        title="Projects"
        actions={
          <>
            <Segmented
              ariaLabel="View"
              value={view}
              onChange={setViewPersist}
              options={[
                { value: 'board', label: 'Board', icon: 'board' },
                { value: 'list', label: 'List', icon: 'list' },
              ]}
            />
            <Button variant="primary" icon="plus" disabled={meta.readOnly} onClick={() => dialogs({ kind: 'project' })}>
              New project
            </Button>
          </>
        }
      />

      {total === 0 && !showArchived ? (
        <EmptyState
          icon="projects"
          title="No projects yet"
          actions={
            <Button variant="primary" icon="plus" onClick={() => dialogs({ kind: 'project' })}>
              Create a project
            </Button>
          }
        >
          A project holds everything about one piece of work: its brief, requirements, prototype and design links, dated updates and notes.
        </EmptyState>
      ) : (
        <>
          <div {...stylex.props(s.toolbar)}>
            <div {...stylex.props(s.toolRow)}>
            <div {...stylex.props(s.search)}>
              <span {...stylex.props(s.searchIcon)}>
                <Icon name="search" size={14} />
              </span>
              <TextInput
                compact
                type="search"
                aria-label="Filter projects"
                placeholder="Filter projects"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                xstyle={s.searchInput}
              />
            </div>
            <label {...stylex.props(s.archived)}>
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Show archived
            </label>
            </div>
            <div {...stylex.props(s.chips)} role="group" aria-label="Filter by goal">
              <button type="button" aria-pressed={goalFilter === null} onClick={() => setGoalFilter(null)} {...stylex.props(s.chip, goalFilter === null && s.chipOn)}>
                All goals
              </button>
              {goals.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={goalFilter === g.id}
                  onClick={() => setGoalFilter(goalFilter === g.id ? null : g.id)}
                  title={g.title}
                  {...stylex.props(s.chip, goalFilter === g.id && s.chipOn)}
                >
                  <Swatch hex={GOAL_HEX[g.color]} size={8} />
                  <span {...stylex.props(s.chipText)}>{g.title}</span>
                </button>
              ))}
              <button
                type="button"
                aria-pressed={goalFilter === '__none'}
                onClick={() => setGoalFilter(goalFilter === '__none' ? null : '__none')}
                {...stylex.props(s.chip, goalFilter === '__none' && s.chipOn)}
              >
                No goal
              </button>
            </div>
          </div>

          {view === 'board' ? (
            <LayoutGroup>
              <div {...stylex.props(s.board)} aria-label="Project board">
                {STATUS_FLOW.map((status) => {
                  const items = sortProjects(filtered.filter((p) => p.status === status));
                  const meta2 = STATUS_META[status];
                  return (
                    <section
                      key={status}
                      aria-label={`${meta2.label}, ${items.length} projects`}
                      onDragOver={(e) => {
                        if (!dragId) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (overCol !== status) setOverCol(status);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol((c) => (c === status ? null : c));
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        onDrop(status);
                      }}
                      {...stylex.props(s.column, overCol === status && s.columnOver)}
                    >
                      <header {...stylex.props(s.colHead)}>
                        <Dot hex={meta2.hex} hollow={status === 'idea' || status === 'paused'} />
                        <span {...stylex.props(s.colTitle)} title={meta2.hint}>
                          {meta2.label}
                        </span>
                        <span {...stylex.props(s.colCount)}>{items.length}</span>
                        {!meta.readOnly && (
                          <IconButton
                            icon="plus"
                            label={`New project in ${meta2.label}`}
                            size="sm"
                            xstyle={s.colAdd}
                            onClick={() => dialogs({ kind: 'project', status, goalId: goalFilter && goalFilter !== '__none' ? goalFilter : undefined })}
                          />
                        )}
                      </header>
                      {items.map((p) => (
                        <m.div key={p.id} layoutId={`card-${p.id}`} layout transition={{ type: 'spring', stiffness: 420, damping: 36 }}>
                          <ProjectCard
                            project={p}
                            data={data}
                            onOpen={() => navigate({ name: 'project', id: p.id })}
                            draggable={!meta.readOnly}
                            dragging={dragId === p.id}
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', p.id);
                              setDragId(p.id);
                            }}
                            onDragEnd={() => {
                              setDragId(null);
                              setOverCol(null);
                            }}
                          />
                        </m.div>
                      ))}
                      {items.length === 0 && (
                        <div {...stylex.props(s.colEmpty)}>{dragId ? `Drop to move to ${meta2.label}` : meta2.hint}</div>
                      )}
                    </section>
                  );
                })}
              </div>
            </LayoutGroup>
          ) : (
            <div {...stylex.props(s.tableWrap)}>
              <table {...stylex.props(s.table)}>
                <thead>
                  <tr>
                    {sortHead('title', 'Project')}
                    {sortHead('status', 'Stage')}
                    {sortHead('priority', 'Priority')}
                    {sortHead('progress', 'Progress')}
                    {sortHead('due', 'Due')}
                    {sortHead('updated', 'Last update')}
                  </tr>
                </thead>
                <tbody>
                  {listSorted.map((p) => {
                    const due = dueLabel(p);
                    const last = lastUpdateFor(p.id, data.updates);
                    return (
                      <tr key={p.id} onClick={() => navigate({ name: 'project', id: p.id })} {...stylex.props(s.tr)}>
                        <td {...stylex.props(s.td)}>
                          <span {...stylex.props(s.titleCell)}>
                            <span {...stylex.props(s.swatches)}>
                              {p.goalIds
                                .map((g) => data.goals[g])
                                .filter(Boolean)
                                .map((g) => (
                                  <Swatch key={g.id} hex={GOAL_HEX[g.color]} size={8} />
                                ))}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate({ name: 'project', id: p.id });
                              }}
                              {...stylex.props(s.titleBtn)}
                            >
                              {p.title}
                            </button>
                            {p.archived && <span {...stylex.props(s.mono)}>archived</span>}
                          </span>
                        </td>
                        <td {...stylex.props(s.td)}>
                          <StatusPill status={p.status} />
                        </td>
                        <td {...stylex.props(s.td)} title={PRIORITY_META[p.priority].label}>
                          <PriorityBars priority={p.priority} />
                        </td>
                        <td {...stylex.props(s.td)}>
                          <span {...stylex.props(s.progressCell)}>
                            <ProgressBar value={p.progress} hex={STATUS_META[p.status].hex} size="sm" />
                            <span {...stylex.props(s.mono)}>{p.progress}%</span>
                          </span>
                        </td>
                        <td {...stylex.props(s.td)}>
                          <span {...stylex.props(s.mono, due?.tone === 'late' && s.late, due?.tone === 'soon' && s.soon)}>{due?.text ?? '—'}</span>
                        </td>
                        <td {...stylex.props(s.td)}>
                          <span {...stylex.props(s.mono)}>{last ? relativeDays(last.date) : '—'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {listSorted.length === 0 && (
                <div {...stylex.props(s.colEmpty)}>No projects match these filters.</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
