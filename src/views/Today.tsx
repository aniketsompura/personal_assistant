import * as stylex from '@stylexjs/stylex';
import { motion as m } from 'motion/react';
import { useMemo, type ReactNode } from 'react';
import { useStore } from '../data/store';
import { useRouter } from '../app/router';
import { useDialogs } from '../app/dialogs';
import { addDays, formatLongDate, greeting, toISODate } from '../lib/dates';
import {
  PACE_LABEL,
  activeProjects,
  attentionLabel,
  cycleInfo,
  goalProgress,
  needsAttention,
  pace,
  sortUpdates,
  type AttentionItem,
} from '../lib/insights';
import { GOAL_HEX, STATUS_META } from '../lib/meta';
import { inClaudeArtifact } from '../lib/claude';
import { color, font, motion, radius, space, text } from '../styles/tokens.stylex';
import { Frame } from '../components/Frame';
import { CycleRuler } from '../components/CycleRuler';
import { EmptyState, PageHeader, itemVariants, listVariants } from '../components/domain';
import { ProgressBar } from '../components/Progress';
import { Timeline, UpdateComposer } from '../components/Updates';
import { Button, Dot, Swatch } from '../components/ui';
import { Icon } from '../components/Icon';

const s = stylex.create({
  page: { display: 'flex', flexDirection: 'column', gap: space.xxl },
  brief: { fontSize: text.lead, lineHeight: 1.55, color: color.inkMuted, maxWidth: '64ch' },
  link: {
    display: 'inline',
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    font: 'inherit',
    color: color.ink,
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'underline',
    textDecorationColor: { default: color.lineStrong, ':hover': color.accent },
    textDecorationThickness: 1.5,
    textUnderlineOffset: 3,
    transitionProperty: 'text-decoration-color',
    transitionDuration: motion.fast,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: { default: 'minmax(0, 1.45fr) minmax(0, 1fr)', '@media (max-width: 1040px)': 'minmax(0, 1fr)' },
    gap: space.xl,
    alignItems: 'start',
  },
  col: { display: 'flex', flexDirection: 'column', gap: space.xl, minWidth: 0 },
  attention: { display: 'flex', flexDirection: 'column' },
  attnRow: {
    display: 'flex',
    alignItems: 'center',
    gap: space.sm,
    width: '100%',
    minHeight: 40,
    paddingInline: space.sm,
    marginInline: -8,
    borderWidth: 0,
    borderRadius: radius.sm,
    backgroundColor: { default: 'transparent', ':hover': color.hover },
    color: color.ink,
    fontSize: text.ui,
    textAlign: 'start',
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
  },
  attnTitle: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 550 },
  attnTag: {
    flexShrink: 0,
    fontFamily: font.mono,
    fontSize: 10.5,
    fontWeight: 600,
    paddingInline: 6,
    height: 20,
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 3,
  },
  tagLate: { color: color.redline, backgroundColor: color.redlineSoft },
  tagSoon: { color: color.warn, backgroundColor: color.warnSoft },
  tagQuiet: { color: color.inkMuted, backgroundColor: color.sunken },
  allClear: { display: 'flex', alignItems: 'center', gap: space.sm, color: color.good, fontSize: text.ui, fontWeight: 550 },
  pulse: { display: 'flex', flexDirection: 'column', gap: space.lg },
  pulseRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    width: '100%',
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: 'inherit',
    textAlign: 'start',
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
    outlineOffset: 4,
    borderRadius: 2,
  },
  pulseHead: { display: 'flex', alignItems: 'center', gap: space.sm, minWidth: 0 },
  pulseTitle: { flex: 1, minWidth: 0, fontSize: text.ui, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  pulsePct: { fontFamily: font.mono, fontSize: text.small, fontVariantNumeric: 'tabular-nums' },
  pace: { fontFamily: font.mono, fontSize: 10.5, letterSpacing: '0.02em' },
  paceBehind: { color: color.redline },
  paceAhead: { color: color.good },
  paceOk: { color: color.inkFaint },
  legend: { display: 'flex', alignItems: 'center', gap: 6, fontSize: text.small, color: color.inkFaint },
  legendMark: { width: 2, height: 12, backgroundColor: color.redline, borderRadius: 1 },
  steps: { display: 'flex', flexDirection: 'column', gap: space.lg, counterReset: 'step' },
  step: { display: 'grid', gridTemplateColumns: '32px minmax(0, 1fr) auto', gap: space.md, alignItems: 'center' },
  stepNum: {
    display: 'grid',
    placeItems: 'center',
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.lineStrong,
    fontFamily: font.mono,
    fontSize: text.small,
    color: color.inkMuted,
  },
  stepDone: { backgroundColor: color.good, borderColor: color.good, color: '#fff' },
  stepText: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  stepTitle: { fontWeight: 600, fontSize: text.body },
  stepBody: { fontSize: text.ui, color: color.inkMuted },
  tip: {
    display: 'flex',
    gap: space.sm,
    alignItems: 'flex-start',
    marginTop: space.lg,
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: color.accentSoft,
    color: color.ink,
    fontSize: text.ui,
  },
  tipIcon: { color: color.accent, marginTop: 2 },
});

