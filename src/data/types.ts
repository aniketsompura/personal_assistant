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

/** What ties outside work to a project, so the agent can match it without asking. */
export interface ProjectAnchors {
  /** Folders or git remotes where you prototype with Claude Code. */
  repos: string[];
  /** Jira issue or epic keys, e.g. DES-142. Jira links on the project count too. */
  jiraKeys: string[];
  /** Names people use for the project in meetings, chats and mail. */
  keywords: string[];
  /** Teams chats or channels, or mail threads, about this project. */
  channels: string[];
}

export const EMPTY_ANCHORS: ProjectAnchors = { repos: [], jiraKeys: [], keywords: [], channels: [] };

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
  anchors: ProjectAnchors;
}

export const UPDATE_KINDS = ['progress', 'decision', 'feedback', 'blocker', 'milestone', 'status'] as const;
export type UpdateKind = (typeof UPDATE_KINDS)[number];

/** Where an entry came from. `manual` is anything you typed in Workfile. */
export const SOURCE_KINDS = [
  'manual',
  'claude-code',
  'figma',
  'jira',
  'teams',
  'outlook-mail',
  'outlook-calendar',
  'agent',
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export interface SourceRef {
  kind: SourceKind;
  /** Stable id in the source: session id, Jira key, Figma version id, message id. */
  ref: string | null;
  url: string | null;
  /** Short label shown next to the entry, e.g. "DES-142" or "enrollment-proto". */
  label: string | null;
}

export const MANUAL_SOURCE: SourceRef = { kind: 'manual', ref: null, url: null, label: null };

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
  /** True when Workfile logged it for you (status or progress changed, or the agent logged it). */
  auto: boolean;
  source: SourceRef;
  /** The inbox proposal this entry came from, if any. */
  proposalId: ID | null;
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
  report: ReportSettings;
}

/* ------------------------------------------------------------------------ */
/* Autopilot: proposals the agent files, and the state of each connector     */
/* ------------------------------------------------------------------------ */

/** One change the agent suggests. A proposal can carry several. */
export type ProposedAction =
  | {
      type: 'log_update';
      date: ISODate;
      text: string;
      kind: UpdateKind;
      progressTo: number | null;
      statusTo: ProjectStatus | null;
    }
  | { type: 'add_link'; url: string; label: string; kind: LinkKind }
  | { type: 'add_requirement'; text: string; level: RequirementLevel }
  | { type: 'complete_requirement'; requirementId: ID; text: string }
  | { type: 'create_project'; title: string; summary: string; goalIds: ID[]; status: ProjectStatus; dueDate: ISODate | null }
  | { type: 'add_anchor'; field: keyof ProjectAnchors; value: string }
  | { type: 'add_note'; title: string; body: string }
  | { type: 'send_report'; reportId: ID };

export const PROPOSED_ACTION_TYPES = [
  'log_update',
  'add_link',
  'add_requirement',
  'complete_requirement',
  'create_project',
  'add_anchor',
  'add_note',
  'send_report',
] as const;

export const PROPOSAL_STATUSES = ['pending', 'approved', 'dismissed', 'auto', 'undone'] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const PROPOSAL_RISKS = ['low', 'medium', 'high'] as const;
export type ProposalRisk = (typeof PROPOSAL_RISKS)[number];

/**
 * Something the agent noticed and wants to log. `pending` waits for you;
 * `auto` was applied by the agent (low risk) and can be undone.
 */
