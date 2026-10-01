import * as stylex from '@stylexjs/stylex';

/* A small stroke icon set (16px grid, 1.6 stroke), drawn for Workfile. */

const PATHS = {
  today: 'M8 2.5v1.2M8 12.3v1.2M2.5 8h1.2M12.3 8h1.2M4.1 4.1l.85.85M11.05 11.05l.85.85M4.1 11.9l.85-.85M11.05 4.95l.85-.85M8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z',
  goals: 'M8 13.5A5.5 5.5 0 1 0 8 2.5a5.5 5.5 0 0 0 0 11zM8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8 8h.01',
  projects: 'M2.5 3.5h4v4h-4zM9.5 3.5h4v4h-4zM2.5 9.5h4v3h-4zM9.5 9.5h4v3h-4z',
  journal: 'M3.5 2.5h7.5a1.5 1.5 0 0 1 1.5 1.5v9.5H5a1.5 1.5 0 0 1-1.5-1.5zM3.5 12a1.5 1.5 0 0 1 1.5-1.5h7.5M6 5.5h4M6 7.5h2.5',
  settings: 'M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12.7 9.6l.9.7-1.2 2.1-1.1-.4a4.6 4.6 0 0 1-1.3.8L9.8 14H7.4l-.2-1.2a4.6 4.6 0 0 1-1.3-.8l-1.1.4-1.2-2.1.9-.7a4.6 4.6 0 0 1 0-1.5l-.9-.7 1.2-2.1 1.1.4c.4-.3.8-.6 1.3-.8L7.4 2h2.4l.2 1.2c.5.2.9.5 1.3.8l1.1-.4 1.2 2.1-.9.7a4.6 4.6 0 0 1 0 1.5z',
  plus: 'M8 3v10M3 8h10',
  search: 'M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM10.6 10.6 14 14',
  chevronRight: 'M6 3.5 10.5 8 6 12.5',
  chevronDown: 'M3.5 6 8 10.5 12.5 6',
  chevronLeft: 'M10 3.5 5.5 8l4.5 4.5',
  check: 'M3 8.5 6.5 12 13 4.5',
  x: 'M4 4l8 8M12 4l-8 8',
  more: 'M3.5 8h.01M8 8h.01M12.5 8h.01',
  link: 'M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.6.6M9.2 6.8a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.6-.6',
  external: 'M9.5 2.5h4v4M13.5 2.5 7.5 8.5M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3',
  trash: 'M2.5 4.5h11M6.5 4.5V3a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1.5M4 4.5l.6 8.1a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8.1',
  pin: 'M9.5 2.5l4 4-2 .5-2.5 2.5-.5 3-5-5 3-.5L9 4.5zM5.5 10.5 2.5 13.5',
  archive: 'M2.5 3.5h11v3h-11zM3.5 6.5v6a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-6M6.5 9h3',
  calendar: 'M3 4h10v9.5H3zM3 7h10M5.5 2.5v3M10.5 2.5v3',
  flag: 'M3.5 14V2.5M3.5 3h8l-1.5 3 1.5 3h-8',
  sparkles: 'M7 2.5l1.1 3.4L11.5 7 8.1 8.1 7 11.5 5.9 8.1 2.5 7l3.4-1.1zM12 10l.5 1.5L14 12l-1.5.5L12 14l-.5-1.5L10 12l1.5-.5z',
  arrowLeft: 'M13 8H3M7 4 3 8l4 4',
  arrowRight: 'M3 8h10M9 4l4 4-4 4',
  menu: 'M2.5 4.5h11M2.5 8h11M2.5 11.5h11',
  board: 'M2.5 3h3v10h-3zM6.5 3h3v6.5h-3zM10.5 3h3v8h-3z',
  list: 'M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01',
  note: 'M3.5 2.5h6l3 3v8h-9zM9.5 2.5v3h3M5.5 8.5h5M5.5 11h3.5',
  clock: 'M8 13.5A5.5 5.5 0 1 0 8 2.5a5.5 5.5 0 0 0 0 11zM8 5v3l2 1.5',
  alert: 'M8 2.5 14 13H2zM8 6.5v3M8 11.3h.01',
  cloud: 'M4.5 12.5a3 3 0 0 1-.4-6A4 4 0 0 1 11.8 6a3.2 3.2 0 0 1 .2 6.5z',
  laptop: 'M3.5 4h9v6.5h-9zM1.5 12.5h13',
  download: 'M8 2.5v8M4.5 7 8 10.5 11.5 7M2.5 13.5h11',
  upload: 'M8 10.5v-8M4.5 6 8 2.5 11.5 6M2.5 13.5h11',
  copy: 'M5.5 5.5h8v8h-8zM10.5 5.5v-3h-8v8h3',
  edit: 'M10.5 2.5l3 3-8 8h-3v-3zM9 4l3 3',
  frame: 'M4.5 1.5v13M11.5 1.5v13M1.5 4.5h13M1.5 11.5h13',
  target: 'M8 2v2.5M8 11.5V14M2 8h2.5M11.5 8H14M8 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  checkSquare: 'M3 3h10v10H3zM5.5 8l1.8 1.8L10.5 6.5',
  bolt: 'M9 1.5 3.5 9H8l-1 5.5L12.5 7H8z',
  sun: 'M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1',
  moon: 'M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z',
  monitor: 'M2 3h12v8H2zM6 14h4M8 11v3',
  stop: 'M4.5 4.5h7v7h-7z',
  grip: 'M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01',
  eye: 'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8zM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  undo: 'M4.5 6.5h6a3 3 0 0 1 0 6h-4M7 4 4.5 6.5 7 9',
  command: 'M5.5 5.5h5v5h-5zM5.5 5.5V4a1.5 1.5 0 1 0-1.5 1.5zM10.5 5.5H12A1.5 1.5 0 1 0 10.5 4zM10.5 10.5V12a1.5 1.5 0 1 0 1.5-1.5zM5.5 10.5H4A1.5 1.5 0 1 0 5.5 12z',
} as const;

export type IconName = keyof typeof PATHS;

const styles = stylex.create({
  icon: {
    flexShrink: 0,
    display: 'block',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
});

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.6,
  style,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  style?: stylex.StyleXStyles;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...stylex.props(styles.icon, style)}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
