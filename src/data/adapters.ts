import { DEFAULT_SETTINGS, type CollectionMap, type CollectionName, type DataSnapshot, type Settings } from './types';
import { normalizers, normalizeSettings } from './normalize';
import type { ClaudeDb, DbError, DocSnapshot } from '../lib/claude';

/*
 * Storage backends. The app talks only to `StorageAdapter`, so the same UI
 * runs against the Claude Artifact database (when published as an artifact)
 * or the browser's localStorage (local development, any static host).
 * Adding a third backend (a company API, Supabase, …) means implementing this
 * interface; nothing else changes.
 */

export const COLLECTIONS: CollectionName[] = ['goals', 'projects', 'updates', 'notes'];
export const SETTINGS_PATH = 'meta/settings';

export type SnapshotPatch = Partial<DataSnapshot> & { ready?: boolean };

export interface AdapterError {
  code: string;
  message: string;
  /** Writes are refused for this viewer (view-only share). */
  readOnly?: boolean;
}

export interface StorageAdapter {
  kind: 'claude' | 'browser';
  /** False when the browser refuses storage (private window); data lasts until reload. */
  persistent: boolean;
  subscribe(listener: (patch: SnapshotPatch) => void, onError: (e: AdapterError) => void): () => void;
  create<K extends CollectionName>(col: K, doc: CollectionMap[K]): Promise<void>;
  patch<K extends CollectionName>(col: K, id: string, patch: Partial<CollectionMap[K]>): Promise<void>;
  remove(col: CollectionName, id: string): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
}

/** Strips `undefined` and class instances so bodies are plain JSON. */
const plain = <T,>(v: T): Record<string, unknown> => JSON.parse(JSON.stringify(v));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One write at a time per document, as the Artifact database asks. A newer
 * write queued behind an in-flight one simply runs after it.
 */
class DocQueue {
  private tails = new Map<string, Promise<void>>();
  run(path: string, fn: () => Promise<void>): Promise<void> {
    const prev = this.tails.get(path) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(fn);
    this.tails.set(path, next);
    void next.finally(() => {
      if (this.tails.get(path) === next) this.tails.delete(path);
    }).catch(() => undefined);
    return next;
  }
}

async function withRetry(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    const code = (e as DbError)?.code;
    if (code !== 'unavailable') throw e;
    await sleep(300 + Math.random() * 700);
    await fn();
  }
}

/* ------------------------------------------------------------------------ */
/* Claude Artifact database                                                  */
/* ------------------------------------------------------------------------ */

export function createArtifactAdapter(db: ClaudeDb): StorageAdapter {
  const queue = new DocQueue();
  // Snapshots reuse the same object for unchanged docs, so normalize once.
  const normalized = new WeakMap<DocSnapshot, unknown>();

  const write = (path: string, fn: () => Promise<void>) => queue.run(path, () => withRetry(fn));

  return {
    kind: 'claude',
    persistent: true,

    subscribe(listener, onError) {
      const pending = new Set<string>([...COLLECTIONS, 'settings']);
      let readySent = false;
      const markLoaded = (key: string) => {
        pending.delete(key);
        if (!readySent && pending.size === 0) {
          readySent = true;
          listener({ ready: true });
        }
      };
      const unsubs: Array<() => void> = [];
      let disposed = false;

      const handleError = (resubscribe: () => void) => (e: DbError) => {
        if (disposed) return;
        if (e?.code === 'unavailable') {
          // The platform bridge stopped answering; a fresh listener is the only recovery.
          setTimeout(() => !disposed && resubscribe(), 1500 + Math.random() * 1500);
          return;
        }
        onError({ code: e?.code ?? 'unavailable', message: e?.message ?? 'Storage stopped responding.' });
      };

      const watchCollection = (col: CollectionName) => {
        const unsub = db.collection(col).onSnapshot((snap) => {
          const normalize = normalizers[col];
          const map: Record<string, unknown> = {};
          for (const doc of snap.docs) {
            if (!doc.exists) continue;
            let value = normalized.get(doc);
            if (!value) {
              value = normalize(doc.id, doc.data());
              normalized.set(doc, value);
            }
            map[doc.id] = value;
          }
          listener({ [col]: map } as SnapshotPatch);
          markLoaded(col);
        }, handleError(() => watchCollection(col)));
        unsubs.push(unsub);
      };

      const watchSettings = () => {
        const unsub = db.doc(SETTINGS_PATH).onSnapshot((snap) => {
          listener({ settings: snap.exists ? normalizeSettings(snap.data()) : { ...DEFAULT_SETTINGS } });
          markLoaded('settings');
        }, handleError(watchSettings));
        unsubs.push(unsub);
      };

      COLLECTIONS.forEach(watchCollection);
      watchSettings();

      return () => {
        disposed = true;
        unsubs.forEach((u) => u());
      };
    },

    create(col, doc) {
      const path = `${col}/${doc.id}`;
      return write(path, () => db.doc(path).set(plain(doc)));
    },

    patch(col, id, patch) {
      const path = `${col}/${id}`;
      return write(path, () => db.doc(path).update(plain(patch)));
    },

    remove(col, id) {
      const path = `${col}/${id}`;
      return write(path, () => db.doc(path).delete());
    },

    saveSettings(settings) {
      return write(SETTINGS_PATH, () => db.doc(SETTINGS_PATH).set(plain(settings)));
    },
  };
}

