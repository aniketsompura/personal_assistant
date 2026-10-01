import * as stylex from '@stylexjs/stylex';
import { motion as m } from 'motion/react';
import type { ReactNode } from 'react';
import type { Goal, Priority, ProjectStatus } from '../data/types';
import { GOAL_HEX, PRIORITY_META, STATUS_FLOW, STATUS_META } from '../lib/meta';
import { color, font, motion, radius, space, text } from '../styles/tokens.stylex';
import { Icon, type IconName } from './Icon';
import { MenuItem, Popover, usePopover } from './Overlay';
import { Dot, Swatch } from './ui';

/* ------------------------------------------------------------------------ */
/* Page header                                                               */
/* ------------------------------------------------------------------------ */

const header = stylex.create({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.lg,
  },
  text: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: '1 1 320px' },
  eyebrow: {
    fontFamily: font.mono,
    fontSize: text.label,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: color.inkFaint,
  },
  title: {
    fontFamily: font.display,
    fontSize: text.h1,
    fontWeight: 700,
    letterSpacing: '-0.025em',
    lineHeight: 1.05,
    color: color.ink,
  },
  sub: { fontSize: text.body, color: color.inkMuted, maxWidth: '62ch' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
});

export function PageHeader({
  eyebrow,
  title,
  sub,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header {...stylex.props(header.root)}>
      <div {...stylex.props(header.text)}>
        {eyebrow && <span {...stylex.props(header.eyebrow)}>{eyebrow}</span>}
        <h1 {...stylex.props(header.title)}>{title}</h1>
        {sub && <div {...stylex.props(header.sub)}>{sub}</div>}
      </div>
      {actions && <div {...stylex.props(header.actions)}>{actions}</div>}
    </header>
  );
}

const section = stylex.create({
  root: { display: 'flex', alignItems: 'center', gap: space.sm, minHeight: 28 },
  title: { fontFamily: font.display, fontSize: text.lead, fontWeight: 650, letterSpacing: '-0.01em' },
  count: { fontFamily: font.mono, fontSize: text.label, color: color.inkFaint },
  actions: { marginInlineStart: 'auto', display: 'flex', gap: space.xs, alignItems: 'center' },
});

