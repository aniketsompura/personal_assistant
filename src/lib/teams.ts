/*
 * Teams hand-off without any write access: a deep link that opens a chat with
 * someone and pre-fills the message. You review it in Teams and press send.
 * Format documented by Microsoft: https://teams.microsoft.com/l/chat/0/0?users=…&message=…
 */

/** Markdown to plain text that reads well in a chat message. */
export function markdownToChat(md: string): string {
  return md
    .replace(/\r\n?/g, '\n')
    .replace(/^#{1,6}\s+(.*)$/gm, (_, h: string) => h.toUpperCase())
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\s)[*_]([^*_\n]+)[*_]/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^\s*[-*+]\s+\[( |x|X)\]\s+/gm, '• ')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Teams clients cut very long deep links, so the pre-filled text is capped. */
const MAX_MESSAGE = 1500;

export function teamsChatLink(email: string, markdown: string): string | null {
  const to = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return null;
  let message = markdownToChat(markdown);
  if (message.length > MAX_MESSAGE) message = `${message.slice(0, MAX_MESSAGE - 40).trimEnd()}\n… (full report in Workfile)`;
  return `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(to)}&message=${encodeURIComponent(message)}`;
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Status doc the agent writes when your Teams workflow webhook is set up. */
export const TEAMS_WORKFLOW_ID = 'teams-workflow';
