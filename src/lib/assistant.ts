import { useEffect, useState } from 'react';
import type { DataSnapshot, Goal, Project, ProjectStatus, Update, UpdateKind } from '../data/types';
import { PROJECT_STATUSES, UPDATE_KINDS } from '../data/types';
import { getCapability, type ClaudeSample, type SampleError } from './claude';
import { STATUS_META } from './meta';
import { goalProgress, projectsForGoal, sortUpdates } from './insights';

/*
 * Claude-powered helpers. They only light up when Workfile runs as a Claude
 * Artifact with the `sample` capability; each call runs on the viewer's own
 * Claude account and asks for consent the first time.
 */

let disabled = false;

/** The sample function, or null when this view can't ask Claude. */
export function useAssistant(): ClaudeSample | null {
  const [sample, setSample] = useState<ClaudeSample | null>(null);
  useEffect(() => {
    let alive = true;
    void getCapability('sample').then((s) => alive && !disabled && setSample(() => s));
    return () => {
      alive = false;
    };
  }, []);
  return sample;
}

const HIDE_CODES = new Set([
  'not_granted',
  'sampling_disabled',
  'not_declared',
  'capability_disabled',
  'capability_removed',
]);

/** Viewer-facing copy for a failed call. Returns null for a cancel. */
export function assistantError(e: unknown): string | null {
  const code = (e as SampleError)?.code ?? 'upstream_error';
  if (code === 'cancelled') return null;
  if (HIDE_CODES.has(code)) {
    disabled = true;
    return 'Claude is turned off for this page. You can allow it from the artifact menu and reload.';
  }
  switch (code) {
    case 'rate_limited':
      return "You've hit your Claude usage limit for now. Try again later.";
    case 'session_expired':
      return 'Your Claude session expired. Sign in again, then retry.';
    case 'invalid_json':
      return "Claude's answer wasn't in the expected shape. Try again.";
    case 'refused':
      return 'Claude declined this request. Rephrase it and try again.';
    case 'prompt_too_large':
      return 'There is too much text to send at once. Pick a shorter range.';
    default:
      return "Couldn't reach Claude. Check your connection and try again.";
  }
}

/* ------------------------------------------------------------------------ */
/* 1. Read a free-text update and suggest project changes                    */
/* ------------------------------------------------------------------------ */

export interface UpdateSuggestion {
  kind: UpdateKind | null;
  progress: number | null;
  status: ProjectStatus | null;
  completedRequirementIds: string[];
  newRequirements: string[];
  tidy: string | null;
}

export async function suggestFromUpdate(
  sample: ClaudeSample,
  project: Project,
  draft: string,
  signal: AbortSignal,
): Promise<UpdateSuggestion> {
  const reqs = project.requirements.map((r) => `- id=${r.id} [${r.done ? 'x' : ' '}] ${r.text}`).join('\n') || '(none)';
  const prompt = `You help a product designer keep a project tracker current. Read their new update and suggest changes to the project.

Project: ${project.title}
Summary: ${project.summary || '(none)'}
Current status: ${project.status} (${STATUS_META[project.status].label})
Current progress: ${project.progress}%
Statuses, in order: ${PROJECT_STATUSES.join(', ')}
Requirements:
${reqs}

New update (written by the designer):
"""
${draft.slice(0, 4000)}
"""

Reply with only a JSON object:
{"kind": one of ${UPDATE_KINDS.filter((k) => k !== 'status').join('|')},
 "progress": integer 0-100 if the update implies a new overall progress, else null,
 "status": a status from the list if the update implies the project moved stage, else null,
 "completedRequirementIds": ids of open requirements the update says are now done,
 "newRequirements": short new requirements the update introduces (max 3),
 "tidy": the update rewritten as 1-3 clear, factual sentences in first person, keeping every fact}
Only suggest a change when the update clearly supports it. Progress should never go down unless the update says so.`;
  const raw = await sample.json<Record<string, unknown>>(prompt, { signal, modelTier: 'quick', cache: false });
  const open = new Set(project.requirements.filter((r) => !r.done).map((r) => r.id));
  const kind = typeof raw.kind === 'string' && (UPDATE_KINDS as readonly string[]).includes(raw.kind) ? (raw.kind as UpdateKind) : null;
  const status =
    typeof raw.status === 'string' && (PROJECT_STATUSES as readonly string[]).includes(raw.status) && raw.status !== project.status
      ? (raw.status as ProjectStatus)
      : null;
  const prog = typeof raw.progress === 'number' && Number.isFinite(raw.progress) ? Math.round(Math.max(0, Math.min(100, raw.progress))) : null;
  return {
    kind,
    progress: prog !== null && prog !== project.progress ? prog : null,
    status,
    completedRequirementIds: Array.isArray(raw.completedRequirementIds)
      ? raw.completedRequirementIds.map(String).filter((id) => open.has(id))
      : [],
    newRequirements: Array.isArray(raw.newRequirements)
      ? raw.newRequirements.map((s) => String(s).trim()).filter(Boolean).slice(0, 3)
      : [],
    tidy: typeof raw.tidy === 'string' && raw.tidy.trim() && raw.tidy.trim() !== draft.trim() ? raw.tidy.trim() : null,
  };
}

