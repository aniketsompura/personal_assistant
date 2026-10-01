import * as stylex from '@stylexjs/stylex';
import {
  forwardRef,
  useLayoutEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { color, font, motion, radius, space, text } from '../styles/tokens.stylex';
import { Icon, type IconName } from './Icon';

/* ------------------------------------------------------------------------ */
/* Buttons                                                                   */
/* ------------------------------------------------------------------------ */

const btn = stylex.create({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    flexShrink: 0,
    height: 32,
    paddingInline: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'solid',
    fontFamily: font.body,
    fontSize: text.ui,
    fontWeight: 550,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    cursor: { default: 'pointer', ':disabled': 'not-allowed' },
    opacity: { default: 1, ':disabled': 0.5 },
    userSelect: 'none',
    textDecoration: 'none',
    transitionProperty: 'background-color, border-color, color, transform, box-shadow',
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.ease,
    transform: { default: null, ':active': 'scale(0.97)' },
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
    outlineOffset: 2,
  },
  sm: { height: 26, paddingInline: space.sm, fontSize: text.small, gap: space.xs },
  primary: {
    backgroundColor: { default: color.accent, ':hover': color.accentHover },
    borderColor: 'transparent',
    color: color.accentInk,
    boxShadow: `0 1px 0 rgba(255,255,255,0.18) inset, 0 1px 2px ${color.shadow}`,
  },
  secondary: {
    backgroundColor: { default: color.surface, ':hover': color.sunken },
    borderColor: { default: color.line, ':hover': color.lineStrong },
    color: color.ink,
    boxShadow: `0 1px 2px ${color.shadow}`,
  },
  ghost: {
    backgroundColor: { default: 'transparent', ':hover': color.hover },
    borderColor: 'transparent',
    color: { default: color.inkMuted, ':hover': color.ink },
  },
  danger: {
    backgroundColor: { default: color.redlineSoft, ':hover': color.redline },
    borderColor: 'transparent',
    color: { default: color.redline, ':hover': '#fff' },
  },
  iconOnly: { width: 32, paddingInline: 0 },
  iconOnlySm: { width: 26, paddingInline: 0 },
  full: { width: '100%' },
});

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: IconName;
  iconRight?: IconName;
  full?: boolean;
  xstyle?: stylex.StyleXStyles;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, full, xstyle, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      {...stylex.props(btn.base, size === 'sm' && btn.sm, btn[variant], full && btn.full, xstyle)}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 14 : 16} />}
    </button>
  );
});

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  label: string;
  variant?: 'secondary' | 'ghost' | 'danger' | 'primary';
  size?: 'sm' | 'md';
  xstyle?: stylex.StyleXStyles;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = 'ghost', size = 'md', xstyle, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      {...rest}
      {...stylex.props(
        btn.base,
        size === 'sm' && btn.sm,
        btn[variant],
        size === 'sm' ? btn.iconOnlySm : btn.iconOnly,
        xstyle,
      )}
    >
      <Icon name={icon} size={size === 'sm' ? 14 : 16} />
    </button>
  );
});

/* ------------------------------------------------------------------------ */
/* Form controls                                                             */
/* ------------------------------------------------------------------------ */

const field = stylex.create({
  control: {
    width: '100%',
    minWidth: 0,
    height: 34,
    paddingInline: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: { default: color.line, ':hover': color.lineStrong, ':focus': color.accent },
    backgroundColor: color.surface,
    color: color.ink,
    fontSize: text.body,
    outline: 'none',
    boxShadow: { default: 'none', ':focus': `0 0 0 3px ${color.accentSoft}` },
    transitionProperty: 'border-color, box-shadow',
    transitionDuration: motion.fast,
    '::placeholder': { color: color.inkFaint },
  },
  compact: { height: 28, fontSize: text.ui, paddingInline: space.sm },
  bare: {
    borderColor: { default: 'transparent', ':hover': color.line, ':focus': color.accent },
    backgroundColor: { default: 'transparent', ':focus': color.surface },
  },
  textarea: {
    height: 'auto',
    minHeight: 72,
    paddingBlock: space.sm,
    lineHeight: 1.55,
    resize: 'none',
    overflow: 'hidden',
  },
  select: {
    appearance: 'none',
    paddingInlineEnd: 28,
    cursor: 'pointer',
  },
  selectWrap: { position: 'relative', display: 'flex', minWidth: 0 },
  selectChevron: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    color: color.inkFaint,
  },
  wrap: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  label: {
    fontFamily: font.mono,
    fontSize: text.label,
    fontWeight: 500,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: color.inkMuted,
  },
  hint: { fontSize: text.small, color: color.inkFaint },
});

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  compact?: boolean;
  bare?: boolean;
  xstyle?: stylex.StyleXStyles;
};

