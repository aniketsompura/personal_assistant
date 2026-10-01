import * as stylex from '@stylexjs/stylex';
import { AnimatePresence, motion as m } from 'motion/react';
import { useState } from 'react';
import { useStore } from '../../data/store';
import { LINK_KINDS, type LinkKind, type Project, type ProjectLink } from '../../data/types';
import { guessLinkKind } from '../../data/normalize';
import { newId } from '../../lib/ids';
import { nowISO } from '../../lib/dates';
import { LINK_KIND_META } from '../../lib/meta';
import { color, font, motion, radius, space, text } from '../../styles/tokens.stylex';
import { Button, IconButton, Select, TextInput } from '../../components/ui';
import { EmptyState } from '../../components/domain';
import { Icon, type IconName } from '../../components/Icon';
import { useToast } from '../../components/Toast';

const KIND_ICON: Record<LinkKind, IconName> = {
  prototype: 'bolt',
  design: 'frame',
  doc: 'note',
  research: 'search',
  ticket: 'checkSquare',
  other: 'link',
};

export function hostOf(url: string) {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function safeHref(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

const s = stylex.create({
  root: { display: 'flex', flexDirection: 'column', gap: space.xl },
  form: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(0, 2fr) minmax(0, 1.2fr) 150px auto',
      '@media (max-width: 760px)': 'minmax(0, 1fr)',
    },
    gap: space.sm,
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
  },
  group: { display: 'flex', flexDirection: 'column', gap: space.sm },
  groupHead: {
    fontFamily: font.mono,
    fontSize: text.label,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: color.inkFaint,
  },
  protoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: space.md },
  proto: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: space.sm,
    padding: space.lg,
    minHeight: 120,
    borderRadius: radius.md,
    backgroundColor: color.ink,
    color: color.canvas,
    textDecoration: 'none',
    overflow: 'hidden',
    transitionProperty: 'transform, box-shadow',
    transitionDuration: motion.base,
    transitionTimingFunction: motion.ease,
    transform: { default: 'translateY(0)', ':hover': 'translateY(-2px)' },
    boxShadow: { default: `0 1px 2px ${color.shadow}`, ':hover': `0 14px 30px -12px ${color.shadow}` },
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
    outlineOffset: 2,
  },
  protoGrid2: {
    position: 'absolute',
    inset: 0,
    opacity: 0.14,
    backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
    backgroundSize: '16px 16px',
    pointerEvents: 'none',
  },
  protoTop: { position: 'relative', display: 'flex', alignItems: 'center', gap: space.sm, fontFamily: font.mono, fontSize: 10.5, opacity: 0.75 },
  protoLabel: { position: 'relative', fontFamily: font.display, fontSize: text.lead, fontWeight: 650, marginTop: 'auto' },
  protoOpen: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: text.small,
    fontWeight: 600,
    color: color.canvas,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    overflow: 'hidden',
  },
  row: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: space.md,
    minHeight: 52,
    paddingInline: space.md,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: color.line,
    backgroundColor: { default: 'transparent', ':hover': color.hover },
  },
  badge: {
    display: 'grid',
    placeItems: 'center',
    width: 30,
    height: 30,
    flexShrink: 0,
    borderRadius: radius.sm,
    backgroundColor: color.sunken,
    color: color.inkMuted,
  },
  linkText: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 },
  linkLabel: {
    fontSize: text.ui,
    fontWeight: 600,
    color: { default: color.ink, ':hover': color.accent },
    textDecoration: 'none',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
  },
  host: { fontFamily: font.mono, fontSize: 10.5, color: color.inkFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowActions: {
    display: 'flex',
    gap: 2,
    opacity: { default: 0, [stylex.when.ancestor(':hover')]: 1, [stylex.when.ancestor(':focus-within')]: 1, '@media (hover: none)': 1 },
    transitionProperty: 'opacity',
    transitionDuration: motion.fast,
  },
});

