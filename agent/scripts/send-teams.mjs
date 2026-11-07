#!/usr/bin/env node
/*
 * Workfile Agent: posts a weekly report to Teams through a Teams "Workflows"
 * webhook (template "Send webhook alerts to a chat"). The webhook URL is kept
 * in the macOS Keychain under the service name `workfile-teams-webhook`.
 *
 *   node send-teams.mjs --check
 *   node send-teams.mjs --title "Week of Oct 27" --file /path/report.md
 *
 * Prints JSON: { ready } for --check, { sent, status } or { sent: false, error } otherwise.
 * This is the only thing in Workfile that sends a message, and only for a report
 * you approved or set to send automatically.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};
const print = (o) => console.log(JSON.stringify(o));

// Teams Workflows webhooks live on Azure Logic Apps or Power Platform hosts.
const ALLOWED_HOST = /(^|\.)(logic\.azure\.com|powerplatform\.com|webhook\.office\.com)$/i;

function webhook() {
  try {
    const url = execFileSync('security', ['find-generic-password', '-s', 'workfile-teams-webhook', '-w'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const u = new URL(url);
    if (u.protocol !== 'https:' || !ALLOWED_HOST.test(u.hostname)) return { error: `Unexpected webhook host ${u.hostname}` };
    return { url };
  } catch {
    return { error: 'No Teams workflow URL in the Keychain (service "workfile-teams-webhook").' };
  }
}

/** Adaptive Card TextBlocks understand bold, italics, lists and links, but not headings. */
function toCardMarkdown(md) {
  return md
    .replace(/\r\n?/g, '\n')
    .replace(/^#{1,6}\s+(.*)$/gm, '**$1**')
    .replace(/^\s*[*+]\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const hook = webhook();
if (args.includes('--check')) {
  print({ ready: !hook.error, error: hook.error ?? undefined });
  process.exit(0);
}
if (hook.error) {
  print({ sent: false, error: hook.error });
  process.exit(0);
}

const title = opt('title') ?? 'Weekly report';
const path = opt('file');
let body;
try {
  body = readFileSync(path, 'utf8');
} catch {
  print({ sent: false, error: `Can't read report file ${path}` });
  process.exit(0);
}

const card = {
  type: 'message',
  attachments: [
    {
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
          { type: 'TextBlock', text: title, weight: 'Bolder', size: 'Medium', wrap: true },
          { type: 'TextBlock', text: toCardMarkdown(body), wrap: true },
        ],
      },
    },
  ],
};

try {
  const res = await fetch(hook.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(card) });
  print(res.ok ? { sent: true, status: res.status } : { sent: false, error: `Teams answered ${res.status} ${res.statusText}` });
} catch (e) {
  print({ sent: false, error: `Couldn't reach Teams: ${e.message}` });
}
