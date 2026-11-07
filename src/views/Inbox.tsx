import * as stylex from '@stylexjs/stylex';
import { AnimatePresence, motion as m } from 'motion/react';
import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { useRouter } from '../app/router';
import type { DataSnapshot, ID, Project, Proposal, ProposedAction } from '../data/types';
import { SOURCE_META, CONNECTORS } from '../connectors/registry';
import { LINK_KIND_META, STATUS_META, UPDATE_KIND_META } from '../lib/meta';
import { formatDate, timeAgo } from '../lib/dates';
import { TEAMS_WORKFLOW_ID, teamsChatLink } from '../lib/teams';
import { color, font, motion, radius, space, text } from '../styles/tokens.stylex';
import { EmptyState, PageHeader } from '../components/domain';
import { Tabs } from '../components/Segmented';
import { Icon, type IconName } from '../components/Icon';
import { useConfirm } from '../components/Overlay';
import { Button, Select, TextArea } from '../components/ui';

/*
 * The agent's inbox. Pending proposals wait for your OK; auto-logged ones can
 * be undone; decided ones stay for a while so you can see what happened.
 */

type InboxTab = 'pending' | 'auto' | 'done';

const RISK_ORDER = { high: 0, medium: 1, low: 2 } as const;
const RISK_LABEL = { high: 'Time-sensitive', medium: 'Changes the project', low: 'Adds to the log' } as const;
const HISTORY_DAYS = 30;

