---
name: workfile-brief
description: Write today's Workfile morning brief (what's due, today's project meetings, what's waiting in the Inbox, one suggested focus), show it on the Workfile Today page and send a one-line notification. Run by the 08:45 scheduled task.
---

# Morning brief

**PLUGIN** means the folder two levels above this skill's base directory. Read `PLUGIN/reference/records.md` for record shapes. Don't ask questions; nobody is at the keyboard.

## 1. Load

1. Read `~/.workfile/config.json` (stop with a one-line message if it's missing).
2. From Workfile (ArtifactData): `projects`, `updates` from the last 14 days, `inbox` (pending), `connectors`, `meta/settings`.
3. If the account is `work` and `outlook-calendar` isn't off: use the Microsoft 365 connector's `outlook_calendar_search` for today's events. Keep the ones that match a project (keywords, title, team names). Skip private and declined events.

## 2. Work out

- **Due**: active projects overdue or due within 7 days, nearest first.
- **Quiet**: active projects (not shipped or on hold) with no update for `staleAfterDays` days.
- **Waiting**: pending Inbox proposals: the count, and the most important high-risk one.
- **Meetings**: today's project meetings, with time and project.
- **Focus**: one suggestion, picking the item that most needs the user today (an overdue item beats a quiet one; a meeting to prepare beats both).

## 3. Write `meta/brief`

`set` `meta/brief` to `{ "generatedAt": "<now>", "body": "<markdown>" }`. Keep the body under 120 words:

```markdown
**Today**
- Device enrollment is due Thursday; it's in review at 70%.
- New from Priya: DES-142, due Friday (in your Inbox).
- Admin search has been quiet for 12 days.

**Meetings**: 14:00 Enrollment design review.

**Suggested focus**: get Priya's sign-off on the enrollment wizard before the review.
```

Leave out sections with nothing in them. Facts only; no invented work.

## 4. Notify

Send one PushNotification (`status: "proactive"`), under 200 characters, e.g. "Workfile: 2 due this week, 3 waiting for your OK, design review at 14:00." Fall back to `osascript -e 'display notification "<text>" with title "Workfile"'` if it isn't delivered. Skip the notification when there's nothing due, waiting or scheduled.
