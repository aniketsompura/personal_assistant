# Workfile

A personal work assistant for a product designer's year. Track your annual goals, the projects that move them, dated updates, requirements, prototype and design links, and notes, all in one place. Workfile runs as a **Claude Artifact**, so your data lives in the artifact's own database and Claude can read and update it when you ask in chat.

Built with **React 19**, **StyleX** and **Motion**, bundled by **Vite** into a single HTML file.

---

## What's inside

| Page | What it does |
| --- | --- |
| **Today** | A briefing ("2 projects need you…"), the review cycle drawn as a ruler with a redline at today, quick log, needs-attention list, and goal pulse with pace markers. |
| **Goals** | Your annual goals with success measures. Progress is the average of linked projects (or set by hand), compared against an even pace through the year. |
| **Goal page** | Linked projects, an evidence timeline built from their updates, success-measure checklist, and a Claude-drafted self-review. |
| **Projects** | Board by stage (Idea → Discovery → Design → Review → Handoff → Shipped, plus On hold) with drag and drop, or a sortable list. |
| **Project page** | Overview, dated **updates** (a version history), **requirements** (MoSCoW), **notes** (Markdown with templates), **links** (prototypes, Figma, docs, tickets), and a design-tool-style **properties** panel. |
| **Journal** | Everything logged, grouped by ISO week; general entries and notes; Claude-drafted recaps for your 1:1. |
| **Settings & data** | Profile, review cycle dates, theme, export / import, erase. |

Updates drive the project. Logging an update can move progress and stage, and changes made in the properties panel are recorded on the timeline automatically. When Workfile runs inside Claude, **Suggest changes** reads a free-text update and proposes the progress, stage and requirement changes it implies.

Light and dark themes follow your system (or the Claude viewer's theme). The sun/moon button in the top bar overrides it; Settings › Appearance switches back to "Match system". `⌘K` opens search and commands.

---

## Run it locally

```bash
npm install
npm run dev
```

Locally, data is saved in your browser's `localStorage` (the sidebar shows "Saved in this browser"). Claude features are hidden because there is no Claude runtime.

Other scripts:

```bash
npm run typecheck        # TypeScript
npm run build            # static build in dist/ (any static host; data stays in the browser)
npm run build:artifact   # single-file Claude Artifact page in dist-artifact/workfile.html
```

---

## Publish as a Claude Artifact

1. `npm run build:artifact`. This produces `dist-artifact/workfile.html`, with all JS and CSS inlined and no `<html>/<head>/<body>` wrapper, as the Artifact publisher expects.
2. In Claude Code, ask Claude to publish it. The exact call is in [`CLAUDE.md`](CLAUDE.md). It publishes the file with these runtime capabilities:

   ```json
   {
     "db": { "rules": [{ "path": "", "read": "view", "write": "admin" }] },
     "user": {},
     "sample": {},
     "downloads": true
   }
   ```

   - `db`: the artifact's database. Only you (and editors you invite) can write.
   - `user`: lets the page know whether the viewer can edit.
   - `sample`: Claude features (suggest changes, recaps, self-review). They run on the viewer's own Claude account and ask for consent first.
   - `downloads`: the Export button.

3. To ship a new version, rebuild and republish **to the same artifact URL**. The database survives republishes.

---

## Data model

Every record is a plain JSON document. In the Artifact database they live at these paths:

| Path | Shape |
| --- | --- |
| `goals/{id}` | `{ title, description, category, color, measures: [{id, text, done}], progressMode: "auto"\|"manual", manualProgress, order, createdAt, updatedAt }` |
| `projects/{id}` | `{ title, summary, status, priority, progress, goalIds[], startDate, dueDate, team, tags[], requirements: [{id, text, done, level, createdAt}], links: [{id, label, url, kind, createdAt}], pinned, archived, createdAt, updatedAt, lastActivityAt }` |
| `updates/{id}` | `{ projectId \| null, date, text, kind, progressFrom, progressTo, statusFrom, statusTo, auto, createdAt, updatedAt }` |
| `notes/{id}` | `{ projectId \| null, title, body (Markdown), pinned, createdAt, updatedAt }` |
| `meta/settings` | `{ ownerName, role, company, cycleLabel, cycleStart, cycleEnd, staleAfterDays }` |

Enumerations live in [`src/data/types.ts`](src/data/types.ts):

- `status`: idea · discovery · design · review · handoff · shipped · paused
- `priority`: high · medium · low
- `update kind`: progress · decision · feedback · blocker · milestone · status
- `link kind`: prototype · design · doc · research · ticket · other
- `requirement level`: must · should · could
- `goal color`: cobalt · jade · amber · coral · violet · teal · rose · olive

Dates are `YYYY-MM-DD`; timestamps are ISO strings. Every document read from storage goes through [`src/data/normalize.ts`](src/data/normalize.ts), so a record Claude writes with missing fields still renders.

### Ask Claude to update your Workfile

Because the data lives in the artifact's database, you can work with it from chat:

> "Add my FY 2026–27 goals to Workfile: …"
> "Log an update on Device enrollment: usability test done, move it to Review at 70%."
> "Which projects haven't had an update in two weeks?"

---

## Moving to your company Claude account

1. In the current Workfile, open **Settings & data › Export JSON** and keep the file.
2. Clone this repo in your company environment, then `npm install` and `npm run build:artifact`.
3. Ask Claude (company account) to publish `dist-artifact/workfile.html` following `CLAUDE.md`.
4. Open the new artifact, go to **Settings & data › Import**, choose the file and **Replace everything**.

The storage layer is one interface ([`src/data/adapters.ts`](src/data/adapters.ts)). To use a different backend later (a company API, Supabase, …), implement `StorageAdapter`; the rest of the app doesn't change.

---

## Project structure

```
src/
  App.tsx                 shell: sidebar, top bar, routing, page transitions
  app/                    router, dialogs (new goal/project/update), sidebar, ⌘K palette, theme
  data/                   types, normalizers, storage adapters, store (actions + undo)
  lib/                    dates, insights (pace, attention), Claude runtime + assistant prompts
  components/             UI kit: buttons, inputs, frames, progress, tabs, overlays, timeline, checklist…
  views/                  Today, Goals, GoalDetail, Projects, ProjectDetail (+ project/), Journal, Settings
  styles/                 StyleX tokens (light + dark), forced themes, global reset
scripts/to-artifact.mjs   turns the Vite build into an Artifact page
```

### Design language

Workfile borrows from the tools a designer lives in: a dotted canvas, white "frames" with mono name tags, selection handles on hover, a layers panel, an inspector, rulers, and a **redline** that marks where an even pace through the year would put you. All colors are StyleX tokens in [`src/styles/tokens.stylex.ts`](src/styles/tokens.stylex.ts), with dark values for every one. Motion is spring-based and respects `prefers-reduced-motion`.
