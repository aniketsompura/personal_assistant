import * as stylex from '@stylexjs/stylex';
import { AnimatePresence, motion as m } from 'motion/react';
import { useMemo } from 'react';
import { useStore } from '../data/store';
import { useRouter, type ProjectTab } from '../app/router';
import { REQUIREMENT_LEVELS, type Project, type Requirement } from '../data/types';
import { newId } from '../lib/ids';
import { formatWeekday, nowISO, relativeDays } from '../lib/dates';
import { requirementStats, updatesFor } from '../lib/insights';
import { GOAL_HEX, LEVEL_META, STATUS_META, UPDATE_KIND_META } from '../lib/meta';
import { color, font, radius, space, text } from '../styles/tokens.stylex';
import { Frame } from '../components/Frame';
import { EmptyState } from '../components/domain';
import { Tabs } from '../components/Segmented';
import { Timeline, UpdateComposer } from '../components/Updates';
import { Checklist } from '../components/Checklist';
import { ProgressBar } from '../components/Progress';
import { excerpt } from '../components/Markdown';
import { Button, Swatch, TextArea, TextInput } from '../components/ui';
import { Icon } from '../components/Icon';
import { Inspector } from './project/Inspector';
import { NotesPane } from './project/Notes';
import { LinksTab, hostOf, safeHref } from './project/Links';

const s = stylex.create({
  page: { display: 'flex', flexDirection: 'column', gap: space.xl },
  top: { display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  layout: {
    display: 'grid',
    gridTemplateColumns: { default: 'minmax(0, 1fr) 300px', '@media (max-width: 1080px)': 'minmax(0, 1fr)' },
    gridTemplateAreas: { default: '"head side" "main side"', '@media (max-width: 1080px)': '"head" "side" "main"' },
    gridTemplateRows: { default: 'auto 1fr', '@media (max-width: 1080px)': 'auto' },
    columnGap: space.xl,
    rowGap: space.xl,
    alignItems: 'start',
  },
  headArea: { gridArea: 'head', display: 'flex', flexDirection: 'column', gap: space.xl, minWidth: 0 },
  main: { gridArea: 'main', display: 'flex', flexDirection: 'column', gap: space.xl, minWidth: 0 },
  side: {
    gridArea: 'side',
    position: { default: 'sticky', '@media (max-width: 1080px)': 'static' },
    top: space.lg,
    minWidth: 0,
  },
  header: { display: 'flex', flexDirection: 'column', gap: space.xs },
  eyebrow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
    fontFamily: font.mono,
    fontSize: text.label,
    letterSpacing: '0.04em',
    color: color.inkFaint,
  },
  titleInput: {
    height: 'auto',
    paddingBlock: 4,
    marginInline: -10,
    fontFamily: font.display,
    fontSize: text.h1,
    fontWeight: 700,
    letterSpacing: '-0.025em',
    lineHeight: 1.1,
  },
  summary: { marginInline: -10, fontSize: text.lead, color: color.inkMuted, minHeight: 0, lineHeight: 1.55 },
  archived: {
    display: 'flex',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: color.warnSoft,
    color: color.warn,
    fontSize: text.ui,
  },
  overview: {
    display: 'grid',
    gridTemplateColumns: { default: 'minmax(0, 1fr) minmax(0, 1fr)', '@media (max-width: 760px)': 'minmax(0, 1fr)' },
    gap: space.xl,
    alignItems: 'start',
  },
  span2: { gridColumn: { default: '1 / -1', '@media (max-width: 760px)': 'auto' } },
  latest: { display: 'flex', flexDirection: 'column', gap: space.sm },
  latestMeta: { display: 'flex', alignItems: 'center', gap: space.sm, fontFamily: font.mono, fontSize: text.small, color: color.inkMuted },
  latestText: { fontSize: text.lead, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
  stack: { display: 'flex', flexDirection: 'column', gap: space.md },
  reqHead: { display: 'flex', alignItems: 'center', gap: space.md },
  reqPct: { fontFamily: font.mono, fontSize: text.small, color: color.inkMuted, whiteSpace: 'nowrap' },
  openList: { display: 'flex', flexDirection: 'column', gap: 6, margin: 0, paddingInlineStart: 18, fontSize: text.ui, color: color.ink },
  muted: { fontSize: text.ui, color: color.inkFaint },
  linkBtn: {
    alignSelf: 'flex-start',
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: { default: color.accent, ':hover': color.accentHover },
    fontSize: text.small,
    fontWeight: 600,
    cursor: 'pointer',
  },
  protoCard: {
    display: 'flex',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: color.ink,
    color: color.canvas,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: text.ui,
    transitionProperty: 'transform',
    transitionDuration: '160ms',
    transform: { default: null, ':hover': 'translateY(-1px)' },
  },
  protoHost: { fontFamily: font.mono, fontSize: 10.5, opacity: 0.7, fontWeight: 400 },
  protoText: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 },
  noteRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    textAlign: 'start',
    cursor: 'pointer',
    color: 'inherit',
  },
  noteTitle: { fontSize: text.ui, fontWeight: 600, color: { default: color.ink, ':hover': color.accent } },
  noteSub: { fontSize: text.small, color: color.inkFaint },
  level: {
    flexShrink: 0,
    height: 20,
    paddingInline: 6,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 3,
    fontFamily: font.mono,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    backgroundColor: 'transparent',
  },
  must: { color: color.redline, borderColor: color.redlineSoft, backgroundColor: color.redlineSoft },
  should: { color: color.inkMuted, borderColor: color.line },
  could: { color: color.inkFaint, borderColor: color.line, borderStyle: 'dashed' },
  sync: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: color.accentSoft,
    fontSize: text.ui,
  },
  spacer: { flex: 1 },
  brief: { display: 'flex', flexDirection: 'column', gap: space.sm },
});

