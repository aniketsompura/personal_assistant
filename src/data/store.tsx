import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import {
  DEFAULT_SETTINGS,
  type CollectionName,
  type DataSnapshot,
  type ExportFile,
  type Goal,
  type ID,
  type Note,
  type Project,
  type ProjectStatus,
  type Settings,
  type Update,
  type UpdateKind,
} from './types';
import { COLLECTIONS, createArtifactAdapter, createBrowserAdapter, type SnapshotPatch, type StorageAdapter } from './adapters';
import { normalizeGoal, normalizeNote, normalizeProject, normalizeSettings, normalizeUpdate } from './normalize';
import { getCapability, inClaudeArtifact } from '../lib/claude';
import { newId } from '../lib/ids';
import { nowISO, todayISO } from '../lib/dates';
import { lastUpdateFor } from '../lib/insights';
import { celebrate } from '../lib/events';
import { GOAL_HEX } from '../lib/meta';
import { useToast } from '../components/Toast';

/* ------------------------------------------------------------------------ */
/* State                                                                     */
/* ------------------------------------------------------------------------ */

const EMPTY: DataSnapshot = { goals: {}, projects: {}, updates: {}, notes: {}, settings: { ...DEFAULT_SETTINGS } };

function reducer(state: { data: DataSnapshot; ready: boolean }, patch: SnapshotPatch) {
  const { ready, ...rest } = patch;
  return { data: { ...state.data, ...rest }, ready: state.ready || !!ready };
}

export interface StoreMeta {
  backend: 'pending' | 'claude' | 'browser';
  /** Running inside Claude, but the database was unavailable, so data stays in this browser. */
  fallback: boolean;
  persistent: boolean;
  readOnly: boolean;
  saving: boolean;
  lastSavedAt: number | null;
  error: string | null;
}

export interface NewUpdate {
  projectId: ID | null;
  date: string;
  text: string;
  kind: UpdateKind;
  progressTo?: number | null;
  statusTo?: ProjectStatus | null;
}

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */

async function runPool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

const ERROR_COPY: Record<string, string> = {
  quota_exceeded: 'Storage is full. Export your data, then delete old notes or updates to make room.',
  resource_exhausted: 'Saving is going too fast. Wait a moment and try again.',
  revoked: 'Your access to this Workfile changed. Reload the page to continue.',
  invalid_argument: "That change couldn't be saved. It may have been deleted elsewhere.",
};

export function validateExport(v: unknown): ExportFile | null {
  if (!v || typeof v !== 'object') return null;
  const f = v as Partial<ExportFile>;
  if (f.app !== 'workfile') return null;
  if (![f.goals, f.projects, f.updates, f.notes].every((a) => a === undefined || Array.isArray(a))) return null;
  return {
    app: 'workfile',
    schemaVersion: 1,
    exportedAt: typeof f.exportedAt === 'string' ? f.exportedAt : nowISO(),
    settings: normalizeSettings(f.settings),
    goals: f.goals ?? [],
    projects: f.projects ?? [],
    updates: f.updates ?? [],
    notes: f.notes ?? [],
  };
}

/* ------------------------------------------------------------------------ */
/* Provider                                                                  */
/* ------------------------------------------------------------------------ */

