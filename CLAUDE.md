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
