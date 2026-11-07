import {
  CONNECTOR_MODES,
  DEFAULT_SETTINGS,
  GOAL_COLORS,
  LINK_KINDS,
  MANUAL_SOURCE,
  PRIORITIES,
  PROJECT_STATUSES,
  PROPOSAL_RISKS,
  PROPOSAL_STATUSES,
  REQUIREMENT_LEVELS,
  SOURCE_KINDS,
  UPDATE_KINDS,
  type Brief,
  type CollectionMap,
  type CollectionName,
  type ConnectorMode,
  type ConnectorState,
  type Goal,
  type Measure,
  type Note,
  type Project,
  type ProjectAnchors,
  type ProjectLink,
  type Proposal,
  type ProposedAction,
  type Report,
  type ReportSettings,
  DEFAULT_REPORT_SETTINGS,
  REPORT_STATUSES,
  type Requirement,
  type Settings,
  type SourceRef,
  type Update,
} from './types';
import { isValidISODate, localDay, nowISO, todayISO } from '../lib/dates';
import { newId } from '../lib/ids';

/*
 * Records can be written by this app, by Claude through the Artifact database
 * tools, or by an imported file. Everything passes through these functions on
 * the way in, so a missing or mistyped field never breaks the UI.
 */

type Raw = Record<string, unknown>;

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const bool = (v: unknown, fallback = false): boolean => (typeof v === 'boolean' ? v : fallback);
const num = (v: unknown, fallback: number): number => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};
const pct = (v: unknown, fallback = 0) => Math.round(Math.min(100, Math.max(0, num(v, fallback))));
const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
  typeof v === 'string' && (list as readonly string[]).includes(v.toLowerCase()) ? (v.toLowerCase() as T) : fallback;
const dateOrNull = (v: unknown) => (isValidISODate(v) ? v : null);
const time = (v: unknown, fallback: string) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : fallback);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {});
const strList = (v: unknown) =>
  arr(v)
    .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    .map((x) => x.trim());

function measure(v: unknown): Measure | null {
  if (typeof v === 'string') return v.trim() ? { id: newId('m'), text: v.trim(), done: false } : null;
  const r = obj(v);
  const text = str(r.text).trim();
  if (!text) return null;
  return { id: str(r.id) || newId('m'), text, done: bool(r.done) };
}

function requirement(v: unknown, now: string): Requirement | null {
  if (typeof v === 'string') {
    return v.trim() ? { id: newId('r'), text: v.trim(), done: false, level: 'should', createdAt: now } : null;
  }
  const r = obj(v);
  const text = str(r.text).trim();
  if (!text) return null;
  return {
    id: str(r.id) || newId('r'),
    text,
    done: bool(r.done),
    level: oneOf(REQUIREMENT_LEVELS, r.level, 'should'),
    createdAt: time(r.createdAt, now),
  };
}

