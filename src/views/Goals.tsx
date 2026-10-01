import * as stylex from '@stylexjs/stylex';
import { motion as m } from 'motion/react';
import { useMemo } from 'react';
import { useStore } from '../data/store';
import { useRouter } from '../app/router';
import { useDialogs } from '../app/dialogs';
import { PACE_LABEL, cycleInfo, goalProgress, pace, projectsForGoal } from '../lib/insights';
import { GOAL_HEX, STATUS_META } from '../lib/meta';
import { color, font, space, text } from '../styles/tokens.stylex';
import { Frame } from '../components/Frame';
import { EmptyState, PageHeader, itemVariants, listVariants } from '../components/domain';
import { ProgressBar } from '../components/Progress';
import { Button, Dot, Swatch } from '../components/ui';

const s = stylex.create({
  page: { display: 'flex', flexDirection: 'column', gap: space.xxl },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
    gap: space.xl,
    alignItems: 'stretch',
  },
  card: { display: 'flex', flexDirection: 'column', gap: space.md, height: '100%' },
  head: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  swatch: { marginTop: 7 },
  title: { fontFamily: font.display, fontSize: text.h3, fontWeight: 650, letterSpacing: '-0.015em', lineHeight: 1.2 },
  desc: {
    fontSize: text.ui,
    color: color.inkMuted,
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  stats: { display: 'flex', alignItems: 'baseline', gap: space.sm, marginTop: 'auto' },
  big: { fontFamily: font.display, fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' },
  pace: { fontFamily: font.mono, fontSize: text.label, letterSpacing: '0.02em' },
  behind: { color: color.redline },
  ahead: { color: color.good },
  ok: { color: color.inkFaint },
  explain: { marginInlineStart: 'auto', fontSize: text.small, color: color.inkFaint, textAlign: 'end' },
  projects: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopStyle: 'dashed',
    borderTopColor: color.line,
  },
  projectRow: { display: 'flex', alignItems: 'center', gap: space.sm, fontSize: text.small, color: color.inkMuted, minWidth: 0 },
  projectName: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  projectPct: { fontFamily: font.mono, fontSize: 10.5, color: color.inkFaint },
  none: { fontSize: text.small, color: color.inkFaint },
});

export function GoalsView() {
  const { data, meta } = useStore();
  const { navigate } = useRouter();
  const dialogs = useDialogs();
  const cycle = cycleInfo(data.settings);
  const goals = useMemo(() => Object.values(data.goals).sort((a, b) => a.order - b.order), [data.goals]);
  const progresses = goals.map((g) => goalProgress(g, data.projects).value);
  const avg = progresses.length ? Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length) : 0;
  const behind = progresses.filter((v) => pace(v, cycle.pct) === 'behind').length;

  return (
    <div {...stylex.props(s.page)}>
      <PageHeader
        eyebrow={`${data.settings.cycleLabel} · ${cycle.pct}% of the year gone`}
        title="Goals"
        sub={
          goals.length
            ? `${goals.length} goal${goals.length === 1 ? '' : 's'}, ${avg}% average progress${behind ? `, ${behind} behind an even pace` : ''}.`
            : 'The outcomes you committed to this year. Projects roll up into them.'
        }
        actions={
          <Button variant="primary" icon="plus" disabled={meta.readOnly} onClick={() => dialogs({ kind: 'goal' })}>
            New goal
          </Button>
        }
      />

      {goals.length === 0 ? (
        <EmptyState
          icon="goals"
          title={`Add your ${data.settings.cycleLabel} goals`}
          actions={
            <Button variant="primary" icon="plus" onClick={() => dialogs({ kind: 'goal' })}>
              Add your first goal
            </Button>
          }
        >
          Start with the goals you set with your manager. Each one tracks progress from its linked projects and shows whether you’re on pace
          for the year.
        </EmptyState>
      ) : (
        <m.div variants={listVariants} initial="hidden" animate="show" {...stylex.props(s.grid)}>
          {goals.map((g, i) => {
            const prog = goalProgress(g, data.projects);
            const p = pace(prog.value, cycle.pct);
            const linked = projectsForGoal(g.id, data.projects);
            const measuresDone = g.measures.filter((x) => x.done).length;
            return (
              <m.div key={g.id} variants={itemVariants} style={{ display: 'flex' }}>
                <Frame
                  tag={`G${String(i + 1).padStart(2, '0')} · ${g.category || 'Goal'}`}
                  tagMeta={g.measures.length ? `${measuresDone}/${g.measures.length} measures` : undefined}
                  onClick={() => navigate({ name: 'goal', id: g.id })}
                  ariaLabel={`${g.title}, ${prog.value}%`}
                  padding="lg"
                  wrapStyle={s.card}
                  xstyle={s.card}
                >
                  <div {...stylex.props(s.head)}>
                    <span {...stylex.props(s.swatch)}>
                      <Swatch hex={GOAL_HEX[g.color]} size={12} />
                    </span>
                    <h2 {...stylex.props(s.title)}>{g.title}</h2>
                  </div>
                  {g.description && <p {...stylex.props(s.desc)}>{g.description}</p>}
                  <div {...stylex.props(s.stats)}>
                    <span {...stylex.props(s.big)}>{prog.value}%</span>
                    <span {...stylex.props(s.pace, p === 'behind' ? s.behind : p === 'ahead' || p === 'done' ? s.ahead : s.ok)}>
                      {PACE_LABEL[p]}
                    </span>
                    <span {...stylex.props(s.explain)}>{prog.explain}</span>
                  </div>
                  <ProgressBar value={prog.value} hex={GOAL_HEX[g.color]} pace={cycle.pct} size="lg" label={`${g.title} progress`} />
                  <div {...stylex.props(s.projects)}>
                    {linked.length ? (
                      linked.slice(0, 4).map((pr) => (
                        <span key={pr.id} {...stylex.props(s.projectRow)}>
                          <Dot hex={STATUS_META[pr.status].hex} hollow={pr.status === 'idea' || pr.status === 'paused'} />
                          <span {...stylex.props(s.projectName)}>{pr.title}</span>
                          <span {...stylex.props(s.projectPct)}>{pr.progress}%</span>
                        </span>
                      ))
                    ) : (
                      <span {...stylex.props(s.none)}>No projects linked yet</span>
                    )}
                    {linked.length > 4 && <span {...stylex.props(s.none)}>+{linked.length - 4} more</span>}
                  </div>
                </Frame>
              </m.div>
            );
          })}
        </m.div>
      )}
    </div>
  );
}
