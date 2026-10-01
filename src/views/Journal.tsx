import * as stylex from '@stylexjs/stylex';
import { AnimatePresence, motion as m } from 'motion/react';
import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { UPDATE_KINDS, type Update, type UpdateKind } from '../data/types';
import { addDays, formatDate, isoWeek, parseDate, startOfWeek, toISODate, todayISO } from '../lib/dates';
import { sortUpdates } from '../lib/insights';
import { UPDATE_KIND_META } from '../lib/meta';
import { recapPrompt, useAssistant } from '../lib/assistant';
import { color, font, space, text } from '../styles/tokens.stylex';
import { Frame } from '../components/Frame';
import { EmptyState, PageHeader } from '../components/domain';
import { Tabs } from '../components/Segmented';
import { Timeline, UpdateComposer } from '../components/Updates';
import { AssistPanel } from '../components/AssistPanel';
import { Select } from '../components/ui';
import { NotesPane } from './project/Notes';

type JournalTab = 'log' | 'notes' | 'recap';
type Range = 'week' | '2weeks' | 'month' | 'cycle';

const s = stylex.create({
  page: { display: 'flex', flexDirection: 'column', gap: space.xl },
  filters: { display: 'flex', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  filter: { flex: '0 1 220px', minWidth: 160 },
  toggle: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: text.small, color: color.inkMuted, cursor: 'pointer' },
  weeks: { display: 'flex', flexDirection: 'column', gap: space.xl },
  weekHead: { display: 'flex', alignItems: 'baseline', gap: space.sm },
  weekNum: { fontFamily: font.display, fontSize: text.lead, fontWeight: 650 },
  weekRange: { fontFamily: font.mono, fontSize: text.small, color: color.inkFaint },
  count: { marginInlineStart: 'auto', fontFamily: font.mono, fontSize: text.label, color: color.inkFaint },
  section: { display: 'flex', flexDirection: 'column', gap: space.xl },
  recapControls: { display: 'flex', flexWrap: 'wrap', gap: space.sm },
});

