import * as stylex from '@stylexjs/stylex';
import { motion as m } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DataSnapshot, Project } from '../data/types';
import { daysBetween, formatDate, formatMonthShort, localDay, parseDate } from '../lib/dates';
import { cycleInfo } from '../lib/insights';
import { GOAL_HEX, STATUS_META } from '../lib/meta';
import { color, font, motion, radius, space, text } from '../styles/tokens.stylex';

/*
 * The cycle drawn like a design-tool ruler: month ticks across the top, a
 * redline marking today, and each dated project as a bar from start to due,
 * filled to its progress.
 */

const ROW = 26;
const MAX_ROWS = 8;

const s = stylex.create({
  scroller: { overflowX: 'auto', marginInline: -4, paddingInline: 4, paddingBottom: 2 },
  canvas: { position: 'relative', minWidth: 640 },
  ruler: {
    position: 'relative',
    height: 28,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: color.lineStrong,
  },
  tick: { position: 'absolute', bottom: 0, width: 1, backgroundColor: color.lineStrong },
  tickMajor: { height: 10 },
  tickMinor: { height: 5, backgroundColor: color.line },
  tickAt: (pct: number) => ({ left: `${pct}%` }),
  month: {
    position: 'absolute',
    top: 2,
    paddingInlineStart: 4,
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: color.inkFaint,
    whiteSpace: 'nowrap',
  },
  past: {
    position: 'absolute',
    top: 28,
    bottom: 0,
    left: 0,
    backgroundImage: `repeating-linear-gradient(135deg, transparent 0 6px, ${color.hover} 6px 7px)`,
    pointerEvents: 'none',
  },
  pastTo: (pct: number) => ({ width: `${pct}%` }),
  rows: { position: 'relative', paddingTop: 10, paddingBottom: 6 },
  rowsHeight: (n: number) => ({ height: n * ROW + 16 }),
  bar: {
    position: 'absolute',
    height: 20,
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: radius.xs,
    borderWidth: 0,
    padding: 0,
    cursor: 'pointer',
    textAlign: 'start',
    transitionProperty: 'transform, box-shadow',
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.ease,
    transform: { default: 'translateY(0)', ':hover': 'translateY(-1px)' },
    boxShadow: { default: 'none', ':hover': `0 4px 12px -4px ${color.shadow}`, ':focus-visible': `0 0 0 2px ${color.accent}` },
    outline: 'none',
  },
  barPos: (left: number, width: number, top: number, tint: string, edge: string) => ({
    left: `${left}%`,
    width: `${width}%`,
    top,
    backgroundColor: tint,
    boxShadow: `inset 2px 0 0 ${edge}`,
  }),
  barFill: { position: 'absolute', insetBlock: 0, left: 0, opacity: 0.32 },
  barFillAt: (pct: number, c: string) => ({ width: `${pct}%`, backgroundColor: c }),
  barLabel: {
    position: 'relative',
    paddingInline: 8,
    fontSize: text.small,
    fontWeight: 550,
    color: color.ink,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  today: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 0,
    borderInlineStartWidth: 1.5,
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: color.redline,
    zIndex: 2,
    pointerEvents: 'none',
  },
  todayAt: (pct: number) => ({ left: `${pct}%` }),
  todayTag: {
    position: 'absolute',
    top: -1,
    left: 0,
    transform: 'translateX(-50%)',
    paddingInline: 6,
    height: 18,
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 3,
    backgroundColor: color.redline,
    color: '#fff',
    fontFamily: font.mono,
    fontSize: 10,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  foot: { display: 'flex', flexWrap: 'wrap', gap: space.md, justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm },
  hint: { fontSize: text.small, color: color.inkFaint },
  more: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    padding: 0,
    color: { default: color.accent, ':hover': color.accentHover },
    fontSize: text.small,
    fontWeight: 550,
    cursor: 'pointer',
  },
});

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