export function SectionHeader({ title, count, actions }: { title: ReactNode; count?: ReactNode; actions?: ReactNode }) {
  return (
    <div {...stylex.props(section.root)}>
      <h2 {...stylex.props(section.title)}>{title}</h2>
      {count !== undefined && <span {...stylex.props(section.count)}>{count}</span>}
      {actions && <div {...stylex.props(section.actions)}>{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Status                                                                    */
/* ------------------------------------------------------------------------ */

const pill = stylex.create({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 22,
    paddingInline: 8,
    borderRadius: radius.pill,
    fontSize: text.small,
    fontWeight: 550,
    whiteSpace: 'nowrap',
    color: color.ink,
    backgroundColor: color.sunken,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
  },
  button: {
    cursor: 'pointer',
    transitionProperty: 'border-color, background-color, transform',
    transitionDuration: motion.fast,
    borderColor: { default: color.line, ':hover': color.lineStrong },
    transform: { default: null, ':active': 'scale(0.96)' },
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
  },
  chev: { color: color.inkFaint, marginInlineEnd: -2 },
  hint: { color: color.inkFaint, fontSize: text.small, marginInlineStart: 'auto', paddingInlineStart: space.md },
});

export function StatusPill({ status }: { status: ProjectStatus }) {
  const meta = STATUS_META[status];
  return (
    <span {...stylex.props(pill.root)}>
      <Dot hex={meta.hex} hollow={status === 'paused' || status === 'idea'} />
      {meta.label}
    </span>
  );
}

/** Status pill that opens a menu to change it. */
export function StatusPicker({
  status,
  onChange,
  disabled,
}: {
  status: ProjectStatus;
  onChange: (s: ProjectStatus) => void;
  disabled?: boolean;
}) {
  const pop = usePopover();
  const meta = STATUS_META[status];
  return (
    <>
      <m.button
        ref={pop.triggerRef}
        type="button"
        disabled={disabled}
        onClick={pop.toggle}
        aria-haspopup="menu"
        aria-expanded={pop.open}
        aria-label={`Status: ${meta.label}. Change status`}
        key={status}
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 600, damping: 18 }}
        {...stylex.props(pill.root, pill.button)}
      >
        <Dot hex={meta.hex} hollow={status === 'paused' || status === 'idea'} />
        {meta.label}
        <span {...stylex.props(pill.chev)}>
          <Icon name="chevronDown" size={12} />
        </span>
      </m.button>
      <Popover open={pop.open} onClose={pop.close} anchorRef={pop.triggerRef} width={280}>
        {STATUS_FLOW.map((s) => (
          <MenuItem
            key={s}
            checked={s === status}
            leading={<Dot hex={STATUS_META[s].hex} hollow={s === 'paused' || s === 'idea'} />}
            onSelect={() => {
              pop.close();
              if (s !== status) onChange(s);
            }}
          >
            {STATUS_META[s].label}
            <span {...stylex.props(pill.hint)}>{STATUS_META[s].hint}</span>
          </MenuItem>
        ))}
      </Popover>
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Goal tag                                                                  */
/* ------------------------------------------------------------------------ */

const tag = stylex.create({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    minWidth: 0,
    fontSize: text.small,
    color: color.inkMuted,
  },
  text: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  boxed: {
    height: 22,
    paddingInline: 8,
    borderRadius: radius.xs,
    backgroundColor: color.sunken,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
  },
});

export function GoalTag({ goal, boxed }: { goal: Goal; boxed?: boolean }) {
  return (
    <span title={goal.title} {...stylex.props(tag.root, boxed && tag.boxed)}>
      <Swatch hex={GOAL_HEX[goal.color]} size={8} />
      <span {...stylex.props(tag.text)}>{goal.title}</span>
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* Priority: signal bars                                                     */
/* ------------------------------------------------------------------------ */

const prio = stylex.create({
  root: { display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 12 },
  bar: { width: 3, borderRadius: 1, backgroundColor: color.lineStrong },
  on: { backgroundColor: color.ink },
  high: { backgroundColor: color.redline },
  h1: { height: 5 },
  h2: { height: 8 },
  h3: { height: 11 },
});

export function PriorityBars({ priority }: { priority: Priority }) {
  const n = PRIORITY_META[priority].bars;
  return (
    <span role="img" aria-label={`${PRIORITY_META[priority].label} priority`} {...stylex.props(prio.root)}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          {...stylex.props(
            prio.bar,
            i === 1 ? prio.h1 : i === 2 ? prio.h2 : prio.h3,
            i <= n && (priority === 'high' ? prio.high : prio.on),
          )}
        />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* Empty state                                                               */
/* ------------------------------------------------------------------------ */

const empty = stylex.create({
  root: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.lineStrong,
    backgroundColor: color.surface,
  },
  compact: { padding: space.lg, gap: space.sm },
  icon: {
    display: 'grid',
    placeItems: 'center',
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: color.accentSoft,
    color: color.accent,
  },
  title: { fontFamily: font.display, fontSize: text.lead, fontWeight: 650 },
  body: { color: color.inkMuted, fontSize: text.body, maxWidth: '56ch' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
});

export function EmptyState({
  icon,
  title,
  children,
  actions,
  compact,
}: {
  icon: IconName;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div {...stylex.props(empty.root, compact && empty.compact)}>
      <span {...stylex.props(empty.icon)}>
        <Icon name={icon} size={18} />
      </span>
      <h3 {...stylex.props(empty.title)}>{title}</h3>
      {children && <p {...stylex.props(empty.body)}>{children}</p>}
      {actions && <div {...stylex.props(empty.actions)}>{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Stagger container for lists                                               */
/* ------------------------------------------------------------------------ */

export const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035 } },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 30 } },
} as const;
