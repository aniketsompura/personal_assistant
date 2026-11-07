import * as stylex from '@stylexjs/stylex';
import { AnimatePresence, motion as m } from 'motion/react';
import { useState } from 'react';
import { useStore } from '../data/store';
import type { ConnectorMode, ReportSettings } from '../data/types';
import { CONNECTORS, MODE_LABEL, effectiveMode, type ConnectorDef } from '../connectors/registry';
import { timeAgo } from '../lib/dates';
import { TEAMS_WORKFLOW_ID, WEEKDAYS } from '../lib/teams';
import { useRouter } from '../app/router';
import { color, font, motion, radius, space, text } from '../styles/tokens.stylex';
import { Frame } from '../components/Frame';
import { PageHeader } from '../components/domain';
import { Segmented } from '../components/Segmented';
import { Icon } from '../components/Icon';
import { Field, Select, TextInput } from '../components/ui';
import { useToast } from '../components/Toast';

const s = stylex.create({
  page: { display: 'flex', flexDirection: 'column', gap: space.xl },
  agent: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space.lg },
  agentIcon: {
    display: 'grid',
    placeItems: 'center',
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: color.ink,
    color: color.canvas,
    flexShrink: 0,
  },
  agentText: { display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 280px', minWidth: 0 },
  agentTitle: { fontFamily: font.display, fontSize: text.lead, fontWeight: 650 },
  agentSub: { fontSize: text.ui, color: color.inkMuted },
  schedule: { display: 'flex', flexWrap: 'wrap', gap: space.sm },
  slot: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingInline: 10,
    borderRadius: radius.pill,
    backgroundColor: color.sunken,
    fontFamily: font.mono,
    fontSize: text.label,
    color: color.inkMuted,
    whiteSpace: 'nowrap',
  },
  liveDot: { width: 7, height: 7, borderRadius: '50%', backgroundColor: color.good },
  idleDot: { width: 7, height: 7, borderRadius: '50%', backgroundColor: color.inkFaint },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 380px), 1fr))',
    gap: space.xl,
    alignItems: 'start',
  },
  card: { display: 'flex', flexDirection: 'column', gap: space.md },
  head: { display: 'flex', alignItems: 'center', gap: space.md },
  tile: {
    display: 'grid',
    placeItems: 'center',
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: color.sunken,
    color: color.ink,
    flexShrink: 0,
    transitionProperty: 'background-color, color',
    transitionDuration: motion.base,
  },
  tileOn: { backgroundColor: color.accentSoft, color: color.accent },
  name: { fontFamily: font.display, fontSize: text.lead, fontWeight: 650 },
  nameWrap: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 },
  status: { display: 'flex', alignItems: 'center', gap: 6, fontSize: text.small, color: color.inkFaint },
  statusOk: { color: color.good },
  statusErr: { color: color.redline },
  chip: {
    flexShrink: 0,
    height: 20,
    paddingInline: 7,
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 3,
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: color.inkMuted,
    backgroundColor: color.sunken,
  },
  summary: { fontSize: text.ui, color: color.inkMuted, lineHeight: 1.55 },
  message: {
    fontSize: text.small,
    color: color.inkMuted,
    padding: space.sm,
    borderRadius: radius.sm,
    backgroundColor: color.sunken,
    fontFamily: font.mono,
  },
  messageErr: { color: color.redline, backgroundColor: color.redlineSoft },
  more: {
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: { default: color.accent, ':hover': color.accentHover },
    fontSize: text.small,
    fontWeight: 600,
    cursor: 'pointer',
  },
  chev: { display: 'inline-grid', transitionProperty: 'transform', transitionDuration: motion.base },
  chevOpen: { transform: 'rotate(180deg)' },
  details: { display: 'flex', flexDirection: 'column', gap: space.md, paddingTop: space.xs },
  cols: {
    display: 'grid',
    gridTemplateColumns: { default: '1fr 1fr', '@media (max-width: 480px)': '1fr' },
    gap: space.md,
  },
  listHead: {
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: color.inkFaint,
    marginBottom: 4,
  },
  list: { margin: 0, paddingInlineStart: 16, display: 'flex', flexDirection: 'column', gap: 3, fontSize: text.small, color: color.inkMuted },
  steps: { margin: 0, paddingInlineStart: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: text.small, color: color.ink, lineHeight: 1.5 },
  via: { fontSize: text.small, color: color.inkFaint },
  ignored: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  ignoreChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    height: 22,
    paddingInlineStart: 8,
    paddingInlineEnd: 2,
    borderRadius: radius.xs,
    backgroundColor: color.sunken,
    fontFamily: font.mono,
    fontSize: 10.5,
    color: color.inkMuted,
    maxWidth: '100%',
  },
  ignoreX: {
    display: 'grid',
    placeItems: 'center',
    width: 18,
    height: 18,
    padding: 0,
    borderWidth: 0,
    borderRadius: 3,
    backgroundColor: { default: 'transparent', ':hover': color.hover },
    color: color.inkFaint,
    cursor: 'pointer',
  },

  form: { display: 'flex', flexDirection: 'column', gap: space.md },
  formRow: { display: 'grid', gridTemplateColumns: { default: '1fr 1fr', '@media (max-width: 480px)': '1fr' }, gap: space.md },
  howto: { display: 'flex', flexDirection: 'column', gap: space.sm },
  tiers: { display: 'grid', gridTemplateColumns: { default: 'repeat(3, minmax(0, 1fr))', '@media (max-width: 760px)': '1fr' }, gap: space.md },
  tier: { display: 'flex', flexDirection: 'column', gap: 6, padding: space.md, borderRadius: radius.sm, backgroundColor: color.sunken },
  tierHead: { display: 'flex', alignItems: 'center', gap: 6, fontSize: text.ui, fontWeight: 650 },
  tierBody: { fontSize: text.small, color: color.inkMuted, lineHeight: 1.5 },
  tierDot: (c: string) => ({ width: 8, height: 8, borderRadius: '50%', backgroundColor: c }),
});

