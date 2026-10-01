import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import { useStore } from '../../data/store';
import { PRIORITIES, type Project } from '../../data/types';
import { daysBetween, formatDate, localDay, parseDate, relativeDays } from '../../lib/dates';
import { lastUpdateFor } from '../../lib/insights';
import { GOAL_HEX, PRIORITY_META, STATUS_META } from '../../lib/meta';
import { color, font, radius, space, text } from '../../styles/tokens.stylex';
import { StatusPicker, GoalTag } from '../../components/domain';
import { ProgressRing, ProgressSlider } from '../../components/Progress';
import { Segmented } from '../../components/Segmented';
import { MenuItem, Popover, useConfirm, usePopover } from '../../components/Overlay';
import { Button, IconButton, PanelLabel, Swatch, TextInput } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useRouter } from '../../app/router';
import { useMediaQuery } from '../../lib/useMedia';
import { dueLabel } from '../../components/ProjectCard';
import { AnimatePresence, motion as m } from 'motion/react';

/*
 * The properties panel, modelled on a design tool's inspector: compact rows,
 * mono labels, every field editable in place.
 */

const s = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    backgroundColor: color.surface,
    boxShadow: `0 1px 2px ${color.shadow}`,
    overflow: 'hidden',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: space.lg,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: color.line,
  },
  last: { borderBottomWidth: 0 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, minWidth: 0 },
  progress: { display: 'flex', alignItems: 'center', gap: space.md },
  pct: { fontFamily: font.mono, fontSize: text.small, minWidth: 36, textAlign: 'end', fontVariantNumeric: 'tabular-nums' },
  goals: { display: 'flex', flexDirection: 'column', gap: 4 },
  goalRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
    justifyContent: 'space-between',
  },
  goalBtn: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    textAlign: 'start',
    cursor: 'pointer',
    display: 'flex',
  },
  dates: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: space.sm },
  dateField: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  dateLabel: { fontSize: text.small, color: color.inkFaint },
  spec: { display: 'flex', alignItems: 'center', gap: 4, color: color.redline, marginTop: 2 },
  specTick: { width: 1, height: 9, backgroundColor: color.redline, flexShrink: 0 },
  specLine: { flex: 1, height: 1, backgroundColor: color.redline, opacity: 0.6 },
  specLabel: {
    fontFamily: font.mono,
    fontSize: 10,
    fontWeight: 600,
    paddingInline: 5,
    height: 16,
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 3,
    backgroundColor: color.redlineSoft,
    whiteSpace: 'nowrap',
  },
  specMuted: { color: color.inkFaint },
  specMutedBg: { backgroundColor: color.inkFaint },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    height: 22,
    paddingInlineStart: 8,
    paddingInlineEnd: 2,
    borderRadius: radius.xs,
    backgroundColor: color.sunken,
    fontSize: text.small,
    color: color.inkMuted,
  },
  tagX: {
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
  facts: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: text.small, color: color.inkMuted },
  fact: { display: 'flex', justifyContent: 'space-between', gap: space.sm },
  factVal: { fontFamily: font.mono, fontSize: text.label, color: color.ink },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  muted: { fontSize: text.small, color: color.inkFaint },
  summary: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.md,
    paddingInline: space.lg,
    paddingBlock: space.md,
  },
  summaryPct: { fontFamily: font.mono, fontSize: text.small, color: color.inkMuted },
  summaryDue: { fontFamily: font.mono, fontSize: text.small, color: color.inkMuted },
  summaryLate: { color: color.redline },
  summaryToggle: { marginInlineStart: 'auto' },
  chev: { display: 'inline-grid', transitionProperty: 'transform', transitionDuration: '200ms' },
  chevOpen: { transform: 'rotate(180deg)' },
  divider: { borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: color.line },
});

function SpecLine({ start, due }: { start: string | null; due: string | null }) {
  const a = parseDate(start);
  const b = parseDate(due);
  if (!b) return null;
  const left = daysBetween(new Date(), b);
  const span = a ? daysBetween(a, b) : null;
  const label = left < 0 ? `${-left}d overdue` : left === 0 ? 'due today' : `${left}d left${span ? ` of ${span}` : ''}`;
  const muted = left > 14;
  return (
    <div {...stylex.props(s.spec, muted && s.specMuted)} aria-label={label}>
      <span {...stylex.props(s.specTick, muted && s.specMutedBg)} />
      <span {...stylex.props(s.specLine, muted && s.specMutedBg)} />
      <span {...stylex.props(s.specLabel)}>{label}</span>
      <span {...stylex.props(s.specLine, muted && s.specMutedBg)} />
      <span {...stylex.props(s.specTick, muted && s.specMutedBg)} />
    </div>
  );
}

