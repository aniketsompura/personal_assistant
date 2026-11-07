import type { ConnectorMode, SourceKind } from '../data/types';
import type { IconName } from '../components/Icon';

/*
 * The plug board. Each entry is one work tool Workfile can watch.
 *
 * The app shows these on the Connections page; the Workfile Agent (agent/)
 * follows `agent/connectors/<id>.md` to read the tool and file proposals.
 * To plug in a new tool: add an entry here and a matching instruction file.
 * See docs/automation-plan.md › Plugging in a tool.
 */

export type ConnectorId = 'claude-code' | 'figma' | 'jira' | 'outlook-calendar' | 'teams' | 'outlook-mail';

export interface ConnectorDef {
  id: ConnectorId;
  source: SourceKind;
  name: string;
  icon: IconName;
  /** One sentence: what it does for you. */
  summary: string;
  reads: string[];
  produces: string[];
  /** How the agent reaches the tool. */
  via: string;
  setup: string[];
  defaultMode: ConnectorMode;
  /** The most autonomy allowed. Teams and mail always ask. */
  maxMode: ConnectorMode;
  /** `work`: only on the work Mac with the company Claude account. */
  scope: 'any' | 'work';
  phase: 1 | 2 | 3;
}

export const CONNECTORS: ConnectorDef[] = [
  {
    id: 'claude-code',
    source: 'claude-code',
    name: 'Claude Code',
    icon: 'terminal',
    summary: 'Turns your prototyping sessions into dated updates on the right project.',
    reads: ['What you asked Claude to build or change', 'Files and commits in the session’s folder', 'Preview and PR links'],
    produces: ['Progress updates', 'New links', 'Requirements marked done (asks first)'],
    via: 'Workfile Agent plugin on your Mac',
    setup: [
      'Install the Workfile Agent plugin: ask Claude Code to install it from github.com/aniketsompura/personal_assistant, or in Terminal run claude plugin marketplace add aniketsompura/personal_assistant, then claude plugin install workfile-agent@workfile.',
      'In Claude Code, run /workfile-agent:workfile-setup and paste this Workfile’s link when asked.',
      'Add your prototype folders to projects under Tracking, or approve the first proposal from a new folder.',
    ],
    defaultMode: 'auto',
    maxMode: 'auto',
    scope: 'any',
    phase: 1,
  },
  {
    id: 'figma',
    source: 'figma',
    name: 'Figma',
    icon: 'frame',
    summary: 'Logs named versions and comments on the Figma files linked to your projects.',
    reads: ['Named versions', 'New comments', 'Last edited time of linked files'],
    produces: ['Milestones from named versions', 'Feedback from comments', 'Nudges when a file changed but nothing was logged'],
    via: 'Figma access token stored in your macOS Keychain',
    setup: [
      'In Figma, open Settings › Security and create a personal access token with read access to file content, versions and comments.',
      'In Terminal, run: security add-generic-password -a "$USER" -s workfile-figma -w   (paste the token when asked; it never goes into Workfile).',
      'Add Figma links to your projects. Those files are the ones watched.',
    ],
    defaultMode: 'auto',
    maxMode: 'auto',
    scope: 'any',
    phase: 2,
  },
  {
    id: 'jira',
    source: 'jira',
    name: 'Jira',
    icon: 'checkSquare',
    summary: 'Picks up tickets PMs assign you and follows the ones linked to your projects.',
    reads: ['Issues assigned to you', 'Status changes and comments on linked issues', 'Due dates'],
    produces: ['New project or requirement suggestions (asks first)', 'Status-change updates', 'Feedback', 'Deadline warnings'],
    via: 'Claude’s Atlassian connector (company account)',
    setup: [
      'In your company Claude account, connect the Atlassian connector (claude.ai › Settings › Connectors). Your Claude admin may need to allow it.',
      'Add Jira links or keys to projects under Tracking.',
      'Switch Jira on here. New assignments always ask first.',
    ],
    defaultMode: 'ask',
    maxMode: 'auto',
    scope: 'work',
    phase: 2,
  },
  {
    id: 'outlook-calendar',
    source: 'outlook-calendar',
    name: 'Outlook calendar',
    icon: 'calendar',
    summary: 'Preps you for project meetings and asks what came out of them afterwards.',
    reads: ['Meetings whose title or attendees match a project', 'Free time for focus blocks'],
    produces: ['Morning meeting prep', 'Follow-up prompts after reviews', 'Focus-time suggestions you book with one click'],
    via: 'Claude’s Microsoft 365 connector (company account, read-only)',
    setup: [
      'In your company Claude account, connect the Microsoft 365 connector. Your Claude admin may need to allow it.',
      'Add keywords to projects under Tracking (the names used in meeting titles).',
    ],
    defaultMode: 'ask',
    maxMode: 'ask',
    scope: 'work',
    phase: 3,
  },
  {
    id: 'teams',
    source: 'teams',
    name: 'Teams',
    icon: 'chat',
    summary: 'Spots asks, decisions and feedback about your projects in chats and channels.',
    reads: ['Chats and channels that mention a project’s keywords', 'Messages sent to you'],
    produces: ['Tasks from asks (“specs by Friday?”)', 'Decisions', 'Stakeholder feedback'],
    via: 'Claude’s Microsoft 365 connector (company account, read-only)',
    setup: [
      'Connect the Microsoft 365 connector in your company Claude account.',
      'Add keywords and the chats or channels to watch under each project’s Tracking.',
      'Teams always asks before logging anything.',
    ],
    defaultMode: 'off',
    maxMode: 'ask',
    scope: 'work',
    phase: 3,
  },
  {
    id: 'outlook-mail',
    source: 'outlook-mail',
    name: 'Outlook mail',
    icon: 'mail',
    summary: 'Captures approvals and decisions from email threads about your projects.',
    reads: ['Threads that mention a project’s keywords', 'Mail from people on a project’s team'],
    produces: ['Decisions and approvals', 'Feedback'],
    via: 'Claude’s Microsoft 365 connector (company account, read-only)',
    setup: [
      'Connect the Microsoft 365 connector in your company Claude account.',
      'Add keywords to projects under Tracking.',
      'Mail always asks before logging anything.',
    ],
    defaultMode: 'off',
    maxMode: 'ask',
    scope: 'work',
    phase: 3,
  },
];

export const CONNECTOR_BY_ID = Object.fromEntries(CONNECTORS.map((c) => [c.id, c])) as Record<ConnectorId, ConnectorDef>;

/** How each source shows up on timeline entries and inbox cards. */
export const SOURCE_META: Record<SourceKind, { label: string; icon: IconName }> = {
  manual: { label: 'You', icon: 'edit' },
  'claude-code': { label: 'Claude Code', icon: 'terminal' },
  figma: { label: 'Figma', icon: 'frame' },
  jira: { label: 'Jira', icon: 'checkSquare' },
  teams: { label: 'Teams', icon: 'chat' },
  'outlook-mail': { label: 'Outlook', icon: 'mail' },
  'outlook-calendar': { label: 'Calendar', icon: 'calendar' },
  agent: { label: 'Workfile Agent', icon: 'sparkles' },
};

export const MODE_LABEL: Record<ConnectorMode, string> = {
  off: 'Off',
  ask: 'Ask me first',
  auto: 'Log automatically',
};

/** Clamps a stored mode to what the connector allows. */
export function effectiveMode(def: ConnectorDef, stored: ConnectorMode | undefined): ConnectorMode {
  const mode = stored ?? def.defaultMode;
  if (mode === 'auto' && def.maxMode !== 'auto') return def.maxMode;
  return mode;
}
