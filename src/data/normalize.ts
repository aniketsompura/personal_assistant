import {
  DEFAULT_SETTINGS,
  GOAL_COLORS,
  LINK_KINDS,
  PRIORITIES,
  PROJECT_STATUSES,
  REQUIREMENT_LEVELS,
  UPDATE_KINDS,
  type CollectionMap,
  type CollectionName,
  type Goal,
  type Measure,
  type Note,
  type Project,
  type ProjectLink,
  type Requirement,
  type Settings,
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
  };
}

export const normalizers: { [K in CollectionName]: (id: string, v: unknown) => CollectionMap[K] } = {
  goals: normalizeGoal,
  projects: normalizeProject,
  updates: normalizeUpdate,
  notes: normalizeNote,
};

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