export function Inspector({ project: p }: { project: Project }) {
  const { data, actions, meta } = useStore();
  const { navigate } = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const goalPop = usePopover();
  const del = useConfirm();
  const ro = meta.readOnly;
  const update = (body: Partial<Project>, silent = false) => actions.updateProject(p.id, body, { silent });
  const goals = p.goalIds.map((g) => data.goals[g]).filter(Boolean);
  const otherGoals = Object.values(data.goals)
    .filter((g) => !p.goalIds.includes(g.id))
    .sort((a, b) => a.order - b.order);
  const last = lastUpdateFor(p.id, data.updates);
  const shown = progress ?? p.progress;
  const compact = useMediaQuery('(max-width: 1080px)');
  const [open, setOpen] = useState(false);
  const due = dueLabel(p);

  if (compact) {
    return (
      <aside aria-label="Project properties" {...stylex.props(s.root)}>
        <div {...stylex.props(s.summary)}>
          <StatusPicker status={p.status} disabled={ro} onChange={(status) => update({ status })} />
          <ProgressRing value={p.progress} size={26} stroke={3} hex={STATUS_META[p.status].hex} showValue={false} />
          <span {...stylex.props(s.summaryPct)}>{p.progress}%</span>
          {due && <span {...stylex.props(s.summaryDue, due.tone === 'late' && s.summaryLate)}>{due.text}</span>}
          <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)} xstyle={s.summaryToggle}>
            {open ? 'Hide properties' : 'All properties'}
            <span {...stylex.props(s.chev, open && s.chevOpen)}>
              <Icon name="chevronDown" size={14} />
            </span>
          </Button>
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <m.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              style={{ overflow: 'hidden' }}
              {...stylex.props(s.divider)}
            >
              {sections()}
            </m.div>
          )}
        </AnimatePresence>
      </aside>
    );
  }

  return (
    <aside aria-label="Project properties" {...stylex.props(s.root)}>
      <div {...stylex.props(s.section)}>
        <div {...stylex.props(s.row)}>
          <PanelLabel>Stage</PanelLabel>
          <StatusPicker status={p.status} disabled={ro} onChange={(status) => update({ status })} />
        </div>
      </div>
      {sections()}
    </aside>
  );

  function sections() {
    return (
      <>

      <div {...stylex.props(s.section)}>
        <PanelLabel>Progress</PanelLabel>
        <div {...stylex.props(s.progress)}>
          <ProgressRing value={shown} size={44} stroke={4} hex={STATUS_META[p.status].hex} />
          <ProgressSlider
            id="inspector-progress"
            value={shown}
            hex={STATUS_META[p.status].hex}
            disabled={ro}
            onChange={setProgress}
            onCommit={(v) => {
              setProgress(null);
              if (v !== p.progress) update({ progress: v });
            }}
          />
          <span {...stylex.props(s.pct)}>{shown}%</span>
        </div>
      </div>

      <div {...stylex.props(s.section)}>
        <PanelLabel>Priority</PanelLabel>
        <Segmented
          ariaLabel="Priority"
          full
          value={p.priority}
          onChange={(priority) => !ro && update({ priority }, true)}
          options={PRIORITIES.map((x) => ({ value: x, label: PRIORITY_META[x].label }))}
        />
      </div>

      <div {...stylex.props(s.section)}>
        <div {...stylex.props(s.row)}>
          <PanelLabel>Goals</PanelLabel>
          {!ro && otherGoals.length > 0 && (
            <>
              <IconButton ref={goalPop.triggerRef} icon="plus" label="Link to a goal" size="sm" onClick={goalPop.toggle} />
              <Popover open={goalPop.open} onClose={goalPop.close} anchorRef={goalPop.triggerRef} align="end" width={280}>
                {otherGoals.map((g) => (
                  <MenuItem
                    key={g.id}
                    leading={<Swatch hex={GOAL_HEX[g.color]} />}
                    onSelect={() => {
                      update({ goalIds: [...p.goalIds, g.id] }, true);
                      goalPop.close();
                    }}
                  >
                    {g.title}
                  </MenuItem>
                ))}
              </Popover>
            </>
          )}
        </div>
        {goals.length ? (
          <div {...stylex.props(s.goals)}>
            {goals.map((g) => (
              <div key={g.id} {...stylex.props(s.goalRow)}>
                <button type="button" onClick={() => navigate({ name: 'goal', id: g.id })} {...stylex.props(s.goalBtn)}>
                  <GoalTag goal={g} />
                </button>
                {!ro && (
                  <IconButton
                    icon="x"
                    label={`Unlink ${g.title}`}
                    size="sm"
                    onClick={() => update({ goalIds: p.goalIds.filter((x) => x !== g.id) }, true)}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <span {...stylex.props(s.muted)}>Not linked to a goal yet.</span>
        )}
      </div>

      <div {...stylex.props(s.section)}>
        <PanelLabel>Timeline</PanelLabel>
        <div {...stylex.props(s.dates)}>
          <label {...stylex.props(s.dateField)}>
            <span {...stylex.props(s.dateLabel)}>Start</span>
            <TextInput
              type="date"
              compact
              readOnly={ro}
              value={p.startDate ?? ''}
              onChange={(e) => update({ startDate: e.target.value || null }, true)}
            />
          </label>
          <label {...stylex.props(s.dateField)}>
            <span {...stylex.props(s.dateLabel)}>Due</span>
            <TextInput
              type="date"
              compact
              readOnly={ro}
              value={p.dueDate ?? ''}
              min={p.startDate ?? undefined}
              onChange={(e) => update({ dueDate: e.target.value || null }, true)}
            />
          </label>
        </div>
        {p.status !== 'shipped' && <SpecLine start={p.startDate} due={p.dueDate} />}
      </div>

      <div {...stylex.props(s.section)}>
        <PanelLabel>Team</PanelLabel>
        <TextInput
          compact
          bare
          key={`team-${p.updatedAt}`}
          readOnly={ro}
          defaultValue={p.team}
          placeholder="PM, engineering lead, stakeholders"
          aria-label="Team"
          onBlur={(e) => e.target.value !== p.team && update({ team: e.target.value }, true)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>

      <div {...stylex.props(s.section)}>
        <PanelLabel>Tags</PanelLabel>
        {p.tags.length > 0 && (
          <div {...stylex.props(s.tags)}>
            {p.tags.map((t) => (
              <span key={t} {...stylex.props(s.tag)}>
                {t}
                {!ro && (
                  <button
                    type="button"
                    aria-label={`Remove tag ${t}`}
                    onClick={() => update({ tags: p.tags.filter((x) => x !== t) }, true)}
                    {...stylex.props(s.tagX)}
                  >
                    <Icon name="x" size={10} />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        {!ro && (
          <TextInput
            compact
            bare
            value={tagDraft}
            placeholder="Add a tag and press Enter"
            aria-label="Add tag"
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const t = tagDraft.trim().replace(/,$/, '');
                if (t && !p.tags.includes(t)) update({ tags: [...p.tags, t] }, true);
                setTagDraft('');
              }
            }}
          />
        )}
      </div>

      <div {...stylex.props(s.section)}>
        <PanelLabel>Activity</PanelLabel>
        <div {...stylex.props(s.facts)}>
          <span {...stylex.props(s.fact)}>
            Created <span {...stylex.props(s.factVal)}>{formatDate(localDay(p.createdAt))}</span>
          </span>
          <span {...stylex.props(s.fact)}>
            Last update <span {...stylex.props(s.factVal)}>{last ? relativeDays(last.date) : 'none yet'}</span>
          </span>
        </div>
      </div>

      {!ro && (
        <div {...stylex.props(s.section, s.last)}>
          <div {...stylex.props(s.actions)}>
            <Button size="sm" variant="ghost" icon="pin" onClick={() => update({ pinned: !p.pinned }, true)}>
              {p.pinned ? 'Unpin' : 'Pin'}
            </Button>
            <Button size="sm" variant="ghost" icon="archive" onClick={() => update({ archived: !p.archived }, true)}>
              {p.archived ? 'Restore' : 'Archive'}
            </Button>
            <Button
              size="sm"
              variant={del.armed ? 'danger' : 'ghost'}
              icon="trash"
              onClick={() => {
                if (del.trigger()) {
                  actions.deleteProject(p.id);
                  navigate({ name: 'projects' });
                }
              }}
            >
              {del.armed ? 'Click again to delete' : 'Delete'}
            </Button>
          </div>
        </div>
      )}
      </>
    );
  }
}