export const TextInput = forwardRef<HTMLInputElement, InputProps>(function TextInput(
  { compact, bare, xstyle, type = 'text', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      {...rest}
      {...stylex.props(field.control, compact && field.compact, bare && field.bare, xstyle)}
    />
  );
});

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  bare?: boolean;
  minRows?: number;
  xstyle?: stylex.StyleXStyles;
};

/** Grows with its content. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { bare, xstyle, value, minRows = 3, ...rest },
  forwarded,
) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={(el) => {
        inner.current = el;
        if (typeof forwarded === 'function') forwarded(el);
        else if (forwarded) forwarded.current = el;
      }}
      rows={minRows}
      value={value}
      {...rest}
      {...stylex.props(field.control, field.textarea, bare && field.bare, xstyle)}
    />
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  compact?: boolean;
  xstyle?: stylex.StyleXStyles;
};

export function Select({ compact, xstyle, children, ...rest }: SelectProps) {
  return (
    <span {...stylex.props(field.selectWrap, xstyle)}>
      <select {...rest} {...stylex.props(field.control, field.select, compact && field.compact)}>
        {children}
      </select>
      <span {...stylex.props(field.selectChevron)}>
        <Icon name="chevronDown" size={14} />
      </span>
    </span>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  xstyle,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  xstyle?: stylex.StyleXStyles;
}) {
  return (
    <div {...stylex.props(field.wrap, xstyle)}>
      <label htmlFor={htmlFor} {...stylex.props(field.label)}>
        {label}
      </label>
      {children}
      {hint && <span {...stylex.props(field.hint)}>{hint}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Small atoms                                                               */
/* ------------------------------------------------------------------------ */

const atoms = stylex.create({
  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 18,
    height: 18,
    paddingInline: 4,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    backgroundColor: color.sunken,
    fontFamily: font.mono,
    fontSize: 10,
    color: color.inkMuted,
    lineHeight: 1,
  },
  swatch: {
    display: 'inline-block',
    flexShrink: 0,
    borderRadius: 2,
    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)',
  },
  swatchColor: (c: string, size: number) => ({ backgroundColor: c, width: size, height: size }),
  dot: { display: 'inline-block', flexShrink: 0, width: 8, height: 8, borderRadius: '50%' },
  dotColor: (c: string) => ({ backgroundColor: c }),
  dotHollow: (c: string) => ({ backgroundColor: 'transparent', boxShadow: `inset 0 0 0 1.5px ${c}` }),
  mono: {
    fontFamily: font.mono,
    fontSize: text.label,
    letterSpacing: '0.02em',
    color: color.inkMuted,
    fontVariantNumeric: 'tabular-nums',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 22,
    paddingInline: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.sunken,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    fontSize: text.small,
    fontWeight: 500,
    color: color.inkMuted,
    whiteSpace: 'nowrap',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  label: {
    fontFamily: font.mono,
    fontSize: text.label,
    fontWeight: 500,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: color.inkFaint,
  },
});

export const Kbd = ({ children }: { children: ReactNode }) => <kbd {...stylex.props(atoms.kbd)}>{children}</kbd>;

export const Swatch = ({ hex, size = 10 }: { hex: string; size?: number }) => (
  <span aria-hidden="true" {...stylex.props(atoms.swatch, atoms.swatchColor(hex, size))} />
);

export const Dot = ({ hex, hollow }: { hex: string; hollow?: boolean }) => (
  <span aria-hidden="true" {...stylex.props(atoms.dot, hollow ? atoms.dotHollow(hex) : atoms.dotColor(hex))} />
);

export const Mono = ({ children, xstyle }: { children: ReactNode; xstyle?: stylex.StyleXStyles }) => (
  <span {...stylex.props(atoms.mono, xstyle)}>{children}</span>
);

export const Chip = ({ children, xstyle }: { children: ReactNode; xstyle?: stylex.StyleXStyles }) => (
  <span {...stylex.props(atoms.chip, xstyle)}>{children}</span>
);

/** Uppercase mono section label, like a panel heading in a design tool. */
export const PanelLabel = ({ children, xstyle }: { children: ReactNode; xstyle?: stylex.StyleXStyles }) => (
  <span {...stylex.props(atoms.label, xstyle)}>{children}</span>
);

/** Plain link that always opens in a new tab (the artifact frame needs real anchors). */
export function ExternalLink({
  href,
  children,
  xstyle,
}: {
  href: string;
  children: ReactNode;
  xstyle?: stylex.StyleXStyles;
}) {
  const safe = /^(https?:)?\/\//i.test(href) ? href : `https://${href}`;
  return (
    <a href={safe} target="_blank" rel="noopener noreferrer" {...stylex.props(xstyle)}>
      {children}
    </a>
  );
}