function link(v: unknown, now: string): ProjectLink | null {
  const r = typeof v === 'string' ? { url: v } : obj(v);
  const url = str(r.url).trim();
  if (!url) return null;
  return {
    id: str(r.id) || newId('l'),
    label: str(r.label).trim() || url.replace(/^https?:\/\//, '').slice(0, 60),
    url,
    kind: oneOf(LINK_KINDS, r.kind, guessLinkKind(url)),
    createdAt: time(r.createdAt, now),
  };
}

export function guessLinkKind(url: string): ProjectLink['kind'] {
  const u = url.toLowerCase();
  if (/figma\.com\/proto|protopie|framer\.(com|website)\/|invisionapp|\/proto\//.test(u)) return 'prototype';
  if (/figma\.com|sketch\.com|zeroheight|storybook/.test(u)) return 'design';
  if (/jira|atlassian\.net\/browse|linear\.app|github\.com\/.+\/(issues|pull)|azure\.com|dev\.azure/.test(u))
    return 'ticket';
  if (/dovetail|maze\.co|usertesting|lookback|hotjar|fullstory|survey|typeform|forms\./.test(u)) return 'research';
  if (/docs\.google|confluence|notion\.|sharepoint|onedrive|dropbox\.com\/paper|\.pdf$|miro\.com/.test(u)) return 'doc';
  return 'other';
}

export function normalizeGoal(id: string, v: unknown): Goal {
  const r = obj(v);
  const now = nowISO();
  return {
    id,
    title: str(r.title).trim() || 'Untitled goal',
    description: str(r.description),
    category: str(r.category).trim(),
    color: oneOf(GOAL_COLORS, r.color, GOAL_COLORS[Math.abs(hash(id)) % GOAL_COLORS.length]),
    measures: arr(r.measures)
      .map(measure)
      .filter((m): m is Measure => m !== null),
    progressMode: r.progressMode === 'manual' ? 'manual' : 'auto',
    manualProgress: pct(r.manualProgress),
    order: num(r.order, Date.parse(time(r.createdAt, now))),
    createdAt: time(r.createdAt, now),
    updatedAt: time(r.updatedAt, now),
  };
}

export function normalizeProject(id: string, v: unknown): Project {
  const r = obj(v);
  const now = nowISO();
  const createdAt = time(r.createdAt, now);
  const updatedAt = time(r.updatedAt, createdAt);
  return {
    id,
    title: str(r.title).trim() || 'Untitled project',
    summary: str(r.summary),
    status: oneOf(PROJECT_STATUSES, r.status, 'idea'),
    priority: oneOf(PRIORITIES, r.priority, 'medium'),
    progress: pct(r.progress),
    goalIds: strList(r.goalIds),
    startDate: dateOrNull(r.startDate),
    dueDate: dateOrNull(r.dueDate),
    team: str(r.team),
    tags: strList(r.tags),
    requirements: arr(r.requirements)
      .map((x) => requirement(x, now))
      .filter((x): x is Requirement => x !== null),
    links: arr(r.links)
      .map((x) => link(x, now))
      .filter((x): x is ProjectLink => x !== null),
    pinned: bool(r.pinned),
    archived: bool(r.archived),
    createdAt,
    updatedAt,
    lastActivityAt: time(r.lastActivityAt, updatedAt),
    anchors: normalizeAnchors(r.anchors),
  };
}

export function normalizeAnchors(v: unknown): ProjectAnchors {
  const r = obj(v);
  const uniq = (list: string[]) => [...new Set(list)];
  return {
    repos: uniq(strList(r.repos)),
    jiraKeys: uniq(strList(r.jiraKeys).map((k) => k.toUpperCase())),
    keywords: uniq(strList(r.keywords)),
    channels: uniq(strList(r.channels)),
  };
}

export function normalizeSource(v: unknown): SourceRef {
  if (!v || typeof v !== 'object') return { ...MANUAL_SOURCE };
  const r = obj(v);
  const url = str(r.url).trim();
  return {
    kind: oneOf(SOURCE_KINDS, r.kind, 'agent'),
    ref: str(r.ref).trim() || null,
    url: /^https?:\/\//i.test(url) ? url : null,
    label: str(r.label).trim().slice(0, 80) || null,
  };
}

export function normalizeUpdate(id: string, v: unknown): Update {
  const r = obj(v);
  const now = nowISO();
  const progressOrNull = (x: unknown) => (x === null || x === undefined || x === '' ? null : pct(x));
  const statusOrNull = (x: unknown) => (typeof x === 'string' ? oneOf(PROJECT_STATUSES, x, 'idea') : null);
  const createdAt = time(r.createdAt, now);
  return {
    id,
    projectId: str(r.projectId) || null,
    date: isValidISODate(r.date) ? r.date : localDay(createdAt) || todayISO(),
    text: str(r.text),
    kind: oneOf(UPDATE_KINDS, r.kind, 'progress'),
    progressFrom: progressOrNull(r.progressFrom),
    progressTo: progressOrNull(r.progressTo),
    statusFrom: statusOrNull(r.statusFrom),
    statusTo: statusOrNull(r.statusTo),
    auto: bool(r.auto),
    source: normalizeSource(r.source),
    proposalId: str(r.proposalId) || null,
    createdAt,
    updatedAt: time(r.updatedAt, createdAt),
  };
}

export function normalizeNote(id: string, v: unknown): Note {
  const r = obj(v);
  const now = nowISO();
  const createdAt = time(r.createdAt, now);
  return {
    id,
    projectId: str(r.projectId) || null,
    title: str(r.title),
    body: str(r.body),
    pinned: bool(r.pinned),
    createdAt,
    updatedAt: time(r.updatedAt, createdAt),
  };
}

export function normalizeSettings(v: unknown): Settings {
  const r = obj(v);
  return {
    ownerName: str(r.ownerName, DEFAULT_SETTINGS.ownerName),
    role: str(r.role, DEFAULT_SETTINGS.role),
    company: str(r.company, DEFAULT_SETTINGS.company),
    cycleLabel: str(r.cycleLabel).trim() || DEFAULT_SETTINGS.cycleLabel,
    cycleStart: isValidISODate(r.cycleStart) ? r.cycleStart : DEFAULT_SETTINGS.cycleStart,
    cycleEnd: isValidISODate(r.cycleEnd) ? r.cycleEnd : DEFAULT_SETTINGS.cycleEnd,
    staleAfterDays: Math.max(1, Math.round(num(r.staleAfterDays, DEFAULT_SETTINGS.staleAfterDays))),
    report: normalizeReportSettings(r.report),
  };
}

export function normalizeReportSettings(v: unknown): ReportSettings {
  const r = obj(v);
  const d = DEFAULT_REPORT_SETTINGS;
  const time = str(r.time);
  return {
    enabled: bool(r.enabled, d.enabled),
    weekday: Math.min(6, Math.max(0, Math.round(num(r.weekday, d.weekday)))),
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : d.time,
    recipientName: str(r.recipientName).trim(),
    recipientEmail: str(r.recipientEmail).trim(),
    delivery: r.delivery === 'auto' ? 'auto' : 'review',
  };
}

export function normalizeReport(id: string, v: unknown): Report {
  const r = obj(v);
  const now = nowISO();
  const createdAt = time(r.createdAt, now);
  const periodEnd = isValidISODate(r.periodEnd) ? r.periodEnd : localDay(createdAt);
  const sentVia = r.sentVia === 'teams-workflow' || r.sentVia === 'manual' ? r.sentVia : null;
  return {
    id,
    periodStart: isValidISODate(r.periodStart) ? r.periodStart : periodEnd,
    periodEnd,
    title: str(r.title).trim() || 'Weekly report',
    body: str(r.body),
    recipientName: str(r.recipientName).trim(),
    recipientEmail: str(r.recipientEmail).trim(),
    status: oneOf(REPORT_STATUSES, r.status, 'draft'),
    sentAt: typeof r.sentAt === 'string' && !Number.isNaN(Date.parse(r.sentAt)) ? r.sentAt : null,
    sentVia,
    note: str(r.note).slice(0, 400),
    createdAt,
    updatedAt: time(r.updatedAt, createdAt),
  };
}

function normalizeAction(v: unknown): ProposedAction | null {
  const r = obj(v);
  switch (r.type) {
    case 'log_update': {
      const text = str(r.text).trim();
      if (!text) return null;
      return {
        type: 'log_update',
        date: isValidISODate(r.date) ? r.date : todayISO(),
        text,
        kind: oneOf(UPDATE_KINDS, r.kind, 'progress'),
        progressTo: r.progressTo === null || r.progressTo === undefined ? null : pct(r.progressTo),
        statusTo: typeof r.statusTo === 'string' ? oneOf(PROJECT_STATUSES, r.statusTo, 'design') : null,
      };
    }
    case 'add_link': {
      const url = str(r.url).trim();
      if (!/^https?:\/\//i.test(url)) return null;
      return { type: 'add_link', url, label: str(r.label).trim() || url, kind: oneOf(LINK_KINDS, r.kind, guessLinkKind(url)) };
    }
    case 'add_requirement': {
      const text = str(r.text).trim();
      return text ? { type: 'add_requirement', text, level: oneOf(REQUIREMENT_LEVELS, r.level, 'should') } : null;
    }
    case 'complete_requirement': {
      const requirementId = str(r.requirementId);
      return requirementId ? { type: 'complete_requirement', requirementId, text: str(r.text) } : null;
    }
    case 'create_project': {
      const title = str(r.title).trim();
      if (!title) return null;
      return {
        type: 'create_project',
        title,
        summary: str(r.summary),
        goalIds: strList(r.goalIds),
        status: oneOf(PROJECT_STATUSES, r.status, 'discovery'),
        dueDate: dateOrNull(r.dueDate),
      };
    }
    case 'add_anchor': {
      // Exact match: these keys are camelCase, and oneOf() lowercases its input.
      const fields = ['repos', 'jiraKeys', 'keywords', 'channels'] as const;
      const field = fields.find((f) => f === r.field) ?? 'keywords';
      const value = str(r.value).trim();
      return value ? { type: 'add_anchor', field, value } : null;
    }
    case 'add_note': {
      const body = str(r.body).trim();
      return body ? { type: 'add_note', title: str(r.title).trim(), body } : null;
    }
    case 'send_report': {
      const reportId = str(r.reportId);
      return reportId ? { type: 'send_report', reportId } : null;
    }
    default:
      return null;
  }
}

export function normalizeProposal(id: string, v: unknown): Proposal {
  const r = obj(v);
  const now = nowISO();
  const createdAt = time(r.createdAt, now);
  const src = obj(r.source);
  const applied = obj(r.applied);
  return {
    id,
    source: { ...normalizeSource(r.source), occurredAt: time(src.occurredAt, createdAt) },
    title: str(r.title).trim() || 'Something to log',
    summary: str(r.summary).trim(),
    why: str(r.why).trim(),
    projectId: str(r.projectId) || null,
    confidence: Math.max(0, Math.min(1, num(r.confidence, 0.5))),
    actions: arr(r.actions)
      .map(normalizeAction)
      .filter((a): a is ProposedAction => a !== null),
    risk: oneOf(PROPOSAL_RISKS, r.risk, 'medium'),
    status: oneOf(PROPOSAL_STATUSES, r.status, 'pending'),
    decidedAt: typeof r.decidedAt === 'string' ? time(r.decidedAt, now) : null,
    applied: {
      updateIds: strList(applied.updateIds),
      noteIds: strList(applied.noteIds),
      linkUrls: strList(applied.linkUrls),
      projectId: str(applied.projectId) || null,
    },
    createdAt,
    updatedAt: time(r.updatedAt, createdAt),
  };
}

export function normalizeConnector(id: string, v: unknown, defaultMode: ConnectorMode = 'off'): ConnectorState {
  const r = obj(v);
  return {
    id,
    mode: oneOf(CONNECTOR_MODES, r.mode, defaultMode),
    lastRunAt: typeof r.lastRunAt === 'string' && !Number.isNaN(Date.parse(r.lastRunAt)) ? r.lastRunAt : null,
    lastStatus: r.lastStatus === 'ok' || r.lastStatus === 'error' ? r.lastStatus : 'never',
    lastMessage: str(r.lastMessage).slice(0, 400),
    cursor: str(r.cursor) || null,
    ignore: strList(r.ignore),
    updatedAt: time(r.updatedAt, nowISO()),
  };
}

export function normalizeBrief(v: unknown): Brief | null {
  const r = obj(v);
  const body = str(r.body).trim();
  if (!body || typeof r.generatedAt !== 'string' || Number.isNaN(Date.parse(r.generatedAt))) return null;
  return { generatedAt: r.generatedAt, body };
}

export const normalizers: { [K in CollectionName]: (id: string, v: unknown) => CollectionMap[K] } = {
  goals: normalizeGoal,
  projects: normalizeProject,
  updates: normalizeUpdate,
  notes: normalizeNote,
  inbox: normalizeProposal,
  connectors: (id, v) => normalizeConnector(id, v),
  reports: normalizeReport,
};

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
