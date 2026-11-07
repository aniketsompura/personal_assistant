#!/usr/bin/env node
/*
 * Workfile Agent: turns one Claude Code session transcript into a short JSON
 * digest the sync can reason about cheaply. It keeps what you asked for, what
 * changed (file names, commits, PRs, preview links) and Claude's closing
 * notes. It never includes file contents or tool output.
 *
 *   node session-digest.mjs <transcript.jsonl> [--since <ISO time>] [--max-prompts 25]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, relative } from 'node:path';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
if (!file) {
  console.error('Usage: session-digest.mjs <transcript.jsonl> [--since ISO] [--max-prompts N]');
  process.exit(2);
}
const since = opt('since', null);
const sinceMs = since ? Date.parse(since) : 0;
const maxPrompts = Number(opt('max-prompts', 25));

const clip = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
// Prompts that are really harness messages (commands, reminders, hook output).
const isNoise = (t) => !t || /^<(command|local-command|system-reminder|bash-|task-notification|user-prompt)/i.test(t.trim()) || /^Caveat:/i.test(t);
const URL_RE = /https?:\/\/[^\s)>\]"'`]+/g;
const KEEP_URL = /(vercel\.app|netlify\.app|github\.io|pages\.dev|figma\.com|github\.com\/[^/]+\/[^/]+\/pull\/\d+|atlassian\.net|sharepoint\.com|loom\.com|claude\.ai\/(artifact|code\/artifact))/i;

let lines;
try {
  lines = readFileSync(file, 'utf8').split('\n');
} catch (e) {
  console.log(JSON.stringify({ error: `Can't read transcript: ${e.message}` }));
  process.exit(0);
}

const out = {
  sessionId: null,
  title: null,
  cwd: null,
  folder: null,
  gitBranch: null,
  startedAt: null,
  endedAt: null,
  since,
  prompts: [],
  closingNotes: [],
  filesChanged: [],
  commits: [],
  prLinks: [],
  links: [],
  stats: { userTurns: 0, toolCalls: 0, edits: 0 },
  git: null,
};
const files = new Set();
const links = new Set();
const notes = [];

for (const line of lines) {
  if (!line) continue;
  let o;
  try {
    o = JSON.parse(line);
  } catch {
    continue;
  }
  if (o.sessionId) out.sessionId ??= o.sessionId;
  if (o.type === 'custom-title' && o.customTitle) out.title = o.customTitle;
  if (o.type === 'pr-link' && o.prUrl && !out.prLinks.includes(o.prUrl)) out.prLinks.push(o.prUrl);
  if (o.type !== 'user' && o.type !== 'assistant') continue;
  if (o.isSidechain) continue;
  const at = o.timestamp ? Date.parse(o.timestamp) : NaN;
  if (Number.isFinite(at)) {
    if (!out.startedAt) out.startedAt = o.timestamp;
    out.endedAt = o.timestamp;
  }
  if (o.cwd) out.cwd = o.cwd;
  if (o.gitBranch && o.gitBranch !== 'HEAD') out.gitBranch = o.gitBranch;
  if (sinceMs && Number.isFinite(at) && at <= sinceMs) continue;

  const content = o.message?.content;
  if (o.type === 'user') {
    const texts = typeof content === 'string' ? [content] : Array.isArray(content) ? content.filter((b) => b?.type === 'text').map((b) => b.text) : [];
    for (const t of texts) {
      if (isNoise(t) || o.isMeta) continue;
      out.stats.userTurns++;
      out.prompts.push({ at: o.timestamp, text: clip(t, 400) });
    }
    continue;
  }
  if (!Array.isArray(content)) continue;
  for (const b of content) {
    if (b?.type === 'text' && b.text) {
      notes.push(clip(b.text, 400));
      for (const u of b.text.match(URL_RE) ?? []) if (KEEP_URL.test(u)) links.add(u.replace(/[.,;:]+$/, ''));
    }
    if (b?.type === 'tool_use') {
      out.stats.toolCalls++;
      const input = b.input ?? {};
      if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(b.name) && input.file_path) {
        out.stats.edits++;
        files.add(String(input.file_path));
      }
      if (b.name === 'Bash' && typeof input.command === 'string' && /git\s+commit/.test(input.command)) {
        const m = input.command.match(/-m\s+(?:"([^"]+)"|'([^']+)'|\$\(cat <<'?EOF'?\n([^\n]+))/);
        const msg = m ? m[1] ?? m[2] ?? m[3] : null;
        if (msg) out.commits.push(clip(msg, 160));
      }
    }
  }
}

out.folder = out.cwd ? basename(out.cwd) : null;
out.filesChanged = [...files].map((f) => (out.cwd && f.startsWith(out.cwd) ? relative(out.cwd, f) : f)).slice(0, 40);
out.links = [...links].slice(0, 10);
out.closingNotes = notes.slice(-4);
if (out.prompts.length > maxPrompts) {
  // Keep the opening asks and the latest ones; the middle is usually iteration.
  const head = out.prompts.slice(0, 5);
  const tail = out.prompts.slice(-(maxPrompts - 5));
  out.prompts = [...head, { at: null, text: `… ${out.prompts.length - maxPrompts} more prompts …` }, ...tail];
}

if (out.cwd) {
  const git = (...a) => execFileSync('git', ['-C', out.cwd, ...a], { encoding: 'utf8', timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    const remote = (() => {
      try {
        return git('remote', 'get-url', 'origin');
      } catch {
        return null;
      }
    })();
    const log = git('log', `--since=${since ?? out.startedAt ?? '1 day ago'}`, '--pretty=format:%h %s', '-n', '15');
    out.git = { remote, commits: log ? log.split('\n') : [] };
  } catch {
    out.git = null;
  }
}

console.log(JSON.stringify(out, null, 1));