export interface Proposal {
  id: ID;
  source: SourceRef & { occurredAt: ISODateTime };
  /** One line, e.g. "Prototype session: CSV error states". */
  title: string;
  /** What happened, in your voice, 1–3 sentences. */
  summary: string;
  /** Why the agent matched it to this project, or why it's asking. */
  why: string;
  projectId: ID | null;
  /** 0–1. Below 0.7 the agent always asks. */
  confidence: number;
  actions: ProposedAction[];
  risk: ProposalRisk;
  status: ProposalStatus;
  decidedAt: ISODateTime | null;
  /** What applying it created, so Undo can remove it. */
  applied: { updateIds: ID[]; noteIds: ID[]; linkUrls: string[]; projectId: ID | null };
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export const CONNECTOR_MODES = ['off', 'ask', 'auto'] as const;
export type ConnectorMode = (typeof CONNECTOR_MODES)[number];

/** Per-source switch and the agent's last report. Stored at `connectors/{id}`. */
export interface ConnectorState {
  id: string;
  mode: ConnectorMode;
  lastRunAt: ISODateTime | null;
  lastStatus: 'ok' | 'error' | 'never';
  lastMessage: string;
  /** The agent's high-water mark (a timestamp or source cursor). */
  cursor: string | null;
  /** Folders, files or channels you told it to skip. */
  ignore: string[];
  updatedAt: ISODateTime;
}

/**
 * A weekly report of your work, drafted by the agent on the day you choose.
 * Stored at `reports/{id}`; the id is the week it covers, e.g. `w_2026-10-26`.
 */
export const REPORT_STATUSES = ['draft', 'approved', 'sent', 'failed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export interface Report {
  id: ID;
  /** First and last day covered. */
  periodStart: ISODate;
  periodEnd: ISODate;
  title: string;
  /** Markdown. */
  body: string;
  recipientName: string;
  recipientEmail: string;
  /** draft: waiting for you · approved: the agent will send it · sent · failed (see `note`). */
  status: ReportStatus;
  sentAt: ISODateTime | null;
  /** How it went out: `teams-workflow` (sent by the agent) or `manual` (you sent it). */
  sentVia: 'teams-workflow' | 'manual' | null;
  note: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Your weekly-report preferences. Part of `meta/settings`. */
export interface ReportSettings {
  enabled: boolean;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** Local time, HH:MM. The first sync at or after this time drafts the report. */
  time: string;
  recipientName: string;
  /** The person's work email, used to address them in Teams. */
  recipientEmail: string;
  /** review: draft and ask you · auto: send through the Teams workflow without asking. */
  delivery: 'review' | 'auto';
}

export const DEFAULT_REPORT_SETTINGS: ReportSettings = {
  enabled: false,
  weekday: 1,
  time: '09:00',
  recipientName: '',
  recipientEmail: '',
  delivery: 'review',
};

/** The latest morning brief, written by the agent. Stored at `meta/brief`. */
export interface Brief {
  generatedAt: ISODateTime;
  /** Markdown. */
  body: string;
}

export type CollectionName = 'goals' | 'projects' | 'updates' | 'notes' | 'inbox' | 'connectors' | 'reports';

export interface CollectionMap {
  goals: Goal;
  projects: Project;
  updates: Update;
  notes: Note;
  inbox: Proposal;
  connectors: ConnectorState;
  reports: Report;
}

export interface DataSnapshot {
  goals: Record<ID, Goal>;
  projects: Record<ID, Project>;
  updates: Record<ID, Update>;
  notes: Record<ID, Note>;
  inbox: Record<ID, Proposal>;
  connectors: Record<string, ConnectorState>;
  reports: Record<ID, Report>;
  settings: Settings;
  brief: Brief | null;
}

export const DEFAULT_SETTINGS: Settings = {
  ownerName: 'Aniket',
  role: 'Product Designer',
  company: 'SOTI',
  cycleLabel: 'FY 2026–27',
  cycleStart: '2026-04-01',
  cycleEnd: '2027-03-31',
  staleAfterDays: 14,
  report: { enabled: false, weekday: 1, time: '09:00', recipientName: '', recipientEmail: '', delivery: 'review' },
};

/**
 * Shape of an export file. Bump `schemaVersion` when the model changes.
 * v2 added `source`/`proposalId` on updates and `anchors` on projects; v1 files still import.
 * The inbox and connector state are machine-specific and aren't exported.
 */
export interface ExportFile {
  app: 'workfile';
  schemaVersion: 1 | 2;
  exportedAt: ISODateTime;
  settings: Settings;
  goals: Goal[];
  projects: Project[];
  updates: Update[];
  notes: Note[];
  /** Added in v2. */
  reports?: Report[];
}