/* ------------------------------------------------------------------------ */
/* Browser localStorage                                                      */
/* ------------------------------------------------------------------------ */

const STORAGE_KEY = 'workfile:data:v1';

type RawStore = { [K in CollectionName]: Record<string, unknown> } & { settings?: unknown };

function readRaw(): { raw: RawStore; ok: boolean } {
  const empty: RawStore = { goals: {}, projects: {}, updates: {}, notes: {} };
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    if (!text) return { raw: empty, ok: true };
    const parsed = JSON.parse(text);
    return { raw: { ...empty, ...parsed }, ok: true };
  } catch {
    return { raw: empty, ok: false };
  }
}

function toSnapshot(raw: RawStore): DataSnapshot {
  const out = { settings: raw.settings ? normalizeSettings(raw.settings) : { ...DEFAULT_SETTINGS } } as DataSnapshot;
  for (const col of COLLECTIONS) {
    const normalize = normalizers[col];
    const map: Record<string, unknown> = {};
    for (const [id, v] of Object.entries(raw[col] ?? {})) map[id] = normalize(id, v);
    (out as unknown as Record<string, unknown>)[col] = map;
  }
  return out;
}

export function createBrowserAdapter(): StorageAdapter {
  const initial = readRaw();
  let raw = initial.raw;
  let persistent = initial.ok;
  const listeners = new Set<(p: SnapshotPatch) => void>();

  const persist = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
    } catch {
      persistent = false;
      adapter.persistent = false;
    }
  };
  const emit = (patch: SnapshotPatch) => listeners.forEach((l) => l(patch));
  const emitCollection = (col: CollectionName) => {
    const normalize = normalizers[col];
    const map: Record<string, unknown> = {};
    for (const [id, v] of Object.entries(raw[col])) map[id] = normalize(id, v);
    emit({ [col]: map } as SnapshotPatch);
  };

  const adapter: StorageAdapter = {
    kind: 'browser',
    persistent,

    subscribe(listener) {
      listeners.add(listener);
      listener({ ...toSnapshot(raw), ready: true });
      const onStorage = (e: StorageEvent) => {
        if (e.key !== STORAGE_KEY) return;
        raw = readRaw().raw;
        listener({ ...toSnapshot(raw) });
      };
      window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', onStorage);
      };
    },

    async create(col, doc) {
      raw[col] = { ...raw[col], [doc.id]: plain(doc) };
      persist();
      emitCollection(col);
    },

    async patch(col, id, patch) {
      const current = raw[col][id];
      if (!current) return;
      raw[col] = { ...raw[col], [id]: { ...(current as object), ...plain(patch) } };
      persist();
      emitCollection(col);
    },

    async remove(col, id) {
      if (!(id in raw[col])) return;
      const next = { ...raw[col] };
      delete next[id];
      raw[col] = next;
      persist();
      emitCollection(col);
    },

    async saveSettings(settings) {
      raw = { ...raw, settings: plain(settings) };
      persist();
      emit({ settings: normalizeSettings(raw.settings) });
    },
  };
  return adapter;
}