export function LinksTab({ project: p }: { project: Project }) {
  const { actions, meta } = useStore();
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<LinkKind | ''>('');
  const ro = meta.readOnly;

  const guessed = url.trim() ? guessLinkKind(url.trim()) : 'other';
  const effectiveKind = kind || guessed;

  const save = (links: ProjectLink[]) => actions.updateProject(p.id, { links }, { silent: true });

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (!u) return;
    save([
      ...p.links,
      { id: newId('l'), url: u, label: label.trim() || hostOf(u), kind: effectiveKind, createdAt: nowISO() },
    ]);
    setUrl('');
    setLabel('');
    setKind('');
  };

  const remove = (l: ProjectLink) => {
    save(p.links.filter((x) => x.id !== l.id));
    toast({ message: `Removed “${l.label}”`, icon: 'trash', action: { label: 'Undo', onClick: () => save([...p.links]) } });
  };

  const copy = async (l: ProjectLink) => {
    try {
      await navigator.clipboard.writeText(safeHref(l.url));
      toast({ message: 'Link copied', tone: 'good', icon: 'copy' });
    } catch {
      toast({ message: 'Copy is blocked here. Open the link and copy it from the address bar.', tone: 'error' });
    }
  };

  const prototypes = p.links.filter((l) => l.kind === 'prototype');
  const others = LINK_KINDS.filter((k) => k !== 'prototype')
    .map((k) => ({ kind: k, items: p.links.filter((l) => l.kind === k) }))
    .filter((g) => g.items.length);

  return (
    <div {...stylex.props(s.root)}>
      {!ro && (
        <form onSubmit={add} {...stylex.props(s.form)} aria-label="Add a link">
          <TextInput
            type="url"
            inputMode="url"
            aria-label="Link URL"
            placeholder="Paste a Figma, prototype, doc or ticket link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <TextInput aria-label="Label" placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Select aria-label="Link type" value={effectiveKind} onChange={(e) => setKind(e.target.value as LinkKind)}>
            {LINK_KINDS.map((k) => (
              <option key={k} value={k}>
                {LINK_KIND_META[k].label}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="primary" icon="plus" disabled={!url.trim()}>
            Add
          </Button>
        </form>
      )}

      {p.links.length === 0 && (
        <EmptyState icon="link" title="No links yet" compact>
          Keep the prototype, Figma file, PRD, research and tickets in one place. Paste a link and Workfile sorts it by type.
        </EmptyState>
      )}

      {prototypes.length > 0 && (
        <section {...stylex.props(s.group)}>
          <h3 {...stylex.props(s.groupHead)}>{LINK_KIND_META.prototype.plural}</h3>
          <div {...stylex.props(s.protoGrid)}>
            <AnimatePresence initial={false}>
              {prototypes.map((l) => (
                <m.a
                  key={l.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  href={safeHref(l.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  {...stylex.props(s.proto)}
                >
                  <span {...stylex.props(s.protoGrid2)} aria-hidden="true" />
                  <span {...stylex.props(s.protoTop)}>
                    <Icon name="bolt" size={12} />
                    {hostOf(l.url)}
                  </span>
                  <span {...stylex.props(s.protoLabel)}>{l.label}</span>
                  <span {...stylex.props(s.protoOpen)}>
                    Open prototype <Icon name="external" size={12} />
                  </span>
                </m.a>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {others.map((g) => (
        <section key={g.kind} {...stylex.props(s.group)}>
          <h3 {...stylex.props(s.groupHead)}>{LINK_KIND_META[g.kind].plural}</h3>
          <div {...stylex.props(s.list)}>
            <AnimatePresence initial={false}>
              {g.items.map((l) => (
                <m.div
                  key={l.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  {...stylex.props(s.row, stylex.defaultMarker())}
                >
                  <span {...stylex.props(s.badge)}>
                    <Icon name={KIND_ICON[l.kind]} size={15} />
                  </span>
                  <span {...stylex.props(s.linkText)}>
                    <a href={safeHref(l.url)} target="_blank" rel="noopener noreferrer" {...stylex.props(s.linkLabel)}>
                      {l.label}
                    </a>
                    <span {...stylex.props(s.host)}>{hostOf(l.url)}</span>
                  </span>
                  <span {...stylex.props(s.rowActions)}>
                    <IconButton icon="copy" label="Copy link" size="sm" onClick={() => copy(l)} />
                    {!ro && <IconButton icon="trash" label={`Remove ${l.label}`} size="sm" onClick={() => remove(l)} />}
                  </span>
                </m.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      ))}
    </div>
  );
}