function Briefing() {
  const { data } = useStore();
  const { navigate } = useRouter();
  const active = activeProjects(data.projects).filter((p) => p.status !== 'shipped' && p.status !== 'paused');
  const goalCount = new Set(active.flatMap((p) => p.goalIds.filter((g) => data.goals[g]))).size;
  const attention = needsAttention(data);
  const weekAgo = toISODate(addDays(new Date(), -6));
  const thisWeek = Object.values(data.updates).filter((u) => !u.auto && u.date >= weekAgo).length;

  const link = (p: { id: string; title: string }) => (
    <button type="button" onClick={() => navigate({ name: 'project', id: p.id })} {...stylex.props(s.link)}>
      {p.title}
    </button>
  );

  const parts: ReactNode[] = [];
  if (active.length) {
    parts.push(
      <span key="a">
        {active.length} project{active.length === 1 ? '' : 's'} in motion
        {goalCount ? ` across ${goalCount} goal${goalCount === 1 ? '' : 's'}` : ''}.{' '}
      </span>,
    );
  }
  const phrase = (a: AttentionItem) => {
    switch (a.reason) {
      case 'overdue':
        return <>is {a.days} day{a.days === 1 ? '' : 's'} past due</>;
      case 'due-soon':
        return a.days === 0 ? <>is due today</> : <>is due in {a.days} day{a.days === 1 ? '' : 's'}</>;
      case 'blocked':
        return <>is blocked</>;
      case 'stale':
        return <>hasn’t had an update in {a.days} days</>;
    }
  };
  const top = attention.slice(0, 2);
  if (top.length === 1) {
    parts.push(<span key="t">{link(top[0].project)} {phrase(top[0])}. </span>);
  } else if (top.length === 2) {
    parts.push(
      <span key="t">
        {link(top[0].project)} {phrase(top[0])}, and {link(top[1].project)} {phrase(top[1])}.{' '}
      </span>,
    );
  } else if (active.length) {
    parts.push(<span key="t">Nothing needs you right now. </span>);
  }
  parts.push(
    <span key="w">
      {thisWeek
        ? `You logged ${thisWeek} update${thisWeek === 1 ? '' : 's'} in the last 7 days.`
        : 'No updates logged in the last 7 days yet.'}
    </span>,
  );
  return <p {...stylex.props(s.brief)}>{parts}</p>;
}

function Onboarding() {
  const { data } = useStore();
  const dialogs = useDialogs();
  const hasGoals = Object.keys(data.goals).length > 0;
  const hasProjects = Object.keys(data.projects).length > 0;
  const hasUpdates = Object.keys(data.updates).length > 0;
  const steps = [
    {
      title: `Add your ${data.settings.cycleLabel} goals`,
      body: 'The goals you agreed with your manager. Add success measures so you know when each is met.',
      done: hasGoals,
      action: <Button variant={hasGoals ? 'secondary' : 'primary'} icon="plus" onClick={() => dialogs({ kind: 'goal' })}>Add goal</Button>,
    },
    {
      title: 'Add the projects that move them',
      body: 'Link each project to one or more goals. Add requirements, links and your prototype.',
      done: hasProjects,
      action: <Button variant={hasGoals && !hasProjects ? 'primary' : 'secondary'} icon="plus" onClick={() => dialogs({ kind: 'project' })}>New project</Button>,
    },
    {
      title: 'Log updates as you work',
      body: 'A line or two after a review, a decision or a blocker. Progress and status follow along.',
      done: hasUpdates,
      action: <Button variant={hasProjects && !hasUpdates ? 'primary' : 'secondary'} icon="plus" onClick={() => dialogs({ kind: 'update' })}>Log update</Button>,
    },
  ];
  return (
    <Frame tag="Getting started" tagMeta={`${steps.filter((x) => x.done).length} of 3 done`} padding="lg">
      <ol {...stylex.props(s.steps)} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {steps.map((st, i) => (
          <li key={st.title} {...stylex.props(s.step)}>
            <span {...stylex.props(s.stepNum, st.done && s.stepDone)}>{st.done ? <Icon name="check" size={14} /> : i + 1}</span>
            <span {...stylex.props(s.stepText)}>
              <span {...stylex.props(s.stepTitle)}>{st.title}</span>
              <span {...stylex.props(s.stepBody)}>{st.body}</span>
            </span>
            {st.action}
          </li>
        ))}
      </ol>
      {inClaudeArtifact() && !hasGoals && (
        <div {...stylex.props(s.tip)}>
          <span {...stylex.props(s.tipIcon)}>
            <Icon name="sparkles" size={16} />
          </span>
          <span>
            Already have your goals written down? Paste them into your Claude chat and ask Claude to add them to your Workfile. It can
            write straight into this page’s database.
          </span>
        </div>
      )}
    </Frame>
  );
}

