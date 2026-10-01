/*
 * Workfile data model. Every record is a plain JSON document so it can live in
 * a Claude Artifact database, in localStorage, or in an export file unchanged.
 * See README.md › "Data model" for how Claude can read and write these.
 */

export type ID = string;
/** Calendar date, `YYYY-MM-DD`. */
export type ISODate = string;
/** Timestamp, `new Date().toISOString()`. */
export type ISODateTime = string;

export const GOAL_COLORS = ['cobalt', 'jade', 'amber', 'coral', 'violet', 'teal', 'rose', 'olive'] as const;
export type GoalColor = (typeof GOAL_COLORS)[number];

export interface Measure {
  id: ID;
  text: string;
  done: boolean;
}

export interface Goal {
  id: ID;
  title: string;
  description: string;
  /** Free text such as Craft, Impact, Leadership, Growth. */
  category: string;
  color: GoalColor;
  /** How you'll know the goal is met. */
  measures: Measure[];
  /** `auto` averages linked projects; `manual` uses `manualProgress`. */
  progressMode: 'auto' | 'manual';
  manualProgress: number;
  order: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export const PROJECT_STATUSES = ['idea', 'discovery', 'design', 'review', 'handoff', 'shipped', 'paused'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PRIORITIES = ['high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const LINK_KINDS = ['prototype', 'design', 'doc', 'research', 'ticket', 'other'] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export const REQUIREMENT_LEVELS = ['must', 'should', 'could'] as const;
export type RequirementLevel = (typeof REQUIREMENT_LEVELS)[number];

export interface Requirement {
  id: ID;
  text: string;
  done: boolean;
  level: RequirementLevel;
  createdAt: ISODateTime;
}

export interface ProjectLink {
  id: ID;
  label: string;
  url: string;
  kind: LinkKind;
  createdAt: ISODateTime;
}

export interface Project {
  id: ID;
  title: string;
  summary: string;
  status: ProjectStatus;
  priority: Priority;
  /** 0–100 */
  progress: number;
  goalIds: ID[];
  startDate: ISODate | null;
  dueDate: ISODate | null;
  /** Free text, e.g. "PM: Priya · Eng: Mark". */
  team: string;
  tags: string[];
  requirements: Requirement[];
  links: ProjectLink[];
  pinned: boolean;
  archived: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** Latest update or edit; drives "needs attention". */
  lastActivityAt: ISODateTime;
}

export const UPDATE_KINDS = ['progress', 'decision', 'feedback', 'blocker', 'milestone', 'status'] as const;
export type UpdateKind = (typeof UPDATE_KINDS)[number];

/** A dated log entry. `projectId: null` is a general journal entry. */
export interface Update {
  id: ID;
  projectId: ID | null;
  date: ISODate;
  text: string;
  kind: UpdateKind;
  progressFrom: number | null;
  progressTo: number | null;
  statusFrom: ProjectStatus | null;
  statusTo: ProjectStatus | null;
  /** True when Workfile logged it for you (status or progress changed). */
  auto: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Long-form notes in Markdown. `projectId: null` is a general note. */
export interface Note {
  id: ID;
  projectId: ID | null;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Settings {
  ownerName: string;
  role: string;
  company: string;
  cycleLabel: string;
  cycleStart: ISODate;
  cycleEnd: ISODate;
  /** Days without an update before a project needs attention. */
  staleAfterDays: number;
}

export type CollectionName = 'goals' | 'projects' | 'updates' | 'notes';

export interface CollectionMap {
  goals: Goal;
  projects: Project;
  updates: Update;
  notes: Note;
}

export interface DataSnapshot {
  goals: Record<ID, Goal>;
  projects: Record<ID, Project>;
  updates: Record<ID, Update>;
  notes: Record<ID, Note>;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  ownerName: 'Aniket',
  role: 'Product Designer',
  company: 'SOTI',
  cycleLabel: 'FY 2026–27',
  cycleStart: '2026-04-01',
  cycleEnd: '2027-03-31',
  staleAfterDays: 14,
};

/** Shape of an export file. Bump `schemaVersion` when the model changes. */
export interface ExportFile {
  app: 'workfile';
  schemaVersion: 1;
  exportedAt: ISODateTime;
  settings: Settings;
  goals: Goal[];
  projects: Project[];
  updates: Update[];
  notes: Note[];
}
