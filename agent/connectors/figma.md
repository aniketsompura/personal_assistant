# Connector: Figma

Logs named versions and comments on the Figma files linked to the user's projects, and notices files that changed with nothing logged.

**Source kind:** `figma` · **Default mode:** auto · **Works on:** any Mac with a Figma access token (if SOTI allows them)

Figma's own Claude connector reads designs (frames, screenshots, variables) but not version history or comments, so this connector uses Figma's REST API with a personal access token kept in the macOS Keychain.

## What to read

1. Collect the files to watch: every active project's links whose URL matches `figma.com/(design|file|proto|board)/<key>/…`. The key is the path segment after the type. Map key → project(s).
2. If there are none, record `lastMessage: "No Figma links on any project yet."` (status ok) and stop.
3. Run:
   ```
   node PLUGIN/scripts/figma-activity.mjs --since "<cursor or 24 hours ago>" <key> <key> …
   ```
   It prints `me`, and per file: `name`, `lastModified`, `versions` (id, at, label, description, by) and `comments` (id, at, by, byMe, reply, resolved, text). If it prints `{"error": "no-token"}`, record `lastStatus: "error"`, `lastMessage: "No Figma token yet. See Connections › Figma › How to connect."` and stop. List any `errors` in `lastMessage`.

## What to propose

- **Named version** (a version with a non-empty `label`): one proposal per version. `log_update`, `kind: "milestone"`, text "Saved “<label>” in <file name>" plus the description if it adds meaning. Low risk. Id `x_fg_<version id>`. `source.url`: the project's link to that file. `source.label`: the file name.
- **Comments from others** (`byMe` false): one proposal per file per run, summarizing what people asked or flagged in one or two sentences, naming who. `log_update`, `kind: "feedback"`. Low risk. Id `x_fgc_<file key>_<latest comment id>`. Don't quote more than a few words.
- **Changed but nothing logged**: if `lastModified` is newer than the project's latest update by at least 2 days and there's no named version, file one medium-risk proposal per project per week: title "<file name> changed; log what moved?", a `log_update` whose text says the file was updated (the user will edit it), `why` naming the dates. Id `x_fgn_<file key>_<ISO week, e.g. 2026W45>`.
- Unnamed autosave versions are noise. Ignore them.

## Cursor

Set `connectors/figma.cursor` to this run's start time.