export function TodayView() {
  const { data } = useStore();
  const { navigate } = useRouter();
  const cycle = cycleInfo(data.settings);
  const attention = useMemo(() => needsAttention(data), [data]);
  const goals = useMemo(() => Object.values(data.goals).sort((a, b) => a.order - b.order), [data.goals]);
  const recent = useMemo(() => sortUpdates(Object.values(data.updates)).slice(0, 6), [data.updates]);
  const name = data.settings.ownerName.trim();
  const isNew = goals.length === 0 || Object.keys(data.projects).length === 0 || Object.keys(data.updates).length === 0;

  return (
    <div {...stylex.props(s.page)}>
      <PageHeader
        eyebrow={`${formatLongDate(new Date())} · ${data.settings.cycleLabel} · day ${cycle.day} of ${cycle.totalDays}`}
        title={`${greeting()}${name ? `, ${name}` : ''}.`}
        sub={<Briefing />}
      />

      {isNew && <Onboarding />}

      <Frame tag={`Cycle · ${data.settings.cycleLabel}`} tagMeta={`${cycle.pct}% of the year gone`} padding="md">
        <CycleRuler data={data} onOpen={(p) => navigate({ name: 'project', id: p.id })} />
      </Frame>

      <div {...stylex.props(s.grid)}>
        <div {...stylex.props(s.col)}>
          <Frame tag="Quick log" tagMeta="⌘↵ to save">
            <UpdateComposer />
          </Frame>
          <Frame tag="Recent activity" tagMeta={recent.length ? <button type="button" onClick={() => navigate({ name: 'journal' })} {...stylex.props(s.link)} style={{ fontSize: 11, fontWeight: 500 }}>Open journal</button> : undefined}>
            {recent.length ? (
              <Timeline updates={recent} showProject numbered={false} />
            ) : (
              <EmptyState icon="clock" title="Nothing logged yet" compact>
                Updates you log show up here, newest first.
              </EmptyState>
            )}
          </Frame>
        </div>

        <div {...stylex.props(s.col)}>
          <Frame tag="Needs attention" tagMeta={attention.length ? `${attention.length}` : undefined}>
            {attention.length ? (
              <m.div variants={listVariants} initial="hidden" animate="show" {...stylex.props(s.attention)}>
                {attention.slice(0, 7).map((a) => (
                  <m.button
                    key={a.project.id}
                    variants={itemVariants}
                    type="button"
                    onClick={() => navigate({ name: 'project', id: a.project.id, tab: 'updates' })}
                    {...stylex.props(s.attnRow)}
                  >
                    <Dot hex={STATUS_META[a.project.status].hex} />
                    <span {...stylex.props(s.attnTitle)}>{a.project.title}</span>
                    <span
                      {...stylex.props(
                        s.attnTag,
                        a.reason === 'overdue' || a.reason === 'blocked' ? s.tagLate : a.reason === 'due-soon' ? s.tagSoon : s.tagQuiet,
                      )}
                    >
                      {attentionLabel(a)}
                    </span>
                  </m.button>
                ))}
              </m.div>
            ) : (
              <span {...stylex.props(s.allClear)}>
                <Icon name="check" size={16} />
                {Object.keys(data.projects).length ? 'All clear. Nothing overdue, blocked or gone quiet.' : 'Projects that slip or go quiet show up here.'}
              </span>
            )}
          </Frame>

          <Frame
            tag="Goal pulse"
            tagMeta={
              <span {...stylex.props(s.legend)}>
                <span {...stylex.props(s.legendMark)} /> even pace
              </span>
            }
          >
            {goals.length ? (
              <m.div variants={listVariants} initial="hidden" animate="show" {...stylex.props(s.pulse)}>
                {goals.map((g) => {
                  const prog = goalProgress(g, data.projects);
                  const p = pace(prog.value, cycle.pct);
                  return (
                    <m.button
                      key={g.id}
                      variants={itemVariants}
                      type="button"
                      onClick={() => navigate({ name: 'goal', id: g.id })}
                      title={prog.explain}
                      {...stylex.props(s.pulseRow)}
                    >
                      <span {...stylex.props(s.pulseHead)}>
                        <Swatch hex={GOAL_HEX[g.color]} />
                        <span {...stylex.props(s.pulseTitle)}>{g.title}</span>
                        <span
                          {...stylex.props(
                            s.pace,
                            p === 'behind' ? s.paceBehind : p === 'ahead' || p === 'done' ? s.paceAhead : s.paceOk,
                          )}
                        >
                          {PACE_LABEL[p]}
                        </span>
                        <span {...stylex.props(s.pulsePct)}>{prog.value}%</span>
                      </span>
                      <ProgressBar value={prog.value} hex={GOAL_HEX[g.color]} pace={cycle.pct} label={`${g.title} progress`} />
                    </m.button>
                  );
                })}
              </m.div>
            ) : (
              <EmptyState icon="goals" title="No goals yet" compact>
                Each goal gets a progress bar here, with a redline showing where an even pace would put you today.
              </EmptyState>
            )}
          </Frame>
        </div>
      </div>
    </div>
  );
}
