---
name: workfile-report
description: Draft the weekly Workfile report of the last 7 days and get it to the chosen person on Teams, either sent through the user's Teams workflow (when set to send without asking) or filed in the Workfile Inbox for approval. Run by the weekly scheduled task on the day the user picked.
---

# Weekly report

**PLUGIN** means the folder two levels above this skill's base directory. Read `PLUGIN/reference/records.md` for record shapes. Don't ask questions; nobody is at the keyboard.

## 1. Should it run?

1. Read `~/.workfile/config.json` (stop with a one-line message if it's missing).
2. Read `meta/settings`. If `report.enabled` isn't true, stop: "Weekly report is off."
3. The period is the 7 days ending yesterday (local dates): `periodEnd` = yesterday, `periodStart` = 7 days ago. Id `w_<periodStart>`.
4. If `reports/w_<periodStart>` already exists, stop. This week's report is done.

## 2. Gather

- `updates` dated within the period. Leave out automatic entries that have no text.
- The projects those updates belong to, plus every active project (not archived, not shipped more than a week ago): stage, progress, due date.
- `goals` titles, to mention goal progress only where it moved.
- Pending blockers: updates of kind `blocker` in the period, and high-risk pending Inbox items.

## 3. Write it

Write in the user's voice: first person, plain, specific, no filler. Under 300 words of Markdown:

```markdown
## Highlights
- (3–5 bullets: outcomes first; ship dates, decisions, test results)

## Progress by project
- **Device enrollment redesign**: Review, 70%. Wizard finished; next, PM sign-off.
- (one line per active project that moved, plus anything due within two weeks)

## Blockers and asks
- (only real ones; write "None." when there are none)

## Next week
- (2–4 bullets drawn from due dates, open requirements and the latest updates)
```

Only state what's in Workfile. Never invent work. If the week was quiet, say so in one line and keep the report short.

**Title**: "Week of <periodStart as "Oct 27">".

## 4. Save

Create `reports/w_<periodStart>` with `status: "draft"`, the title, body and period, and `recipientName` / `recipientEmail` from `report` settings.

## 5. Deliver

1. Check the Teams workflow: `node PLUGIN/scripts/send-teams.mjs --check`, and record it in `connectors/teams-workflow`.
2. **Send now** when `report.delivery` is `"auto"` and the check says ready: write the body to a temp file and run `node PLUGIN/scripts/send-teams.mjs --title "<title>" --file <tmp>`, then delete the temp file.
   - Sent: update the report to `status: "sent"`, `sentAt` now, `sentVia: "teams-workflow"`. Create an Inbox record `x_report_w_<periodStart>` with `status: "auto"`, `risk: "high"`, `source: { "kind": "agent", "ref": "w_<periodStart>", "url": null, "label": "Weekly report", "occurredAt": now }`, title "Sent your weekly report to <name>", a one-sentence summary, `actions: [{ "type": "send_report", "reportId": "w_<periodStart>" }]` and empty `applied` lists.
   - Failed: update the report to `status: "failed"` with the error in `note`, and fall through to "Ask first".
3. **Ask first** (otherwise): create a pending Inbox proposal `x_report_w_<periodStart>`: `risk: "high"`, the same source, title "Weekly report for <name> is ready", summary "Covers <period>: <n> updates across <m> projects.", `why` "Your weekly report is set for <weekday>s at <time>.", `confidence: 1`, `projectId: null`, `actions: [{ "type": "send_report", "reportId": "w_<periodStart>" }]`. When the user approves it in Workfile, the hourly sync sends it through the workflow, or they send it themselves from the pre-filled Teams chat.
4. Notify once (PushNotification, `status: "proactive"`): "Workfile: your weekly report for <name> is ready to review." or "Workfile: weekly report sent to <name>." Fall back to `osascript` if it isn't delivered.

If `recipientEmail` is empty, still draft the report and say in the notification that it needs a recipient (Workfile › Connections › Weekly report).
