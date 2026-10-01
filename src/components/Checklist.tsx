import * as stylex from '@stylexjs/stylex';
import { AnimatePresence, motion as m } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { color, motion, radius, space, text } from '../styles/tokens.stylex';
import { Icon } from './Icon';
import { IconButton, TextInput } from './ui';

/*
 * A checklist for requirements and success measures. The tick draws itself in,
 * the text strikes through, and finished items settle at the bottom.
 */

export interface CheckItem {
  id: string;
  text: string;
  done: boolean;
}

const s = stylex.create({
  list: { display: 'flex', flexDirection: 'column', listStyle: 'none', margin: 0, padding: 0 },
  row: {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    paddingBlock: 7,
    paddingInline: 6,
    marginInline: -6,
    borderRadius: radius.sm,
    backgroundColor: { default: 'transparent', ':hover': color.hover },
  },
  box: {
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    width: 18,
    height: 18,
    marginTop: 1,
    padding: 0,
    borderRadius: 4,
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: { default: color.lineStrong, ':hover': color.accent },
    backgroundColor: color.surface,
    color: color.accentInk,
    cursor: 'pointer',
    transitionProperty: 'background-color, border-color, transform',
    transitionDuration: motion.fast,
    transform: { default: null, ':active': 'scale(0.85)' },
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
    outlineOffset: 2,
  },
  boxOn: { backgroundColor: color.accent, borderColor: { default: color.accent, ':hover': color.accent } },
  text: {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    fontSize: text.body,
    lineHeight: 1.45,
    color: color.ink,
    overflowWrap: 'anywhere',
    cursor: 'text',
    transitionProperty: 'color',
    transitionDuration: motion.base,
  },
  textDone: { color: color.inkFaint },
  strike: {
    position: 'absolute',
    left: 0,
    top: '0.72em',
    height: 1.5,
    backgroundColor: color.inkFaint,
    pointerEvents: 'none',
  },
  trailing: { flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 },
  actions: {
    opacity: { default: 0, [stylex.when.ancestor(':hover')]: 1, [stylex.when.ancestor(':focus-within')]: 1, '@media (hover: none)': 1 },
    transitionProperty: 'opacity',
    transitionDuration: motion.fast,
  },
  add: { display: 'flex', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  addIcon: { color: color.inkFaint, flexShrink: 0, width: 18, display: 'grid', placeItems: 'center' },
  editInput: { flex: 1 },
});

export function Checklist<T extends CheckItem>({
  items,
  onToggle,
  onEdit,
  onDelete,
  onAdd,
  addPlaceholder = 'Add an item',
  trailing,
  readOnly,
  label,
}: {
  items: T[];
  onToggle: (item: T) => void;
  onEdit: (item: T, text: string) => void;
  onDelete: (item: T) => void;
  onAdd: (text: string) => void;
  addPlaceholder?: string;
  trailing?: (item: T) => ReactNode;
  readOnly?: boolean;
  label: string;
}) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const ordered = [...items.filter((i) => !i.done), ...items.filter((i) => i.done)];

  const commitEdit = (item: T) => {
    if (!editing) return;
    const t = editing.text.trim();
    setEditing(null);
    if (t && t !== item.text) onEdit(item, t);
  };

  return (
    <div>
      <ul aria-label={label} {...stylex.props(s.list)}>
        <AnimatePresence initial={false}>
          {ordered.map((item) => (
            <m.li
              key={item.id}
              layout="position"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, paddingBlock: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              {...stylex.props(s.row, stylex.defaultMarker())}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={item.done}
                aria-label={item.text}
                disabled={readOnly}
                onClick={() => onToggle(item)}
                {...stylex.props(s.box, item.done && s.boxOn)}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <m.path
                    d="M2.5 6.3 5 8.6 9.5 3.6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={false}
                    animate={{ pathLength: item.done ? 1 : 0, opacity: item.done ? 1 : 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                  />
                </svg>
              </button>
              {editing?.id === item.id ? (
                <TextInput
                  compact
                  autoFocus
                  aria-label="Edit item"
                  value={editing.text}
                  onChange={(e) => setEditing({ id: item.id, text: e.target.value })}
                  onBlur={() => commitEdit(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(item);
                    if (e.key === 'Escape') setEditing(null);
                  }}
                  xstyle={s.editInput}
                />
              ) : (
                <span
                  onClick={() => !readOnly && setEditing({ id: item.id, text: item.text })}
                  {...stylex.props(s.text, item.done && s.textDone)}
                >
                  {item.text}
                  <m.span
                    aria-hidden="true"
                    initial={false}
                    animate={{ width: item.done ? '100%' : '0%' }}
                    transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1], delay: item.done ? 0.08 : 0 }}
                    {...stylex.props(s.strike)}
                  />
                </span>
              )}
              <span {...stylex.props(s.trailing)}>
                {trailing?.(item)}
                {!readOnly && (
                  <span {...stylex.props(s.actions)}>
                    <IconButton icon="trash" label={`Delete “${item.text}”`} size="sm" onClick={() => onDelete(item)} />
                  </span>
                )}
              </span>
            </m.li>
          ))}
        </AnimatePresence>
      </ul>
      {!readOnly && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = draft.trim();
            if (!t) return;
            onAdd(t);
            setDraft('');
          }}
          {...stylex.props(s.add)}
        >
          <span {...stylex.props(s.addIcon)}>
            <Icon name="plus" size={14} />
          </span>
          <TextInput compact bare value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={addPlaceholder} aria-label={addPlaceholder} />
        </form>
      )}
    </div>
  );
}
