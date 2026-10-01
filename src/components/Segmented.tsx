import * as stylex from '@stylexjs/stylex';
import { motion as m } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { color, font, motion, radius, space, text } from '../styles/tokens.stylex';
import { Icon, type IconName } from './Icon';

const SPRING = { type: 'spring', stiffness: 520, damping: 38, mass: 0.7 } as const;

/* ------------------------------------------------------------------------ */
/* Segmented control (pill indicator slides between options)                 */
/* ------------------------------------------------------------------------ */

const seg = stylex.create({
  root: {
    display: 'inline-flex',
    padding: 2,
    gap: 2,
    borderRadius: radius.sm,
    backgroundColor: color.sunken,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    maxWidth: '100%',
    overflowX: 'auto',
  },
  full: { display: 'flex', width: '100%' },
  option: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: '1 0 auto',
    height: 26,
    paddingInline: 10,
    borderWidth: 0,
    borderRadius: 4,
    backgroundColor: 'transparent',
    fontSize: text.small,
    fontWeight: 550,
    color: { default: color.inkMuted, ':hover': color.ink },
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
    transitionProperty: 'color',
    transitionDuration: motion.fast,
  },
  active: { color: color.ink },
  pill: {
    position: 'absolute',
    inset: 0,
    borderRadius: 4,
    backgroundColor: color.surface,
    boxShadow: `0 1px 2px ${color.shadow}, 0 0 0 1px ${color.line}`,
  },
  label: { position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 },
});

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: IconName;
  title?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  full,
  ariaLabel,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  full?: boolean;
  ariaLabel: string;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={ariaLabel} {...stylex.props(seg.root, full && seg.full)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            {...stylex.props(seg.option, active && seg.active)}
          >
            {active && <m.span layoutId={`seg-${id}`} transition={SPRING} {...stylex.props(seg.pill)} />}
            <span {...stylex.props(seg.label)}>
              {o.icon && <Icon name={o.icon} size={14} />}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Tabs (underline slides between tabs)                                      */
/* ------------------------------------------------------------------------ */

const tabs = stylex.create({
  root: {
    display: 'flex',
    gap: space.xs,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: color.line,
    overflowX: 'auto',
    scrollbarWidth: 'none',
  },
  tab: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingInline: 10,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: text.ui,
    fontWeight: 550,
    color: { default: color.inkMuted, ':hover': color.ink },
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
    outlineOffset: -2,
  },
  active: { color: color.ink },
  count: {
    fontFamily: font.mono,
    fontSize: 10,
    minWidth: 18,
    height: 16,
    paddingInline: 4,
    display: 'inline-grid',
    placeItems: 'center',
    borderRadius: radius.pill,
    backgroundColor: color.sunken,
    color: color.inkMuted,
  },
  countActive: { backgroundColor: color.accentSoft, color: color.accent },
  underline: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: -1,
    height: 2,
    borderRadius: 2,
    backgroundColor: color.accent,
  },
});

export interface TabDef<T extends string> {
  value: T;
  label: string;
  count?: number | string;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: TabDef<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  const id = useId();
  return (
    <div role="tablist" aria-label={ariaLabel} {...stylex.props(tabs.root)}>
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            id={`${id}-${t.value}`}
            aria-selected={active}
            onClick={() => onChange(t.value)}
            {...stylex.props(tabs.tab, active && tabs.active)}
          >
            {t.label}
            {t.count !== undefined && t.count !== 0 && (
              <span {...stylex.props(tabs.count, active && tabs.countActive)}>{t.count}</span>
            )}
            {active && <m.span layoutId={`tab-${id}`} transition={SPRING} {...stylex.props(tabs.underline)} />}
          </button>
        );
      })}
    </div>
  );
}
