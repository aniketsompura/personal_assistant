import * as stylex from '@stylexjs/stylex';
import { AnimatePresence, motion as m } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import { useStore } from '../data/store';
import { PROJECT_STATUSES, UPDATE_KINDS, type ID, type ProjectStatus, type Update, type UpdateKind } from '../data/types';
import { formatMonth, formatWeekday, parseDate, relativeDays, todayISO } from '../lib/dates';
import { STATUS_META, UPDATE_KIND_META } from '../lib/meta';
import { assistantError, suggestFromUpdate, useAssistant, type UpdateSuggestion } from '../lib/assistant';
import { newId } from '../lib/ids';
import { nowISO } from '../lib/dates';
import { color, font, motion, radius, space, text } from '../styles/tokens.stylex';
import { Icon } from './Icon';
import { ProgressSlider } from './Progress';
import { Button, Dot, IconButton, Select, TextArea, TextInput } from './ui';
import { useToast } from './Toast';
import { useRouter } from '../app/router';

const UPDATE_PLACEHOLDER: Record<UpdateKind, string> = {
  progress: 'What moved? e.g. Finished the empty-state explorations; reviewing with PM tomorrow.',
  decision: 'What did you decide, and why? e.g. Going with a bottom sheet over a modal for enrollment.',
  feedback: 'What feedback came in, and from whom? e.g. Support says admins miss the bulk-action menu.',
  blocker: "What's in the way, and what do you need? e.g. Waiting on API field names from the platform team.",
  milestone: 'What did you reach? e.g. Usability test with 6 IT admins complete.',
  status: '',
};

/* ------------------------------------------------------------------------ */
/* Composer                                                                  */
/* ------------------------------------------------------------------------ */

const comp = stylex.create({
  root: { display: 'flex', flexDirection: 'column', gap: space.md },
  kinds: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  kind: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 26,
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
    transitionProperty: 'background-color, border-color, color, transform',
    transitionDuration: motion.fast,
    transform: { default: null, ':active': 'scale(0.95)' },
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
  },
  kindOn: { borderColor: color.ink, color: color.ink, backgroundColor: color.sunken },
  row: { display: 'flex', flexWrap: 'wrap', gap: space.md, alignItems: 'center' },
  ctl: { display: 'flex', alignItems: 'center', gap: space.sm, minWidth: 0 },
  ctlLabel: {
    fontFamily: font.mono,
    fontSize: text.label,
    color: color.inkMuted,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  date: { width: 150 },
  progressCtl: { flex: '1 1 220px', minWidth: 180 },
  pct: { fontFamily: font.mono, fontSize: text.small, fontVariantNumeric: 'tabular-nums', minWidth: 72, textAlign: 'end' },
  pctChanged: { color: color.accent, fontWeight: 600 },
  status: { flex: '0 1 180px', minWidth: 150 },
  footer: { display: 'flex', flexWrap: 'wrap', gap: space.sm, alignItems: 'center', justifyContent: 'flex-end' },
  hint: { marginInlineEnd: 'auto', fontSize: text.small, color: color.inkFaint },
  project: { flex: '1 1 220px' },
  suggest: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: color.accentSoft,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.accentSoft,
  },
  suggestHead: { display: 'flex', alignItems: 'center', gap: space.sm, fontSize: text.small, fontWeight: 600, color: color.accent },
  suggestList: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  suggestion: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    minHeight: 26,
    paddingInline: 10,
    paddingBlock: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.accent,
    backgroundColor: color.surface,
    color: color.ink,
    fontSize: text.small,
    textAlign: 'start',
    cursor: 'pointer',
    transitionProperty: 'opacity, background-color',
    transitionDuration: motion.fast,
  },
  suggestionOff: { opacity: 0.5, borderColor: color.line, textDecoration: 'line-through' },
  tidy: { fontSize: text.small, color: color.inkMuted, fontStyle: 'italic' },
  thinking: { display: 'flex', alignItems: 'center', gap: space.sm, fontSize: text.small, color: color.accent },
});

interface Props {
  /** Fixes the project; omit to show a project picker (journal, quick capture). */
  projectId?: ID | null;
  onLogged?: (u: Update) => void;
  autoFocus?: boolean;
}

