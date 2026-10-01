import * as stylex from '@stylexjs/stylex';
import type { DataSnapshot, Project } from '../data/types';
import { daysFromToday, formatDate, relativeDays } from '../lib/dates';
import { lastUpdateFor, requirementStats } from '../lib/insights';
import { GOAL_HEX, STATUS_META } from '../lib/meta';
import { color, font, motion, radius, space, text } from '../styles/tokens.stylex';
import { Handles } from './Frame';
import { Icon } from './Icon';
import { ProgressBar } from './Progress';
import { PriorityBars, StatusPill } from './domain';
import { Swatch } from './ui';

const s = stylex.create({
  card: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: { default: color.line, ':hover': color.accent, ':focus-visible': color.accent },
    backgroundColor: color.surface,
    boxShadow: {
      default: `0 1px 2px ${color.shadow}`,
      ':hover': `0 0 0 1px ${color.accent}, 0 8px 20px -10px ${color.shadow}`,
      ':focus-visible': `0 0 0 1px ${color.accent}, 0 0 0 4px ${color.accentSoft}`,
    },
    cursor: 'pointer',
    outline: 'none',
    textAlign: 'start',
    width: '100%',
    color: 'inherit',
    transitionProperty: 'border-color, box-shadow, transform, opacity',
    transitionDuration: motion.base,
    transitionTimingFunction: motion.ease,
    transform: { default: null, ':active': 'scale(0.99)' },
    userSelect: 'none',
  },
  dragging: { opacity: 0.4, transform: 'rotate(-1.5deg) scale(0.98)' },
  top: { display: 'flex', alignItems: 'center', gap: 4, minHeight: 12 },
  pin: { color: color.accent, marginInlineStart: 2 },
  prio: { marginInlineStart: 'auto' },
  title: {
    fontSize: text.body,
    fontWeight: 600,
    lineHeight: 1.35,
    color: color.ink,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    overflowWrap: 'anywhere',
  },
  progressRow: { display: 'flex', alignItems: 'center', gap: space.sm },
  pct: { fontFamily: font.mono, fontSize: text.label, color: color.inkMuted, minWidth: 30, textAlign: 'end' },
  meta: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    fontFamily: font.mono,
    fontSize: 10.5,
    color: color.inkFaint,
    fontVariantNumeric: 'tabular-nums',
  },
  metaItem: { display: 'inline-flex', alignItems: 'center', gap: 4 },
  late: { color: color.redline, fontWeight: 600 },
  soon: { color: color.warn, fontWeight: 600 },
});

export function dueLabel(p: Project): { text: string; tone: 'late' | 'soon' | null } | null {
  if (!p.dueDate) return null;
  if (p.status === 'shipped') return { text: `Due ${formatDate(p.dueDate)}`, tone: null };
  const d = daysFromToday(p.dueDate);
  if (d === null) return null;
  if (d < 0) return { text: `${-d}d overdue`, tone: 'late' };
  if (d <= 7) return { text: d === 0 ? 'Due today' : `Due in ${d}d`, tone: 'soon' };
  return { text: `Due ${formatDate(p.dueDate)}`, tone: null };
}

export function ProjectCard({
  project: p,
  data,
  onOpen,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  showStatus,
}: {
  project: Project;
  data: DataSnapshot;
  onOpen: () => void;
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  showStatus?: boolean;
}) {
  const goals = p.goalIds.map((id) => data.goals[id]).filter(Boolean);
  const last = lastUpdateFor(p.id, data.updates);
  const req = requirementStats(p);
  const due = dueLabel(p);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${p.title}, ${STATUS_META[p.status].label}, ${p.progress}% done`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      {...stylex.props(s.card, dragging && s.dragging, stylex.defaultMarker())}
    >
      <Handles />
      <div {...stylex.props(s.top)}>
        {goals.slice(0, 4).map((g) => (
          <span key={g.id} title={g.title}>
            <Swatch hex={GOAL_HEX[g.color]} size={8} />
          </span>
        ))}
        {p.pinned && (
          <span {...stylex.props(s.pin)} title="Pinned">
            <Icon name="pin" size={12} />
          </span>
        )}
        <span {...stylex.props(s.prio)}>
          <PriorityBars priority={p.priority} />
        </span>
      </div>
      <span {...stylex.props(s.title)}>{p.title}</span>
      {showStatus && (
        <span>
          <StatusPill status={p.status} />
        </span>
      )}
      <div {...stylex.props(s.progressRow)}>
        <ProgressBar value={p.progress} hex={STATUS_META[p.status].hex} size="sm" label={`${p.title} progress`} />
        <span {...stylex.props(s.pct)}>{p.progress}%</span>
      </div>
      <div {...stylex.props(s.meta)}>
        {due && (
          <span {...stylex.props(s.metaItem, due.tone === 'late' && s.late, due.tone === 'soon' && s.soon)}>
            <Icon name="flag" size={11} />
            {due.text}
          </span>
        )}
        {req.total > 0 && (
          <span {...stylex.props(s.metaItem)} title="Requirements done">
            <Icon name="checkSquare" size={11} />
            {req.done}/{req.total}
          </span>
        )}
        <span {...stylex.props(s.metaItem)} title="Last update">
          <Icon name="clock" size={11} />
          {last ? relativeDays(last.date) : 'no updates'}
        </span>
      </div>
    </div>
  );
}