function Overview({ project: p, go }: { project: Project; go: (tab: ProjectTab, noteId?: string) => void }) {
  const { data } = useStore();
  const updates = useMemo(() => updatesFor(p.id, data.updates), [p.id, data.updates]);
  const latest = updates.find((u) => !u.auto && u.text) ?? null;
  const req = requirementStats(p);
  const open = p.requirements.filter((r) => !r.done).slice(0, 5);
  const notes = Object.values(data.notes)
    .filter((n) => n.projectId === p.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);
  const protos = p.links.filter((l) => l.kind === 'prototype' || l.kind === 'design').slice(0, 3);

  return (
    <div {...stylex.props(s.overview)}>
      <Frame tag="Latest update" tagMeta={latest ? relativeDays(latest.date) : undefined} wrapStyle={s.span2}>
        {latest ? (
          <div {...stylex.props(s.latest)}>
            <span {...stylex.props(s.latestMeta)}>
              {formatWeekday(latest.date)} · <span style={{ color: UPDATE_KIND_META[latest.kind].hex }}>{UPDATE_KIND_META[latest.kind].label}</span>
            </span>
            <p {...stylex.props(s.latestText)}>{latest.text}</p>
            <button type="button" onClick={() => go('updates')} {...stylex.props(s.linkBtn)}>
              All {updates.length} updates →
            </button>
          </div>
        ) : (
          <EmptyState icon="clock" title="No updates yet" compact actions={<Button size="sm" variant="primary" icon="plus" onClick={() => go('updates')}>Log the first update</Button>}>
            Log what moved, with a date. Progress and stage update with it.
          </EmptyState>
        )}
      </Frame>

      <Frame tag="Requirements" tagMeta={req.total ? `${req.done}/${req.total} done` : undefined}>
        <div {...stylex.props(s.stack)}>
          {req.total ? (
            <>
              <div {...stylex.props(s.reqHead)}>
                <ProgressBar value={req.pct} hex={STATUS_META[p.status].hex} />
                <span {...stylex.props(s.reqPct)}>{req.pct}%</span>
              </div>
              {open.length ? (
                <ul {...stylex.props(s.openList)}>
                  {open.map((r) => (
                    <li key={r.id}>{r.text}</li>
                  ))}
                </ul>
              ) : (
                <span {...stylex.props(s.muted)}>Every requirement is done.</span>
              )}
            </>
          ) : (
            <span {...stylex.props(s.muted)}>No requirements captured yet.</span>
          )}
          <button type="button" onClick={() => go('requirements')} {...stylex.props(s.linkBtn)}>
            {req.total ? 'Open requirements →' : 'Add requirements →'}
          </button>
        </div>
      </Frame>

      <Frame tag="Prototype & design">
        <div {...stylex.props(s.stack)}>
          {protos.length ? (
            protos.map((l) => (
              <a key={l.id} href={safeHref(l.url)} target="_blank" rel="noopener noreferrer" {...stylex.props(s.protoCard)}>
                <Icon name={l.kind === 'prototype' ? 'bolt' : 'frame'} size={16} />
                <span {...stylex.props(s.protoText)}>
                  {l.label}
                  <span {...stylex.props(s.protoHost)}>{hostOf(l.url)}</span>
                </span>
                <Icon name="external" size={14} />
              </a>
            ))
          ) : (
            <span {...stylex.props(s.muted)}>No prototype or design file linked.</span>
          )}
          <button type="button" onClick={() => go('links')} {...stylex.props(s.linkBtn)}>
            {p.links.length ? `All ${p.links.length} links →` : 'Add links →'}
          </button>
        </div>
      </Frame>

      <Frame tag="Notes" tagMeta={notes.length ? `${Object.values(data.notes).filter((n) => n.projectId === p.id).length}` : undefined} wrapStyle={s.span2}>
        <div {...stylex.props(s.stack)}>
          {notes.length ? (
            notes.map((n) => (
              <button key={n.id} type="button" onClick={() => go('notes', n.id)} {...stylex.props(s.noteRow)}>
                <span {...stylex.props(s.noteTitle)}>{n.title || 'Untitled note'}</span>
                <span {...stylex.props(s.noteSub)}>{excerpt(n.body, 120) || 'Empty'}</span>
              </button>
            ))
          ) : (
            <span {...stylex.props(s.muted)}>Meeting notes, critiques and decisions for this project live here.</span>
          )}
          <button type="button" onClick={() => go('notes')} {...stylex.props(s.linkBtn)}>
            {notes.length ? 'Open notes →' : 'Write a note →'}
          </button>
        </div>
      </Frame>
    </div>
  );
}

