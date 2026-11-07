import * as stylex from '@stylexjs/stylex';
import { AnimatePresence, motion as m } from 'motion/react';
import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { useRouter } from '../app/router';
import type { Report } from '../data/types';
import { formatDate, timeAgo } from '../lib/dates';
import { TEAMS_WORKFLOW_ID, WEEKDAYS, teamsChatLink } from '../lib/teams';
import { color, font, radius, space, text } from '../styles/tokens.stylex';
import { EmptyState } from '../components/domain';
import { Markdown } from '../components/Markdown';
import { Icon } from '../components/Icon';
import { useConfirm } from '../components/Overlay';
import { Button, TextArea } from '../components/ui';
import { useToast } from '../components/Toast';

/*
 * Weekly reports the agent drafted. Review, edit, then send: through your
 * Teams workflow (the agent sends it) or a pre-filled Teams chat (you send it).
 */

const STATUS_COPY: Record<Report['status'], string> = {
  draft: 'Draft · waiting for you',
  approved: 'Approved · the agent sends it on its next run',
  sent: 'Sent',
  failed: 'Couldn’t send',
};

const s = stylex.create({
  root: {
    display: 'grid',
    gridTemplateColumns: { default: '260px minmax(0, 1fr)', '@media (max-width: 760px)': 'minmax(0, 1fr)' },
    gap: space.lg,
    alignItems: 'start',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 4 },
  item: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    width: '100%',
    paddingInline: space.md,
    paddingBlock: 10,
    borderWidth: 0,
    borderRadius: radius.sm,
    backgroundColor: { default: 'transparent', ':hover': color.hover },
    color: 'inherit',
    textAlign: 'start',
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
  },
  activeBg: {
    position: 'absolute',
    inset: 0,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    boxShadow: `0 1px 2px ${color.shadow}, 0 0 0 1px ${color.accent}`,
  },
  itemTitle: { position: 'relative', fontSize: text.ui, fontWeight: 600 },
  itemSub: { position: 'relative', fontFamily: font.mono, fontSize: 10.5, color: color.inkFaint },
  dot: { position: 'relative', display: 'inline-block', width: 7, height: 7, borderRadius: '50%', marginInlineEnd: 6 },
  dotDraft: { backgroundColor: color.warn },
  dotApproved: { backgroundColor: color.accent },
  dotSent: { backgroundColor: color.good },
  dotFailed: { backgroundColor: color.redline },

  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.lg,
    padding: space.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    backgroundColor: color.surface,
    boxShadow: `0 1px 2px ${color.shadow}`,
    minWidth: 0,
  },
  head: { display: 'flex', flexDirection: 'column', gap: 4 },
  title: { fontFamily: font.display, fontSize: text.h3, fontWeight: 650, letterSpacing: '-0.01em' },
  sub: { fontSize: text.small, color: color.inkMuted },
  status: {
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    height: 22,
    paddingInline: 8,
    borderRadius: 3,
    fontFamily: font.mono,
    fontSize: 10.5,
    fontWeight: 600,
  },
  statusDraft: { color: color.warn, backgroundColor: color.warnSoft },
  statusApproved: { color: color.accent, backgroundColor: color.accentSoft },
  statusSent: { color: color.good, backgroundColor: color.goodSoft },
  statusFailed: { color: color.redline, backgroundColor: color.redlineSoft },
  body: { paddingBlock: space.sm, borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: color.line },
  edit: { minHeight: 280, fontSize: text.body, lineHeight: 1.65 },
  actions: { display: 'flex', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  spacer: { flex: 1 },
  teams: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space.sm,
    height: 32,
    paddingInline: space.md,
    borderRadius: radius.sm,
    backgroundColor: { default: color.accent, ':hover': color.accentHover },
    color: color.accentInk,
    fontSize: text.ui,
    fontWeight: 550,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
    outlineOffset: 2,
  },
  note: { fontSize: text.small, color: color.inkFaint, lineHeight: 1.5 },
  fail: { fontSize: text.small, color: color.redline },
});

