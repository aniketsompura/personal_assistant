# Workfile: notes for Claude

Workfile is a React 19 + StyleX + Motion app for a product designer's goals, projects, updates and notes. It ships as a single-file Claude Artifact whose data lives in the artifact's `db`.

## Build & check

```bash
npm install
npm run typecheck
npm run build:artifact   # -> dist-artifact/workfile.html
npm run dev              # local, data in localStorage
```

## Publishing the artifact

- First publish: Artifact tool, `action: "publish"`, `file_path: "dist-artifact/workfile.html"`, `icon: "target"`, `description: "Personal work assistant for annual goals, projects, updates and notes."`, and
  ```json
  "capabilities": {
    "db": { "rules": [{ "path": "", "read": "view", "write": "admin" }] },
    "user": {},
    "sample": {},
    "downloads": true
  }
  ```
- Redeploy: rebuild, then publish the same file with `url` set to the existing artifact. Omit `capabilities` (keeps them) and `icon`.
- Current artifact (personal account): https://claude.ai/artifact/YRbE5hztEJLmfaWPGorjhm. A copy published from another account is a separate artifact with its own database; record its URL here instead.

## Updating the app safely (never lose the user's data)

The user's data lives in the artifact's database, not in this repo. A code change can't erase it, but a careless publish or data-model change can disconnect it or hide it. Follow this checklist for every change.

**Before publishing**
1. Develop and test with `npm run dev`. It saves to browser storage and never touches the artifact's database.
2. `npm run typecheck` and `npm run build:artifact` must pass.
3. If the change touches data shapes, ask the user to use **Settings & data › Export JSON** first, so there's a backup.

**Publishing**
- Always republish to the artifact URL recorded above (pass it as `url`). Publishing without `url` creates a new artifact with an empty database, and the user's data stays behind on the old one.
- On a redeploy, omit `capabilities` unless you're deliberately changing them. A non-empty object replaces the whole set, and `{}` removes database access. If you do change them, restate every capability, including the `db` rule.
- Never delete the artifact, and never run the app's "Erase all data". Don't write test documents to the real database, apart from a probe with a distinct id that you delete straight after.

**Changing the data model**
- Adding a field is safe: add it to `src/data/types.ts` and give it a default in `src/data/normalize.ts`. Existing records pick up the default.
- When renaming or removing a field, changing its type, or changing enum values, keep reading the old shape in `normalize.ts` (map old to new) so existing records still render. Don't depend on rewriting stored records.
- If a one-time migration of stored records is truly needed, ask the user first, have them export, then run it with the ArtifactData tool in batches with `if_version` pins.
- Never rename the collections (`goals`, `projects`, `updates`, `notes`, `meta/settings`) or change the ids of existing records.
- When the export shape changes, bump `schemaVersion` in `ExportFile` and keep `validateExport` in `src/data/store.tsx` accepting older files.

**After publishing**
- Confirm existing data is still there: one ArtifactData `list` of `projects` is enough. Tell the user the new version is live at the same link.

## Reading and writing the user's data (ArtifactData tool)

Collections: `goals`, `projects`, `updates`, `notes`; settings doc `meta/settings`. Field shapes are in `README.md` › Data model and `src/data/types.ts`.

Rules when writing:

- Ids: `<prefix>_<base36 time><random>` with prefixes `g_`, `p_`, `u_`, `n_`, and `m_`/`r_`/`l_` for nested items. Letters, digits and `_` only.
- Always set `createdAt` / `updatedAt` (ISO timestamps). Dates are `YYYY-MM-DD`.
- Logging an update on a project: create `updates/{id}` with `progressFrom/progressTo` and `statusFrom/statusTo` (null when unchanged), `auto: false`, then `update` the project's `progress`, `status`, `updatedAt` and `lastActivityAt` to match. That's what the app does in `actions.addUpdate`.
- Linking a project to a goal means adding the goal id to `projects/{id}.goalIds`. Goal progress is computed, so don't store it (except `manualProgress` when `progressMode` is `manual`).
- Use a `batch` for more than a couple of writes. Never invent the user's goals or projects; write only what they gave you.

## Code conventions

- Styles: StyleX only (`stylex.create` in the same file). Colors, type, spacing and motion come from `src/styles/tokens.stylex.ts`; never hard-code a color that only works in one theme. Forced light/dark themes are in `themes.stylex.ts`.
- `src/styles/global.css` holds only the document ground and a reset inside `@layer reset` (declared first in `index.html` so StyleX layers win).
- Animation: `motion/react` for presence, layout and springs; CSS transitions for hover and press. Wrap nothing in animations that hide content at rest.
- Artifact frame limits: no `alert/confirm/prompt` (use `useConfirm` or undo toasts), no `<a download>` (use the `downloads` capability), links open with `target="_blank"`, routing is in-memory (`src/app/router.tsx`).
- Storage goes through `StorageAdapter` (`src/data/adapters.ts`); one write at a time per document; every read passes through `src/data/normalize.ts`.
