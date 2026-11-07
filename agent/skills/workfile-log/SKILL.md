---
name: workfile-log
description: Log what you've done in this Claude Code session to Workfile right now, instead of waiting for the hourly sync. Drafts a dated update for the right project, shows it to you, and saves it when you confirm.
---

# Log this session to Workfile

The user wants this session's work in their Workfile now. **PLUGIN** means the folder two levels above this skill's base directory. Read `PLUGIN/reference/records.md` for record shapes.

1. Read `~/.workfile/config.json`. If it's missing, say the agent isn't set up and suggest `/workfile-agent:workfile-setup`.
2. Load ArtifactData and read `projects` from the Workfile.
3. From this conversation, work out what was made or decided since the session began (or since an earlier `/workfile-log` in this session). Note the working directory (`pwd`) and the git remote (`git remote get-url origin`, if any).
4. Match the project: a project whose `anchors.repos` contains this folder or remote first; otherwise the project the work clearly belongs to.
5. Show the user a draft and ask them to confirm or edit:
   - Project (and, if it wasn't matched by folder, offer to remember this folder for it).
   - Update text: 1–2 sentences, first person, past tense, outcome first, design language.
   - Kind: progress, decision or milestone.
   - Only if the conversation supports it: a new progress %, a stage change, requirements finished, links to add (preview URLs, PRs).
6. On confirmation, write directly. The user approved it, so it isn't an Inbox proposal:
   - `updates/u_log_<YYYYMMDDHHmm>_<4 random letters>` with `auto: false`, `source: { "kind": "claude-code", "ref": "log:<absolute cwd>", "url": <PR link or null>, "label": "<folder name>" }`, `proposalId: null`, and `progressFrom`/`progressTo`, `statusFrom`/`statusTo` set when they changed (from the project's current values).
   - `update` the project (pinned with `if_version`): `lastActivityAt`, `updatedAt`, plus `progress`, `status`, `requirements`, `links` and `anchors.repos` as confirmed.
7. Reply with one line: what was logged where. The hourly sync recognises the `log:` source and won't log this stretch of the session again.
