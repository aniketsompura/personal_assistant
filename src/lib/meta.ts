import type { GoalColor, LinkKind, Priority, ProjectStatus, RequirementLevel, UpdateKind } from '../data/types';

/** Goal swatches. Mid-tone hues that read on both the light and dark canvas. */
export const GOAL_HEX: Record<GoalColor, string> = {
  cobalt: '#4C6FFF',
  jade: '#16A37A',
  amber: '#E09A0B',
  coral: '#F0614F',
  violet: '#8D63F2',
  teal: '#0FA3B8',
  rose: '#E04C8D',
  olive: '#82A01E',
};

export const STATUS_META: Record<ProjectStatus, { label: string; hint: string; hex: string }> = {
  idea: { label: 'Idea', hint: 'Not started; worth exploring', hex: '#8A90A0' },
  discovery: { label: 'Discovery', hint: 'Research, problem framing', hex: '#0FA3B8' },
  design: { label: 'Design', hint: 'Exploring and refining solutions', hex: '#4C6FFF' },
  review: { label: 'Review', hint: 'Critique, stakeholder sign-off', hex: '#8D63F2' },
  handoff: { label: 'Handoff', hint: 'Specs and support for engineering', hex: '#E09A0B' },
  shipped: { label: 'Shipped', hint: 'Live for customers', hex: '#16A37A' },
  paused: { label: 'On hold', hint: 'Parked for now', hex: '#8A90A0' },
};

/** Board column order. */
export const STATUS_FLOW: ProjectStatus[] = ['idea', 'discovery', 'design', 'review', 'handoff', 'shipped', 'paused'];

export const PRIORITY_META: Record<Priority, { label: string; bars: number }> = {
  high: { label: 'High', bars: 3 },
  medium: { label: 'Medium', bars: 2 },
  low: { label: 'Low', bars: 1 },
};

export const UPDATE_KIND_META: Record<UpdateKind, { label: string; hex: string }> = {
  progress: { label: 'Progress', hex: '#4C6FFF' },
  decision: { label: 'Decision', hex: '#8D63F2' },
  feedback: { label: 'Feedback', hex: '#0FA3B8' },
  blocker: { label: 'Blocker', hex: '#E5484D' },
  milestone: { label: 'Milestone', hex: '#16A37A' },
  status: { label: 'Status', hex: '#8A90A0' },
};

export const LINK_KIND_META: Record<LinkKind, { label: string; plural: string }> = {
  prototype: { label: 'Prototype', plural: 'Prototypes' },
  design: { label: 'Design file', plural: 'Design files' },
  doc: { label: 'Doc', plural: 'Docs & specs' },
  research: { label: 'Research', plural: 'Research' },
  ticket: { label: 'Ticket', plural: 'Tickets' },
  other: { label: 'Link', plural: 'Other links' },
};

export const LEVEL_META: Record<RequirementLevel, { label: string; short: string }> = {
  must: { label: 'Must have', short: 'Must' },
  should: { label: 'Should have', short: 'Should' },
  could: { label: 'Could have', short: 'Could' },
};

export const GOAL_CATEGORY_SUGGESTIONS = ['Craft', 'Impact', 'Collaboration', 'Leadership', 'Growth', 'Innovation'];