export function UpdateComposer({ projectId: fixedProject, onLogged, autoFocus }: Props) {
  const { data, actions, meta } = useStore();
  const toast = useToast();
  const { navigate } = useRouter();
  const sample = useAssistant();
  const pickProject = fixedProject === undefined;
  const [projectId, setProjectId] = useState<ID | null>(fixedProject ?? null);
  const project = projectId ? data.projects[projectId] : null;
  const [kind, setKind] = useState<UpdateKind>('progress');
  const [draft, setDraft] = useState('');
  const [date, setDate] = useState(todayISO());
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [justLogged, setJustLogged] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [suggestion, setSuggestion] = useState<UpdateSuggestion | null>(null);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const ctl = useRef<AbortController | null>(null);

  const activeProjects = useMemo(
    () => Object.values(data.projects).filter((p) => !p.archived).sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)),
    [data.projects],
  );

  const currentProgress = project?.progress ?? 0;
  const shownProgress = progress ?? currentProgress;

  const reset = () => {
    setDraft('');
    setProgress(null);
    setStatus('');
    setKind('progress');
    setSuggestion(null);
    setAccepted({});
    setDate(todayISO());
  };

  const suggestionItems = useMemo(() => {
    if (!suggestion || !project) return [];
    const list: { key: string; label: string; apply: () => void }[] = [];
    if (suggestion.kind && suggestion.kind !== kind)
      list.push({ key: 'kind', label: `Type: ${UPDATE_KIND_META[suggestion.kind].label}`, apply: () => setKind(suggestion.kind!) });
    if (suggestion.progress !== null)
      list.push({ key: 'progress', label: `Progress → ${suggestion.progress}%`, apply: () => setProgress(suggestion.progress) });
    if (suggestion.status)
      list.push({ key: 'status', label: `Move to ${STATUS_META[suggestion.status].label}`, apply: () => setStatus(suggestion.status!) });
    for (const id of suggestion.completedRequirementIds) {
      const r = project.requirements.find((x) => x.id === id);
      if (r) list.push({ key: `done:${id}`, label: `Mark done: ${r.text}`, apply: () => undefined });
    }
    suggestion.newRequirements.forEach((t, i) =>
      list.push({ key: `new:${i}`, label: `Add requirement: ${t}`, apply: () => undefined }),
    );
    if (suggestion.tidy) list.push({ key: 'tidy', label: 'Use the tidied wording', apply: () => setDraft(suggestion.tidy!) });
    return list;
  }, [suggestion, project, kind]);

  const askClaude = async () => {
    if (!sample || !project || !draft.trim()) return;
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setThinking(true);
    setSuggestion(null);
    try {
      const s = await suggestFromUpdate(sample, project, draft, c.signal);
      setSuggestion(s);
      const on: Record<string, boolean> = {};
      if (s.kind) on.kind = true;
      if (s.progress !== null) on.progress = true;
      if (s.status) on.status = true;
      s.completedRequirementIds.forEach((id) => (on[`done:${id}`] = true));
      s.newRequirements.forEach((_, i) => (on[`new:${i}`] = false));
      if (s.tidy) on.tidy = false;
      setAccepted(on);
      if (!s.kind && s.progress === null && !s.status && !s.completedRequirementIds.length && !s.newRequirements.length && !s.tidy) {
        toast({ message: 'Claude has no changes to suggest for this update.', icon: 'sparkles' });
      }
    } catch (e) {
      const msg = assistantError(e);
      if (msg) toast({ message: msg, tone: 'error', duration: 6000 });
    } finally {
      if (ctl.current === c) setThinking(false);
    }
  };

  const applySuggestions = () => {
    for (const item of suggestionItems) if (accepted[item.key]) item.apply();
  };

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    applySuggestionSideEffects();
    const u = actions.addUpdate({
      projectId,
      date,
      text,
      kind,
      progressTo: project && progress !== null ? progress : null,
      statusTo: project && status ? status : null,
    });
    setJustLogged(true);
    setTimeout(() => setJustLogged(false), 1400);
    toast({
      message: project ? `Logged to ${project.title}` : 'Logged to your journal',
      tone: 'good',
      action: pickProject && project ? { label: 'Open', onClick: () => navigate({ name: 'project', id: project.id, tab: 'updates' }) } : undefined,
    });
    reset();
    onLogged?.(u);
  };

  /** Requirement changes from accepted suggestions are written alongside the update. */
  const applySuggestionSideEffects = () => {
    if (!suggestion || !project) return;
    const done = new Set(suggestion.completedRequirementIds.filter((id) => accepted[`done:${id}`]));
    const added = suggestion.newRequirements.filter((_, i) => accepted[`new:${i}`]);
    if (!done.size && !added.length) return;
    const now = nowISO();
    actions.updateProject(
      project.id,
      {
        requirements: [
          ...project.requirements.map((r) => (done.has(r.id) ? { ...r, done: true } : r)),
          ...added.map((t) => ({ id: newId('r'), text: t, done: false, level: 'should' as const, createdAt: now })),
        ],
      },
      { silent: true },
    );
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  const disabled = meta.readOnly;

  return (
    <div {...stylex.props(comp.root)} onKeyDown={onKeyDown}>
      {pickProject && (
        <div {...stylex.props(comp.row)}>
          <Select
            id="composer-project"
            aria-label="Project"
            value={projectId ?? ''}
            onChange={(e) => {
              setProjectId(e.target.value || null);
              setProgress(null);
              setStatus('');
              setSuggestion(null);
            }}
            xstyle={comp.project}
          >
            <option value="">General journal (no project)</option>
            {activeProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div role="radiogroup" aria-label="Type of update" {...stylex.props(comp.kinds)}>
        {UPDATE_KINDS.filter((k) => k !== 'status').map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            {...stylex.props(comp.kind, kind === k && comp.kindOn)}
          >
            <Dot hex={UPDATE_KIND_META[k].hex} />
            {UPDATE_KIND_META[k].label}
          </button>
        ))}
      </div>

      <TextArea
        id={`composer-text-${fixedProject ?? 'any'}`}
        aria-label="Update"
        value={draft}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={UPDATE_PLACEHOLDER[kind]}
        onChange={(e) => setDraft(e.target.value)}
        minRows={3}
      />

      <div {...stylex.props(comp.row)}>
        <label {...stylex.props(comp.ctl)}>
          <span {...stylex.props(comp.ctlLabel)}>Date</span>
          <TextInput
            type="date"
            compact
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value || todayISO())}
            xstyle={comp.date}
          />
        </label>
        {project && (
          <>
            <div {...stylex.props(comp.ctl, comp.progressCtl)}>
              <span {...stylex.props(comp.ctlLabel)}>Progress</span>
              <ProgressSlider
                value={shownProgress}
                from={currentProgress}
                onChange={(v) => setProgress(v === currentProgress ? null : v)}
                label="New progress"
              />
              <span {...stylex.props(comp.pct, progress !== null && comp.pctChanged)}>
                {progress !== null ? `${currentProgress}→${progress}%` : `${currentProgress}%`}
              </span>
            </div>
            <Select
              compact
              aria-label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus | '')}
              xstyle={comp.status}
            >
              <option value="">Keep status · {STATUS_META[project.status].label}</option>
              {PROJECT_STATUSES.filter((s) => s !== project.status).map((s) => (
                <option key={s} value={s}>
                  Move to {STATUS_META[s].label}
                </option>
              ))}
            </Select>
          </>
        )}
      </div>

      <AnimatePresence initial={false}>
        {(thinking || suggestion) && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            style={{ overflow: 'hidden' }}
          >
            <div {...stylex.props(comp.suggest)}>
              {thinking ? (
                <div {...stylex.props(comp.thinking)}>
                  <m.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }}>
                    <Icon name="sparkles" size={14} />
                  </m.span>
                  Reading your update…
                  <Button size="sm" variant="ghost" onClick={() => ctl.current?.abort()}>
                    Stop
                  </Button>
                </div>
              ) : suggestionItems.length ? (
                <>
                  <div {...stylex.props(comp.suggestHead)}>
                    <Icon name="sparkles" size={14} />
                    Suggested changes. Tap to include or skip each one.
                  </div>
                  <div {...stylex.props(comp.suggestList)}>
                    {suggestionItems.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        aria-pressed={!!accepted[s.key]}
                        onClick={() => setAccepted((a) => ({ ...a, [s.key]: !a[s.key] }))}
                        {...stylex.props(comp.suggestion, !accepted[s.key] && comp.suggestionOff)}
                      >
                        <Icon name={accepted[s.key] ? 'check' : 'plus'} size={12} />
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {suggestion?.tidy && accepted.tidy && <p {...stylex.props(comp.tidy)}>“{suggestion.tidy}”</p>}
                  <div {...stylex.props(comp.footer)}>
                    <Button size="sm" variant="ghost" onClick={() => setSuggestion(null)}>
                      Dismiss
                    </Button>
                    <Button size="sm" variant="primary" icon="check" onClick={applySuggestions}>
                      Apply to this update
                    </Button>
                  </div>
                </>
              ) : (
                <div {...stylex.props(comp.thinking)}>No changes suggested.</div>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <div {...stylex.props(comp.footer)}>
        <span {...stylex.props(comp.hint)}>⌘↵ to log</span>
        {sample && project && (
          <Button variant="ghost" icon="sparkles" disabled={!draft.trim() || thinking} onClick={askClaude}>
            Suggest changes
          </Button>
        )}
        <Button variant="primary" disabled={!draft.trim() || disabled} onClick={submit}>
          <AnimatePresence mode="wait" initial={false}>
            <m.span
              key={justLogged ? 'done' : 'idle'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {justLogged ? <Icon name="check" size={16} /> : <Icon name="plus" size={16} />}
              {justLogged ? 'Logged' : 'Log update'}
            </m.span>
          </AnimatePresence>
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Timeline: version history of a project (or the whole journal)             */
/* ------------------------------------------------------------------------ */

const tl = stylex.create({
  root: { display: 'flex', flexDirection: 'column', gap: space.lg },
  month: {
    fontFamily: font.mono,
    fontSize: text.label,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: color.inkFaint,
    paddingInlineStart: 36,
  },
  list: { position: 'relative', display: 'flex', flexDirection: 'column' },
  rail: {
    position: 'absolute',
    left: 11,
    top: 10,
    bottom: 10,
    width: 1,
    backgroundColor: color.line,
  },
  item: {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: '24px minmax(0, 1fr)',
    columnGap: space.md,
    paddingBlock: 10,
  },
  node: {
    position: 'relative',
    zIndex: 1,
    marginTop: 3,
    width: 23,
    height: 23,
    display: 'grid',
    placeItems: 'center',
    borderRadius: '50%',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
  },
  nodeDot: { width: 9, height: 9, borderRadius: '50%' },
  nodeColor: (c: string) => ({ backgroundColor: c }),
  body: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  meta: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, minHeight: 26 },
  version: {
    fontFamily: font.mono,
    fontSize: 10,
    fontWeight: 600,
    color: color.inkFaint,
    paddingInline: 5,
    height: 18,
    display: 'inline-grid',
    placeItems: 'center',
    borderRadius: radius.xs,
    backgroundColor: color.sunken,
  },
  date: { fontFamily: font.mono, fontSize: text.small, color: color.inkMuted, fontVariantNumeric: 'tabular-nums' },
  kind: { fontSize: text.small, fontWeight: 600 },
  kindColor: (c: string) => ({ color: c }),
  project: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    maxWidth: 240,
    fontSize: text.small,
    color: { default: color.inkMuted, ':hover': color.accent },
    borderWidth: 0,
    backgroundColor: 'transparent',
    padding: 0,
    cursor: 'pointer',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  auto: { fontSize: text.small, color: color.inkFaint, fontStyle: 'italic' },
  text: { fontSize: text.body, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: color.ink },
  changes: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  change: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 22,
    paddingInline: 8,
    borderRadius: radius.xs,
    backgroundColor: color.sunken,
    fontFamily: font.mono,
    fontSize: text.label,
    color: color.inkMuted,
    fontVariantNumeric: 'tabular-nums',
  },
  arrow: { color: color.inkFaint },
  actions: {
    position: 'absolute',
    top: 8,
    right: 0,
    display: 'flex',
    gap: 2,
    opacity: {
      default: 0,
      [stylex.when.ancestor(':hover')]: 1,
      [stylex.when.ancestor(':focus-within')]: 1,
      '@media (hover: none)': 1,
    },
    transitionProperty: 'opacity',
    transitionDuration: motion.fast,
  },
  editRow: { display: 'flex', gap: space.sm, justifyContent: 'flex-end' },
});

export function Timeline({
  updates,
  showProject,
  numbered = true,
}: {
  updates: Update[];
  showProject?: boolean;
  numbered?: boolean;
}) {
  const { data, actions, meta } = useStore();
  const { navigate } = useRouter();
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  // Version numbers count up from the oldest entry.
  const version = useMemo(() => {
    const map = new Map<string, number>();
    [...updates].reverse().forEach((u, i) => map.set(u.id, i + 1));
    return map;
  }, [updates]);

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: Update[] }[] = [];
    for (const u of updates) {
      const d = parseDate(u.date) ?? new Date();
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: formatMonth(d), items: [] };
        out.push(g);
      }
      g.items.push(u);
    }
    return out;
  }, [updates]);

  return (
    <div {...stylex.props(tl.root)}>
      {groups.map((g) => (
        <section key={g.key} aria-label={g.label}>
          <div {...stylex.props(tl.month)}>{g.label}</div>
          <div {...stylex.props(tl.list)}>
            <span aria-hidden="true" {...stylex.props(tl.rail)} />
            <AnimatePresence initial={false}>
              {g.items.map((u) => {
                const kindMeta = UPDATE_KIND_META[u.kind];
                const project = u.projectId ? data.projects[u.projectId] : null;
                const isEditing = editing?.id === u.id;
                return (
                  <m.article
                    key={u.id}
                    layout="position"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0, paddingBlock: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    {...stylex.props(tl.item, stylex.defaultMarker())}
                  >
                    <span {...stylex.props(tl.node)}>
                      <span {...stylex.props(tl.nodeDot, tl.nodeColor(kindMeta.hex))} />
                    </span>
                    <div {...stylex.props(tl.body)}>
                      <div {...stylex.props(tl.meta)}>
                        {numbered && <span {...stylex.props(tl.version)}>v{version.get(u.id)}</span>}
                        <time dateTime={u.date} title={relativeDays(u.date)} {...stylex.props(tl.date)}>
                          {formatWeekday(u.date)}
                        </time>
                        <span {...stylex.props(tl.kind, tl.kindColor(kindMeta.hex))}>{kindMeta.label}</span>
                        {showProject && (
                          project ? (
                            <button
                              type="button"
                              onClick={() => navigate({ name: 'project', id: project.id, tab: 'updates' })}
                              {...stylex.props(tl.project)}
                            >
                              <Icon name="projects" size={12} />
                              {project.title}
                            </button>
                          ) : (
                            <span {...stylex.props(tl.auto)}>General</span>
                          )
                        )}
                        {u.auto && <span {...stylex.props(tl.auto)}>logged automatically</span>}
                      </div>

                      {isEditing ? (
                        <>
                          <TextArea
                            aria-label="Edit update"
                            value={editing.text}
                            autoFocus
                            onChange={(e) => setEditing({ id: u.id, text: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setEditing(null);
                              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                actions.editUpdate(u.id, { text: editing.text.trim() });
                                setEditing(null);
                              }
                            }}
                          />
                          <div {...stylex.props(tl.editRow)}>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => {
                                actions.editUpdate(u.id, { text: editing.text.trim() });
                                setEditing(null);
                              }}
                            >
                              Save
                            </Button>
                          </div>
                        </>
                      ) : (
                        u.text && <p {...stylex.props(tl.text)}>{u.text}</p>
                      )}

                      {(u.statusTo || u.progressTo !== null) && (
                        <div {...stylex.props(tl.changes)}>
                          {u.statusTo && (
                            <span {...stylex.props(tl.change)}>
                              {u.statusFrom && (
                                <>
                                  <Dot hex={STATUS_META[u.statusFrom].hex} />
                                  {STATUS_META[u.statusFrom].label}
                                  <span {...stylex.props(tl.arrow)}>→</span>
                                </>
                              )}
                              <Dot hex={STATUS_META[u.statusTo].hex} />
                              {STATUS_META[u.statusTo].label}
                            </span>
                          )}
                          {u.progressTo !== null && (
                            <span {...stylex.props(tl.change)}>
                              {u.progressFrom ?? 0}%<span {...stylex.props(tl.arrow)}>→</span>
                              {u.progressTo}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {!isEditing && !meta.readOnly && (
                      <div {...stylex.props(tl.actions)}>
                        {!u.auto && (
                          <IconButton icon="edit" label="Edit update" size="sm" onClick={() => setEditing({ id: u.id, text: u.text })} />
                        )}
                        <IconButton icon="trash" label="Delete update" size="sm" onClick={() => actions.deleteUpdate(u.id)} />
                      </div>
                    )}
                  </m.article>
                );
              })}
            </AnimatePresence>
          </div>
        </section>
      ))}
    </div>
  );
}