const s = stylex.create({
  page: { display: 'flex', flexDirection: 'column', gap: space.xl },
  list: { display: 'flex', flexDirection: 'column', gap: space.lg },
  toolbar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  toolbarNote: { fontSize: text.small, color: color.inkFaint, marginInlineEnd: 'auto' },

  card: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    backgroundColor: color.surface,
    boxShadow: `0 1px 2px ${color.shadow}`,
  },
  cardHigh: { borderColor: color.redline, boxShadow: `0 0 0 1px ${color.redlineSoft}, 0 1px 2px ${color.shadow}` },
  meta: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, minHeight: 22 },
  source: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: font.mono,
    fontSize: text.label,
    color: color.inkMuted,
    letterSpacing: '0.02em',
    minWidth: 0,
  },
  sourceLabel: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 },
  when: { fontFamily: font.mono, fontSize: text.label, color: color.inkFaint },
  risk: {
    marginInlineStart: 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    height: 20,
    paddingInline: 7,
    borderRadius: 3,
    fontFamily: font.mono,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
  },
  riskHigh: { color: color.redline, backgroundColor: color.redlineSoft },
  riskMedium: { color: color.warn, backgroundColor: color.warnSoft },
  riskLow: { color: color.inkMuted, backgroundColor: color.sunken },
  title: { fontFamily: font.display, fontSize: text.lead, fontWeight: 650, letterSpacing: '-0.01em', lineHeight: 1.3 },
  summary: { fontSize: text.body, color: color.inkMuted, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
  why: { display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: text.small, color: color.inkFaint },
  whyIcon: { marginTop: 2, color: color.accent, flexShrink: 0 },
  confidence: { fontFamily: font.mono, fontSize: text.label, color: color.inkMuted, whiteSpace: 'nowrap' },
  confidenceLow: { color: color.warn },

  target: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  targetLabel: {
    fontFamily: font.mono,
    fontSize: text.label,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: color.inkMuted,
  },
  targetSelect: { flex: '0 1 320px', minWidth: 200 },

  actions: {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    overflow: 'hidden',
  },
  action: {
    display: 'grid',
    gridTemplateColumns: '20px 18px minmax(0, 1fr) auto',
    alignItems: 'flex-start',
    gap: 10,
    paddingInline: space.md,
    paddingBlock: 10,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: color.line,
    backgroundColor: color.surface,
    transitionProperty: 'opacity, background-color',
    transitionDuration: motion.fast,
  },
  actionLast: { borderBottomWidth: 0 },
  actionOff: { opacity: 0.45, backgroundColor: color.sunken },
  check: {
    display: 'grid',
    placeItems: 'center',
    width: 18,
    height: 18,
    marginTop: 1,
    padding: 0,
    borderRadius: 4,
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: { default: color.lineStrong, ':hover': color.accent },
    backgroundColor: color.surface,
    color: color.accentInk,
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
    outlineOffset: 2,
  },
  checkOn: { backgroundColor: color.accent, borderColor: { default: color.accent, ':hover': color.accent } },
  actionIcon: { marginTop: 2, color: color.inkMuted },
  actionBody: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  actionLabel: { fontSize: text.ui, fontWeight: 600, color: color.ink },
  actionDetail: { fontSize: text.ui, color: color.inkMuted, lineHeight: 1.5, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' },
  actionNote: { fontSize: text.small, color: color.warn },
  footer: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  spacer: { flex: 1 },
  link: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: text.small,
    fontWeight: 550,
    color: { default: color.accent, ':hover': color.accentHover },
    textDecoration: 'none',
  },

  rows: {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    backgroundColor: color.surface,
    overflow: 'hidden',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: { default: '28px minmax(0, 1fr) auto auto', '@media (max-width: 640px)': '28px minmax(0, 1fr) auto' },
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    paddingInline: space.md,
    paddingBlock: space.sm,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: color.line,
  },
  rowIcon: {
    display: 'grid',
    placeItems: 'center',
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: color.sunken,
    color: color.inkMuted,
  },
  rowText: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  rowTitle: { fontSize: text.ui, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowSub: { fontSize: text.small, color: color.inkFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowWhen: {
    display: { default: 'block', '@media (max-width: 640px)': 'none' },
    fontFamily: font.mono,
    fontSize: text.label,
    color: color.inkFaint,
    whiteSpace: 'nowrap',
  },
  statusTag: { fontFamily: font.mono, fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: color.inkFaint },
});

/* ------------------------------------------------------------------------ */
/* Describing actions                                                        */
/* ------------------------------------------------------------------------ */

interface ActionView {
  icon: IconName;
  label: string;
  detail: string;
  /** Why it can't apply as things stand (e.g. no project chosen). */
  blocked: string | null;
}

function describe(action: ProposedAction, project: Project | null, data: DataSnapshot): ActionView {
  const needsProject = project ? null : 'Pick a project for this.';
  switch (action.type) {
    case 'log_update': {
      const changes = [
        action.statusTo && project && action.statusTo !== project.status
          ? `${STATUS_META[project.status].label} → ${STATUS_META[action.statusTo].label}`
          : '',
        action.progressTo !== null && project && action.progressTo !== project.progress
          ? `${project.progress}% → ${action.progressTo}%`
          : '',
      ].filter(Boolean);
      return {
        icon: 'clock',
        label: `Log ${UPDATE_KIND_META[action.kind].label.toLowerCase()} · ${formatDate(action.date)}${changes.length ? ` · ${changes.join(' · ')}` : ''}`,
        detail: action.text,
        blocked: null,
      };
    }
    case 'add_note':
      return { icon: 'note', label: `Save note${action.title ? `: ${action.title}` : ''}`, detail: action.body.slice(0, 280), blocked: null };
    case 'add_link':
      return { icon: 'link', label: `Add ${LINK_KIND_META[action.kind].label.toLowerCase()} link`, detail: `${action.label}\n${action.url}`, blocked: needsProject };
    case 'add_requirement':
      return { icon: 'checkSquare', label: 'Add requirement', detail: action.text, blocked: needsProject };
    case 'complete_requirement': {
      const r = project?.requirements.find((x) => x.id === action.requirementId);
      return {
        icon: 'check',
        label: 'Mark requirement done',
        detail: r?.text ?? action.text,
        blocked: project && !r ? 'That requirement isn’t on this project.' : needsProject,
      };
    }
    case 'create_project':
      return {
        icon: 'plus',
        label: 'Create project',
        detail: [
          action.title,
          action.summary,
          action.goalIds.map((g) => data.goals[g]?.title).filter(Boolean).join(', '),
          action.dueDate ? `Due ${formatDate(action.dueDate)}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        blocked: null,
      };
    case 'send_report': {
      const r = data.reports[action.reportId];
      return {
        icon: 'chat',
        label: r ? `Send “${r.title}” to ${r.recipientName || r.recipientEmail || 'your recipient'} on Teams` : 'Send weekly report',
        detail: r ? r.body.slice(0, 600) : 'This report was deleted.',
        blocked: r ? null : 'This report no longer exists.',
      };
    }
    case 'add_anchor': {
      const what = { repos: 'folder', jiraKeys: 'Jira key', keywords: 'keyword', channels: 'channel' }[action.field];
      return { icon: 'radar', label: `Track this ${what} for the project from now on`, detail: action.value, blocked: needsProject };
    }
  }
}

/* ------------------------------------------------------------------------ */
/* Pending card                                                              */
/* ------------------------------------------------------------------------ */

function ProposalCard({ proposal: p }: { proposal: Proposal }) {
  const { data, actions, meta } = useStore();
  const createsProject = p.actions.some((a) => a.type === 'create_project');
  // A weekly report isn't about one project, so there's nothing to pick.
  const onlyReport = p.actions.every((a) => a.type === 'send_report');
  const [projectId, setProjectId] = useState<ID | null>(p.projectId);
  const [included, setIncluded] = useState<boolean[]>(() => p.actions.map(() => true));
  const [texts, setTexts] = useState<Record<number, string>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const project = projectId ? (data.projects[projectId] ?? null) : null;
  const createIncluded = p.actions.some((a, i) => a.type === 'create_project' && included[i]);
  // A project the proposal creates stands in for the chosen one.
  const effectiveProject: Project | null = createIncluded ? ({ ...placeholderProject } as Project) : project;
  const views = p.actions.map((a) => describe(a, effectiveProject, data));
  const source = SOURCE_META[p.source.kind];
  const projects = useMemo(
    () => Object.values(data.projects).filter((x) => !x.archived).sort((a, b) => a.title.localeCompare(b.title)),
    [data.projects],
  );

  const chosen = (): ProposedAction[] =>
    p.actions
      .map((a, i) => (a.type === 'log_update' && texts[i] !== undefined ? { ...a, text: texts[i].trim() || a.text } : a))
      .filter((_, i) => included[i] && !views[i].blocked);

  const canApprove = chosen().length > 0 && !meta.readOnly;
  const reportAction = p.actions.find((a) => a.type === 'send_report');
  const report = reportAction && reportAction.type === 'send_report' ? data.reports[reportAction.reportId] : undefined;
  const reportLink = report ? teamsChatLink(report.recipientEmail, report.body) : null;
  const workflowReady = data.connectors[TEAMS_WORKFLOW_ID]?.lastStatus === 'ok';

  return (
    <m.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      aria-label={p.title}
      {...stylex.props(s.card, p.risk === 'high' && s.cardHigh)}
    >
      <div {...stylex.props(s.meta)}>
        <span {...stylex.props(s.source)}>
          <Icon name={source.icon} size={13} />
          <span {...stylex.props(s.sourceLabel)}>
            {source.label}
            {p.source.label ? ` · ${p.source.label}` : ''}
          </span>
        </span>
        <span {...stylex.props(s.when)}>{timeAgo(p.source.occurredAt)}</span>
        <span {...stylex.props(s.risk, p.risk === 'high' ? s.riskHigh : p.risk === 'medium' ? s.riskMedium : s.riskLow)}>
          {RISK_LABEL[p.risk]}
        </span>
      </div>

      <div>
        <h3 {...stylex.props(s.title)}>{p.title}</h3>
      </div>
      {p.summary && <p {...stylex.props(s.summary)}>{p.summary}</p>}
      {p.why && (
        <p {...stylex.props(s.why)}>
          <span {...stylex.props(s.whyIcon)}>
            <Icon name="sparkles" size={12} />
          </span>
          <span>
            {p.why}{' '}
            <span {...stylex.props(s.confidence, p.confidence < 0.7 && s.confidenceLow)}>· {Math.round(p.confidence * 100)}% match</span>
          </span>
        </p>
      )}

      {!createIncluded && !onlyReport && (
        <label {...stylex.props(s.target)}>
          <span {...stylex.props(s.targetLabel)}>Log to</span>
          <Select
            compact
            aria-label="Project"
            value={projectId ?? ''}
            onChange={(e) => setProjectId(e.target.value || null)}
            xstyle={s.targetSelect}
          >
            <option value="">{createsProject ? 'Choose a project' : 'General journal (no project)'}</option>
            {projects.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </Select>
        </label>
      )}

      <div {...stylex.props(s.actions)} role="group" aria-label="Changes to apply">
        {p.actions.map((a, i) => {
          const v = views[i];
          const on = included[i] && !v.blocked;
          const isText = a.type === 'log_update';
          return (
            <div key={i} {...stylex.props(s.action, i === p.actions.length - 1 && s.actionLast, !on && s.actionOff)}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={`Include: ${v.label}`}
                disabled={!!v.blocked}
                onClick={() => setIncluded((list) => list.map((x, j) => (j === i ? !x : x)))}
                {...stylex.props(s.check, on && s.checkOn)}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <m.path
                    d="M2.5 6.3 5 8.6 9.5 3.6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={false}
                    animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
                    transition={{ duration: 0.18 }}
                  />
                </svg>
              </button>
              <span {...stylex.props(s.actionIcon)}>
                <Icon name={v.icon} size={14} />
              </span>
              <div {...stylex.props(s.actionBody)}>
                <span {...stylex.props(s.actionLabel)}>{v.label}</span>
                {isText && editing === i ? (
                  <TextArea
                    aria-label="Edit the update"
                    autoFocus
                    minRows={2}
                    value={texts[i] ?? a.text}
                    onChange={(e) => setTexts((t) => ({ ...t, [i]: e.target.value }))}
                  />
                ) : (
                  <span {...stylex.props(s.actionDetail)}>{isText ? (texts[i] ?? v.detail) : v.detail}</span>
                )}
                {v.blocked && <span {...stylex.props(s.actionNote)}>{v.blocked}</span>}
              </div>
              {isText && !meta.readOnly ? (
                <Button size="sm" variant="ghost" onClick={() => setEditing(editing === i ? null : i)}>
                  {editing === i ? 'Done' : 'Edit'}
                </Button>
              ) : (
                <span />
              )}
            </div>
          );
        })}
      </div>

      <div {...stylex.props(s.footer)}>
        {report && reportLink && report.status !== 'sent' && (
          <a href={reportLink} target="_blank" rel="noopener noreferrer" {...stylex.props(s.link)}>
            <Icon name="chat" size={12} /> Open Teams chat with {report.recipientName || report.recipientEmail}
          </a>
        )}
        {report && report.status !== 'sent' && !meta.readOnly && (
          <Button size="sm" variant="ghost" onClick={() => actions.markReportSent(report.id)}>
            I sent it
          </Button>
        )}
        {p.source.url && (
          <a href={p.source.url} target="_blank" rel="noopener noreferrer" {...stylex.props(s.link)}>
            Open in {source.label} <Icon name="external" size={12} />
          </a>
        )}
        <span {...stylex.props(s.spacer)} />
        {!meta.readOnly && (
          <>
            <Button variant="ghost" onClick={() => actions.dismissProposal(p.id)}>
              Dismiss
            </Button>
            <Button
              variant="primary"
              icon="check"
              disabled={!canApprove}
              onClick={() => actions.approveProposal(p.id, { projectId, actions: chosen() })}
              title={report && !workflowReady ? 'Set up a Teams workflow so the agent can send it, or use the Teams chat link.' : undefined}
            >
              {report ? (workflowReady ? 'Approve and send' : 'Approve') : 'Approve'}
            </Button>
          </>
        )}
      </div>
    </m.article>
  );
}

/** Stands in for a project a proposal will create, so its actions read as applicable. */
const placeholderProject = {
  id: '__new',
  status: 'discovery',
  progress: 0,
  requirements: [],
  links: [],
} as unknown as Project;

/* ------------------------------------------------------------------------ */
/* History rows                                                              */
/* ------------------------------------------------------------------------ */

function HistoryRow({ proposal: p }: { proposal: Proposal }) {
  const { data, actions, meta } = useStore();
  const { navigate } = useRouter();
  const source = SOURCE_META[p.source.kind];
  const project = p.projectId ? data.projects[p.projectId] : null;
  const label = { pending: 'Waiting', approved: 'Approved', dismissed: 'Dismissed', auto: 'Auto-logged', undone: 'Undone' }[p.status];
  return (
    <m.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      {...stylex.props(s.row)}
    >
      <span {...stylex.props(s.rowIcon)} title={source.label}>
        <Icon name={source.icon} size={14} />
      </span>
      <span {...stylex.props(s.rowText)}>
        <span {...stylex.props(s.rowTitle)}>{p.title}</span>
        <span {...stylex.props(s.rowSub)}>
          <span {...stylex.props(s.statusTag)}>{label}</span> · {project ? project.title : 'No project'}
          {p.source.label ? ` · ${source.label} ${p.source.label}` : ` · ${source.label}`}
        </span>
      </span>
      <span {...stylex.props(s.rowWhen)}>{timeAgo(p.source.occurredAt)}</span>
      <span style={{ display: 'inline-flex', gap: 4 }}>
        {project && p.status !== 'dismissed' && p.status !== 'undone' && (
          <Button size="sm" variant="ghost" onClick={() => navigate({ name: 'project', id: project.id, tab: 'updates' })}>
            View
          </Button>
        )}
        {!meta.readOnly && (p.status === 'auto' || p.status === 'approved') && (
          <Button size="sm" variant="secondary" icon="undo" onClick={() => actions.undoProposal(p.id)}>
            Undo
          </Button>
        )}
        {!meta.readOnly && p.status === 'dismissed' && (
          <Button size="sm" variant="secondary" onClick={() => actions.restoreProposal(p.id)}>
            Restore
          </Button>
        )}
      </span>
    </m.div>
  );
}

/* ------------------------------------------------------------------------ */
/* View                                                                      */
/* ------------------------------------------------------------------------ */

export function InboxView() {
  const { data, actions, meta } = useStore();
  const { navigate } = useRouter();
  const [tab, setTab] = useState<InboxTab>('pending');
  const approveAll = useConfirm();
  const cutoff = Date.now() - HISTORY_DAYS * 86_400_000;

  const all = Object.values(data.inbox);
  const pending = all
    .filter((p) => p.status === 'pending')
    .sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || b.source.occurredAt.localeCompare(a.source.occurredAt));
  const auto = all
    .filter((p) => p.status === 'auto' && Date.parse(p.createdAt) >= cutoff)
    .sort((a, b) => b.source.occurredAt.localeCompare(a.source.occurredAt));
  const done = all
    .filter((p) => (p.status === 'approved' || p.status === 'dismissed' || p.status === 'undone') && Date.parse(p.decidedAt ?? p.updatedAt) >= cutoff)
    .sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''));

  const lastRun = Object.values(data.connectors)
    .map((c) => c.lastRunAt)
    .filter((x): x is string => !!x)
    .sort()
    .pop();
  const anyConnected = CONNECTORS.some((c) => data.connectors[c.id]?.lastRunAt);
  // One-click approval is only offered where every action already has a home.
  const readyToApprove = pending.filter(
    (p) => p.projectId && data.projects[p.projectId] && !p.actions.some((a) => a.type === 'create_project'),
  );

  return (
    <div {...stylex.props(s.page)}>
      <PageHeader
        eyebrow={lastRun ? `Workfile Agent · last sync ${timeAgo(lastRun)}` : 'Workfile Agent · not connected yet'}
        title="Inbox"
        sub="What the agent noticed in your tools. Small things log themselves; anything that changes a project waits here for your OK."
        actions={
          <Button variant="secondary" icon="plug" onClick={() => navigate({ name: 'connections' })}>
            Connections
          </Button>
        }
      />

      <Tabs
        ariaLabel="Inbox sections"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'pending', label: 'Needs your OK', count: pending.length },
          { value: 'auto', label: 'Auto-logged', count: auto.length },
          { value: 'done', label: 'Done', count: done.length },
        ]}
      />

      <AnimatePresence mode="wait" initial={false}>
        <m.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.08 } }}>
          {tab === 'pending' &&
            (pending.length ? (
              <div {...stylex.props(s.list)}>
                {readyToApprove.length > 1 && !meta.readOnly && (
                  <div {...stylex.props(s.toolbar)}>
                    <span {...stylex.props(s.toolbarNote)}>
                      {readyToApprove.length} proposals already have a project. You can approve them as they are.
                    </span>
                    <Button
                      variant={approveAll.armed ? 'primary' : 'secondary'}
                      icon="check"
                      onClick={() => {
                        if (!approveAll.trigger()) return;
                        for (const p of readyToApprove) actions.approveProposal(p.id, { projectId: p.projectId, actions: p.actions });
                      }}
                    >
                      {approveAll.armed ? `Click again to approve ${readyToApprove.length}` : `Approve ${readyToApprove.length} as suggested`}
                    </Button>
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {pending.map((p) => (
                    <ProposalCard key={p.id} proposal={p} />
                  ))}
                </AnimatePresence>
              </div>
            ) : anyConnected ? (
              <EmptyState icon="check" title="All caught up">
                Nothing is waiting for you. The agent last checked your tools {lastRun ? timeAgo(lastRun) : 'recently'}.
              </EmptyState>
            ) : (
              <EmptyState
                icon="inbox"
                title="The agent hasn’t run yet"
                actions={
                  <Button variant="primary" icon="plug" onClick={() => navigate({ name: 'connections' })}>
                    Set up Connections
                  </Button>
                }
              >
                Once the Workfile Agent is installed on your Mac, it reads your Claude Code sessions (and later Figma, Jira and Microsoft 365)
                and files what it finds here.
              </EmptyState>
            ))}

          {tab === 'auto' &&
            (auto.length ? (
              <div {...stylex.props(s.rows)}>
                <AnimatePresence initial={false}>
                  {auto.map((p) => (
                    <HistoryRow key={p.id} proposal={p} />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <EmptyState icon="clock" title="Nothing auto-logged in the last 30 days" compact>
                Low-risk entries the agent logs on its own show up here, each with Undo.
              </EmptyState>
            ))}

          {tab === 'done' &&
            (done.length ? (
              <div {...stylex.props(s.rows)}>
                <AnimatePresence initial={false}>
                  {done.map((p) => (
                    <HistoryRow key={p.id} proposal={p} />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <EmptyState icon="check" title="No decisions in the last 30 days" compact>
                Proposals you approve or dismiss are listed here.
              </EmptyState>
            ))}
        </m.div>
      </AnimatePresence>
    </div>
  );
}