function useStoreValue() {
  const toast = useToast();
  const [{ data, ready }, dispatch] = useReducer(reducer, { data: EMPTY, ready: false });
  const [meta, setMeta] = useState<StoreMeta>({
    backend: 'pending',
    fallback: false,
    persistent: true,
    readOnly: false,
    saving: false,
    lastSavedAt: null,
    error: null,
  });
  const adapterRef = useRef<StorageAdapter | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const pending = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    (async () => {
      let adapter: StorageAdapter;
      let fallback = false;
      let readOnly = false;
      if (inClaudeArtifact()) {
        const db = await getCapability('db');
        if (db) {
          adapter = createArtifactAdapter(db);
          const user = await getCapability('user');
          readOnly = (await user?.can('data.write').catch(() => null)) === false;
        } else {
          adapter = createBrowserAdapter();
          fallback = true;
        }
      } else {
        adapter = createBrowserAdapter();
      }
      if (cancelled) return;
      adapterRef.current = adapter;
      setMeta((m) => ({ ...m, backend: adapter.kind, fallback, readOnly, persistent: adapter.persistent }));
      unsub = adapter.subscribe(
        (patch) => dispatch(patch),
        (e) => setMeta((m) => ({ ...m, error: ERROR_COPY[e.code] ?? 'Live sync stopped. Reload to reconnect.' })),
      );
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const actions = useMemo(() => {
    const adapter = () => {
      if (!adapterRef.current) throw new Error('Storage is still loading.');
      return adapterRef.current;
    };

    const track = (p: Promise<void>) => {
      pending.current++;
      setMeta((m) => (m.saving ? m : { ...m, saving: true }));
      p.then(
        () => setMeta((m) => ({ ...m, lastSavedAt: Date.now(), error: null })),
        (e: { code?: string }) => {
          const msg = ERROR_COPY[e?.code ?? ''] ?? "Couldn't save that change. Check your connection and try again.";
          if (e?.code === 'revoked') setMeta((m) => ({ ...m, error: msg, readOnly: true }));
          toast({ message: msg, tone: 'error', duration: 6000 });
        },
      ).finally(() => {
        pending.current--;
        if (pending.current === 0) setMeta((m) => ({ ...m, saving: false }));
      });
      return p;
    };

    const create = <K extends CollectionName>(col: K, doc: Parameters<StorageAdapter['create']>[1]) =>
      track(adapter().create(col, doc as never));

    const patch = <K extends CollectionName>(col: K, id: ID, body: Record<string, unknown>) =>
      track(adapter().patch(col, id, body as never));

    const remove = (col: CollectionName, id: ID) => track(adapter().remove(col, id));

    const celebrateFor = (p: Project) => celebrate({ colors: p.goalIds.map((g) => GOAL_HEX[dataRef.current.goals[g]?.color ?? 'cobalt']) });

    /** Records status/progress changes made outside the update composer, one entry per kind per day. */
    const logAutoChange = (prev: Project, next: Partial<Project>) => {
      const today = todayISO();
      const now = nowISO();
      const todays = Object.values(dataRef.current.updates).filter(
        (u) => u.projectId === prev.id && u.auto && u.date === today,
      );
      if (next.status !== undefined && next.status !== prev.status) {
        const existing = todays.find((u) => u.kind === 'status');
        if (existing) {
          if (existing.statusFrom === next.status) void remove('updates', existing.id);
          else void patch('updates', existing.id, { statusTo: next.status, updatedAt: now });
        } else {
          void create(
            'updates',
            normalizeUpdate(newId('u'), {
              projectId: prev.id,
              date: today,
              kind: 'status',
              text: '',
              statusFrom: prev.status,
              statusTo: next.status,
              auto: true,
              createdAt: now,
            }),
          );
        }
      }
      if (next.progress !== undefined && next.progress !== prev.progress) {
        const existing = todays.find((u) => u.kind === 'progress' && u.text === '');
        if (existing) {
          if (existing.progressFrom === next.progress) void remove('updates', existing.id);
          else void patch('updates', existing.id, { progressTo: next.progress, updatedAt: now });
        } else {
          void create(
            'updates',
            normalizeUpdate(newId('u'), {
              projectId: prev.id,
              date: today,
              kind: 'progress',
              text: '',
              progressFrom: prev.progress,
              progressTo: next.progress,
              auto: true,
              createdAt: now,
            }),
          );
        }
      }
    };

    return {
      /* Goals --------------------------------------------------------------- */
      createGoal(input: Partial<Goal>): Goal {
        const now = nowISO();
        const order = Math.max(0, ...Object.values(dataRef.current.goals).map((g) => g.order)) + 1;
        const goal = normalizeGoal(newId('g'), { ...input, order, createdAt: now, updatedAt: now });
        void create('goals', goal);
        return goal;
      },

      updateGoal(id: ID, body: Partial<Goal>) {
        void patch('goals', id, { ...body, updatedAt: nowISO() });
      },

      deleteGoal(id: ID) {
        const goal = dataRef.current.goals[id];
        if (!goal) return;
        const affected = Object.values(dataRef.current.projects).filter((p) => p.goalIds.includes(id));
        void remove('goals', id);
        affected.forEach((p) => void patch('projects', p.id, { goalIds: p.goalIds.filter((g) => g !== id) }));
        toast({
          message: `Deleted goal “${goal.title}”`,
          icon: 'trash',
          action: {
            label: 'Undo',
            onClick: () => {
              void create('goals', goal);
              affected.forEach((p) => void patch('projects', p.id, { goalIds: p.goalIds }));
            },
          },
        });
      },

      /* Projects ------------------------------------------------------------ */
      createProject(input: Partial<Project>): Project {
        const now = nowISO();
        const project = normalizeProject(newId('p'), {
          status: 'discovery',
          startDate: todayISO(),
          ...input,
          createdAt: now,
          updatedAt: now,
          lastActivityAt: now,
        });
        void create('projects', project);
        return project;
      },

      /** `silent` skips the automatic timeline entry for status/progress changes. */
      updateProject(id: ID, body: Partial<Project>, opts: { silent?: boolean } = {}) {
        const prev = dataRef.current.projects[id];
        if (!prev) return;
        const now = nowISO();
        void patch('projects', id, { ...body, updatedAt: now, lastActivityAt: now });
        if (!opts.silent) logAutoChange(prev, body);
        const shipped = body.status === 'shipped' && prev.status !== 'shipped';
        const finished = body.progress === 100 && prev.progress < 100;
        if (shipped || finished) celebrateFor(prev);
      },

      deleteProject(id: ID) {
        const d = dataRef.current;
        const project = d.projects[id];
        if (!project) return;
        const updates = Object.values(d.updates).filter((u) => u.projectId === id);
        const notes = Object.values(d.notes).filter((n) => n.projectId === id);
        void remove('projects', id);
        updates.forEach((u) => void remove('updates', u.id));
        notes.forEach((n) => void remove('notes', n.id));
        toast({
          message: `Deleted “${project.title}” with ${updates.length} updates and ${notes.length} notes`,
          icon: 'trash',
          action: {
            label: 'Undo',
            onClick: () => {
              void create('projects', project);
              updates.forEach((u) => void create('updates', u));
              notes.forEach((n) => void create('notes', n));
            },
          },
        });
      },

      /* Updates ------------------------------------------------------------- */
      addUpdate(input: NewUpdate): Update {
        const d = dataRef.current;
        const now = nowISO();
        const p = input.projectId ? d.projects[input.projectId] : null;
        const progressChanged = p && input.progressTo != null && input.progressTo !== p.progress;
        const statusChanged = p && input.statusTo && input.statusTo !== p.status;
        const update = normalizeUpdate(newId('u'), {
          projectId: input.projectId,
          date: input.date,
          text: input.text.trim(),
          kind: input.kind,
          progressFrom: progressChanged ? p.progress : null,
          progressTo: progressChanged ? input.progressTo : null,
          statusFrom: statusChanged ? p.status : null,
          statusTo: statusChanged ? input.statusTo : null,
          auto: false,
          createdAt: now,
          updatedAt: now,
        });
        void create('updates', update);
        if (p) {
          // Only the newest entry moves the project; a back-dated note just joins the history.
          const latest = lastUpdateFor(p.id, d.updates);
          const isLatest = !latest || update.date >= latest.date;
          const body: Partial<Project> = { lastActivityAt: now, updatedAt: now };
          if (isLatest && update.progressTo !== null) body.progress = update.progressTo;
          if (isLatest && update.statusTo) body.status = update.statusTo;
          void patch('projects', p.id, body);
          if ((body.status === 'shipped' && p.status !== 'shipped') || (body.progress === 100 && p.progress < 100)) {
            celebrateFor(p);
          }
        }
        return update;
      },

      editUpdate(id: ID, body: Partial<Update>) {
        void patch('updates', id, { ...body, updatedAt: nowISO() });
      },

      deleteUpdate(id: ID) {
        const u = dataRef.current.updates[id];
        if (!u) return;
        void remove('updates', id);
        toast({
          message: 'Update deleted',
          icon: 'trash',
          action: { label: 'Undo', onClick: () => void create('updates', u) },
        });
      },

      /* Notes --------------------------------------------------------------- */
      createNote(input: Partial<Note>): Note {
        const now = nowISO();
        const note = normalizeNote(newId('n'), { title: '', body: '', ...input, createdAt: now, updatedAt: now });
        void create('notes', note);
        if (note.projectId) void patch('projects', note.projectId, { lastActivityAt: now });
        return note;
      },

      updateNote(id: ID, body: Partial<Note>) {
        return patch('notes', id, { ...body, updatedAt: nowISO() });
      },

      deleteNote(id: ID) {
        const n = dataRef.current.notes[id];
        if (!n) return;
        void remove('notes', id);
        toast({
          message: `Deleted note${n.title ? ` “${n.title}”` : ''}`,
          icon: 'trash',
          action: { label: 'Undo', onClick: () => void create('notes', n) },
        });
      },

      /* Settings & data ----------------------------------------------------- */
      saveSettings(body: Partial<Settings>) {
        const next = normalizeSettings({ ...dataRef.current.settings, ...body });
        return track(adapter().saveSettings(next));
      },

      exportData(): ExportFile {
        const d = dataRef.current;
        return {
          app: 'workfile',
          schemaVersion: 1,
          exportedAt: nowISO(),
          settings: d.settings,
          goals: Object.values(d.goals),
          projects: Object.values(d.projects),
          updates: Object.values(d.updates),
          notes: Object.values(d.notes),
        };
      },

      async importData(file: ExportFile, mode: 'merge' | 'replace') {
        const d = dataRef.current;
        const a = adapter();
        type Job = () => Promise<void>;
        const jobs: Job[] = [];
        if (mode === 'replace') {
          const keep = {
            goals: new Set(file.goals.map((x) => (x as Goal).id)),
            projects: new Set(file.projects.map((x) => (x as Project).id)),
            updates: new Set(file.updates.map((x) => (x as Update).id)),
            notes: new Set(file.notes.map((x) => (x as Note).id)),
          };
          for (const col of COLLECTIONS) {
            for (const id of Object.keys(d[col])) if (!keep[col].has(id)) jobs.push(() => a.remove(col, id));
          }
        }
        const add = <K extends CollectionName>(col: K, list: unknown[], norm: (id: string, v: unknown) => unknown, prefix: string) => {
          for (const raw of list) {
            const id = typeof (raw as { id?: unknown })?.id === 'string' ? (raw as { id: string }).id : newId(prefix);
            if (!/^[A-Za-z0-9_\-.~:@+]{1,120}$/.test(id)) continue;
            const doc = norm(id, raw);
            jobs.push(() => a.create(col, doc as never));
          }
        };
        add('goals', file.goals, normalizeGoal, 'g');
        add('projects', file.projects, normalizeProject, 'p');
        add('updates', file.updates, normalizeUpdate, 'u');
        add('notes', file.notes, normalizeNote, 'n');
        jobs.push(() => a.saveSettings(normalizeSettings(file.settings)));
        await track(runPool(jobs, 4, (job) => job()));
        return {
          goals: file.goals.length,
          projects: file.projects.length,
          updates: file.updates.length,
          notes: file.notes.length,
        };
      },

      async eraseAll() {
        const d = dataRef.current;
        const a = adapter();
        const jobs: Array<() => Promise<void>> = [];
        for (const col of COLLECTIONS) for (const id of Object.keys(d[col])) jobs.push(() => a.remove(col, id));
        await track(runPool(jobs, 4, (job) => job()));
      },
    };
  }, [toast]);

  return { data, ready, meta, actions };
}

export type Store = ReturnType<typeof useStoreValue>;
export type Actions = Store['actions'];

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useStoreValue();
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside <StoreProvider>');
  return s;
}