/* ------------------------------------------------------------------------ */
/* 2. Recaps for 1:1s and status reports                                     */
/* ------------------------------------------------------------------------ */

function updateLine(u: Update, data: DataSnapshot): string {
  const p = u.projectId ? data.projects[u.projectId] : null;
  const changes = [
    u.statusTo ? `status ${u.statusFrom ?? '?'}→${u.statusTo}` : '',
    u.progressTo !== null ? `progress ${u.progressFrom ?? '?'}%→${u.progressTo}%` : '',
  ]
    .filter(Boolean)
    .join(', ');
  return `- ${u.date} [${p?.title ?? 'General'}] (${u.kind}) ${u.text || '(no text)'}${changes ? ` {${changes}}` : ''}`;
}

export function recapPrompt(data: DataSnapshot, from: string, to: string, audience: 'manager' | 'self'): string {
  const updates = sortUpdates(Object.values(data.updates).filter((u) => u.date >= from && u.date <= to)).reverse();
  const projects = Object.values(data.projects)
    .filter((p) => !p.archived)
    .map(
      (p) =>
        `- ${p.title}: ${STATUS_META[p.status].label}, ${p.progress}%${p.dueDate ? `, due ${p.dueDate}` : ''}; goals: ${
          p.goalIds.map((g) => data.goals[g]?.title).filter(Boolean).join('; ') || 'none'
        }`,
    )
    .join('\n');
  const lines = updates.map((u) => updateLine(u, data)).join('\n').slice(0, 60_000);
  const s = data.settings;
  return `Write a ${audience === 'manager' ? 'concise status recap for a 1:1 with my manager' : 'private weekly reflection for myself'}.
I am ${s.ownerName || 'a designer'}, ${s.role} at ${s.company}. Period: ${from} to ${to}.

Projects right now:
${projects || '(none)'}

Log entries in the period, oldest first:
${lines || '(no entries)'}

Format in Markdown:
## Highlights (3-5 bullets, outcomes first)
## In progress (one line per active project: where it stands, next step)
## Blockers & asks (only real ones; write "None" if none)
${audience === 'manager' ? '## Next week (2-4 bullets)' : '## What I learned (2-3 bullets)'}
Use plain, specific language. Don't invent facts that aren't in the log.`;
}

/* ------------------------------------------------------------------------ */
/* 3. Goal self-review draft                                                 */
/* ------------------------------------------------------------------------ */

export function goalReviewPrompt(goal: Goal, data: DataSnapshot): string {
  const linked = projectsForGoal(goal.id, data.projects);
  const prog = goalProgress(goal, data.projects);
  const ids = new Set(linked.map((p) => p.id));
  const updates = sortUpdates(Object.values(data.updates).filter((u) => u.projectId && ids.has(u.projectId))).reverse();
  const s = data.settings;
  return `Draft a self-assessment for one annual goal, for my ${s.cycleLabel} performance review.
I am ${s.ownerName || 'a designer'}, ${s.role} at ${s.company}.

Goal: ${goal.title}
Description: ${goal.description || '(none)'}
Success measures:
${goal.measures.map((m) => `- [${m.done ? 'x' : ' '}] ${m.text}`).join('\n') || '(none)'}
Overall progress: ${prog.value}% (${prog.explain})

Linked projects:
${linked.map((p) => `- ${p.title}: ${STATUS_META[p.status].label}, ${p.progress}%. ${p.summary}`).join('\n') || '(none)'}

Evidence from my log, oldest first:
${updates.map((u) => updateLine(u, data)).join('\n').slice(0, 60_000) || '(no entries yet)'}

Write in first person, Markdown:
## Summary (2-3 sentences)
## Impact & evidence (bullets tied to specific projects and measures)
## Challenges (1-3 bullets)
## Next steps (2-3 bullets)
Be specific and honest; only use facts from above.`;
}
