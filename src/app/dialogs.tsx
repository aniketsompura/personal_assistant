import * as stylex from '@stylexjs/stylex';
import { motion as m } from 'motion/react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useStore } from '../data/store';
import { GOAL_COLORS, PRIORITIES, PROJECT_STATUSES, type Goal, type GoalColor, type ID, type Priority, type ProjectStatus } from '../data/types';
import { GOAL_CATEGORY_SUGGESTIONS, GOAL_HEX, PRIORITY_META, STATUS_META } from '../lib/meta';
import { guessLinkKind } from '../data/normalize';
import { newId } from '../lib/ids';
import { nowISO, todayISO } from '../lib/dates';
import { Modal } from '../components/Overlay';
import { Button, Field, Select, Swatch, TextArea, TextInput } from '../components/ui';
import { Segmented } from '../components/Segmented';
import { UpdateComposer } from '../components/Updates';
import { useToast } from '../components/Toast';
import { useRouter } from './router';
import { color, radius, space, text } from '../styles/tokens.stylex';
import { Icon } from '../components/Icon';

type Dialog =
  | { kind: 'project'; goalId?: ID; status?: ProjectStatus }
  | { kind: 'goal'; goal?: Goal }
  | { kind: 'update'; projectId?: ID | null };

const DialogContext = createContext<(d: Dialog) => void>(() => undefined);
export const useDialogs = () => useContext(DialogContext);

