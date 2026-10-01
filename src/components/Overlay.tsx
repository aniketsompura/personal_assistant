import * as stylex from '@stylexjs/stylex';
import { AnimatePresence, motion as m } from 'motion/react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { color, font, radius, space, text } from '../styles/tokens.stylex';
import { Icon, type IconName } from './Icon';
import { IconButton } from './ui';

/* ------------------------------------------------------------------------ */
/* Popover: anchored to a trigger, rendered in a portal so panels never clip */
/* ------------------------------------------------------------------------ */

const pop = stylex.create({
  panel: {
    position: 'fixed',
    zIndex: 60,
    minWidth: 200,
    maxWidth: 'min(320px, calc(100vw - 24px))',
    maxHeight: 'min(360px, calc(100vh - 24px))',
    overflowY: 'auto',
    padding: space.xs,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    boxShadow: `0 12px 32px -8px ${color.shadow}, 0 2px 6px ${color.shadow}`,
    transformOrigin: 'top left',
  },
  pos: (top: number, left: number) => ({ top, left }),
});

export function usePopover() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);
  return { open, setOpen, toggle, close, triggerRef };
}

export function Popover({
  open,
  onClose,
  anchorRef,
  children,
  align = 'start',
  width,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  align?: 'start' | 'end';
  width?: number;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ top: -9999, left: -9999 });

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      const p = panelRef.current?.getBoundingClientRect();
      if (!a) return;
      const pw = p?.width ?? width ?? 220;
      const ph = p?.height ?? 200;
      let left = align === 'end' ? a.right - pw : a.left;
      left = Math.max(12, Math.min(left, window.innerWidth - pw - 12));
      let top = a.bottom + 6;
      if (top + ph > window.innerHeight - 12) top = Math.max(12, a.top - ph - 6);
      setPos({ top, left });
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchorRef, align, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        anchorRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, onClose, anchorRef]);

  const panelSx = stylex.props(pop.panel, pop.pos(pos.top, pos.left));
  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          ref={panelRef}
          initial={{ opacity: 0, scale: 0.96, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -2, transition: { duration: 0.1 } }}
          transition={{ type: 'spring', stiffness: 600, damping: 36 }}
          className={panelSx.className}
          style={{ ...panelSx.style, ...(width ? { width } : null) }}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

const menu = stylex.create({
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: space.sm,
    width: '100%',
    minHeight: 30,
    paddingInline: space.sm,
    paddingBlock: 4,
    borderWidth: 0,
    borderRadius: 4,
    backgroundColor: { default: 'transparent', ':hover': color.hover, ':focus-visible': color.hover },
    color: color.ink,
    fontSize: text.ui,
    textAlign: 'start',
    cursor: 'pointer',
    outline: 'none',
  },
  danger: { color: color.redline },
  check: { marginInlineStart: 'auto', color: color.accent },
  text: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  heading: {
    paddingInline: space.sm,
    paddingBlock: 6,
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: color.inkFaint,
  },
  sep: { height: 1, marginBlock: 4, backgroundColor: color.line },
});

export function MenuItem({
  children,
  onSelect,
  icon,
  leading,
  checked,
  danger,
}: {
  children: ReactNode;
  onSelect: () => void;
  icon?: IconName;
  leading?: ReactNode;
  checked?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={onSelect}
      {...stylex.props(menu.item, danger && menu.danger)}
    >
      {icon && <Icon name={icon} size={14} />}
      {leading}
      <span {...stylex.props(menu.text)}>{children}</span>
      {checked && (
        <span {...stylex.props(menu.check)}>
          <Icon name="check" size={14} />
        </span>
      )}
    </button>
  );
}

export const MenuHeading = ({ children }: { children: ReactNode }) => (
  <div {...stylex.props(menu.heading)}>{children}</div>
);
export const MenuSeparator = () => <div role="separator" {...stylex.props(menu.sep)} />;

/* ------------------------------------------------------------------------ */
/* Modal                                                                     */
/* ------------------------------------------------------------------------ */

const modal = stylex.create({
  scrim: {
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    backgroundColor: color.scrim,
    backdropFilter: 'blur(2px)',
  },
  holder: {
    position: 'fixed',
    inset: 0,
    zIndex: 51,
    display: 'flex',
    alignItems: { default: 'flex-start', '@media (max-width: 640px)': 'flex-end' },
    justifyContent: 'center',
    paddingInline: { default: space.lg, '@media (max-width: 640px)': 0 },
    paddingTop: { default: 'min(12vh, 120px)', '@media (max-width: 640px)': 0 },
    paddingBottom: { default: space.lg, '@media (max-width: 640px)': 0 },
    pointerEvents: 'none',
  },
  panel: {
    pointerEvents: 'auto',
    width: '100%',
    maxHeight: { default: 'calc(100vh - 140px)', '@media (max-width: 640px)': '92vh' },
    overflowY: 'auto',
    borderRadius: { default: radius.lg, '@media (max-width: 640px)': '14px 14px 0 0' },
    backgroundColor: color.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    boxShadow: `0 24px 60px -16px ${color.shadow}, 0 4px 12px ${color.shadow}`,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  },
  width: (w: number) => ({ maxWidth: w }),
  head: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: space.sm,
    paddingInline: space.lg,
    paddingBlock: space.md,
    backgroundColor: color.surface,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: color.line,
  },
  title: { flex: 1, fontFamily: font.display, fontSize: text.lead, fontWeight: 650, letterSpacing: '-0.01em' },
  body: { padding: space.lg },
});

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  width?: number;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, select');
      first?.focus();
    }, 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
      prev?.focus?.();
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <m.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            {...stylex.props(modal.scrim)}
          />
          <div key="holder" {...stylex.props(modal.holder)}>
            <m.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.12 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              {...stylex.props(modal.panel, modal.width(width))}
            >
              <div {...stylex.props(modal.head)}>
                <h2 {...stylex.props(modal.title)}>{title}</h2>
                <IconButton icon="x" label="Close" size="sm" onClick={onClose} />
              </div>
              <div {...stylex.props(modal.body)}>{children}</div>
            </m.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ------------------------------------------------------------------------ */
/* Two-step confirm (the artifact frame blocks window.confirm)               */
/* ------------------------------------------------------------------------ */

export function useConfirm(timeoutMs = 3500) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), timeoutMs);
    return () => clearTimeout(t);
  }, [armed, timeoutMs]);
  return {
    armed,
    /** Returns true on the second click. */
    trigger: () => {
      if (armed) {
        setArmed(false);
        return true;
      }
      setArmed(true);
      return false;
    },
  };
}