function RequirementsTab({ project: p }: { project: Project }) {
  const { actions, meta } = useStore();
  const req = requirementStats(p);
  const save = (requirements: Requirement[]) => actions.updateProject(p.id, { requirements }, { silent: true });
  const cycleLevel = (r: Requirement) => {
    const next = REQUIREMENT_LEVELS[(REQUIREMENT_LEVELS.indexOf(r.level) + 1) % REQUIREMENT_LEVELS.length];
    save(p.requirements.map((x) => (x.id === r.id ? { ...x, level: next } : x)));
  };
  return (
    <div {...stylex.props(s.stack)}>
      {req.total > 0 && req.pct !== p.progress && !meta.readOnly && (
        <div {...stylex.props(s.sync)}>
          <Icon name="checkSquare" size={16} />
          {req.done} of {req.total} requirements done ({req.pct}%). Project progress is {p.progress}%.
          <span {...stylex.props(s.spacer)} />
          <Button size="sm" variant="secondary" onClick={() => actions.updateProject(p.id, { progress: req.pct })}>
            Set progress to {req.pct}%
          </Button>
        </div>
      )}
      <Frame tag="Requirements" tagMeta={req.total ? `${req.done}/${req.total} done · tap a tag to change priority` : undefined}>
        <Checklist
          label="Requirements"
          items={p.requirements}
          readOnly={meta.readOnly}
          addPlaceholder="Add a requirement and press Enter"
          onToggle={(r) => save(p.requirements.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)))}
          onEdit={(r, t) => save(p.requirements.map((x) => (x.id === r.id ? { ...x, text: t } : x)))}
          onDelete={(r) => save(p.requirements.filter((x) => x.id !== r.id))}
          onAdd={(t) => save([...p.requirements, { id: newId('r'), text: t, done: false, level: 'should', createdAt: nowISO() }])}
          trailing={(r) => (
            <button
              type="button"
              title={`${LEVEL_META[r.level].label}. Click to change.`}
              disabled={meta.readOnly}
              onClick={() => cycleLevel(r)}
              {...stylex.props(s.level, s[r.level])}
            >
              {LEVEL_META[r.level].short}
            </button>
          )}
        />
      </Frame>
    </div>
  );
}

