import * as stylex from '@stylexjs/stylex';
import { AnimatePresence, motion as m } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../data/store';
import type { ID, Note } from '../../data/types';
import { formatDate, localDay, relativeDays } from '../../lib/dates';
import { color, font, radius, space, text } from '../../styles/tokens.stylex';
import { Markdown, excerpt } from '../../components/Markdown';
import { Segmented } from '../../components/Segmented';
import { EmptyState } from '../../components/domain';
import { Button, IconButton, TextArea, TextInput } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';

const TEMPLATES: { label: string; title: string; body: string }[] = [
  {
    label: 'Meeting notes',
    title: 'Meeting notes',
    body: '## Attendees\n- \n\n## Notes\n- \n\n## Decisions\n- \n\n## Action items\n- [ ] ',
  },
  {
    label: 'Design critique',
    title: 'Design critique',
    body: "## What we reviewed\n\n## What's working\n- \n\n## What to change\n- \n\n## Next steps\n- [ ] ",
  },
  {
    label: 'Research findings',
    title: 'Research findings',
    body: '## Goal\n\n## Method\n\n## Key findings\n1. \n\n## Quotes\n> \n\n## Recommendations\n- ',
  },
  {
    label: 'Decision record',
    title: 'Decision: ',
    body: '## Context\n\n## Options considered\n1. \n2. \n\n## Decision\n\n## Why\n\n## Consequences\n',
  },
];

const s = stylex.create({
  root: {
    display: 'grid',
    gridTemplateColumns: { default: '240px minmax(0, 1fr)', '@media (max-width: 760px)': 'minmax(0, 1fr)' },
    gap: space.lg,
    alignItems: 'start',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 4 },
  item: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    width: '100%',
    paddingInline: space.md,
    paddingBlock: 10,
    borderWidth: 0,
    borderRadius: radius.sm,
    backgroundColor: { default: 'transparent', ':hover': color.hover },
    color: 'inherit',
    textAlign: 'start',
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
  },
  itemActive: { backgroundColor: { default: color.surface, ':hover': color.surface } },
  activeBg: {
    position: 'absolute',
    inset: 0,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    boxShadow: `0 1px 2px ${color.shadow}, 0 0 0 1px ${color.accent}`,
  },
  itemTitle: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: text.ui,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemSub: {
    position: 'relative',
    fontSize: text.small,
    color: color.inkFaint,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemDate: { position: 'relative', fontFamily: font.mono, fontSize: 10, color: color.inkFaint },
  pin: { color: color.accent, flexShrink: 0 },
  editor: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    backgroundColor: color.surface,
    boxShadow: `0 1px 2px ${color.shadow}`,
    minWidth: 0,
  },
  bar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  tools: { display: 'flex', gap: 2 },
  spacer: { flex: 1 },
  status: { fontFamily: font.mono, fontSize: 10.5, color: color.inkFaint, whiteSpace: 'nowrap' },
  title: {
    height: 'auto',
    paddingBlock: 4,
    marginInline: -10,
    fontFamily: font.display,
    fontSize: text.h3,
    fontWeight: 650,
    letterSpacing: '-0.01em',
  },
  body: { marginInline: -10, minHeight: 280, fontSize: text.body, lineHeight: 1.7 },
  preview: { minHeight: 200, paddingBlock: space.xs },
  templates: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  templatesLabel: { fontSize: text.small, color: color.inkFaint, marginInlineEnd: 4 },
  foot: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.sm,
    alignItems: 'center',
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: color.line,
    fontSize: text.small,
    color: color.inkFaint,
  },
  hint: { fontFamily: font.mono, fontSize: 10.5, color: color.inkFaint },
});

