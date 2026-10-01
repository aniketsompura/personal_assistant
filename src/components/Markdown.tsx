import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { color, font, radius, space, text } from '../styles/tokens.stylex';

/*
 * A small Markdown renderer for notes. It builds React elements directly (no
 * innerHTML), so note content can never inject markup. Supports headings,
 * lists, task lists, quotes, code blocks, rules, bold, italic, strike, inline
 * code and links.
 */

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    fontSize: text.body,
    lineHeight: 1.65,
    color: color.ink,
    maxWidth: '68ch',
    overflowWrap: 'anywhere',
  },
  h1: { fontFamily: font.display, fontSize: text.h3, fontWeight: 650, letterSpacing: '-0.01em', marginTop: space.sm },
  h2: { fontFamily: font.display, fontSize: 17, fontWeight: 650, marginTop: space.sm },
  h3: {
    fontFamily: font.mono,
    fontSize: text.label,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: color.inkMuted,
    marginTop: space.sm,
  },
  list: { margin: 0, paddingInlineStart: 22, display: 'flex', flexDirection: 'column', gap: 4 },
  task: { listStyle: 'none', marginInlineStart: -20, display: 'flex', gap: space.sm, alignItems: 'baseline' },
  box: {
    flexShrink: 0,
    width: 13,
    height: 13,
    borderRadius: 3,
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: color.lineStrong,
    transform: 'translateY(2px)',
    display: 'inline-grid',
    placeItems: 'center',
    fontSize: 9,
    lineHeight: 1,
  },
  boxDone: { backgroundColor: color.accent, borderColor: color.accent, color: color.accentInk },
  done: { color: color.inkFaint, textDecoration: 'line-through' },
  quote: {
    margin: 0,
    paddingInlineStart: space.md,
    borderInlineStartWidth: 2,
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: color.redline,
    color: color.inkMuted,
  },
  pre: {
    margin: 0,
    padding: space.md,
    overflowX: 'auto',
    borderRadius: radius.sm,
    backgroundColor: color.sunken,
    fontFamily: font.mono,
    fontSize: text.small,
    lineHeight: 1.6,
  },
  code: {
    fontFamily: font.mono,
    fontSize: '0.86em',
    paddingInline: 4,
    paddingBlock: 1,
    borderRadius: 3,
    backgroundColor: color.sunken,
  },
  link: {
    color: color.accent,
    textDecoration: 'underline',
    textDecorationThickness: 1,
    textUnderlineOffset: 2,
  },
  hr: { width: '100%', height: 1, borderWidth: 0, backgroundColor: color.line, marginBlock: space.sm },
  p: { margin: 0 },
});

type Block =
  | { t: 'h'; level: 1 | 2 | 3; text: string }
  | { t: 'p'; text: string }
  | { t: 'ul' | 'ol'; items: { text: string; task?: boolean; done?: boolean }[] }
  | { t: 'quote'; text: string }
  | { t: 'code'; text: string }
  | { t: 'hr' };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++;
      blocks.push({ t: 'code', text: body.join('\n') });
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push({ t: 'h', level: h[1].length as 1 | 2 | 3, text: h[2] });
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ t: 'hr' });
      i++;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''));
      blocks.push({ t: 'quote', text: body.join(' ') });
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: { text: string; task?: boolean; done?: boolean }[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        const raw = lines[i++].replace(/^\s*([-*+]|\d+[.)])\s+/, '');
        const task = /^\[( |x|X)\]\s+(.*)$/.exec(raw);
        items.push(task ? { text: task[2], task: true, done: task[1] !== ' ' } : { text: raw });
      }
      blocks.push({ t: ordered ? 'ol' : 'ul', items });
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|```|\s*>|\s*([-*+]|\d+[.)])\s+|-{3,}\s*$)/.test(lines[i])
    ) {
      para.push(lines[i++]);
    }
    blocks.push({ t: 'p', text: para.join('\n') });
  }
  return blocks;
}

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(~~[^~]+~~)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\([^)\s]+\))|(https?:\/\/[^\s)]+)/g;

function inline(src: string, keyBase = ''): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of src.matchAll(INLINE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(...withBreaks(src.slice(last, idx), `${keyBase}t${k}`));
    const tok = m[0];
    const key = `${keyBase}${k++}`;
    if (m[1]) out.push(<code key={key} {...stylex.props(styles.code)}>{tok.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={key}>{inline(tok.slice(2, -2), key)}</strong>);
    else if (m[3]) out.push(<s key={key}>{inline(tok.slice(2, -2), key)}</s>);
    else if (m[4]) out.push(<em key={key}>{inline(tok.slice(1, -1), key)}</em>);
    else if (m[5]) {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)!;
      out.push(<SafeLink key={key} href={lm[2]}>{lm[1]}</SafeLink>);
    } else if (m[6]) out.push(<SafeLink key={key} href={tok}>{tok}</SafeLink>);
    last = idx + tok.length;
  }
  if (last < src.length) out.push(...withBreaks(src.slice(last), `${keyBase}e`));
  return out;
}

function withBreaks(s: string, key: string): ReactNode[] {
  const parts = s.split('\n');
  return parts.flatMap((p, i) => (i === 0 ? [p] : [<br key={`${key}-${i}`} />, p]));
}

function SafeLink({ href, children }: { href: string; children: ReactNode }) {
  if (!/^https?:\/\//i.test(href)) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...stylex.props(styles.link)}>
      {children}
    </a>
  );
}

export function Markdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);
  return (
    <div {...stylex.props(styles.root)}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'h':
            return b.level === 1 ? (
              <h2 key={i} {...stylex.props(styles.h1)}>{inline(b.text)}</h2>
            ) : b.level === 2 ? (
              <h3 key={i} {...stylex.props(styles.h2)}>{inline(b.text)}</h3>
            ) : (
              <h4 key={i} {...stylex.props(styles.h3)}>{inline(b.text)}</h4>
            );
          case 'p':
            return <p key={i} {...stylex.props(styles.p)}>{inline(b.text)}</p>;
          case 'quote':
            return <blockquote key={i} {...stylex.props(styles.quote)}>{inline(b.text)}</blockquote>;
          case 'code':
            return <pre key={i} {...stylex.props(styles.pre)}>{b.text}</pre>;
          case 'hr':
            return <hr key={i} {...stylex.props(styles.hr)} />;
          case 'ul':
          case 'ol': {
            const Tag = b.t;
            return (
              <Tag key={i} {...stylex.props(styles.list)}>
                {b.items.map((it, j) =>
                  it.task ? (
                    <li key={j} {...stylex.props(styles.task)}>
                      <span aria-hidden="true" {...stylex.props(styles.box, it.done && styles.boxDone)}>
                        {it.done ? '✓' : ''}
                      </span>
                      <span {...stylex.props(it.done && styles.done)}>{inline(it.text)}</span>
                    </li>
                  ) : (
                    <li key={j}>{inline(it.text)}</li>
                  ),
                )}
              </Tag>
            );
          }
        }
      })}
    </div>
  );
}

/** First meaningful line of a note, without Markdown syntax. */
export function excerpt(src: string, max = 140): string {
  const plain = src
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/^\s*([-*+]|\d+[.)])\s+(\[( |x|X)\]\s+)?/gm, '')
    .replace(/[*_~`>]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1)}…` : plain;
}
