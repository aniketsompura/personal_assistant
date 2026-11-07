#!/usr/bin/env node
/*
 * Workfile Agent hook (Claude Code `Stop` and `SessionEnd`).
 *
 * Notes that a Claude Code session had activity, so the scheduled sync knows
 * what to read later. It only writes ~/.workfile/sessions.json on this Mac:
 * no network, no transcript copying. Any error exits quietly so Claude Code is
 * never slowed down or blocked.
 */
import { closeSync, mkdirSync, openSync, readFileSync, readSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const HOME = homedir();
const DIR = join(HOME, '.workfile');
const STATE = join(DIR, 'sessions.json');
const CONFIG = join(DIR, 'config.json');
/** Sessions started by the agent itself (scheduled runs) are not your work. */
const AGENT_PROMPT = /workfile-(sync|brief|report|setup)\b/i;
const KEEP_DAYS = 45;

const readJSON = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
};
const expand = (p) => (p.startsWith('~') ? join(HOME, p.slice(1)) : p);

/** First prompt of a transcript, read from its first 64 KB only. */
function firstPrompt(transcriptPath) {
  try {
    const fd = openSync(transcriptPath, 'r');
    const buf = Buffer.alloc(65536);
    const n = readSync(fd, buf, 0, buf.length, 0);
    closeSync(fd);
    for (const line of buf.subarray(0, n).toString('utf8').split('\n')) {
      let o;
      try {
        o = JSON.parse(line);
      } catch {
        continue;
      }
      if (o.type !== 'user' || o.isSidechain) continue;
      const c = o.message?.content;
      if (typeof c === 'string') return c;
      if (Array.isArray(c)) {
        const t = c.find((b) => b?.type === 'text');
        if (t) return t.text;
      }
    }
  } catch {
    /* unreadable: treat as a normal session */
  }
  return '';
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return;
  }
  const { session_id: id, transcript_path: transcript, cwd, hook_event_name: event } = input ?? {};
  if (!id) return;

  const config = readJSON(CONFIG, {});
  const ignored = (config.ignoreFolders ?? []).map((f) => resolve(expand(String(f))));
  if (cwd && ignored.some((f) => resolve(cwd) === f || resolve(cwd).startsWith(`${f}/`))) return;

  mkdirSync(DIR, { recursive: true });
  const state = readJSON(STATE, { sessions: {} });
  state.sessions ??= {};
  const now = new Date().toISOString();
  const s = state.sessions[id] ?? { firstSeenAt: now, processedUpTo: null };
  if (s.agent === undefined && transcript) s.agent = AGENT_PROMPT.test(firstPrompt(transcript));
  if (transcript) s.transcriptPath = transcript;
  if (cwd) s.cwd = cwd;
  s.lastActivityAt = now;
  if (event === 'SessionEnd') s.endedAt = now;
  state.sessions[id] = s;

  const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
  for (const [key, v] of Object.entries(state.sessions)) {
    if (Date.parse(v.lastActivityAt ?? 0) < cutoff) delete state.sessions[key];
  }

  const tmp = `${STATE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 1));
  renameSync(tmp, STATE);
}

try {
  main();
} catch {
  /* never block Claude Code */
}
process.exit(0);