const s = stylex.create({
  form: { display: 'flex', flexDirection: 'column', gap: space.lg },
  grid: {
    display: 'grid',
    gridTemplateColumns: { default: 'repeat(2, minmax(0, 1fr))', '@media (max-width: 520px)': 'minmax(0, 1fr)' },
    gap: space.lg,
  },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: space.sm, paddingTop: space.xs },
  swatches: { display: 'flex', flexWrap: 'wrap', gap: space.sm },
  swatchBtn: {
    display: 'grid',
    placeItems: 'center',
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: { default: color.line, ':hover': color.lineStrong },
    backgroundColor: color.surface,
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${color.accent}` },
  },
  swatchOn: { borderColor: color.ink, boxShadow: `0 0 0 1px ${color.ink}` },
  goalPicks: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  goalPick: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingInline: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: { default: color.line, ':hover': color.lineStrong },
    backgroundColor: color.surface,
    fontSize: text.small,
    cursor: 'pointer',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    transitionProperty: 'border-color, background-color',
    transitionDuration: '120ms',
  },
  goalPickOn: { borderColor: color.accent, backgroundColor: color.accentSoft },
  muted: { fontSize: text.small, color: color.inkFaint },
});

/* ------------------------------------------------------------------------ */
/* Goal form                                                                 */
/* ------------------------------------------------------------------------ */

function GoalForm({ goal, onDone }: { goal?: Goal; onDone: (id?: ID) => void }) {
  const { data, actions } = useStore();
  const used = new Set(Object.values(data.goals).map((g) => g.color));
  const [title, setTitle] = useState(goal?.title ?? '');
  const [description, setDescription] = useState(goal?.description ?? '');
  const [category, setCategory] = useState(goal?.category ?? '');
  const [goalColor, setGoalColor] = useState<GoalColor>(goal?.color ?? GOAL_COLORS.find((c) => !used.has(c)) ?? 'cobalt');
  const [measures, setMeasures] = useState(goal ? goal.measures.map((x) => x.text).join('\n') : '');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const lines = measures.split('\n').map((l) => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
    const existing = new Map((goal?.measures ?? []).map((x) => [x.text, x]));
    const nextMeasures = lines.map((t) => existing.get(t) ?? { id: newId('m'), text: t, done: false });
    if (goal) {
      actions.updateGoal(goal.id, { title: title.trim(), description, category: category.trim(), color: goalColor, measures: nextMeasures });
      onDone(goal.id);
    } else {
      const g = actions.createGoal({ title: title.trim(), description, category: category.trim(), color: goalColor, measures: nextMeasures });
      onDone(g.id);
    }
  };

  return (
    <form onSubmit={submit} {...stylex.props(s.form)}>
      <Field label="Goal" htmlFor="goal-title">
        <TextInput
          id="goal-title"
          data-autofocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Raise the quality bar of the admin console"
          required
        />
      </Field>
      <Field label="Why it matters" htmlFor="goal-desc">
        <TextArea
          id="goal-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="The outcome you and your manager agreed on, in a sentence or two."
          minRows={2}
        />
      </Field>
      <div {...stylex.props(s.grid)}>
        <Field label="Category" htmlFor="goal-cat">
          <TextInput
            id="goal-cat"
            list="goal-categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Craft, Impact, Leadership…"
          />
          <datalist id="goal-categories">
            {GOAL_CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Color">
          <div role="radiogroup" aria-label="Goal color" {...stylex.props(s.swatches)}>
            {GOAL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={goalColor === c}
                aria-label={c}
                onClick={() => setGoalColor(c)}
                {...stylex.props(s.swatchBtn, goalColor === c && s.swatchOn)}
              >
                <Swatch hex={GOAL_HEX[c]} size={14} />
              </button>
            ))}
          </div>
        </Field>
      </div>
      <Field label="Success measures" htmlFor="goal-measures" hint="One per line. You can tick them off as you meet them.">
        <TextArea
          id="goal-measures"
          value={measures}
          onChange={(e) => setMeasures(e.target.value)}
          placeholder={'Ship 2 redesigned admin flows\nSUS score above 75 in usability tests\nRun 1 design critique per sprint'}
          minRows={3}
        />
      </Field>
      <div {...stylex.props(s.footer)}>
        <Button variant="ghost" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!title.trim()}>
          {goal ? 'Save goal' : 'Add goal'}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------------ */
/* Project form                                                              */
/* ------------------------------------------------------------------------ */

function ProjectForm({ goalId, status: initialStatus, onDone }: { goalId?: ID; status?: ProjectStatus; onDone: (id?: ID) => void }) {
  const { data, actions } = useStore();
  const goals = Object.values(data.goals).sort((a, b) => a.order - b.order);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [goalIds, setGoalIds] = useState<ID[]>(goalId ? [goalId] : []);
  const [status, setStatus] = useState<ProjectStatus>(initialStatus ?? 'discovery');
  const [priority, setPriority] = useState<Priority>('medium');
  const [startDate, setStartDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState('');
  const [prototype, setPrototype] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const url = prototype.trim();
    const p = actions.createProject({
      title: title.trim(),
      summary,
      goalIds,
      status,
      priority,
      startDate: startDate || null,
      dueDate: dueDate || null,
      links: url
        ? [{ id: newId('l'), url, label: 'Prototype', kind: guessLinkKind(url) === 'design' ? 'design' : 'prototype', createdAt: nowISO() }]
        : [],
    });
    onDone(p.id);
  };

  return (
    <form onSubmit={submit} {...stylex.props(s.form)}>
      <Field label="Project" htmlFor="project-title">
        <TextInput
          id="project-title"
          data-autofocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Device enrollment redesign"
          required
        />
      </Field>
      <Field label="Brief" htmlFor="project-summary">
        <TextArea
          id="project-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="The problem, who it's for, and what good looks like."
          minRows={2}
        />
      </Field>
      <Field label="Supports goals">
        {goals.length ? (
          <div {...stylex.props(s.goalPicks)}>
            {goals.map((g) => {
              const on = goalIds.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setGoalIds((ids) => (on ? ids.filter((x) => x !== g.id) : [...ids, g.id]))}
                  {...stylex.props(s.goalPick, on && s.goalPickOn)}
                >
                  <Swatch hex={GOAL_HEX[g.color]} size={8} />
                  {g.title}
                  {on && <Icon name="check" size={12} />}
                </button>
              );
            })}
          </div>
        ) : (
          <span {...stylex.props(s.muted)}>No goals yet. You can link this project to goals later.</span>
        )}
      </Field>
      <div {...stylex.props(s.grid)}>
        <Field label="Stage" htmlFor="project-status">
          <Select id="project-status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
            {PROJECT_STATUSES.map((st) => (
              <option key={st} value={st}>
                {STATUS_META[st].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Segmented
            ariaLabel="Priority"
            full
            value={priority}
            onChange={setPriority}
            options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label }))}
          />
        </Field>
        <Field label="Start" htmlFor="project-start">
          <TextInput id="project-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Due" htmlFor="project-due">
          <TextInput id="project-due" type="date" value={dueDate} min={startDate || undefined} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Prototype link" htmlFor="project-proto" hint="Optional. Add more links on the project page.">
        <TextInput
          id="project-proto"
          type="url"
          inputMode="url"
          value={prototype}
          onChange={(e) => setPrototype(e.target.value)}
          placeholder="https://www.figma.com/proto/…"
        />
      </Field>
      <div {...stylex.props(s.footer)}>
        <Button variant="ghost" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!title.trim()}>
          Create project
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------------ */
/* Provider                                                                  */
/* ------------------------------------------------------------------------ */

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const { navigate } = useRouter();
  const toast = useToast();
  const close = useCallback(() => setDialog(null), []);
  const open = useCallback((d: Dialog) => setDialog(d), []);

  const title = useMemo(() => {
    if (!dialog) return '';
    if (dialog.kind === 'goal') return dialog.goal ? 'Edit goal' : 'New goal';
    if (dialog.kind === 'project') return 'New project';
    return 'Log an update';
  }, [dialog]);

  return (
    <DialogContext.Provider value={open}>
      {children}
      <Modal open={!!dialog} onClose={close} title={title} width={dialog?.kind === 'update' ? 640 : 580}>
        <m.div layout>
          {dialog?.kind === 'goal' && (
            <GoalForm
              goal={dialog.goal}
              onDone={(id) => {
                close();
                if (id && !dialog.goal) {
                  toast({ message: 'Goal added', tone: 'good' });
                  navigate({ name: 'goal', id });
                }
              }}
            />
          )}
          {dialog?.kind === 'project' && (
            <ProjectForm
              goalId={dialog.goalId}
              status={dialog.status}
              onDone={(id) => {
                close();
                if (id) {
                  toast({ message: 'Project created', tone: 'good' });
                  navigate({ name: 'project', id });
                }
              }}
            />
          )}
          {dialog?.kind === 'update' && <UpdateComposer projectId={dialog.projectId} autoFocus onLogged={close} />}
        </m.div>
      </Modal>
    </DialogContext.Provider>
  );
}
