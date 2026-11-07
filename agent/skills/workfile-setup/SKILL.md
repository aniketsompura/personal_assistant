---
name: workfile-setup
description: Set up the Workfile Agent on this Mac. Connects it to your Workfile artifact, creates the scheduled sync, morning brief and weekly report tasks, checks the optional Figma token and Teams workflow, and runs a first sync. Run once per Mac, and again to change anything.
---

# Set up the Workfile Agent

Walk the user through setup conversationally. Explain each step in a sentence before doing it, and ask before creating scheduled tasks. **PLUGIN** means the folder two levels above this skill's base directory.

Never ask the user to paste a token, password or webhook URL into the chat. Secrets go into the macOS Keychain with a command the user runs in their own Terminal.

## 1. Which Workfile, which account

1. Ask for the Workfile link (the `https://claude.ai/artifact/…` address of their Workfile page). If they don't have it handy, use the Artifact tool's `list` action and offer the artifacts titled "Workfile".
2. Ask whether this Mac uses their **personal** or **work** (company) Claude account. Explain: on a personal account the agent only reads Claude Code (and Figma if they want), never Jira, Teams or Outlook, so company data stays in the company account.
3. Check access: load ArtifactData (ToolSearch `select:ArtifactData`) and `list` the `connectors` collection on that URL. If it fails, explain that the link must be a Workfile they own in this Claude account, and stop.

## 2. Save the machine settings

Write `~/.workfile/config.json` (create `~/.workfile/` if needed), keeping any `ignoreFolders` already there:

```json
{ "artifactUrl": "<link>", "account": "personal | work", "ignoreFolders": ["~/.workfile"] }
```

If `connectors/claude-code` doesn't exist in Workfile yet, create it: `{ "mode": "auto", "lastRunAt": null, "lastStatus": "never", "lastMessage": "Set up on this Mac. Waiting for the first sync.", "cursor": null, "ignore": [], "updatedAt": "<now>" }`.

## 3. Scheduled tasks

Read `meta/settings` from Workfile for the weekly report preferences (`report.enabled`, `report.weekday`, `report.time`). Then propose this schedule and ask the user to confirm or adjust it:

| Task id | When (local) | Cron |
| --- | --- | --- |
| `workfile-sync` | Hourly, 09:05–18:05, weekdays | `5 9-18 * * 1-5` |
| `workfile-brief` | 08:45 weekdays | `45 8 * * 1-5` |
| `workfile-report` | The report day and time from Workfile (default Monday 09:00) | `<mm> <hh> * * <weekday>` |

With the scheduled-tasks tools, `list` existing tasks first: update ones that exist, create the missing ones. Use `notifyOnCompletion: false`. Each prompt must be self-contained:

- **workfile-sync**: "Run the Workfile Agent sync. Invoke the skill `workfile-agent:workfile-sync` and follow it exactly. Nobody is at the keyboard: don't ask questions; if something is missing, record it in the connector status and finish."
- **workfile-brief**: "Write today's Workfile morning brief. Invoke the skill `workfile-agent:workfile-brief` and follow it exactly. Don't ask questions."
- **workfile-report**: "Draft this week's Workfile report. Invoke the skill `workfile-agent:workfile-report` and follow it exactly. Don't ask questions."

Tell the user: scheduled tasks run while the Claude app is open; a run missed while the Mac was off happens when the app next opens.

## 4. Optional extras (offer, don't push)

- **Figma** (both accounts): to log named versions and comments, they create a Figma personal access token (Figma › Settings › Security › Personal access tokens, read-only scopes for file content, versions and comments). Then in Terminal: `security add-generic-password -a "$USER" -s workfile-figma -w` and paste the token when asked. On a work Mac, mention checking that SOTI allows Figma tokens.
- **Teams workflow** (work account, for sending the weekly report automatically): in Teams › Workflows, template "Send webhook alerts to a chat", pick the chat with the report's recipient, copy the URL, then in Terminal: `security add-generic-password -a "$USER" -s workfile-teams-webhook -w` and paste it. Then run `node PLUGIN/scripts/send-teams.mjs --check` and record the result in `connectors/teams-workflow` (`mode: "auto"`, `lastStatus` ok or error, `lastRunAt` now, `lastMessage`).
- **Work connectors** (work account): in claude.ai › Settings › Connectors, connect **Atlassian** and **Microsoft 365**. Their Claude admin may need to allow them. Then switch Jira, Outlook calendar, Teams and Outlook mail on in Workfile › Connections.

## 5. First run

Ask whether to run the first sync now. If yes, run the `workfile-sync` task now with the scheduled-tasks tools (this also proves scheduled runs can reach Workfile). Report what it found.

Finish by explaining, briefly:
- The Claude Code hook starts recording with the next new Claude Code session.
- Everything the agent files shows up in Workfile › Inbox; small things log themselves and can be undone there.
- To pause: switch sources off in Workfile › Connections, or disable the scheduled tasks. To remove: `/plugin uninstall workfile-agent@workfile`.