export function CycleRuler({ data, onOpen }: { data: DataSnapshot; onOpen: (p: Project) => void }) {
  const cycle = cycleInfo(data.settings);
  const [showAll, setShowAll] = useState(false);

  const toPct = (d: Date) => clampPct((daysBetween(cycle.start, d) / cycle.totalDays) * 100);

  const months = useMemo(() => {
    const out: { pct: number; label: string }[] = [];
    const d = new Date(cycle.start.getFullYear(), cycle.start.getMonth(), 1);
    if (d < cycle.start) d.setMonth(d.getMonth() + 1);
    while (d <= cycle.end) {
      out.push({ pct: toPct(d), label: formatMonthShort(d) + (d.getMonth() === 0 ? ` ’${String(d.getFullYear()).slice(2)}` : '') });
      d.setMonth(d.getMonth() + 1);
    }
    return out;
  }, [cycle.start.getTime(), cycle.end.getTime()]);

  const weeks = useMemo(() => {
    const out: number[] = [];
    for (let i = 7; i < cycle.totalDays; i += 7) out.push((i / cycle.totalDays) * 100);
    return out;
  }, [cycle.totalDays]);

  const bars = useMemo(() => {
    return Object.values(data.projects)
      .filter((p) => !p.archived && (p.startDate || p.dueDate))
      .map((p) => {
        const start = parseDate(p.startDate) ?? parseDate(localDay(p.createdAt)) ?? cycle.start;
        const end = parseDate(p.dueDate) ?? new Date(Math.max(start.getTime(), Date.now()) + 14 * 86_400_000);
        return { p, start, end };
      })
      .filter(({ start, end }) => end >= cycle.start && start <= cycle.end)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [data.projects, cycle.start, cycle.end]);

  const shown = showAll ? bars : bars.slice(0, MAX_ROWS);
  const todayPct = cycle.pct;
  const scroller = useRef<HTMLDivElement | null>(null);

  // On narrow screens the ruler scrolls; start with today in view.
  useEffect(() => {
    const el = scroller.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = (todayPct / 100) * el.scrollWidth - el.clientWidth / 2;
  }, [todayPct]);

  return (
    <div>
      <div ref={scroller} {...stylex.props(s.scroller)}>
        <div {...stylex.props(s.canvas)}>
          <div {...stylex.props(s.ruler)}>
            {weeks.map((w) => (
              <span key={w} {...stylex.props(s.tick, s.tickMinor, s.tickAt(w))} />
            ))}
            {months.map((mo) => (
              <span key={mo.pct}>
                <span {...stylex.props(s.tick, s.tickMajor, s.tickAt(mo.pct))} />
                <span {...stylex.props(s.month, s.tickAt(mo.pct))}>{mo.label}</span>
              </span>
            ))}
          </div>
          <span aria-hidden="true" {...stylex.props(s.past, s.pastTo(todayPct))} />
          <div {...stylex.props(s.rows, s.rowsHeight(Math.max(1, shown.length)))}>
            {shown.map(({ p, start, end }, i) => {
              const left = toPct(start);
              const width = Math.max(2.2, toPct(end) - left);
              const goal = p.goalIds.map((g) => data.goals[g]).find(Boolean);
              const hex = goal ? GOAL_HEX[goal.color] : STATUS_META[p.status].hex;
              const sx = stylex.props(s.bar, s.barPos(left, width, 10 + i * ROW, `${hex}26`, hex));
              return (
                <m.button
                  key={p.id}
                  type="button"
                  title={`${p.title} · ${formatDate(p.startDate)} → ${formatDate(p.dueDate)} · ${p.progress}%`}
                  onClick={() => onOpen(p)}
                  initial={{ opacity: 0, scaleX: 0.6 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 26, delay: i * 0.03 }}
                  className={sx.className}
                  style={{ ...sx.style, originX: 0 }}
                >
                  <span {...stylex.props(s.barFill, s.barFillAt(p.progress, hex))} />
                  <span {...stylex.props(s.barLabel)}>{p.title}</span>
                </m.button>
              );
            })}
          </div>
          <span aria-hidden="true" {...stylex.props(s.today, s.todayAt(todayPct))}>
            <span {...stylex.props(s.todayTag)}>Today</span>
          </span>
        </div>
      </div>
      <div {...stylex.props(s.foot)}>
        <span {...stylex.props(s.hint)}>
          {bars.length === 0
            ? 'Give projects a start or due date to see them on the cycle.'
            : 'Bars run from start to due date, filled to progress. Hatched area is time already spent.'}
        </span>
        {bars.length > MAX_ROWS && (
          <button type="button" onClick={() => setShowAll((v) => !v)} {...stylex.props(s.more)}>
            {showAll ? 'Show fewer' : `Show all ${bars.length}`}
          </button>
        )}
      </div>
    </div>
  );
}
