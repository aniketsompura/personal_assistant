import * as stylex from '@stylexjs/stylex';
import { AnimatePresence, motion as m } from 'motion/react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { color, font, motion, radius, space, text } from '../styles/tokens.stylex';
import { Icon, type IconName } from './Icon';

interface ToastInput {
  message: string;
  tone?: 'default' | 'good' | 'error';
  icon?: IconName;
  action?: { label: string; onClick: () => void };
  /** ms; 0 keeps it until dismissed. */
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<(t: ToastInput) => void>(() => undefined);

export const useToast = () => useContext(ToastContext);

const styles = stylex.create({
  stack: {
    position: 'fixed',
    zIndex: 80,
    left: '50%',
    bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column-reverse',
    alignItems: 'center',
    gap: space.sm,
    width: 'min(440px, calc(100vw - 32px))',
    pointerEvents: 'none',
  },
  toast: {
    position: 'relative',
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: space.sm,
    width: '100%',
    minHeight: 42,
    paddingInlineStart: space.md,
    paddingInlineEnd: space.xs,
    paddingBlock: 6,
    overflow: 'hidden',
    borderRadius: radius.md,
    backgroundColor: color.ink,
    color: color.canvas,
    fontSize: text.ui,
    fontWeight: 500,
    boxShadow: `0 12px 32px -10px ${color.shadow}`,
  },
  icon: { color: color.canvas, opacity: 0.8 },
  good: { color: '#40CF8C', opacity: 1 },
  error: { color: '#FF6B70', opacity: 1 },
  message: { flex: 1, minWidth: 0 },
  action: {
    flexShrink: 0,
    height: 28,
    paddingInline: 10,
    borderWidth: 0,
    borderRadius: radius.sm,
    backgroundColor: { default: 'rgba(127,127,127,0.18)', ':hover': 'rgba(127,127,127,0.3)' },
    color: 'inherit',
    fontFamily: font.mono,
    fontSize: text.label,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transitionProperty: 'background-color',
    transitionDuration: motion.fast,
  },
  close: {
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    width: 28,
    height: 28,
    borderWidth: 0,
    borderRadius: radius.sm,
    backgroundColor: { default: 'transparent', ':hover': 'rgba(127,127,127,0.2)' },
    color: 'inherit',
    opacity: 0.7,
    cursor: 'pointer',
  },
  timer: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 2,
    width: '100%',
    transformOrigin: 'left',
    backgroundColor: color.accent,
  },
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = ++seq.current;
      const duration = input.duration ?? (input.action ? 6000 : 3200);
      setItems((list) => [...list.slice(-2), { ...input, id, duration }]);
      if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
    },
    [dismiss],
  );

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" {...stylex.props(styles.stack)}>
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <m.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.14 } }}
              transition={{ type: 'spring', stiffness: 500, damping: 34 }}
              {...stylex.props(styles.toast)}
            >
              <span {...stylex.props(styles.icon, t.tone === 'good' && styles.good, t.tone === 'error' && styles.error)}>
                <Icon name={t.icon ?? (t.tone === 'error' ? 'alert' : 'check')} size={15} />
              </span>
              <span {...stylex.props(styles.message)}>{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  {...stylex.props(styles.action)}
                >
                  {t.action.label}
                </button>
              )}
              <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} {...stylex.props(styles.close)}>
                <Icon name="x" size={14} />
              </button>
              {t.duration ? (
                <m.span
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: t.duration / 1000, ease: 'linear' }}
                  {...stylex.props(styles.timer)}
                />
              ) : null}
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
