/*
 * Minimal typings for the claude.ai Artifact runtime (`window.claude.use`).
 * Only the members Workfile calls are declared. Full contracts live in the
 * Artifact capability docs; everything here is optional at runtime because
 * the app also runs on its own (npm run dev, any static host).
 */

export type DbError = { code: string; message: string };

export interface DocSnapshot {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
  metadata: { fromCache: boolean; hasPendingWrites: boolean };
}

export interface QuerySnapshot {
  docs: DocSnapshot[];
  size: number;
  empty: boolean;
  metadata: { fromCache: boolean; hasPendingWrites: boolean };
}

export interface DocRef {
  id: string;
  path: string;
  get(): Promise<DocSnapshot>;
  set(data: Record<string, unknown>): Promise<void>;
  update(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  onSnapshot(next: (s: DocSnapshot) => void, error?: (e: DbError) => void): () => void;
}

export interface CollectionRef {
  path: string;
  doc(id?: string): DocRef;
  get(): Promise<QuerySnapshot>;
  onSnapshot(next: (s: QuerySnapshot) => void, error?: (e: DbError) => void): () => void;
}

export interface ClaudeDb {
  doc(path: string): DocRef;
  collection(path: string): CollectionRef;
}

export type SampleError = { code: string; message: string; text?: string };

export interface ClaudeSample {
  (
    input: string,
    options?: {
      onText?: (u: { text: string; delta: string }) => void;
      signal?: AbortSignal;
      modelTier?: 'default' | 'complex' | 'quick';
      cache?: boolean | { gcTime?: number; refresh?: boolean };
    },
  ): Promise<{ text: string; truncated: boolean }>;
  json<T = unknown>(
    input: string,
    options?: { signal?: AbortSignal; modelTier?: 'default' | 'complex' | 'quick'; cache?: boolean },
  ): Promise<T>;
}

export interface ClaudeDownloads {
  save(req: { filename: string; data: string | Blob }): Promise<{ status: 'saved' | 'delivered' }>;
}

export interface ClaudeUser {
  can(capability: string): Promise<boolean | null>;
  isOwner(): Promise<boolean>;
}

interface CapabilityMap {
  db: ClaudeDb;
  sample: ClaudeSample;
  downloads: ClaudeDownloads;
  user: ClaudeUser;
}

declare global {
  interface Window {
    claude?: { use?: <K extends keyof CapabilityMap>(name: K) => Promise<CapabilityMap[K] | null> };
  }
}

/** True when the page is running inside a Claude Artifact viewer. */
export function inClaudeArtifact(): boolean {
  return typeof window !== 'undefined' && typeof window.claude?.use === 'function';
}

const cache = new Map<string, Promise<unknown>>();

/** Resolves a capability namespace, or null when unavailable (never throws). */
export function getCapability<K extends keyof CapabilityMap>(name: K): Promise<CapabilityMap[K] | null> {
  if (!inClaudeArtifact()) return Promise.resolve(null);
  if (!cache.has(name)) {
    const p = window.claude!.use!(name).then(
      (ns) => ns ?? null,
      () => null,
    );
    cache.set(name, p);
  }
  return cache.get(name) as Promise<CapabilityMap[K] | null>;
}