function ConnectorCard({ def }: { def: ConnectorDef }) {
  const { data, actions, meta } = useStore();
  const toast = useToast();
  const state = data.connectors[def.id];
  const mode = effectiveMode(def, state?.mode);
  const [open, setOpen] = useState(false);
  const options = (['off', 'ask', 'auto'] as ConnectorMode[])
    .filter((m2) => m2 !== 'auto' || def.maxMode === 'auto')
    .map((value) => ({ value, label: MODE_LABEL[value] }));

  const statusLine = !state?.lastRunAt
    ? mode === 'off'
      ? 'Off'
      : 'Not set up yet'
    : state.lastStatus === 'error'
      ? `Problem on last run · ${timeAgo(state.lastRunAt)}`
      : `Checked ${timeAgo(state.lastRunAt)}`;

  return (
    <Frame tag={`Phase ${def.phase}`} tagMeta={def.scope === 'work' ? 'Work Mac only' : 'Any Mac'} padding="lg" xstyle={s.card}>
      <div {...stylex.props(s.head)}>
        <span {...stylex.props(s.tile, mode !== 'off' && s.tileOn)}>
          <Icon name={def.icon} size={18} />
        </span>
        <span {...stylex.props(s.nameWrap)}>
          <span {...stylex.props(s.name)}>{def.name}</span>
          <span
            {...stylex.props(
              s.status,
              state?.lastStatus === 'ok' && s.statusOk,
              state?.lastStatus === 'error' && s.statusErr,
            )}
          >
            {state?.lastStatus === 'ok' && <Icon name="check" size={12} />}
            {state?.lastStatus === 'error' && <Icon name="alert" size={12} />}
            {statusLine}
          </span>
        </span>
        {def.maxMode === 'ask' && <span {...stylex.props(s.chip)}>Always asks</span>}
      </div>

      <p {...stylex.props(s.summary)}>{def.summary}</p>

      <Segmented
        ariaLabel={`${def.name}: how much it may do`}
        full
        value={mode}
        onChange={(v) => {
          if (meta.readOnly) return;
          actions.setConnectorMode(def.id, v);
          toast({ message: `${def.name}: ${MODE_LABEL[v].toLowerCase()}`, tone: 'good', icon: 'plug' });
        }}
        options={options}
      />

      {state?.lastMessage && (
        <p {...stylex.props(s.message, state.lastStatus === 'error' && s.messageErr)}>{state.lastMessage}</p>
      )}

      {state && state.ignore.length > 0 && (
        <div {...stylex.props(s.ignored)}>
          <span {...stylex.props(s.listHead)}>Skipping</span>
          {state.ignore.map((x) => (
            <span key={x} {...stylex.props(s.ignoreChip)} title={x}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x}</span>
              {!meta.readOnly && (
                <button type="button" aria-label={`Stop skipping ${x}`} onClick={() => actions.unignoreForConnector(def.id, x)} {...stylex.props(s.ignoreX)}>
                  <Icon name="x" size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} {...stylex.props(s.more)}>
        {open ? 'Hide details' : 'What it reads and how to connect'}
        <span {...stylex.props(s.chev, open && s.chevOpen)}>
          <Icon name="chevronDown" size={12} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            style={{ overflow: 'hidden' }}
          >
            <div {...stylex.props(s.details)}>
              <div {...stylex.props(s.cols)}>
                <div>
                  <div {...stylex.props(s.listHead)}>Reads</div>
                  <ul {...stylex.props(s.list)}>
                    {def.reads.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div {...stylex.props(s.listHead)}>Files in your inbox</div>
                  <ul {...stylex.props(s.list)}>
                    {def.produces.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <p {...stylex.props(s.via)}>Connects through {def.via.charAt(0).toLowerCase() + def.via.slice(1)}.</p>
              <div>
                <div {...stylex.props(s.listHead)}>How to connect</div>
                <ol {...stylex.props(s.steps)}>
                  {def.setup.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </Frame>
  );
}

function WeeklyReportFrame() {
  const { data, actions, meta } = useStore();
  const { navigate } = useRouter();
  const toast = useToast();
  const st = data.settings.report;
  const workflow = data.connectors[TEAMS_WORKFLOW_ID];
  const workflowReady = workflow?.lastStatus === 'ok';
  const save = (patch: Partial<ReportSettings>) => void actions.saveSettings({ report: { ...st, ...patch } });
  const emailOk = !st.recipientEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(st.recipientEmail);
  const latest = Object.values(data.reports).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0];

  return (
    <Frame
      tag="Automation · weekly report"
      tagMeta={st.enabled ? `${WEEKDAYS[st.weekday]}s at ${st.time}` : 'Off'}
      padding="lg"
      xstyle={s.card}
    >
      <div {...stylex.props(s.head)}>
        <span {...stylex.props(s.tile, st.enabled && s.tileOn)}>
          <Icon name="chat" size={18} />
        </span>
        <span {...stylex.props(s.nameWrap)}>
          <span {...stylex.props(s.name)}>Weekly report on Teams</span>
          <span {...stylex.props(s.status)}>
            {latest ? `Last report: ${latest.title} · ${latest.status}` : 'No report yet'}
          </span>
        </span>
      </div>
      <p {...stylex.props(s.summary)}>
        Once a week, the agent writes a report of the last 7 days from your log (highlights, progress per project, blockers, next
        steps) and sends it to one person on Teams.
      </p>

      <Segmented
        ariaLabel="Weekly report"
        full
        value={st.enabled ? 'on' : 'off'}
        onChange={(v) => {
          if (meta.readOnly) return;
          save({ enabled: v === 'on' });
          toast({ message: v === 'on' ? 'Weekly report on' : 'Weekly report off', tone: 'good', icon: 'chat' });
        }}
        options={[
          { value: 'off', label: 'Off' },
          { value: 'on', label: 'On' },
        ]}
      />

      {st.enabled && (
        <div {...stylex.props(s.form)}>
          <div {...stylex.props(s.formRow)}>
            <Field label="Day" htmlFor="report-day">
              <Select id="report-day" value={String(st.weekday)} disabled={meta.readOnly} onChange={(e) => save({ weekday: Number(e.target.value) })}>
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Time" htmlFor="report-time">
              <TextInput
                id="report-time"
                type="time"
                value={st.time}
                readOnly={meta.readOnly}
                onChange={(e) => /^\d{2}:\d{2}$/.test(e.target.value) && save({ time: e.target.value })}
              />
            </Field>
          </div>
          <div {...stylex.props(s.formRow)}>
            <Field label="Send to" htmlFor="report-name">
              <TextInput
                id="report-name"
                key={`n-${st.recipientName}`}
                defaultValue={st.recipientName}
                placeholder="Priya Shah"
                readOnly={meta.readOnly}
                onBlur={(e) => e.target.value.trim() !== st.recipientName && save({ recipientName: e.target.value.trim() })}
              />
            </Field>
            <Field label="Their work email" htmlFor="report-email" hint={emailOk ? undefined : 'That doesn’t look like an email address.'}>
              <TextInput
                id="report-email"
                type="email"
                key={`e-${st.recipientEmail}`}
                defaultValue={st.recipientEmail}
                placeholder="priya.shah@soti.net"
                readOnly={meta.readOnly}
                onBlur={(e) => e.target.value.trim() !== st.recipientEmail && save({ recipientEmail: e.target.value.trim() })}
              />
            </Field>
          </div>
          <Field label="Before it goes out">
            <Segmented
              ariaLabel="Delivery"
              full
              value={st.delivery}
              onChange={(v) => !meta.readOnly && save({ delivery: v })}
              options={[
                { value: 'review', label: 'Ask me first' },
                { value: 'auto', label: 'Send without asking' },
              ]}
            />
          </Field>
          <p {...stylex.props(s.message, st.delivery === 'auto' && !workflowReady && s.messageErr)}>
            {workflowReady
              ? `The agent sends through your Teams workflow (checked ${timeAgo(workflow?.lastRunAt)}).`
              : st.delivery === 'auto'
                ? 'Sending without asking needs a Teams workflow (steps below). Until then you get a draft to send yourself.'
                : 'You get a draft in your Inbox with a link that opens a pre-filled Teams chat to send. Add a Teams workflow (below) and the agent sends it for you once you approve.'}
          </p>
          <details {...stylex.props(s.howto)}>
            <summary {...stylex.props(s.more)}>Set up the Teams workflow (one time, about 2 minutes)</summary>
            <ol {...stylex.props(s.steps)}>
              <li>In Teams, open the Workflows app and choose the template “Send webhook alerts to a chat”.</li>
              <li>Pick your chat with {st.recipientName || 'the person'} and finish. Teams shows a URL; copy it.</li>
              <li>
                On your Mac, in Terminal, run: security add-generic-password -a "$USER" -s workfile-teams-webhook -w   and paste the URL
                when asked. It stays in your Keychain, never in Workfile.
              </li>
              <li>The agent checks it on its next run, and this panel will say it’s ready. Messages appear from the Workflows app in that chat.</li>
            </ol>
          </details>
          {latest && (
            <button type="button" onClick={() => navigate({ name: 'journal' })} {...stylex.props(s.more)}>
              See reports in the Journal →
            </button>
          )}
        </div>
      )}
    </Frame>
  );
}

export function ConnectionsView() {
  const { data } = useStore();
  const runs = Object.values(data.connectors)
    .map((c) => c.lastRunAt)
    .filter((x): x is string => !!x)
    .sort();
  const lastRun = runs[runs.length - 1] ?? null;
  const live = !!lastRun && Date.now() - Date.parse(lastRun) < 3 * 3_600_000;

  return (
    <div {...stylex.props(s.page)}>
      <PageHeader
        eyebrow="Plug board"
        title="Connections"
        sub="Choose which tools Workfile watches and how much it may log on its own. Workfile only reads these tools. It never sends a message, moves a ticket or edits a file."
      />

      <Frame tag="Workfile Agent" tagMeta="Runs on your Mac in the Claude app">
        <div {...stylex.props(s.agent)}>
          <span {...stylex.props(s.agentIcon)}>
            <Icon name="radar" size={20} />
          </span>
          <span {...stylex.props(s.agentText)}>
            <span {...stylex.props(s.agentTitle)}>{lastRun ? (live ? 'Watching your tools' : 'Installed, not running lately') : 'Not installed yet'}</span>
            <span {...stylex.props(s.agentSub)}>
              {lastRun
                ? `Last sync ${timeAgo(lastRun)}. Scheduled syncs run while the Claude app is open; missed ones catch up when it opens.`
                : 'Install the Workfile Agent plugin in Claude Code (see Claude Code below). It needs this Workfile’s link, the claude.ai/artifact/… address of this page.'}
            </span>
          </span>
          <span {...stylex.props(s.schedule)}>
            <span {...stylex.props(s.slot)}>
              <span {...stylex.props(live ? s.liveDot : s.idleDot)} />
              Hourly 09–18, weekdays
            </span>
            <span {...stylex.props(s.slot)}>08:45 brief</span>
            <span {...stylex.props(s.slot)}>17:30 digest</span>
          </span>
        </div>
      </Frame>

      <div {...stylex.props(s.grid)}>
        {CONNECTORS.map((def) => (
          <ConnectorCard key={def.id} def={def} />
        ))}
        <WeeklyReportFrame />
      </div>

      <Frame tag="When it logs alone, and when it asks">
        <div {...stylex.props(s.tiers)}>
          <div {...stylex.props(s.tier)}>
            <span {...stylex.props(s.tierHead)}>
              <span {...stylex.props(s.tierDot('#8A90A0'))} /> Adds to the log
            </span>
            <span {...stylex.props(s.tierBody)}>
              Session notes, Figma versions, comments on linked tickets, new links. Logged automatically when a source is set to “Log
              automatically”, with Undo in the Inbox.
            </span>
          </div>
          <div {...stylex.props(s.tier)}>
            <span {...stylex.props(s.tierHead)}>
              <span {...stylex.props(s.tierDot('#E09A0B'))} /> Changes the project
            </span>
            <span {...stylex.props(s.tierBody)}>
              Progress, stage, requirements done, a new project, or anything matched with low confidence. Always waits for your OK.
            </span>
          </div>
          <div {...stylex.props(s.tier)}>
            <span {...stylex.props(s.tierHead)}>
              <span {...stylex.props(s.tierDot('#E5484D'))} /> Time-sensitive
            </span>
            <span {...stylex.props(s.tierBody)}>
              New assignments with due dates, moved deadlines, blockers, asks from stakeholders. Waits for your OK and sends a notification.
            </span>
          </div>
        </div>
      </Frame>
    </div>
  );
}
