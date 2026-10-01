import * as stylex from '@stylexjs/stylex';
import { AnimatePresence, motion as m } from 'motion/react';
import { useRef, useState, type ReactNode } from 'react';
import { assistantError, useAssistant } from '../lib/assistant';
import { color, radius, space, text } from '../styles/tokens.stylex';
import { Icon } from './Icon';
import { Markdown } from './Markdown';
import { Button } from './ui';
import { useToast } from './Toast';

/*
 * "Ask Claude to draft this" block: a button that streams a Markdown answer,
 * with Stop, Copy and Regenerate. Renders nothing when Claude isn't available.
 */

const s = stylex.create({
  root: { display: 'flex', flexDirection: 'column', gap: space.md },
  intro: { fontSize: text.ui, color: color.inkMuted },
  controls: { display: 'flex', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  out: {
    padding: space.lg,
    borderRadius: radius.sm,
    backgroundColor: color.sunken,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: color.line,
    maxHeight: 520,
    overflowY: 'auto',
  },
  thinking: { display: 'flex', alignItems: 'center', gap: space.sm, color: color.accent, fontSize: text.ui },
  note: { fontSize: text.small, color: color.inkFaint },
});

export function AssistPanel({
  intro,
  buttonLabel,
  buildPrompt,
  extraControls,
  filenameHint,
}: {
  intro: ReactNode;
  buttonLabel: string;
  buildPrompt: () => string;
  extraControls?: ReactNode;
  filenameHint?: string;
}) {
  const sample = useAssistant();
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const ctl = useRef<AbortController | null>(null);

  if (!sample) return null;

  const run = async (fresh: boolean) => {
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setBusy(true);
    setText('');
    setTruncated(false);
    try {
      const res = await sample(buildPrompt(), {
        signal: c.signal,
        onText: ({ text: t }) => setText(t),
        cache: fresh ? false : true,
      });
      setText(res.text);
      setTruncated(res.truncated);
    } catch (e) {
      const partial = (e as { text?: string })?.text;
      if (partial) setText(partial);
      const msg = assistantError(e);
      if (msg) toast({ message: msg, tone: 'error', duration: 6000 });
    } finally {
      if (ctl.current === c) setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ message: 'Copied to clipboard', tone: 'good', icon: 'copy' });
    } catch {
      toast({ message: 'Copy is blocked here. Select the text and copy it instead.', tone: 'error' });
    }
  };

  return (
    <div {...stylex.props(s.root)}>
      <p {...stylex.props(s.intro)}>{intro}</p>
      <div {...stylex.props(s.controls)}>
        {extraControls}
        {busy ? (
          <Button variant="secondary" icon="stop" onClick={() => ctl.current?.abort()}>
            Stop
          </Button>
        ) : (
          <Button variant={text ? 'secondary' : 'primary'} icon="sparkles" onClick={() => run(!!text)}>
            {text ? 'Regenerate' : buttonLabel}
          </Button>
        )}
        {text && !busy && (
          <Button variant="ghost" icon="copy" onClick={copy}>
            Copy
          </Button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {(busy || text) && (
          <m.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            {...stylex.props(s.out)}
            aria-live="polite"
            aria-label={filenameHint}
          >
            {text ? (
              <Markdown source={text} />
            ) : (
              <span {...stylex.props(s.thinking)}>
                <m.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }}>
                  <Icon name="sparkles" size={14} />
                </m.span>
                Claude is reading your log…
              </span>
            )}
          </m.div>
        )}
      </AnimatePresence>
      {truncated && <p {...stylex.props(s.note)}>The answer was cut short. Try a shorter date range.</p>}
    </div>
  );
}
