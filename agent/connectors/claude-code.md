# Connector: Claude Code

Turns the user's Claude Code sessions (prototyping, exploring, building) into dated updates on the right project.

**Source kind:** `claude-code` · **Default mode:** auto · **Works on:** any Mac

## What to read

1. Read `~/.workfile/sessions.json` (written by the plugin's hook after every Claude response). If it's missing, record `lastStatus: "error"`, `lastMessage: "No sessions recorded yet. The hook starts with new Claude Code sessions."` and stop.
2. Pick sessions where all of these hold:
   - `agent` is not true (those are the agent's own runs);
   - `lastActivityAt` is later than `processedUpTo` (or `processedUpTo` is null);
   - the session has been idle for at least 20 minutes (`lastActivityAt` older than 20 minutes) or has `endedAt`. Leave sessions still in progress for a later run;
   - its `cwd` is not inside any folder in `config.ignoreFolders` or `connectors/claude-code.ignore` (expand `~`).
3. For each, run:
   ```
   node PLUGIN/scripts/session-digest.mjs "<transcriptPath>" --since "<processedUpTo or firstSeenAt>"
   ```
   It prints JSON: `title`, `cwd`, `folder`, `gitBranch`, `prompts` (what the user asked), `closingNotes` (Claude's last messages), `filesChanged`, `commits`, `prLinks`, `links`, `stats`, `git` (`remote`, recent `commits`). It never includes file contents.
4. **Skip trivial chunks:** no user prompts with substance, no file edits and no commits (for example a quick question). Mark them processed anyway.
5. **Skip what's already logged:** if an update exists with `source.kind: "claude-code"` and either the same `source.ref` (this session id), or `source.ref` equal to `log:<this session's cwd>` with `createdAt` after the chunk started (written by `/workfile-agent:workfile-log`), mark the chunk processed and move on.

## Matching

- **Anchor match** (confidence 0.95): the session `cwd`, or its git `remote`, equals or sits inside one of a project's `anchors.repos` (compare expanded paths; for remotes compare the `owner/repo` part).
- **Meaning match** (0.6–0.8): the session title, prompts or folder name clearly refer to one active project (its title, summary or keywords). Include an `add_anchor` (`repos`, the session's `cwd` written with `~`) so the next session there matches by anchor.
- **No match:** `projectId: null`, confidence 0.3, `why`: "This folder isn't tracked by a project yet." Include `log_update` and `add_anchor` actions so the user can pick the project once.
- The Workfile app's own repository isn't special. Treat it like any other folder.

## What to propose

One proposal per session chunk.

- **title**: "Prototype session: <what was made or changed>", under 70 characters. Use "Session: …" when it wasn't prototyping (research, a spec, a script).
- **summary**: 1–2 sentences, first person, past tense, outcome first, design language rather than code language. Good: "Built the CSV upload error states for bulk enrollment and added inline validation copy." Bad: "Edited ErrorState.tsx and fixed a TypeScript error."
- **actions**:
  - `log_update` with today's local date (or the chunk's last activity date), `kind: "progress"`, or `"milestone"` when the user said it's done, ready for review or shipped. Text: the summary, under 240 characters.
  - Only if the user said so in the session: `progressTo` (e.g. "about 80% there") or `statusTo` ("ready for review" → `review`, "handing off to dev" → `handoff`, "shipped" → `shipped`). This makes it medium risk.
  - `complete_requirement` for an open requirement of the matched project the session clearly finished (medium risk).
  - `add_link` for each new preview deployment, PR (`prLinks`) or Figma link in `links` that the project doesn't already have. Prototype previews → kind `prototype`; PRs → `other`; Figma → `design` or `prototype`.
- **source**: `kind: "claude-code"`, `ref`: session id, `url`: the first PR link or null, `label`: the folder name, `occurredAt`: the chunk's last activity time.
- **id**: `x_cc_<first 12 characters of the session id without dashes>_<YYYYMMDDHHmm of occurredAt>`.

## Risk

Low when the actions are only a plain `log_update` and/or `add_link` and the project matched by anchor; medium otherwise (see `records.md`).

## Cursor

Set `connectors/claude-code.cursor` to the latest `lastActivityAt` processed.