function NoteEditor({ note }: { note: Note }) {
  const { actions, meta } = useStore();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [mode, setMode] = useState<'write' | 'preview'>(note.body.trim() ? 'preview' : 'write');
  const [status, setStatus] = useState<'idle' | 'pending' | 'saved'>('idle');
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ title, body });
  latest.current = { title, body };
  const area = useRef<HTMLTextAreaElement | null>(null);
  const ro = meta.readOnly;

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    void actions.updateNote(note.id, latest.current).then(() => setStatus('saved'));
  };

  const schedule = () => {
    dirty.current = true;
    setStatus('pending');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
  };

  // Save on leave.
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pick up edits made elsewhere (another device, or Claude) when nothing is pending here.
  useEffect(() => {
    if (dirty.current) return;
    setTitle(note.title);
    setBody(note.body);
  }, [note.title, note.body]);

  const insert = (before: string, after = '', placeholder = '') => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const selected = value.slice(a, b) || placeholder;
    const next = value.slice(0, a) + before + selected + after + value.slice(b);
    setBody(next);
    schedule();
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + before.length, a + before.length + selected.length);
    });
  };

  const linePrefix = (prefix: string) => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: a, value } = el;
    const lineStart = value.lastIndexOf('\n', a - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    setBody(next);
    schedule();
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + prefix.length, a + prefix.length);
    });
  };

  const tools: { icon: IconName | null; label: string; text?: string; run: () => void }[] = [
    { icon: null, text: 'H', label: 'Heading', run: () => linePrefix('## ') },
    { icon: null, text: 'B', label: 'Bold (⌘B)', run: () => insert('**', '**', 'bold') },
    { icon: 'list', label: 'Bulleted list', run: () => linePrefix('- ') },
    { icon: 'checkSquare', label: 'Checklist', run: () => linePrefix('- [ ] ') },
    { icon: 'link', label: 'Link', run: () => insert('[', '](https://)', 'link text') },
  ];

  return (
    <div {...stylex.props(s.editor)}>
      <div {...stylex.props(s.bar)}>
        <Segmented
          ariaLabel="Editor mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'write', label: 'Write', icon: 'edit' },
            { value: 'preview', label: 'Read', icon: 'eye' },
          ]}
        />
        {mode === 'write' && !ro && (
          <div {...stylex.props(s.tools)}>
            {tools.map((t) =>
              t.icon ? (
                <IconButton key={t.label} icon={t.icon} label={t.label} size="sm" onClick={t.run} />
              ) : (
                <Button key={t.label} size="sm" variant="ghost" title={t.label} aria-label={t.label} onClick={t.run}>
                  <span style={{ fontWeight: 700, width: 12, textAlign: 'center' }}>{t.text}</span>
                </Button>
              ),
            )}
          </div>
        )}
        <span {...stylex.props(s.spacer)} />
        <span {...stylex.props(s.status)} aria-live="polite">
          {status === 'pending' ? 'Saving…' : status === 'saved' ? 'Saved' : `Edited ${relativeDays(localDay(note.updatedAt))}`}
        </span>
      </div>

      <TextInput
        bare
        aria-label="Note title"
        placeholder="Untitled note"
        value={title}
        readOnly={ro}
        onChange={(e) => {
          setTitle(e.target.value);
          schedule();
        }}
        onBlur={flush}
        xstyle={s.title}
      />

      {mode === 'write' ? (
        <>
          {!body.trim() && !ro && (
            <div {...stylex.props(s.templates)}>
              <span {...stylex.props(s.templatesLabel)}>Start from</span>
              {TEMPLATES.map((t) => (
                <Button
                  key={t.label}
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setBody(t.body);
                    if (!title.trim()) setTitle(t.title);
                    schedule();
                    requestAnimationFrame(() => area.current?.focus());
                  }}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          )}
          <TextArea
            ref={area}
            bare
            aria-label="Note body"
            placeholder={'Write in Markdown. ## for headings, - for lists, - [ ] for to-dos.'}
            value={body}
            readOnly={ro}
            minRows={12}
            onChange={(e) => {
              setBody(e.target.value);
              schedule();
            }}
            onBlur={flush}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                insert('**', '**', 'bold');
              }
            }}
            xstyle={s.body}
          />
        </>
      ) : (
        <div {...stylex.props(s.preview)}>
          {body.trim() ? (
            <Markdown source={body} />
          ) : (
            <span {...stylex.props(s.hint)}>This note is empty. Switch to Write to add to it.</span>
          )}
        </div>
      )}

      <div {...stylex.props(s.foot)}>
        <span>Created {formatDate(localDay(note.createdAt), { year: true })}</span>
        <span {...stylex.props(s.spacer)} />
        {!ro && (
          <>
            <Button size="sm" variant="ghost" icon="pin" onClick={() => void actions.updateNote(note.id, { pinned: !note.pinned })}>
              {note.pinned ? 'Unpin' : 'Pin to top'}
            </Button>
            <Button size="sm" variant="ghost" icon="trash" onClick={() => actions.deleteNote(note.id)}>
              Delete
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function NotesPane({ projectId, initialNoteId }: { projectId: ID | null; initialNoteId?: string }) {
  const { data, actions, meta } = useStore();
  const notes = useMemo(
    () =>
      Object.values(data.notes)
        .filter((n) => n.projectId === projectId)
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)),
    [data.notes, projectId],
  );
  const [selected, setSelected] = useState<string | null>(initialNoteId ?? null);
  const current = notes.find((n) => n.id === selected) ?? notes[0] ?? null;

  const create = () => {
    const n = actions.createNote({ projectId });
    setSelected(n.id);
  };

  if (!notes.length) {
    return (
      <EmptyState
        icon="note"
        title={projectId ? 'No notes for this project yet' : 'No general notes yet'}
        actions={
          !meta.readOnly && (
            <Button variant="primary" icon="plus" onClick={create}>
              New note
            </Button>
          )
        }
      >
        Meeting notes, critique feedback, research findings, decisions. Notes support Markdown and come with templates.
      </EmptyState>
    );
  }

  return (
    <div {...stylex.props(s.root)}>
      <div {...stylex.props(s.list)}>
        {!meta.readOnly && (
          <Button variant="secondary" icon="plus" onClick={create} full>
            New note
          </Button>
        )}
        <AnimatePresence initial={false}>
          {notes.map((n) => {
            const active = current?.id === n.id;
            return (
              <m.button
                key={n.id}
                layout="position"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => setSelected(n.id)}
                {...stylex.props(s.item)}
              >
                {active && <m.span layoutId={`note-active-${projectId ?? 'general'}`} transition={{ type: 'spring', stiffness: 500, damping: 40 }} {...stylex.props(s.activeBg)} />}
                <span {...stylex.props(s.itemTitle)}>
                  {n.pinned && (
                    <span {...stylex.props(s.pin)}>
                      <Icon name="pin" size={11} />
                    </span>
                  )}
                  {n.title || 'Untitled note'}
                </span>
                <span {...stylex.props(s.itemSub)}>{excerpt(n.body, 60) || 'Empty'}</span>
                <span {...stylex.props(s.itemDate)}>{formatDate(localDay(n.updatedAt))}</span>
              </m.button>
            );
          })}
        </AnimatePresence>
      </div>
      {current && <NoteEditor key={current.id} note={current} />}
    </div>
  );
}