export function JournalView() {
  const { data } = useStore();
  const sample = useAssistant();
  const [tab, setTab] = useState<JournalTab>('log');
  const [kind, setKind] = useState<UpdateKind | 'all'>('all');
  const [project, setProject] = useState<string>('all');
  const [showAuto, setShowAuto] = useState(false);
  const [range, setRange] = useState<Range>('week');
  const [audience, setAudience] = useState<'manager' | 'self'>('manager');

  const projects = useMemo(
    () => Object.values(data.projects).sort((a, b) => Number(a.archived) - Number(b.archived) || a.title.localeCompare(b.title)),
    [data.projects],
  );

  const filtered = useMemo(() => {
    return sortUpdates(
      Object.values(data.updates).filter((u) => {
        if (!showAuto && u.auto) return false;
        if (kind !== 'all' && u.kind !== kind) return false;
        if (project === 'general' && u.projectId) return false;
        if (project !== 'all' && project !== 'general' && u.projectId !== project) return false;
        return true;
      }),
    );
  }, [data.updates, kind, project, showAuto]);

  const weeks = useMemo(() => {
    const out: { key: string; label: string; range: string; items: Update[] }[] = [];
    for (const u of filtered) {
      const d = parseDate(u.date) ?? new Date();
      const { year, week } = isoWeek(d);
      const key = `${year}-${week}`;
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        const start = startOfWeek(d);
        const thisWeek = isoWeek(new Date());
        const label = year === thisWeek.year && week === thisWeek.week ? `This week · W${week}` : `Week ${week}${year !== new Date().getFullYear() ? `, ${year}` : ''}`;
        g = { key, label, range: `${formatDate(toISODate(start))} – ${formatDate(toISODate(addDays(start, 6)))}`, items: [] };
        out.push(g);
      }
      g.items.push(u);
    }
    return out;
  }, [filtered]);

  const generalNotes = Object.values(data.notes).filter((n) => !n.projectId).length;

  const rangeDates = (): [string, string] => {
    const today = todayISO();
    switch (range) {
      case 'week':
        return [toISODate(addDays(new Date(), -6)), today];
      case '2weeks':
        return [toISODate(addDays(new Date(), -13)), today];
      case 'month':
        return [toISODate(addDays(new Date(), -29)), today];
      case 'cycle':
        return [data.settings.cycleStart, today];
    }
  };

  return (
    <div {...stylex.props(s.page)}>
      <PageHeader
        eyebrow={`${Object.values(data.updates).filter((u) => !u.auto).length} entries · ${Object.keys(data.notes).length} notes`}
        title="Journal"
        sub="Everything you've logged, week by week. Write general entries and notes here, and turn them into a recap for your 1:1."
      />

      <Tabs
        ariaLabel="Journal sections"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'log', label: 'Log', count: filtered.length },
          { value: 'notes', label: 'General notes', count: generalNotes },
          ...(sample ? [{ value: 'recap' as const, label: 'Recap' }] : []),
        ]}
      />

      <AnimatePresence mode="wait" initial={false}>
        <m.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.08 } }}>
          {tab === 'log' && (
            <div {...stylex.props(s.section)}>
              <Frame tag="New entry" tagMeta="Pick a project, or keep it general">
                <UpdateComposer />
              </Frame>

              <div {...stylex.props(s.filters)}>
                <Select compact aria-label="Filter by project" value={project} onChange={(e) => setProject(e.target.value)} xstyle={s.filter}>
                  <option value="all">All projects</option>
                  <option value="general">General entries</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
                <Select compact aria-label="Filter by type" value={kind} onChange={(e) => setKind(e.target.value as UpdateKind | 'all')} xstyle={s.filter}>
                  <option value="all">All types</option>
                  {UPDATE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {UPDATE_KIND_META[k].label}
                    </option>
                  ))}
                </Select>
                <label {...stylex.props(s.toggle)}>
                  <input type="checkbox" checked={showAuto} onChange={(e) => setShowAuto(e.target.checked)} />
                  Show automatic stage and progress changes
                </label>
              </div>

              {weeks.length ? (
                <div {...stylex.props(s.weeks)}>
                  {weeks.map((w) => (
                    <Frame
                      key={w.key}
                      tag={
                        <span {...stylex.props(s.weekHead)}>
                          <span>{w.label}</span>
                          <span {...stylex.props(s.weekRange)}>{w.range}</span>
                        </span>
                      }
                      tagMeta={`${w.items.length} ${w.items.length === 1 ? 'entry' : 'entries'}`}
                    >
                      <Timeline updates={w.items} showProject numbered={false} />
                    </Frame>
                  ))}
                </div>
              ) : (
                <EmptyState icon="journal" title={Object.keys(data.updates).length ? 'Nothing matches these filters' : 'Your journal is empty'}>
                  {Object.keys(data.updates).length
                    ? 'Try another project or type.'
                    : 'Log a line whenever something moves: a decision, a review, a blocker. It adds up to a clear record by review time.'}
                </EmptyState>
              )}
            </div>
          )}

          {tab === 'notes' && <NotesPane projectId={null} />}

          {tab === 'recap' && (
            <Frame tag="Recap" tagMeta="Drafted by Claude from your log">
              <AssistPanel
                intro="Pick a period and who it's for. Claude reads your log for that period and drafts a recap you can paste into a 1:1 doc or a status update."
                buttonLabel="Draft recap"
                buildPrompt={() => {
                  const [from, to] = rangeDates();
                  return recapPrompt(data, from, to, audience);
                }}
                extraControls={
                  <div {...stylex.props(s.recapControls)}>
                    <Select compact aria-label="Period" value={range} onChange={(e) => setRange(e.target.value as Range)}>
                      <option value="week">Last 7 days</option>
                      <option value="2weeks">Last 14 days</option>
                      <option value="month">Last 30 days</option>
                      <option value="cycle">Whole cycle so far</option>
                    </Select>
                    <Select compact aria-label="Audience" value={audience} onChange={(e) => setAudience(e.target.value as 'manager' | 'self')}>
                      <option value="manager">For my manager</option>
                      <option value="self">For me</option>
                    </Select>
                  </div>
                }
              />
            </Frame>
          )}
        </m.div>
      </AnimatePresence>
    </div>
  );
}
