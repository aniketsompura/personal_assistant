import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { color, font, motion, radius, space, text } from '../styles/tokens.stylex';

/*
 * A "frame" is Workfile's card: a white surface on the dotted canvas with an
 * optional mono name tag above it, like a frame on a design canvas. Interactive
 * frames show selection handles on hover and keyboard focus.
 */

const styles = stylex.create({
  wrap: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  tag: {
    display: 'flex',
    alignItems: 'center',
    gap: space.sm,
    minWidth: 0,
    fontFamily: font.mono,
    fontSize: text.label,
    letterSpacing: '0.03em',
    color: color.inkFaint,
    paddingInline: 2,
  },
  tagText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  tagMeta: { marginInlineStart: 'auto', flexShrink: 0 },
  frame: {
    position: 'relative',
    minWidth: 0,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    boxShadow: `0 1px 2px ${color.shadow}`,
  },
  padded: { padding: space.lg },
  roomy: { padding: space.xl },
  interactive: {
    cursor: 'pointer',
    textAlign: 'start',
    width: '100%',
    color: 'inherit',
    transitionProperty: 'border-color, box-shadow, transform',
    transitionDuration: motion.base,
    transitionTimingFunction: motion.ease,
    borderColor: { default: color.line, ':hover': color.accent, ':focus-visible': color.accent },
    boxShadow: {
      default: `0 1px 2px ${color.shadow}`,
      ':hover': `0 0 0 1px ${color.accent}, 0 8px 24px -12px ${color.shadow}`,
      ':focus-visible': `0 0 0 1px ${color.accent}, 0 0 0 4px ${color.accentSoft}`,
    },
    transform: { default: 'translateY(0)', ':hover': 'translateY(-1px)', ':active': 'translateY(0) scale(0.995)' },
    outline: 'none',
  },
  handle: {
    position: 'absolute',
    width: 7,
    height: 7,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.accent,
    borderRadius: 1,
    pointerEvents: 'none',
    opacity: {
      default: 0,
      [stylex.when.ancestor(':hover')]: 1,
      [stylex.when.ancestor(':focus-visible')]: 1,
    },
    transform: {
      default: 'scale(0.4)',
      [stylex.when.ancestor(':hover')]: 'scale(1)',
      [stylex.when.ancestor(':focus-visible')]: 'scale(1)',
    },
    transitionProperty: 'opacity, transform',
    transitionDuration: motion.base,
    transitionTimingFunction: motion.spring,
    zIndex: 1,
  },
  tl: { top: -4, left: -4 },
  tr: { top: -4, right: -4 },
  bl: { bottom: -4, left: -4 },
  br: { bottom: -4, right: -4 },
});

export function Handles() {
  return (
    <>
      <span aria-hidden="true" {...stylex.props(styles.handle, styles.tl)} />
      <span aria-hidden="true" {...stylex.props(styles.handle, styles.tr)} />
      <span aria-hidden="true" {...stylex.props(styles.handle, styles.bl)} />
      <span aria-hidden="true" {...stylex.props(styles.handle, styles.br)} />
    </>
  );
}

interface FrameProps {
  /** Name tag shown above the frame. */
  tag?: ReactNode;
  /** Right side of the name tag. */
  tagMeta?: ReactNode;
  padding?: 'none' | 'md' | 'lg';
  onClick?: () => void;
  ariaLabel?: string;
  children: ReactNode;
  xstyle?: stylex.StyleXStyles;
  wrapStyle?: stylex.StyleXStyles;
}

export function Frame({ tag, tagMeta, padding = 'md', onClick, ariaLabel, children, xstyle, wrapStyle }: FrameProps) {
  const pad = padding === 'md' ? styles.padded : padding === 'lg' ? styles.roomy : null;
  const body = onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      {...stylex.props(styles.frame, styles.interactive, pad, stylex.defaultMarker(), xstyle)}
    >
      <Handles />
      {children}
    </button>
  ) : (
    <div {...stylex.props(styles.frame, pad, xstyle)}>{children}</div>
  );
  if (!tag && !tagMeta) return body;
  return (
    <div {...stylex.props(styles.wrap, wrapStyle)}>
      <div {...stylex.props(styles.tag)}>
        <span {...stylex.props(styles.tagText)}>{tag}</span>
        {tagMeta && <span {...stylex.props(styles.tagMeta)}>{tagMeta}</span>}
      </div>
      {body}
    </div>
  );
}
