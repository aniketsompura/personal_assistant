import type { DataSnapshot, Goal, Project, Settings, Update } from '../data/types';
import { daysBetween, daysFromToday, localDay, parseDate } from './dates';

/*
 * Derived numbers: cycle position, goal progress and pace, and the
 * "needs attention" list. Pure functions so they're easy to test and reuse.
 */

export interface CycleInfo {
  start: Date;
  end: Date;
  totalDays: number;
  /** Day number within the cycle, clamped to [0, totalDays]. */
  day: number;
  /** Percent of the cycle elapsed, 0–100. */
  pct: number;
}

export function cycleInfo(settings: Settings, today = new Date()): CycleInfo {
  const start = parseDate(settings.cycleStart) ?? new Date(today.getFullYear(), 0, 1);
  let end = parseDate(settings.cycleEnd) ?? new Date(today.getFullYear(), 11, 31);
  if (end <= start) end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate() - 1);
  const totalDays = Math.max(1, daysBetween(start, end) + 1);
  const day = Math.min(totalDays, Math.max(0, daysBetween(start, today) + 1));
  return { start, end, totalDays, day, pct: Math.round((day / totalDays) * 100) };
}

export const activeProjects = (projects: Record<string, Project>) =>
  Object.values(projects).filter((p) => !p.archived);

export function projectsForGoal(goalId: string, projects: Record<string, Project>): Project[] {
  return activeProjects(projects).filter((p) => p.goalIds.includes(goalId));
}

export interface GoalProgress {
  value: number;
  source: 'manual' | 'projects' | 'measures' | 'none';
  /** Human sentence explaining the number. */
  explain: string;
}

export function goalProgress(goal: Goal, projects: Record<string, Project>): GoalProgress {
  if (goal.progressMode === 'manual') {
    return { value: goal.manualProgress, source: 'manual', explain: 'Set by you' };
  }
  const linked = projectsForGoal(goal.id, projects).filter((p) => p.status !== 'paused');
  if (linked.length > 0) {
    const value = Math.round(linked.reduce((s, p) => s + p.progress, 0) / linked.length);
    return {
      value,
      source: 'projects',
      explain: `Average of ${linked.length} linked project${linked.length === 1 ? '' : 's'}`,
    };
  }
  if (goal.measures.length > 0) {
    const done = goal.measures.filter((m) => m.done).length;
    return {
      value: Math.round((done / goal.measures.length) * 100),
      source: 'measures',
      explain: `${done} of ${goal.measures.length} measures met`,
    };
  }
  return { value: 0, source: 'none', explain: 'Link a project to start tracking' };
}

export type Pace = 'ahead' | 'on-track' | 'behind' | 'done';

/** Compares progress with the share of the cycle that has elapsed. */
export function pace(progress: number, cyclePct: number): Pace {
  if (progress >= 100) return 'done';
  if (progress >= cyclePct + 10) return 'ahead';
  if (progress >= cyclePct - 12) return 'on-track';
  return 'behind';
}

export const PACE_LABEL: Record<Pace, string> = {
  ahead: 'Ahead',
  'on-track': 'On track',
  behind: 'Behind pace',
  done: 'Complete',
};

export function updatesFor(projectId: string, updates: Record<string, Update>): Update[] {
  return sortUpdates(Object.values(updates).filter((u) => u.projectId === projectId));
}

/** Newest first: by entry date, then by when it was written. */
export function sortUpdates(list: Update[]): Update[] {
  return [...list].sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
}

export function lastUpdateFor(projectId: string, updates: Record<string, Update>): Update | null {
  let best: Update | null = null;
  for (const u of Object.values(updates)) {
    if (u.projectId !== projectId) continue;
    if (!best || u.date > best.date || (u.date === best.date && u.createdAt > best.createdAt)) best = u;
  }
  return best;
}

export type AttentionReason = 'overdue' | 'due-soon' | 'stale' | 'blocked';

export interface AttentionItem {
  project: Project;
  reason: AttentionReason;
  days: number;
}

const ATTENTION_ORDER: Record<AttentionReason, number> = { overdue: 0, blocked: 1, 'due-soon': 2, stale: 3 };

/** Active projects that need a look: overdue, due within 7 days, blocked, or quiet for too long. */
export function needsAttention(data: DataSnapshot): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const p of activeProjects(data.projects)) {
    if (p.status === 'shipped' || p.status === 'paused') continue;
    const due = daysFromToday(p.dueDate);
    const last = lastUpdateFor(p.id, data.updates);
    if (due !== null && due < 0) {
      items.push({ project: p, reason: 'overdue', days: -due });
      continue;
    }
    if (last?.kind === 'blocker' && (daysFromToday(last.date) ?? -99) > -21) {
      items.push({ project: p, reason: 'blocked', days: -(daysFromToday(last.date) ?? 0) });
      continue;
    }
    if (due !== null && due <= 7) {
      items.push({ project: p, reason: 'due-soon', days: due });
      continue;
    }
    const lastTouch = last?.date ?? localDay(p.createdAt);
    const quiet = -(daysFromToday(lastTouch) ?? 0);
    if (quiet >= data.settings.staleAfterDays) items.push({ project: p, reason: 'stale', days: quiet });
  }
  return items.sort((a, b) => ATTENTION_ORDER[a.reason] - ATTENTION_ORDER[b.reason] || a.days - b.days);
}

export function attentionLabel(item: AttentionItem): string {
  switch (item.reason) {
    case 'overdue':
      return `${item.days}d overdue`;
    case 'due-soon':
      return item.days === 0 ? 'Due today' : `Due in ${item.days}d`;
    case 'blocked':
      return 'Blocked';
    case 'stale':
      return `Quiet ${item.days}d`;
  }
}

export function requirementStats(p: Project) {
  const total = p.requirements.length;
  const done = p.requirements.filter((r) => r.done).length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}
