# Connector: Jira

Picks up tickets PMs assign to the user and follows the tickets linked to their projects.

**Source kind:** `jira` · **Default mode:** ask · **Works on:** the work Mac, company Claude account only

Uses Claude's **Atlassian** connector. Find its tools with ToolSearch (try `atlassian jira`). Use read tools only (search, get issue, get comments). **Never** use create, edit, transition, comment, assign or any `executeWrite` / `executeDestructive` tool.

If no Atlassian tools are available, record `lastStatus: "error"`, `lastMessage: "The Atlassian connector isn't connected in this Claude account."` and stop.

## What to read (since the cursor, or 24 hours on a first run)

1. **Assigned to the user:** JQL `assignee = currentUser() AND updated >= "<cursor as yyyy-MM-dd HH:mm>" ORDER BY updated DESC` (limit 50).
2. **Tracked tickets:** every Jira key in projects' `anchors.jiraKeys` and every key in their `ticket` links (`…/browse/KEY-123`). JQL `key in (…) AND updated >= "…"`. Also include child issues of tracked epics: `parent in (…) AND updated >= "…"`.
3. For each issue you need: key, summary, status, assignee, reporter, priority, due date, parent or epic, created, updated, and comments added since the cursor (author, created, a short gist).

## What to propose

- **Newly assigned, not tracked by any project** (assigned since the cursor and its key isn't on any project): **high risk**.
  - If its parent epic is tracked by a project, propose on that project: `add_requirement` (the ticket summary, `must` if priority is High or above), `add_anchor` (`jiraKeys`, the key), `add_link` (`ticket`).
  - Otherwise: `create_project` (title from the summary, a one-line summary, `status: "discovery"`, `dueDate` from Jira, `goalIds` only if a goal clearly fits), `add_anchor`, `add_link`.
  - Title "New ticket from <reporter>: <summary>". Id `x_jira_<KEY>_assigned`.
- **Status change on a tracked ticket:** low risk. `log_update` "<KEY> moved to <status>", `kind: "progress"`, or `"milestone"` when it reached Done. If the new status clearly means a Workfile stage (In Design → `design`, In Review → `review`, Ready for Dev → `handoff`, Done → `shipped`) and the project isn't there yet, add `statusTo` instead, which makes it medium risk. Id `x_jira_<KEY>_<updated YYYYMMDDHHmm>`.
- **New comments by others on a tracked ticket:** low risk, one per ticket per run. `log_update` with `kind: "feedback"`, summarizing who said what in one or two sentences. Id `x_jirac_<KEY>_<latest comment id>`.
- **Due date added or moved on a tracked ticket:** high risk. `log_update` stating old → new date, `kind: "blocker"` if it moved earlier, otherwise `"progress"`. Mention it in `why`. Id `x_jirad_<KEY>_<new due date>`.

`source`: `kind: "jira"`, `ref`: the key, `url`: the issue's browse URL, `label`: the key, `occurredAt`: the issue's updated time.

## Cursor

Set `connectors/jira.cursor` to this run's start time.