export function ProjectDetailView({ id, tab = 'overview', noteId }: { id: string; tab?: ProjectTab; noteId?: string }) {
  const { data, actions, meta } = useStore();
  const { navigate, back } = useRouter();
  const p = data.projects[id];
  const updates = useMemo(() => (p ? updatesFor(p.id, data.updates) : []), [p, data.updates]);

  if (!p) {
    return (
      <EmptyState icon="projects" title="This project no longer exists" actions={<Button onClick={() => navigate({ name: 'projects' })}>All projects</Button>}>
        It may have been deleted on another device.
      </EmptyState>
    );
  }

  const go = (t: ProjectTab, nid?: string) => navigate({ name: 'project', id: p.id, tab: t, noteId: nid });
  const req = requirementStats(p);
  const noteCount = Object.values(data.notes).filter((n) => n.projectId === p.id).length;
  const goals = p.goalIds.map((g) => data.goals[g]).filter(Boolean);
  const ro = meta.readOnly;

  return (
    <div {...stylex.props(s.page)}>
      <div {...stylex.props(s.top)}>
        <Button variant="ghost" size="sm" icon="arrowLeft" onClick={back}>
          Back
        </Button>
      </div>

      <div {...stylex.props(s.layout)}>
        <div {...stylex.props(s.headArea)}>
          <header {...stylex.props(s.header)}>
            <span {...stylex.props(s.eyebrow)}>
              <span style={{ color: STATUS_META[p.status].hex }}>●</span>
              {STATUS_META[p.status].label.toUpperCase()}
              {goals.map((g) => (
                <span key={g.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  · <Swatch hex={GOAL_HEX[g.color]} size={8} /> {g.title}
                </span>
              ))}
            </span>
            <TextInput
              bare
              aria-label="Project title"
              key={`t-${p.id}-${p.title}`}
              defaultValue={p.title}
              readOnly={ro}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== p.title) actions.updateProject(p.id, { title: v }, { silent: true });
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              xstyle={s.titleInput}
            />
            <TextArea
              bare
              aria-label="Project brief"
              key={`s-${p.id}-${p.summary.length}`}
              defaultValue={p.summary}
              readOnly={ro}
              minRows={1}
              placeholder="The brief: the problem, who it's for, and what good looks like."
              onBlur={(e) => e.target.value !== p.summary && actions.updateProject(p.id, { summary: e.target.value }, { silent: true })}
              xstyle={s.summary}
            />
          </header>

          {p.archived && (
            <div {...stylex.props(s.archived)}>
              <Icon name="archive" size={16} />
              This project is archived. It's hidden from boards and goal progress.
              <span {...stylex.props(s.spacer)} />
              {!ro && (
                <Button size="sm" variant="secondary" onClick={() => actions.updateProject(p.id, { archived: false }, { silent: true })}>
                  Restore
                </Button>
              )}
            </div>
          )}
        </div>

        <div {...stylex.props(s.side)}>
          <Inspector project={p} />
        </div>

        <div {...stylex.props(s.main)}>
          <Tabs
            ariaLabel="Project sections"
            value={tab}
            onChange={(t) => go(t)}
            items={[
              { value: 'overview', label: 'Overview' },
              { value: 'updates', label: 'Updates', count: updates.length },
              { value: 'requirements', label: 'Requirements', count: req.total ? `${req.done}/${req.total}` : 0 },
              { value: 'notes', label: 'Notes', count: noteCount },
              { value: 'links', label: 'Links', count: p.links.length },
            ]}
          />

          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.08 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            >
              {tab === 'overview' && <Overview project={p} go={go} />}
              {tab === 'updates' && (
                <div {...stylex.props(s.stack)} style={{ gap: 24 }}>
                  {!ro && (
                    <Frame tag="Log an update" tagMeta="⌘↵ to save">
                      <UpdateComposer projectId={p.id} autoFocus={updates.length === 0} />
                    </Frame>
                  )}
                  <Frame tag="Version history" tagMeta={`${updates.length} entries`}>
                    {updates.length ? (
                      <Timeline updates={updates} />
                    ) : (
                      <EmptyState icon="clock" title="No history yet" compact>
                        Every update, stage change and progress change is recorded here with its date.
                      </EmptyState>
                    )}
                  </Frame>
                </div>
              )}
              {tab === 'requirements' && <RequirementsTab project={p} />}
              {tab === 'notes' && <NotesPane projectId={p.id} initialNoteId={noteId} />}
              {tab === 'links' && <LinksTab project={p} />}
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

