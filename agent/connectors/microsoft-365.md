# Connector: Microsoft 365 (Outlook calendar, Teams, Outlook mail)

Three sources through Claude's **Microsoft 365** connector: `outlook-calendar`, `teams` and `outlook-mail`. Each has its own mode in Workfile. **None of them may ever apply anything automatically.** Every proposal is `pending`.

**Works on:** the work Mac, company Claude account only.

Find the tools with ToolSearch (try `microsoft 365 outlook teams`). The connector is read-only: `outlook_calendar_search`, `outlook_email_search`, `chat_message_search`, `find_meeting_availability`, `read_resource`, `sharepoint_search`. If they aren't available, record `lastStatus: "error"`, `lastMessage: "The Microsoft 365 connector isn't connected in this Claude account."` on each of the three connectors that isn't off, and stop.

## Privacy rules (stricter than elsewhere)

- Read only what relates to the user's projects: matches on project keywords, channels, Jira keys, project titles or people on a project's team.
- Skip anything personal, HR, compensation, medical, legal, or marked confidential, even if it matches.
- Never store message bodies. Store one or two sentences in your own words, naming the sender. Quote at most a few words.
- Use the item's web link as `source.url` when the tool returns one; otherwise null.

## Outlook calendar (`outlook-calendar`)

Look at events that **ended** since the cursor (at most 24 hours back).

- If an event's subject, body preview or attendees match a project (keywords, title, team names, Jira keys), file one **medium-risk** proposal: title "Log the outcome of “<meeting>”?", `log_update` with `kind: "decision"` or `"feedback"` and draft text "Held <meeting> with <first names>." for the user to complete, and `why` naming what matched. Id `x_cal_<event id or subject slug>_<YYYYMMDD>`.
- Skip one-on-ones with no project match, all-day events, declined and cancelled events, and anything over 15 attendees.

Upcoming meetings aren't proposals; the morning brief lists them.

## Teams (`teams`)

Search with `chat_message_search` for messages since the cursor that mention each project's keywords, channel names or Jira keys, plus messages sent directly to the user. Classify each relevant message:

- **An ask of the user** ("can you…", "could you share…", with or without a date): **high risk**. `add_requirement` on the matched project ("Share empty-state specs with Priya (by Fri 14 Nov)", `level: "must"` if dated) plus `log_update` `kind: "feedback"`. Title "<sender> asked: <short ask>".
- **A decision** about a project: **medium**. `log_update` `kind: "decision"`.
- **Feedback** on the user's work: **medium**. `log_update` `kind: "feedback"`.
- Ignore chit-chat, greetings, reactions and anything already handled.

Id `x_teams_<message id>`. One proposal per conversation per run when several messages say the same thing.

## Outlook mail (`outlook-mail`)

Same as Teams, using `outlook_email_search` for mail received since the cursor that matches projects. Typical finds: approvals ("looks good, go ahead"), decisions, deadlines and feedback. Asks and deadlines are **high**; the rest **medium**. Skip newsletters, notifications, calendar invites and automated mail. Id `x_mail_<message id>`.

## Cursors

Set each of `connectors/outlook-calendar`, `connectors/teams`, `connectors/outlook-mail` `.cursor` to this run's start time, but only for those that aren't off.
