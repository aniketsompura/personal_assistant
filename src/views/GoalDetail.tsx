import * as stylex from '@stylexjs/stylex';
import { useMemo, useState, type ReactNode } from 'react';
import { useStore } from '../data/store';
import { useRouter } from '../app/router';
import { useDialogs } from '../app/dialogs';
import type { Goal } from '../data/types';
import { newId } from '../lib/ids';
import { PACE_LABEL, cycleInfo, goalProgress, pace, projectsForGoal, sortUpdates } from '../lib/insights';
import { GOAL_HEX, STATUS_META } from '../lib/meta';
import { goalReviewPrompt, useAssistant } from '../lib/assistant';
import { color, font, radius, space, text } from '../styles/tokens.stylex';
import { Frame } from '../components/Frame';
import { EmptyState, SectionHeader, StatusPill } from '../components/domain';
import { ProgressBar, ProgressRing, ProgressSlider } from '../components/Progress';
import { Segmented } from '../components/Segmented';
import { Checklist } from '../components/Checklist';
import { Timeline } from '../components/Updates';
import { AssistPanel } from '../components/AssistPanel';
import { MenuItem, Popover, useConfirm, usePopover } from '../components/Overlay';
import { Button, Dot, Swatch, TextArea, TextInput } from '../components/ui';
import { dueLabel } from '../components/ProjectCard';
import { Icon } from '../components/Icon';

