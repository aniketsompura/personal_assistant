#!/usr/bin/env node
/*
 * Workfile Agent: what happened in some Figma files since a time.
 * Read-only. Uses a personal access token kept in the macOS Keychain under
 * the service name `workfile-figma` (it is never written anywhere else).
 *
 *   node figma-activity.mjs [--since <ISO time>] <fileKey> [<fileKey> …]
 *
 * Prints JSON: { me, files: [{ key, name, lastModified, versions, comments }], errors }
 * Not yet verified against a live Figma account; check the first run's output.
 */
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const sinceIdx = args.indexOf('--since');
const since = sinceIdx >= 0 ? args[sinceIdx + 1] : null;
const sinceMs = since ? Date.parse(since) : 0;
const keys = args.filter((a, i) => !a.startsWith('--') && i !== sinceIdx + 1);

const print = (o) => console.log(JSON.stringify(o, null, 1));
const clip = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

let token;
try {
  token = execFileSync('security', ['find-generic-password', '-s', 'workfile-figma', '-w'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  print({ error: 'no-token', message: 'No Figma token in the Keychain (service "workfile-figma").' });
  process.exit(0);
}
if (!keys.length) {
  print({ error: 'no-files', message: 'Pass one or more Figma file keys.' });
  process.exit(0);
}

async function get(path) {
  const res = await fetch(`https://api.figma.com/v1${path}`, { headers: { 'X-Figma-Token': token } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path.split('?')[0]}`);
  return res.json();
}

const after = (iso) => !sinceMs || Date.parse(iso) > sinceMs;
const out = { me: null, since, files: [], errors: [] };

try {
  const me = await get('/me');
  out.me = { id: me.id, handle: me.handle };
} catch (e) {
  out.errors.push(`me: ${e.message}`);
}

for (const key of [...new Set(keys)]) {
  try {
    const meta = await get(`/files/${encodeURIComponent(key)}?depth=1`);
    const file = { key, name: meta.name, lastModified: meta.lastModified, versions: [], comments: [] };
    try {
      const v = await get(`/files/${encodeURIComponent(key)}/versions`);
      file.versions = (v.versions ?? [])
        .filter((x) => after(x.created_at))
        .map((x) => ({ id: x.id, at: x.created_at, label: x.label ?? '', description: clip(x.description, 300), by: x.user?.handle ?? null }));
    } catch (e) {
      out.errors.push(`${key} versions: ${e.message}`);
    }
    try {
      const c = await get(`/files/${encodeURIComponent(key)}/comments`);
      file.comments = (c.comments ?? [])
        .filter((x) => after(x.created_at))
        .map((x) => ({
          id: x.id,
          at: x.created_at,
          by: x.user?.handle ?? null,
          byMe: !!out.me && x.user?.id === out.me.id,
          reply: !!x.parent_id,
          resolved: !!x.resolved_at,
          text: clip(x.message, 300),
        }));
    } catch (e) {
      out.errors.push(`${key} comments: ${e.message}`);
    }
    out.files.push(file);
  } catch (e) {
    out.errors.push(`${key}: ${e.message}`);
  }
}

print(out);
