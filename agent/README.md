# Workfile Agent

A Claude Code plugin that keeps your Workfile up to date from the tools you work in. It logs small things itself, files anything that changes a project in your Workfile Inbox for your OK, writes a morning brief, and drafts a weekly report for one person on Teams.

The plan behind it: [`docs/automation-plan.md`](../docs/automation-plan.md).

## Install (each Mac)

In Claude Code:

```
/plugin marketplace add aniketsompura/personal_assistant
/plugin install workfile-agent@workfile
/workfile-agent:workfile-setup
```

Setup asks for your Workfile link and whether this Mac uses your personal or work Claude account, then creates three scheduled tasks (hourly sync on weekdays, 08:45 brief, weekly report) and runs a first sync.

## What's inside

| Path | What it is |
| --- | --- |
| `hooks/hooks.json` | After each Claude Code response, notes the session in `~/.workfile/sessions.json`. Local only, never blocks. |
| `skills/workfile-sync` | The hourly runbook: collect → match → log or ask → notify. |
| `skills/workfile-brief` | The 08:45 morning brief, shown on Workfile › Today. |
| `skills/workfile-report` | The weekly report: drafted from your log, sent to one person on Teams. |
| `skills/workfile-log` | `/workfile-agent:workfile-log`: log this session right now. |
| `skills/workfile-setup` | One-time setup per Mac. |
| `connectors/*.md` | One instruction file per source: what to read, how to match, what to propose, how risky it is. |
| `reference/records.md` | Exact shapes of everything the agent writes into Workfile. |
| `scripts/session-digest.mjs` | Turns a Claude Code transcript into a short digest (prompts, files, commits, links; never file contents). |
| `scripts/figma-activity.mjs` | Figma versions and comments for linked files (token in Keychain). |
| `scripts/send-teams.mjs` | Posts an approved weekly report through your Teams workflow (URL in Keychain). |

## Safety

- Read-only on Jira, Teams, Outlook and Figma. The only message it can send is a weekly report you approved (or set to send without asking), through a Teams workflow you created.
- Secrets live in the macOS Keychain (`workfile-figma`, `workfile-teams-webhook`), never in Workfile or the repo.
- On a personal Claude account it never reads Jira, Teams or Outlook.
- Everything it logs shows its source and can be undone from Workfile › Inbox.

## Plug in another tool

1. Add an entry to `src/connectors/registry.ts` in the app (it shows on the Connections page).
2. Add `connectors/<id>.md` here, following the existing ones.
3. If the tool has no Claude connector, add a read-only script in `scripts/` that prints JSON.
4. Mention the new connector in step 2 of `skills/workfile-sync/SKILL.md`.