const s = stylex.create({
  page: { display: 'flex', flexDirection: 'column', gap: space.xl },
  top: { display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  spacer: { flex: 1 },
  header: { display: 'flex', flexDirection: 'column', gap: space.sm },
  eyebrow: {
    display: 'flex',
    alignItems: 'center',
    gap: space.sm,
    fontFamily: font.mono,
    fontSize: text.label,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
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
  descInput: { marginInline: -10, fontSize: text.lead, color: color.inkMuted, minHeight: 0 },
  grid: {
    display: 'grid',
    gridTemplateColumns: { default: 'minmax(0, 1.6fr) minmax(0, 1fr)', '@media (max-width: 1040px)': 'minmax(0, 1fr)' },
    gap: space.xl,
    alignItems: 'start',
  },
  col: { display: 'flex', flexDirection: 'column', gap: space.xl, minWidth: 0 },
  ringRow: { display: 'flex', alignItems: 'center', gap: space.lg },
  ringText: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  paceText: { fontFamily: font.mono, fontSize: text.small },
  behind: { color: color.redline },
  ahead: { color: color.good },
  ok: { color: color.inkMuted },
  explain: { fontSize: text.small, color: color.inkFaint },
  progressBox: { display: 'flex', flexDirection: 'column', gap: space.lg },
  manualRow: { display: 'flex', alignItems: 'center', gap: space.md },
  manualPct: { fontFamily: font.mono, fontSize: text.small, minWidth: 36, textAlign: 'end' },
  rows: { display: 'flex', flexDirection: 'column' },
  row: {
    display: 'grid',
    gridTemplateColumns: { default: 'minmax(0, 1fr) auto 120px 84px', '@media (max-width: 640px)': 'minmax(0, 1fr) auto' },
    alignItems: 'center',
    gap: space.md,
    minHeight: 48,
    paddingInline: space.sm,
    marginInline: -8,
    borderWidth: 0,
    borderRadius: radius.sm,
    backgroundColor: { default: 'transparent', ':hover': color.hover },
    color: 'inherit',
    textAlign: 'start',
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
  },
  rowTitle: { fontWeight: 600, fontSize: text.ui, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowBar: { display: { default: 'flex', '@media (max-width: 640px)': 'none' }, alignItems: 'center', gap: space.sm },
  rowDue: {
    display: { default: 'block', '@media (max-width: 640px)': 'none' },
    fontFamily: font.mono,
    fontSize: 10.5,
    color: color.inkFaint,
    textAlign: 'end',
  },
  late: { color: color.redline },
  pct: { fontFamily: font.mono, fontSize: 10.5, color: color.inkMuted, minWidth: 28, textAlign: 'end' },
  sectionGap: { display: 'flex', flexDirection: 'column', gap: space.md },
  missing: { display: 'flex', flexDirection: 'column', gap: space.lg },
});

export function GoalDetailView({ id }: { id: string }) {
  const { data, actions, meta } = useStore();
  const { navigate, back } = useRouter();
  const dialogs = useDialogs();
  const goal = data.goals[id];
  const confirm = useConfirm();
  const linkPop = usePopover();
  const [manual, setManual] = useState<number | null>(null);

  const linked = useMemo(() => (goal ? projectsForGoal(goal.id, data.projects) : []), [goal, data.projects]);
  const evidence = useMemo(() => {
    const ids = new Set(linked.map((p) => p.id));
    return sortUpdates(Object.values(data.updates).filter((u) => u.projectId && ids.has(u.projectId)));
  }, [linked, data.updates]);

  if (!goal) {
    return (
      <div {...stylex.props(s.missing)}>
        <EmptyState
          icon="goals"
          title="This goal no longer exists"
          actions={<Button onClick={() => navigate({ name: 'goals' })}>All goals</Button>}
        >
          It may have been deleted on another device.
        </EmptyState>
      </div>
    );
  }

  const cycle = cycleInfo(data.settings);
  const prog = goalProgress(goal, data.projects);
  const p = pace(prog.value, cycle.pct);
  const hex = GOAL_HEX[goal.color];
  const unlinked = Object.values(data.projects).filter((x) => !x.archived && !x.goalIds.includes(goal.id));
  const ro = meta.readOnly;

  const update = (body: Partial<Goal>) => actions.updateGoal(goal.id, body);

  return (
    <div {...stylex.props(s.page)}>
      <div {...stylex.props(s.top)}>
        <Button variant="ghost" size="sm" icon="arrowLeft" onClick={back}>
          Back
        </Button>
        <span {...stylex.props(s.spacer)} />
        <Button variant="secondary" size="sm" icon="edit" disabled={ro} onClick={() => dialogs({ kind: 'goal', goal })}>
          Edit
        </Button>
        <Button
          variant={confirm.armed ? 'danger' : 'ghost'}
          size="sm"
          icon="trash"
          disabled={ro}
          onClick={() => {
            if (confirm.trigger()) {
              actions.deleteGoal(goal.id);
              navigate({ name: 'goals' });
            }
          }}
        >
          {confirm.armed ? 'Click again to delete' : 'Delete'}
        </Button>
      </div>

      <header {...stylex.props(s.header)}>
        <span {...stylex.props(s.eyebrow)}>
          <Swatch hex={hex} size={10} />
          {goal.category || 'Goal'} · {data.settings.cycleLabel}
        </span>
        <TextInput
          bare
          aria-label="Goal title"
          defaultValue={goal.title}
          key={`t-${goal.updatedAt}`}
          readOnly={ro}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== goal.title) update({ title: v });
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          xstyle={s.titleInput}
        />
        <TextArea
          bare
          aria-label="Why this goal matters"
          placeholder="Why this goal matters, in a sentence or two."
          defaultValue={goal.description}
          key={`d-${goal.updatedAt}`}
          readOnly={ro}
          minRows={1}
          onBlur={(e) => e.target.value !== goal.description && update({ description: e.target.value })}
          xstyle={s.descInput}
        />
      </header>

      <div {...stylex.props(s.grid)}>
        <div {...stylex.props(s.col)}>
          <Frame tag="Linked projects" tagMeta={`${linked.length}`}>
            <div {...stylex.props(s.sectionGap)}>
              {linked.length ? (
                <div {...stylex.props(s.rows)}>
                  {linked.map((pr) => {
                    const due = dueLabel(pr);
                    return (
                      <button key={pr.id} type="button" onClick={() => navigate({ name: 'project', id: pr.id })} {...stylex.props(s.row)}>
                        <span {...stylex.props(s.rowTitle)}>{pr.title}</span>
                        <StatusPill status={pr.status} />
                        <span {...stylex.props(s.rowBar)}>
                          <ProgressBar value={pr.progress} hex={STATUS_META[pr.status].hex} size="sm" />
                          <span {...stylex.props(s.pct)}>{pr.progress}%</span>
                        </span>
                        <span {...stylex.props(s.rowDue, due?.tone === 'late' && s.late)}>{due?.text ?? '—'}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon="projects" title="No projects linked yet" compact>
                  Link the projects that move this goal. Its progress becomes the average of theirs.
                </EmptyState>
              )}
              {!ro && (
                <div {...stylex.props(s.top)}>
                  <Button size="sm" variant="secondary" icon="plus" onClick={() => dialogs({ kind: 'project', goalId: goal.id })}>
                    New project
                  </Button>
                  {unlinked.length > 0 && (
                    <>
                      <Button ref={linkPop.triggerRef} size="sm" variant="ghost" icon="link" onClick={linkPop.toggle}>
                        Link existing
                      </Button>
                      <Popover open={linkPop.open} onClose={linkPop.close} anchorRef={linkPop.triggerRef} width={300}>
                        {unlinked.map((pr) => (
                          <MenuItem
                            key={pr.id}
                            leading={<Dot hex={STATUS_META[pr.status].hex} />}
                            onSelect={() => {
                              actions.updateProject(pr.id, { goalIds: [...pr.goalIds, goal.id] }, { silent: true });
                              linkPop.close();
                            }}
                          >
                            {pr.title}
                          </MenuItem>
                        ))}
                      </Popover>
                    </>
                  )}
                </div>
              )}
            </div>
          </Frame>

          <Frame tag="Evidence" tagMeta={`${evidence.length} updates from linked projects`}>
            {evidence.length ? (
              <Timeline updates={evidence} showProject numbered={false} />
            ) : (
              <EmptyState icon="clock" title="No evidence yet" compact>
                Updates on linked projects collect here. At review time, this is your record of what you did.
              </EmptyState>
            )}
          </Frame>
        </div>

        <div {...stylex.props(s.col)}>
          <Frame tag="Progress" tagMeta={`Day ${cycle.day} of ${cycle.totalDays}`}>
            <div {...stylex.props(s.progressBox)}>
              <div {...stylex.props(s.ringRow)}>
                <ProgressRing value={manual ?? prog.value} size={76} stroke={6} hex={hex} />
                <div {...stylex.props(s.ringText)}>
                  <span {...stylex.props(s.paceText, p === 'behind' ? s.behind : p === 'ahead' || p === 'done' ? s.ahead : s.ok)}>
                    {PACE_LABEL[p]}
                  </span>
                  <span {...stylex.props(s.explain)}>{prog.explain}.</span>
                  <span {...stylex.props(s.explain)}>An even pace puts you at {cycle.pct}% today.</span>
                </div>
              </div>
              <ProgressBar value={manual ?? prog.value} hex={hex} pace={cycle.pct} size="lg" />
              <Segmented
                ariaLabel="How progress is measured"
                full
                value={goal.progressMode}
                onChange={(mode) => update({ progressMode: mode, manualProgress: mode === 'manual' ? prog.value : goal.manualProgress })}
                options={[
                  { value: 'auto', label: 'From projects', title: 'Average of linked projects, or measures met' },
                  { value: 'manual', label: 'Set by hand' },
                ]}
              />
              {goal.progressMode === 'manual' && (
                <div {...stylex.props(s.manualRow)}>
                  <ProgressSlider
                    value={manual ?? goal.manualProgress}
                    hex={hex}
                    onChange={setManual}
                    onCommit={(v) => {
                      setManual(null);
                      if (v !== goal.manualProgress) update({ manualProgress: v });
                    }}
                    disabled={ro}
                  />
                  <span {...stylex.props(s.manualPct)}>{manual ?? goal.manualProgress}%</span>
                </div>
              )}
            </div>
          </Frame>

          <Frame
            tag="Success measures"
            tagMeta={goal.measures.length ? `${goal.measures.filter((x) => x.done).length}/${goal.measures.length} met` : undefined}
          >
            <Checklist
              label="Success measures"
              items={goal.measures}
              readOnly={ro}
              addPlaceholder="Add a measure, e.g. SUS above 75"
              onToggle={(m) => update({ measures: goal.measures.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)) })}
              onEdit={(m, t) => update({ measures: goal.measures.map((x) => (x.id === m.id ? { ...x, text: t } : x)) })}
              onDelete={(m) => update({ measures: goal.measures.filter((x) => x.id !== m.id) })}
              onAdd={(t) => update({ measures: [...goal.measures, { id: newId('m'), text: t, done: false }] })}
            />
          </Frame>

          <AssistFrame goal={goal} />
        </div>
      </div>
    </div>
  );
}

function AssistFrame({ goal }: { goal: Goal }) {
  const { data } = useStore();
  return (
    <AssistOnly>
      <Frame tag="Review prep">
        <SectionHeader title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Icon name="sparkles" size={16} />Self-review draft</span>} />
        <AssistPanel
          intro="Claude drafts a first-person self-assessment for this goal from your measures, linked projects and logged updates. Edit it before you share it."
          buttonLabel="Draft self-review"
          buildPrompt={() => goalReviewPrompt(goal, data)}
        />
      </Frame>
    </AssistOnly>
  );
}

/** Renders children only when Claude is available, so empty frames never show. */
function AssistOnly({ children }: { children: ReactNode }) {
  return useAssistant() ? <>{children}</> : null;
}
