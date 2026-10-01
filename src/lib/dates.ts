import type { ISODate, ISODateTime } from '../data/types';

const DAY = 86_400_000;

export const nowISO = (): ISODateTime => new Date().toISOString();

/** Today in the viewer's local time zone, as `YYYY-MM-DD`. */
export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parses `YYYY-MM-DD` as a local date (not UTC midnight). */
export function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** The local calendar day of a timestamp (an ISO timestamp is in UTC, so slicing it would be off in the evening). */
export function localDay(isoDateTime: string): ISODate {
  const d = new Date(isoDateTime);
  return Number.isNaN(d.getTime()) ? isoDateTime.slice(0, 10) : toISODate(d);
}

export function isValidISODate(v: unknown): v is ISODate {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && parseDate(v) !== null;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);
}

export function daysFromToday(iso: string | null | undefined): number | null {
  const d = parseDate(iso);
  if (!d) return null;
  return daysBetween(new Date(), d);
}

const fmtShort = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const fmtShortYear = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const fmtLong = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const fmtWeekday = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtMonth = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const fmtMonthShort = new Intl.DateTimeFormat(undefined, { month: 'short' });

export function formatDate(iso: string | null | undefined, opts: { year?: boolean } = {}): string {
  const d = parseDate(iso);
  if (!d) return '—';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return opts.year || !sameYear ? fmtShortYear.format(d) : fmtShort.format(d);
}

export const formatLongDate = (d: Date) => fmtLong.format(d);
export const formatWeekday = (iso: string) => {
  const d = parseDate(iso);
  return d ? fmtWeekday.format(d) : '—';
};
export const formatMonth = (d: Date) => fmtMonth.format(d);
export const formatMonthShort = (d: Date) => fmtMonthShort.format(d);

/** "today", "yesterday", "3d ago", "2w ago", "in 5d" */
export function relativeDays(iso: string | null | undefined): string {
  const n = daysFromToday(iso);
  if (n === null) return '—';
  if (n === 0) return 'today';
  if (n === -1) return 'yesterday';
  if (n === 1) return 'tomorrow';
  const abs = Math.abs(n);
  const unit = abs >= 14 ? `${Math.round(abs / 7)}w` : `${abs}d`;
  return n < 0 ? `${unit} ago` : `in ${unit}`;
}

/** ISO-8601 week number, used to group the journal. */
export function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / DAY + 1) / 7);
  return { year: t.getUTCFullYear(), week };
}

export function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  const day = s.getDay() || 7;
  s.setDate(s.getDate() - (day - 1));
  return s;
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
