import * as stylex from '@stylexjs/stylex';
import { animate, motion as m, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { color, font, motion, radius, text } from '../styles/tokens.stylex';

/* ------------------------------------------------------------------------ */
/* Count-up number                                                           */
/* ------------------------------------------------------------------------ */

/** Animates from the previous value to the new one. */
export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const mv = useMotionValue(value);
  const rounded = useTransform(mv, (v) => `${Math.round(v)}${suffix}`);
  const reduce = useReducedMotion();
  const first = useRef(true);
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    if (first.current) {
      first.current = false;
      mv.set(0);
    }
    const controls = animate(mv, value, { duration: 0.7, ease: [0.2, 0.8, 0.2, 1] });
    return () => controls.stop();
  }, [value, mv, reduce]);
  return <m.span>{rounded}</m.span>;
}

/* ------------------------------------------------------------------------ */
/* Progress bar with a pace marker                                           */
/* ------------------------------------------------------------------------ */

const bar = stylex.create({
  track: {
    position: 'relative',
    width: '100%',
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: color.sunken,
    boxShadow: `inset 0 0 0 1px ${color.line}`,
  },
  thin: { height: 4 },
  thick: { height: 8 },
  fill: {
    position: 'absolute',
    insetBlock: 0,
    left: 0,
    borderRadius: radius.pill,
  },
  fillColor: (c: string) => ({ backgroundColor: c }),
  marker: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    width: 2,
    marginInlineStart: -1,
    borderRadius: 1,
    backgroundColor: color.redline,
    zIndex: 1,
  },
  markerAt: (pct: number) => ({ left: `${pct}%` }),
  markerCap: {
    position: 'absolute',
    top: -3,
    left: -2,
    width: 6,
    height: 2,
    backgroundColor: color.redline,
  },
});

export function ProgressBar({
  value,
  hex,
  pace,
  size = 'md',
  label,
}: {
  value: number;
  hex?: string;
  /** Where you should be by now (percent of the cycle elapsed). Drawn as a redline. */
  pace?: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}) {
  const reduce = useReducedMotion();
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progress'}
      {...stylex.props(bar.track, size === 'sm' && bar.thin, size === 'lg' && bar.thick)}
    >
      <m.div
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${v}%` }}
        transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.8 }}
        {...stylex.props(bar.fill, bar.fillColor(hex ?? color.accent))}
      />
      {pace !== undefined && (
        <span title={`Where you'd be at an even pace: ${pace}%`} {...stylex.props(bar.marker, bar.markerAt(pace))}>
          <span {...stylex.props(bar.markerCap)} />
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Ring                                                                      */
/* ------------------------------------------------------------------------ */

const ring = stylex.create({
  wrap: { position: 'relative', display: 'inline-grid', placeItems: 'center', flexShrink: 0 },
  svg: { display: 'block', transform: 'rotate(-90deg)' },
  track: { stroke: color.sunken },
  center: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    fontFamily: font.mono,
    fontSize: text.label,
    fontWeight: 600,
    color: color.ink,
    fontVariantNumeric: 'tabular-nums',
    transitionProperty: 'transform',
    transitionDuration: motion.base,
  },
});

export function ProgressRing({
  value,
  size = 36,
  stroke = 3.5,
  hex,
  children,
  showValue = true,
}: {
  value: number;
  size?: number;
  stroke?: number;
  hex: string;
  children?: ReactNode;
  showValue?: boolean;
}) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <span {...stylex.props(ring.wrap)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" {...stylex.props(ring.svg)}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} {...stylex.props(ring.track)} />
        <m.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={hex}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (v / 100) * c }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }}
        />
      </svg>
      {(children || showValue) && (
        <span {...stylex.props(ring.center)} style={size < 30 ? { fontSize: 0 } : undefined}>
          {children ?? <CountUp value={v} />}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* Slider: native range input (keyboard + a11y) over a drawn track           */
/* ------------------------------------------------------------------------ */

const slider = stylex.create({
  root: { position: 'relative', height: 24, display: 'flex', alignItems: 'center', minWidth: 0, flex: 1 },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: color.sunken,
    boxShadow: `inset 0 0 0 1px ${color.line}`,
  },
  fill: { position: 'absolute', left: 0, height: 6, borderRadius: radius.pill },
  fillAt: (pct: number, c: string) => ({ width: `${pct}%`, backgroundColor: c }),
  ghost: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: 2,
    marginInlineStart: -1,
    backgroundColor: color.inkFaint,
    opacity: 0.6,
    borderRadius: 1,
  },
  ghostAt: (pct: number) => ({ left: `${pct}%` }),
  thumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    marginInlineStart: -8,
    borderRadius: '50%',
    backgroundColor: color.surface,
    borderWidth: 2,
    borderStyle: 'solid',
    boxShadow: `0 1px 3px ${color.shadow}`,
    pointerEvents: 'none',
    transitionProperty: 'transform, box-shadow',
    transitionDuration: motion.fast,
    transform: {
      default: 'scale(1)',
      [stylex.when.siblingBefore(':active')]: 'scale(1.18)',
      [stylex.when.siblingBefore(':focus-visible')]: 'scale(1.18)',
    },
  },
  thumbAt: (pct: number, c: string) => ({ left: `${pct}%`, borderColor: c }),
  input: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    margin: 0,
    opacity: 0,
    cursor: 'pointer',
  },
});

export function ProgressSlider({
  value,
  onChange,
  onCommit,
  hex,
  from,
  label = 'Progress',
  disabled,
  id,
}: {
  value: number;
  onChange: (v: number) => void;
  /** Fired when the drag or key press ends. */
  onCommit?: (v: number) => void;
  hex?: string;
  /** Where the value started; drawn as a faint tick so you see the change. */
  from?: number;
  label?: string;
  disabled?: boolean;
  id?: string;
}) {
  const c = hex ?? color.accent;
  return (
    <div {...stylex.props(slider.root)}>
      <span {...stylex.props(slider.track)} />
      <span {...stylex.props(slider.fill, slider.fillAt(value, c))} />
      {from !== undefined && from !== value && <span {...stylex.props(slider.ghost, slider.ghostAt(from))} />}
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={`${value}%`}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        {...stylex.props(slider.input, stylex.defaultMarker())}
      />
      <span {...stylex.props(slider.thumb, slider.thumbAt(value, c))} />
    </div>
  );
}