function ReportPanel({ report: r }: { report: Report }) {
  const { data, actions, meta } = useStore();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(r.body);
  const del = useConfirm();
  const workflowReady = data.connectors[TEAMS_WORKFLOW_ID]?.lastStatus === 'ok';
  const link = teamsChatLink(r.recipientEmail, r.body);
  const who = r.recipientName || r.recipientEmail || 'your recipient';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(r.body);
      toast({ message: 'Report copied', tone: 'good', icon: 'copy' });
    } catch {
      toast({ message: 'Copy is blocked here. Select the text and copy it instead.', tone: 'error' });
    }
  };

  return (
    <div {...stylex.props(s.panel)}>
      <div {...stylex.props(s.head)}>
        <span
          {...stylex.props(
            s.status,
            r.status === 'draft' && s.statusDraft,
            r.status === 'approved' && s.statusApproved,
            r.status === 'sent' && s.statusSent,
            r.status === 'failed' && s.statusFailed,
          )}
        >
          {r.status === 'sent' && r.sentAt
            ? `Sent ${timeAgo(r.sentAt)} ${r.sentVia === 'teams-workflow' ? 'through your Teams workflow' : 'by you'}`
            : STATUS_COPY[r.status]}
        </span>
        <h3 {...stylex.props(s.title)}>{r.title}</h3>
        <span {...stylex.props(s.sub)}>
          {formatDate(r.periodStart)} – {formatDate(r.periodEnd)} · for {who}
        </span>
        {r.status === 'failed' && r.note && <span {...stylex.props(s.fail)}>{r.note}</span>}
      </div>

      <div {...stylex.props(s.body)}>
        {editing ? (
          <TextArea aria-label="Edit report" value={draft} onChange={(e) => setDraft(e.target.value)} minRows={14} xstyle={s.edit} />
        ) : (
          <Markdown source={r.body} />
        )}
      </div>

      {!meta.readOnly && (
        <div {...stylex.props(s.actions)}>
          {editing ? (
            <>
              <Button variant="ghost" onClick={() => { setDraft(r.body); setEditing(false); }}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  void actions.editReport(r.id, { body: draft });
                  setEditing(false);
                }}
              >
                Save changes
              </Button>
            </>
          ) : (
            <>
              {r.status !== 'sent' && link && (
                <a href={link} target="_blank" rel="noopener noreferrer" {...stylex.props(s.teams)}>
                  <Icon name="chat" size={16} />
                  Open Teams chat with {who}
                </a>
              )}
              {r.status === 'draft' && workflowReady && (
                <Button variant="secondary" icon="check" onClick={() => actions.approveReport(r.id)}>
                  Approve: send through workflow
                </Button>
              )}
              {r.status !== 'sent' && (
                <Button variant="secondary" icon="check" onClick={() => actions.markReportSent(r.id)}>
                  Mark as sent
                </Button>
              )}
              <Button variant="ghost" icon="copy" onClick={copy}>
                Copy
              </Button>
              {r.status !== 'sent' && (
                <Button variant="ghost" icon="edit" onClick={() => { setDraft(r.body); setEditing(true); }}>
                  Edit
                </Button>
              )}
              <span {...stylex.props(s.spacer)} />
              <Button
                variant={del.armed ? 'danger' : 'ghost'}
                icon="trash"
                onClick={() => del.trigger() && actions.deleteReport(r.id)}
              >
                {del.armed ? 'Click again to delete' : 'Delete'}
              </Button>
            </>
          )}
        </div>
      )}

      {r.status !== 'sent' && !editing && (
        <p {...stylex.props(s.note)}>
          {link
            ? 'The Teams chat opens with the report pre-filled; check it and press send there. Very long reports are shortened in the chat, so use Copy for the full text.'
            : 'Add the person’s work email under Connections › Weekly report to open a pre-filled Teams chat.'}
          {!workflowReady && ' To have the agent send it for you, set up a Teams workflow (Connections › Weekly report).'}
        </p>
      )}
    </div>
  );
}

export function ReportsPane() {
  const { data } = useStore();
  const { navigate } = useRouter();
  const reports = useMemo(
    () => Object.values(data.reports).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd) || b.createdAt.localeCompare(a.createdAt)),
    [data.reports],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const current = reports.find((r) => r.id === selected) ?? reports[0] ?? null;
  const st = data.settings.report;

  if (!reports.length) {
    return (
      <EmptyState
        icon="chat"
        title="No weekly reports yet"
        actions={
          <Button variant="primary" icon="plug" onClick={() => navigate({ name: 'connections' })}>
            {st.enabled ? 'Report settings' : 'Set up the weekly report'}
          </Button>
        }
      >
        {st.enabled
          ? `The agent drafts the first one on ${WEEKDAYS[st.weekday]} after ${st.time}, from the last 7 days of your log.`
          : 'Pick a day and a person, and the agent drafts a report of your week from your log, ready to send on Teams.'}
      </EmptyState>
    );
  }

  return (
    <div {...stylex.props(s.root)}>
      <div {...stylex.props(s.list)}>
        <AnimatePresence initial={false}>
          {reports.map((r) => {
            const active = current?.id === r.id;
            return (
              <m.button
                key={r.id}
                layout="position"
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => setSelected(r.id)}
                {...stylex.props(s.item)}
              >
                {active && <m.span layoutId="report-active" transition={{ type: 'spring', stiffness: 500, damping: 40 }} {...stylex.props(s.activeBg)} />}
                <span {...stylex.props(s.itemTitle)}>
                  <span
                    {...stylex.props(
                      s.dot,
                      r.status === 'draft' && s.dotDraft,
                      r.status === 'approved' && s.dotApproved,
                      r.status === 'sent' && s.dotSent,
                      r.status === 'failed' && s.dotFailed,
                    )}
                  />
                  {r.title}
                </span>
                <span {...stylex.props(s.itemSub)}>
                  {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                </span>
              </m.button>
            );
          })}
        </AnimatePresence>
      </div>
      {current && <ReportPanel key={current.id} report={current} />}
    </div>
  );
}
